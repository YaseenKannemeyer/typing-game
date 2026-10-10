/**
 * Multiplayer simulation against the real Supabase project.
 *
 *   npm run bots -- [count=4]
 *
 * Bots create/join a lobby, pick car colours, vote on a mode, race at
 * different speeds, and one cheater tries to submit the whole passage
 * instantly. Verifies server validation, realtime events, that SQL results
 * match the shared TS ranking, and that every finisher earns a trophy.
 *
 * Each run creates `count` anonymous users; Supabase's default limit is
 * 30 anonymous sign-ins per hour per IP (Auth → Rate Limits).
 */
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  awardTrophies,
  raceResultsFromRows,
  SECTIONS,
  sectionOf,
  type Award,
  type RacePlayerRow,
  computeStats,
  passageLength,
  rankPlayers,
  splitWords,
  TROPHIES,
  type PlayerProgress,
  type RaceResult,
  type Sample,
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

/**
 * Cumulative counters as a real typist would report them after `chars` correct
 * characters at a given mistake rate. Each mistake is one wrong attempt at the
 * expected position, then deleted, so per-section counts only ever grow.
 */
function counters(chars: number, errorRate: number, len: number) {
  const sk = Array<number>(SECTIONS).fill(0);
  const se = Array<number>(SECTIONS).fill(0);
  let errors = 0;
  for (let p = 0; p < chars; p++) {
    const sec = sectionOf(p, len);
    sk[sec]!++;
    if (Math.floor((p + 1) * errorRate) > Math.floor(p * errorRate)) {
      sk[sec]!++;
      se[sec]!++;
      errors++;
    }
  }
  return {
    p_keystrokes: chars + errors, p_errors: errors, p_deletions: errors,
    p_section_keystrokes: sk, p_section_errors: se,
  };
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
  for (const ev of ['vote:result', 'race:start', 'player:finished', 'race:end', 'race:awards']) {
    channel.on('broadcast', { event: ev }, () => events.push(ev));
  }
  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') resolve();
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(err ?? new Error(status));
    });
  });
  check(true, 'host subscribed to private lobby channel');

  // Colours ----------------------------------------------------------------
  const { data: colorRows } = await second.sb.from('lobby_players').select('user_id, car_color');
  check(new Set(colorRows?.map((r) => r.car_color)).size === count, 'every player got a distinct car colour');
  const hostColor = colorRows!.find((r) => r.user_id === host.id)!.car_color;
  check((await rpcError(second, 'set_car_color', { p_lobby_id: lobbyId, p_color: hostColor })) === 'color_taken', 'taken colour rejected');
  check((await rpcError(second, 'set_car_color', { p_lobby_id: lobbyId, p_color: '#000000' })) === 'invalid_color', 'unknown colour rejected');
  await rpc(second, 'set_car_color', { p_lobby_id: lobbyId, p_color: '#fa8763' });

  // Garage (cosmetic, server-validated) -------------------------------------
  const cleaned = await rpc<Record<string, unknown>>(second, 'set_vehicle', {
    p_lobby_id: lobbyId,
    p_vehicle: { model: 'rocket', accent: 'red;<script>', wheels: 'square', stripes: 'yes', number: 1234, effect: 'neon', speed: 999 },
  });
  check(
    JSON.stringify(cleaned) === JSON.stringify({ model: 'rocket', accent: '#b9f46a', wheels: 'sport', stripes: false, number: 99, effect: 'neon' }) ||
      (cleaned.model === 'rocket' && cleaned.accent === '#b9f46a' && cleaned.wheels === 'sport' && cleaned.stripes === false && cleaned.number === 99 && !('speed' in cleaned)),
    'garage build is sanitised server-side (unknown keys dropped)',
  );

  // Voting -----------------------------------------------------------------
  check((await rpcError(second, 'start_voting', { p_lobby_id: lobbyId })) === 'not_host', 'only host can start voting');
  await rpc(host, 'start_voting', { p_lobby_id: lobbyId });
  check((await rpcError(second, 'cast_vote', { p_lobby_id: lobbyId, p_mode: 'nope' })) === 'invalid_mode', 'invalid mode rejected');
  for (const b of bots) await rpc(b, 'cast_vote', { p_lobby_id: lobbyId, p_mode: b.cheater ? 'hard' : 'shakespeare' });
  await rpc(second, 'cast_vote', { p_lobby_id: lobbyId, p_mode: 'coding' }); // change of mind
  await rpc(bots[2]!, 'cast_vote', { p_lobby_id: lobbyId, p_mode: 'coding' });
  const { data: votes } = await second.sb.from('lobby_votes').select('mode');
  check(votes?.length === count, 'one vote per player (changing a vote replaces it)');
  check((await rpcError(second, 'close_voting', { p_lobby_id: lobbyId })) === 'voting_open', 'non-host cannot close voting early');
  const expected = count - 3 > 2 ? 'shakespeare' : null; // shakespeare leads when there are enough bots
  const winner = await rpc<string>(host, 'close_voting', { p_lobby_id: lobbyId });
  if (expected) check(winner === expected, `most-voted mode wins (${winner})`);
  else check(['shakespeare', 'coding'].includes(winner), `tied vote picked one of the tied modes (${winner})`);

  const { data: lobbyRow } = await second.sb.from('lobbies').select('current_race_id, status').eq('id', lobbyId).single();
  check(lobbyRow?.status === 'racing', 'closing the vote starts the race');
  const raceId = lobbyRow!.current_race_id as string;
  check((await rpcError(second, 'set_vehicle', { p_lobby_id: lobbyId, p_vehicle: {} })) === 'race_in_progress', 'garage locked during the race');
  const { data: race } = await second.sb.from('races').select('start_at, passage_id, mode').eq('id', raceId).single();
  check(race?.mode === winner, `race uses the winning mode (${race?.mode})`);
  const { data: passage } = await second.sb.from('passages').select('text').eq('id', race!.passage_id).single();
  check(!!passage?.text, 'racer can read the race passage');
  const words = splitWords(passage!.text);
  const startAt = Date.parse(race!.start_at);
  console.log(`Race starts in ${((startAt - Date.now()) / 1000).toFixed(1)}s: "${passage!.text.slice(0, 50)}…"`);

  const len = passageLength(words);
  const firstWord = counters(words[0]!.length + 1, 0, len);
  const early = await rpc<{ reason?: string }>(second, 'submit_progress', {
    p_race_id: raceId, p_from_word: 0, p_words: [words[0]], ...firstWord,
  });
  check(early.reason === 'not_started', 'typing before GO rejected');

  await sleep(Math.max(0, startAt - Date.now()) + 300);

  await Promise.all(bots.map((b) => (b.cheater ? cheat(b) : race_(b))));

  async function cheat(b: Bot) {
    await sleep(1000);
    const forged = await rpc<{ reason?: string }>(b, 'submit_progress', {
      p_race_id: raceId, p_from_word: 0, p_words: [words[0]],
      ...firstWord, p_section_keystrokes: [999, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    check(forged.reason === 'bad_counters', `${b.name} (cheater) section counts that don't add up rejected`);
    const res = await rpc<{ ok: boolean; reason?: string }>(b, 'submit_progress', {
      p_race_id: raceId, p_from_word: 0, p_words: words, ...counters(len, 0, len),
    });
    check(res.reason === 'too_fast', `${b.name} (cheater) instant finish rejected`);
    const skip = await rpc<{ reason?: string }>(b, 'submit_progress', {
      p_race_id: raceId, p_from_word: 3, p_words: [words[3]], ...counters(len, 0, len),
    });
    check(skip.reason === 'out_of_sync', `${b.name} (cheater) word skip rejected`);
    const wrong = await rpc<{ reason?: string }>(b, 'submit_progress', {
      p_race_id: raceId, p_from_word: 0, p_words: ['wrong'], ...counters(len, 0, len),
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
      const res = await rpc<{ ok: boolean; reason?: string; words_done: number }>(b, 'submit_progress', {
        p_race_id: raceId, p_from_word: done, p_words: words.slice(done, target),
        ...counters(chars, b.errorRate, len),
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
  check(events.includes('vote:result'), 'realtime: vote:result received');
  check(events.includes('race:start'), 'realtime: race:start received');
  check(events.filter((e) => e === 'player:finished').length === count - 1, 'realtime: player:finished for each finisher');
  check(events.includes('race:end'), 'realtime: race:end received');

  const select = 'user_id, name, rank, net_wpm, gross_wpm, accuracy, errors, keystrokes, correct_chars, finished_at, flagged, samples';
  const views = await Promise.all(
    bots.filter((b) => !b.cheater).map(async (b) =>
      (await b.sb.from('race_players').select(select).eq('race_id', raceId).order('rank')).data ?? []),
  );
  const rows = views[0]!;
  check(views.every((v) => JSON.stringify(v) === JSON.stringify(rows)), 'every racer sees identical results');
  check(rows.find((r) => r.name === bots.at(-1)!.name)?.flagged === true, 'cheater flagged');
  check(rows.filter((r) => r.finished_at).every((r) => (r.samples as Sample[]).length > 0), 'server recorded samples for finishers');

  const { data: finalRace } = await second.sb.from('races').select('start_at, ended_at').eq('id', raceId).single();
  const raceStartMs = Date.parse(finalRace!.start_at);
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
  check(rows.every((r, i) => Math.abs(r.net_wpm - ts[i]!.netWpm) < 0.05), 'SQL WPM matches shared TS WPM');

  const { data: streaks } = await second.sb.from('lobby_players').select('user_id, streak');
  const streakOf = new Map(streaks?.map((s) => [s.user_id, s.streak]));
  check(rows.filter((r) => r.finished_at).every((r) => streakOf.get(r.user_id) === 1), 'finishers have a completion streak of 1');

  // Trophies: computed and stored on the server by the award-trophies function.
  const invoke = (b: Bot) => b.sb.functions.invoke('award-trophies', { body: { race_id: raceId } });
  const first = await invoke(second);
  check(!first.error && first.data?.stored === true, 'server computed and stored trophies');
  const again = await invoke(bots[2]!);
  check(!again.error && again.data?.stored === false, 'trophy calculation is idempotent');
  const outsider = await invoke(bots.at(-1)!); // the cheater already left the lobby
  check(!!outsider.error, 'non-members cannot trigger trophy calculation');
  await sleep(1500);
  check(events.includes('race:awards'), 'realtime: race:awards received');

  const fullSelect = 'user_id, name, rank, correct_chars, keystrokes, errors, deletions, section_keystrokes, section_errors, finished_at, net_wpm, gross_wpm, accuracy, flagged, samples, awards';
  const { data: stored } = await second.sb.from('race_players').select(fullSelect).eq('race_id', raceId);
  const storedAwards = new Map((stored ?? []).map((r) => [r.user_id as string, r.awards as Award[]]));
  const results: RaceResult[] = raceResultsFromRows(stored as RacePlayerRow[], {
    passage: passage!.text, startAt: finalRace!.start_at, streaks: streakOf,
  });
  const awards = awardTrophies(results, { mode: race!.mode, passageLength: len });
  // Compare values, not JSON text: Postgres jsonb stores object keys in its own order.
  const canon = (list: Award[] = []) => list.map((a) => `${a.trophy}|${a.reason}`).join('\n');
  const mismatched = rows.filter((r) => canon(storedAwards.get(r.user_id)) !== canon(awards.get(r.user_id)));
  for (const r of mismatched) console.log(`   ${r.name} stored:\n${canon(storedAwards.get(r.user_id))}\n   expected:\n${canon(awards.get(r.user_id))}`);
  check(mismatched.length === 0, 'stored awards exactly match the shared, unit-tested rules');
  check(rows.filter((r) => r.finished_at && !r.flagged).every((r) => (storedAwards.get(r.user_id)?.length ?? 0) > 0), 'every finisher earned at least one trophy');
  check((storedAwards.get(rows.find((r) => r.flagged)!.user_id) ?? []).length === 0, 'cheater earned no trophies');
  check(
    (stored ?? []).filter((r) => r.finished_at).every((r) => (r.section_keystrokes as number[]).length === SECTIONS),
    'server stored ten section counts per finisher',
  );

  console.log('\nRank  Name    WPM    Acc     Err  Trophies');
  for (const r of rows) {
    const list = (storedAwards.get(r.user_id) ?? []).map((a) => `${TROPHIES[a.trophy].emoji} ${TROPHIES[a.trophy].name} (${a.reason})`);
    console.log(
      `${String(r.rank).padEnd(6)}${r.name.padEnd(8)}${r.net_wpm.toFixed(1).padEnd(7)}${r.accuracy.toFixed(1).padEnd(8)}${String(r.errors).padEnd(5)}${list.join(', ') || (r.finished_at ? '' : 'DNF')}`,
    );
  }

  await rpc(host, 'return_to_lobby', { p_lobby_id: lobbyId });
  const { data: back } = await second.sb.from('lobbies').select('current_race_id, status').eq('id', lobbyId).single();
  check(back?.current_race_id === null && back?.status === 'waiting', 'host can return everyone to the waiting room');
  await rpc(second, 'heartbeat', { p_lobby_id: lobbyId });
  check(true, 'heartbeat accepted');

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
