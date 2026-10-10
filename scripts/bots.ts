/**
 * Multiplayer simulation against the real Supabase project.
 *
 *   npm run bots -- [count=4]
 *
 * Bots create/join a lobby, race at different speeds, and one cheater tries to
 * submit the whole passage instantly. Verifies server validation, realtime
 * events, and that SQL results match the shared TS ranking/trophy logic.
 *
 * Each run creates `count` anonymous users; Supabase's default limit is
 * 30 anonymous sign-ins per hour per IP (Auth → Rate Limits).
 */
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  awardTrophies,
  computeStats,
  passageLength,
  rankPlayers,
  splitWords,
  type PlayerProgress,
} from '@race/shared';

const env = Object.fromEntries(
  readFileSync(new URL('../client/.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => l.split('=').map((s) => s.trim()) as [string, string]),
);
const URL_ = env.VITE_SUPABASE_URL!;
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY!;

const count = Math.max(3, Number(process.argv[2] ?? 4));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? '✅' : '❌'} ${label}`);
  if (!ok) failures++;
};

interface Bot {
  name: string;
  sb: SupabaseClient;
  id: string;
  wpm: number;
  errorRate: number;
  cheater: boolean;
}

async function makeBot(i: number): Promise<Bot> {
  const sb = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInAnonymously();
  if (error) throw new Error(`sign-in failed: ${error.message}`);
  return {
    name: `Bot${i + 1}`,
    sb,
    id: data.user!.id,
    wpm: 130 - i * 15,
    errorRate: 0.02 + i * 0.03,
    cheater: i === count - 1,
  };
}

async function rpc<T>(bot: Bot, fn: string, args: object): Promise<T> {
  const { data, error } = await bot.sb.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

async function rpcError(bot: Bot, fn: string, args: object): Promise<string | null> {
  const { error } = await bot.sb.rpc(fn, args);
  return error?.message ?? null;
}

async function main() {
  console.log(`Signing in ${count} bots…`);
  const bots = await Promise.all(Array.from({ length: count }, (_, i) => makeBot(i)));
  const [host, second] = bots as [Bot, Bot, ...Bot[]];

  // Lobby -----------------------------------------------------------------
  const [created] = await rpc<{ lobby_id: string; code: string }[]>(host, 'create_lobby', {
    p_name: host.name,
  });
  const { lobby_id: lobbyId, code } = created!;
  console.log(`Lobby ${code}`);

  check((await rpcError(second, 'join_lobby', { p_code: 'ZZZZZZ', p_name: 'x1' })) === 'lobby_not_found', 'unknown code rejected');
  check((await rpcError(second, 'join_lobby', { p_code: code, p_name: '<b>' })) === 'invalid_name', 'invalid name rejected');
  check((await rpcError(second, 'start_race', { p_lobby_id: lobbyId })) !== null, 'non-member cannot start');
  for (const b of bots.slice(1)) await rpc(b, 'join_lobby', { p_code: code.toLowerCase(), p_name: b.name });
  check((await rpcError(second, 'join_lobby', { p_code: code, p_name: host.name })) === 'name_taken', 'duplicate name rejected');
  check((await rpcError(second, 'start_race', { p_lobby_id: lobbyId })) === 'not_host', 'only host can start');

  const { data: members } = await second.sb.from('lobby_players').select('name');
  check(members?.length === count, `member sees all ${count} players via RLS`);

  // Realtime: host listens for server-sent events.
  const events: string[] = [];
  await host.sb.realtime.setAuth();
  const channel = host.sb.channel(`lobby:${code}`, { config: { private: true } });
  for (const ev of ['race:start', 'player:finished', 'race:end']) {
    channel.on('broadcast', { event: ev }, () => events.push(ev));
  }
  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') resolve();
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(err ?? new Error(status));
    });
  });
  check(true, 'host subscribed to private lobby channel');

  // Race ------------------------------------------------------------------
  const raceId = await rpc<string>(host, 'start_race', { p_lobby_id: lobbyId });
  const { data: race } = await second.sb.from('races').select('start_at, passage_id').eq('id', raceId).single();
  const { data: passage } = await second.sb.from('passages').select('text').eq('id', race!.passage_id).single();
  check(!!passage?.text, 'racer can read the race passage');
  const words = splitWords(passage!.text);
  const startAt = Date.parse(race!.start_at);
  console.log(`Race starts in ${((startAt - Date.now()) / 1000).toFixed(1)}s: "${passage!.text.slice(0, 50)}…"`);

  const early = await rpc<{ reason?: string }>(second, 'submit_progress', {
    p_race_id: raceId, p_from_word: 0, p_words: [words[0]], p_keystrokes: 10, p_errors: 0,
  });
  check(early.reason === 'not_started', 'typing before GO rejected');

  await sleep(Math.max(0, startAt - Date.now()) + 300);

  const results = await Promise.all(bots.map((b) => (b.cheater ? cheat(b) : race_(b))));
  void results;

  async function cheat(b: Bot) {
    await sleep(1000);
    const res = await rpc<{ ok: boolean; reason?: string }>(b, 'submit_progress', {
      p_race_id: raceId, p_from_word: 0, p_words: words, p_keystrokes: 999, p_errors: 0,
    });
    check(res.reason === 'too_fast', `${b.name} (cheater) instant finish rejected`);
    const skip = await rpc<{ reason?: string }>(b, 'submit_progress', {
      p_race_id: raceId, p_from_word: 3, p_words: [words[3]], p_keystrokes: 999, p_errors: 0,
    });
    check(skip.reason === 'out_of_sync', `${b.name} (cheater) word skip rejected`);
    const wrong = await rpc<{ reason?: string }>(b, 'submit_progress', {
      p_race_id: raceId, p_from_word: 0, p_words: ['wrong'], p_keystrokes: 999, p_errors: 0,
    });
    check(wrong.reason === 'mismatch', `${b.name} (cheater) wrong word rejected`);
    await rpc(b, 'leave_lobby', { p_lobby_id: lobbyId });
  }

  async function race_(b: Bot) {
    const charsPerMs = (b.wpm * 5) / 60_000;
    const raceStart = Date.now();
    let done = 0;
    const ends: number[] = [];
    words.forEach((w, i) => ends.push((ends[i - 1] ?? 0) + w.length + (i < words.length - 1 ? 1 : 0)));
    while (done < words.length) {
      await sleep(1000);
      const typed = (Date.now() - raceStart) * charsPerMs;
      let target = done;
      while (target < words.length && ends[target]! <= typed) target++;
      if (target === done) continue;
      const chars = ends[target - 1]!;
      const errors = Math.floor(chars * b.errorRate);
      const res = await rpc<{ ok: boolean; reason?: string; words_done: number }>(b, 'submit_progress', {
        p_race_id: raceId, p_from_word: done, p_words: words.slice(done, target),
        p_keystrokes: chars + errors * 2, p_errors: errors,
      });
      if (!res.ok) {
        check(false, `${b.name} submit rejected: ${res.reason}`);
        return;
      }
      done = res.words_done;
    }
    console.log(`   ${b.name} finished (${b.wpm} wpm target)`);
  }

  // Results ---------------------------------------------------------------
  let ended = false;
  for (let i = 0; i < 20 && !ended; i++) {
    const { data } = await second.sb.from('races').select('status').eq('id', raceId).single();
    ended = data?.status === 'finished';
    if (!ended) await sleep(500);
  }
  check(ended, 'race auto-finalized when all remaining racers finished');
  await sleep(1000);
  check(events.includes('race:start'), 'realtime: race:start received');
  check(events.filter((e) => e === 'player:finished').length === count - 1, 'realtime: player:finished for each finisher');
  check(events.includes('race:end'), 'realtime: race:end received');

  const select = 'user_id, name, rank, net_wpm, gross_wpm, accuracy, errors, keystrokes, correct_chars, finished_at, trophies, flagged';
  const views = await Promise.all(
    bots.filter((b) => !b.cheater).map(async (b) =>
      (await b.sb.from('race_players').select(select).eq('race_id', raceId).order('rank')).data ?? []),
  );
  const rows = views[0]!;
  check(views.every((v) => JSON.stringify(v) === JSON.stringify(rows)), 'every racer sees identical results');
  check(rows.find((r) => r.name === bots.at(-1)!.name)?.flagged === true, 'cheater flagged');

  const { data: finalRace } = await second.sb.from('races').select('start_at, ended_at').eq('id', raceId).single();
  const raceStartMs = Date.parse(finalRace!.start_at);
  const len = passageLength(words);
  const ts = rankPlayers(
    rows.map((r) =>
      computeStats(
        {
          id: r.user_id, name: r.name, correctChars: r.correct_chars, keystrokes: r.keystrokes,
          errors: r.errors, finishedMs: r.finished_at ? Date.parse(r.finished_at) - raceStartMs : null,
        } satisfies PlayerProgress,
        len,
        Date.parse(finalRace!.ended_at) - raceStartMs,
      ),
    ),
  );
  check(ts.map((p) => p.id).join() === rows.map((r) => r.user_id).join(), 'SQL ranking matches shared TS ranking');
  const tsAwards = awardTrophies(ts);
  check(
    rows.every((r) => JSON.stringify(r.trophies) === JSON.stringify(tsAwards.get(r.user_id) ?? [])),
    'SQL trophies match shared TS trophies',
  );
  check(
    rows.every((r, i) => Math.abs(r.net_wpm - ts[i]!.netWpm) < 0.05),
    'SQL WPM matches shared TS WPM',
  );

  console.log('\nRank  Name    WPM    Acc     Err  Trophies');
  for (const r of rows) {
    console.log(
      `${String(r.rank).padEnd(6)}${r.name.padEnd(8)}${r.net_wpm.toFixed(1).padEnd(7)}${r.accuracy.toFixed(1).padEnd(8)}${String(r.errors).padEnd(5)}${r.trophies.join(', ') || (r.finished_at ? '' : 'DNF')}`,
    );
  }

  await host.sb.removeChannel(channel);
  for (const b of bots.filter((b) => !b.cheater)) await rpc(b, 'leave_lobby', { p_lobby_id: lobbyId });
  const { data: gone } = await second.sb.from('lobbies').select('id').eq('id', lobbyId);
  check(gone?.length === 0, 'lobby deleted after everyone left');

  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
