/**
 * Multiplayer simulation against the real Supabase project.
 *
 *   npm run bots -- [count=4]
 *
 * Bots create/join a lobby, pick car colours, set the race rules, vote on a
 * mode and race for one timed minute at different speeds and mistake rates
 * (locking each line like Enter does), while one cheater tries forged and
 * impossibly fast submissions. Verifies server validation, realtime events,
 * that SQL results match the shared TS ranking, and that every racer still
 * on the grid at the final whistle earns a trophy.
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
  layoutLines,
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

const count = Number(process.argv[2] ?? 4);
if (!Number.isInteger(count) || count < 3 || count > 15) {
  throw new Error('Bot count must be an integer from 3 to 15 (including one cheater).');
}
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
    wpm: 130 - i * (100 / (count - 1)),
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

const RACE_SECONDS = 60;

type Counters = {
  p_keystrokes: number;
  p_errors: number;
  p_deletions: number;
  p_section_keystrokes: number[];
  p_section_errors: number[];
};
const ZERO: Counters = {
  p_keystrokes: 0, p_errors: 0, p_deletions: 0,
  p_section_keystrokes: Array(SECTIONS).fill(0), p_section_errors: Array(SECTIONS).fill(0),
};

/** Deterministic: does bot `b` mistype word `i`? (one wrong letter, then moves on) */
const isWrong = (b: Bot, i: number) => ((i * 7919 + b.wpm * 31) % 1000) / 1000 < b.errorRate * 4;

/** What bot `b` typed for words [from, upto). */
function typedAs(b: Bot, words: string[], from: number, upto: number): string[] {
  return words.slice(from, upto).map((w, k) => (isWrong(b, from + k) ? (w[0] === '#' ? '%' : '#') + w.slice(1) : w));
}

/**
 * When each word is finished (letters + separator) at the bot's speed, with
 * cumulative counters as the typing engine would report them: a mistyped word
 * is one wrong attempt; keystrokes go to the time slice they happen in.
 */
function plan(b: Bot, words: string[], durationMs: number): { at: number; counters: Counters }[] {
  const perMs = (b.wpm * 5) / 60_000;
  const sk = Array<number>(SECTIONS).fill(0);
  const se = Array<number>(SECTIONS).fill(0);
  const out: { at: number; counters: Counters }[] = [];
  let t = 0;
  let k = 0;
  let e = 0;
  for (let i = 0; i < words.length; i++) {
    const len = words[i]!.length + 1;
    t += len / perMs;
    if (t > durationMs) break;
    const sec = sectionOf(t, durationMs);
    k += len;
    sk[sec]! += len;
    if (isWrong(b, i)) {
      e++;
      se[sec]!++;
    }
    out.push({ at: t, counters: { p_keystrokes: k, p_errors: e, p_deletions: 0, p_section_keystrokes: [...sk], p_section_errors: [...se] } });
  }
  return out;
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
  const channel = host.sb.channel(`lobby:${code}:server`, { config: { private: true } });
  for (const ev of ['vote:result', 'race:start', 'race:end', 'race:awards']) {
    channel.on('broadcast', { event: ev }, () => events.push(ev));
  }
  const relayed = new Set<string>();
  channel.on('broadcast', { event: 'progress' }, ({ payload }) => relayed.add((payload as { id: string }).id));
  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') resolve();
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(err ?? new Error(status));
    });
  });
  check(true, 'host subscribed to the receive-only server channel');

  // A member can join the server channel but must not be able to forge events on it.
  await second.sb.realtime.setAuth();
  const forger = second.sb.channel(`lobby:${code}:server`, { config: { private: true } });
  await new Promise<void>((resolve, reject) => {
    forger.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') resolve();
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(err ?? new Error(status));
    });
  });
  await forger.send({ type: 'broadcast', event: 'vote:result', payload: { mode: 'coding' } });
  await new Promise((r) => setTimeout(r, 2000));
  check(!events.includes('vote:result'), 'member cannot forge server events');
  await second.sb.removeChannel(forger);

  // Players may share presence on the lobby topic but not broadcast on it.
  const heard: string[] = [];
  const listen = host.sb.channel(`lobby:${code}`, { config: { private: true } });
  listen.on('broadcast', { event: 'progress' }, () => heard.push('progress'));
  const spoofer = second.sb.channel(`lobby:${code}`, { config: { private: true } });
  for (const c of [listen, spoofer]) {
    await new Promise<void>((resolve, reject) => {
      c.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') resolve();
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(err ?? new Error(status));
      });
    });
  }
  await spoofer.send({ type: 'broadcast', event: 'progress', payload: { id: host.id, chars: 9999, wpm: 999 } });
  await new Promise((r) => setTimeout(r, 2000));
  check(heard.length === 0, 'members cannot broadcast fake progress');
  await host.sb.removeChannel(listen);
  await second.sb.removeChannel(spoofer);

  // Colours ----------------------------------------------------------------
  const { data: colorRows } = await second.sb.from('lobby_players').select('user_id, car_color');
  check(new Set(colorRows?.map((r) => r.car_color)).size === count, 'every player got a distinct car colour');
  const hostColor = colorRows!.find((r) => r.user_id === host.id)!.car_color;
  check((await rpcError(second, 'set_car_color', { p_lobby_id: lobbyId, p_color: hostColor })) === 'color_taken', 'taken colour rejected');
  check((await rpcError(second, 'set_car_color', { p_lobby_id: lobbyId, p_color: '#000000' })) === 'invalid_color', 'unknown colour rejected');
  // At full capacity every colour is occupied; reselecting your own is valid.
  const secondColor = colorRows!.find((r) => r.user_id === second.id)!.car_color;
  await rpc(second, 'set_car_color', { p_lobby_id: lobbyId, p_color: secondColor });

  // Garage (cosmetic, server-validated) -------------------------------------
  const cleaned = await rpc<Record<string, unknown>>(second, 'set_vehicle', {
    p_lobby_id: lobbyId,
    p_vehicle: { model: 'rocket', accent: 'red;<script>', wheels: 'square', stripes: 'yes', number: 1234, effect: 'neon', speed: 999 },
  });
  check(
    cleaned.model === 'rocket' && cleaned.accent === '#b9f46a' && cleaned.wheels === 'sport' &&
      cleaned.stripes === false && cleaned.number === 999 && cleaned.effect === 'neon' && !('speed' in cleaned),
    'garage build is sanitised server-side (unknown keys dropped)',
  );

  // Race rules -------------------------------------------------------------
  const settings = (b: Bot, seconds: number, zero: boolean) =>
    rpcError(b, 'set_race_settings', { p_lobby_id: lobbyId, p_seconds: seconds, p_zero_mistakes: zero });
  check((await settings(second, 120, true)) === 'not_host', 'only the host can change the race rules');
  check((await settings(host, 90, false)) === 'invalid_duration', 'race length must be 1–5 whole minutes');
  check((await settings(host, 300, true)) === null, 'host can set 5 minutes with zero-mistake mode');
  const { data: rules } = await second.sb.from('lobbies').select('race_seconds, zero_mistakes').eq('id', lobbyId).single();
  check(rules?.race_seconds === 300 && rules.zero_mistakes === true, 'members see the host\'s rules');
  await settings(host, RACE_SECONDS, false);

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
  const { data: race } = await second.sb.from('races').select('start_at, end_at, duration_s, zero_mistakes, text, mode').eq('id', raceId).single();
  check(race?.mode === winner, `race uses the winning mode (${race?.mode})`);
  check(race?.duration_s === RACE_SECONDS && !race?.zero_mistakes, 'race uses the host\'s settings (1 min, mistakes allowed)');
  check(!!race?.text && race.text.length >= RACE_SECONDS * 25, `race text is long enough that nobody runs out (${race?.text?.length} chars)`);
  const words = splitWords(race!.text);
  const lines = layoutLines(words);
  const startAt = Date.parse(race!.start_at);
  const endAt = Date.parse(race!.end_at);
  const durationMs = race!.duration_s * 1000;
  check(endAt - startAt === durationMs, 'race ends exactly when the timer runs out');
  console.log(`Race starts in ${((startAt - Date.now()) / 1000).toFixed(1)}s and lasts ${race!.duration_s}s: "${race!.text.slice(0, 50)}…"`);

  const early = await rpc<{ reason?: string }>(second, 'submit_typing', {
    p_race_id: raceId, p_from_word: 0, p_words: [words[0]], p_lock: false, ...ZERO,
  });
  check(early.reason === 'not_started', 'typing before GO rejected');

  await sleep(Math.max(0, startAt - Date.now()) + 300);
  check((await rpc<boolean>(second, 'finalize_race', { p_race_id: raceId })) === false, 'race cannot be closed before the timer ends');

  await Promise.all(bots.map((b) => (b.cheater ? cheat(b) : race_(b))));

  async function cheat(b: Bot) {
    await sleep(1000);
    const base = { p_race_id: raceId, p_lock: false };
    const zeroCounters = ZERO;
    const forged = await rpc<{ reason?: string }>(b, 'submit_typing', {
      ...base, p_from_word: 0, p_words: [words[0]], ...zeroCounters, p_keystrokes: 50, p_section_keystrokes: [999, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    check(forged.reason === 'bad_counters', `${b.name} (cheater) section counts that don't add up rejected`);
    const free = await rpc<{ reason?: string }>(b, 'submit_typing', {
      ...base, p_from_word: 0, p_words: words.slice(0, 5), ...zeroCounters,
    });
    check(free.reason === 'bad_counters', `${b.name} (cheater) words without keystrokes rejected`);
    const spaced = await rpc<{ reason?: string }>(b, 'submit_typing', {
      ...base, p_from_word: 0, p_words: ['two words'], ...zeroCounters,
    });
    check(spaced.reason === 'mismatch', `${b.name} (cheater) malformed word rejected`);
    const skip = await rpc<{ reason?: string }>(b, 'submit_typing', {
      ...base, p_from_word: 3, p_words: [words[3]], ...zeroCounters,
    });
    check(skip.reason === 'out_of_sync', `${b.name} (cheater) jumping ahead rejected`);
    const n = lines[0]!.end;
    const chars = words.slice(0, n).join(' ').length + 1;
    const res = await rpc<{ reason?: string }>(b, 'submit_typing', {
      ...base, p_lock: true, p_from_word: 0, p_words: words.slice(0, n),
      p_keystrokes: chars * 20, p_errors: 0, p_deletions: 0,
      p_section_keystrokes: [chars * 20, 0, 0, 0, 0, 0, 0, 0, 0, 0], p_section_errors: Array(SECTIONS).fill(0),
    });
    // A whole line in about a second is plausible; keep going until it isn't.
    let flagged = res.reason === 'too_fast';
    for (let i = 1; i < 6 && !flagged; i++) {
      const from = lines[i]!.start;
      const upto = lines[i + 3]!.end;
      const total = words.slice(0, upto).join(' ').length + 1;
      const r = await rpc<{ reason?: string }>(b, 'submit_typing', {
        ...base, p_lock: true, p_from_word: from, p_words: words.slice(from, upto),
        p_keystrokes: total * 20, p_errors: 0, p_deletions: 0,
        p_section_keystrokes: [total * 20, 0, 0, 0, 0, 0, 0, 0, 0, 0], p_section_errors: Array(SECTIONS).fill(0),
      });
      flagged = r.reason === 'too_fast';
      if (r.reason && !flagged) break;
    }
    check(flagged, `${b.name} (cheater) impossible speed rejected and flagged`);
    await rpc(b, 'leave_lobby', { p_lobby_id: lobbyId });
  }

  async function race_(b: Bot) {
    const steps = plan(b, words, durationMs);
    let done = 0; // words locked on the server
    const send = async (from: number, upto: number, lock: boolean, at: Counters) => {
      const res = await rpc<{ ok: boolean; reason?: string; words_done: number }>(b, 'submit_typing', {
        p_race_id: raceId, p_from_word: from, p_words: typedAs(b, words, from, upto), p_lock: lock, ...at,
      });
      if (!res.ok) throw new Error(`${b.name} submit rejected: ${res.reason}`);
      done = res.words_done;
    };
    try {
      for (;;) {
        await sleep(1000);
        const t = Math.min(durationMs, Date.now() - startAt);
        const final = t >= durationMs;
        const typed = steps.filter((s) => s.at <= t).length; // words finished so far
        const at = steps[typed - 1]?.counters ?? ZERO;
        // Lock every line that is fully typed, in order (Enter at the end of each).
        let line = lines.findIndex((l) => l.start === done);
        while (lines[line] && lines[line]!.end <= typed) {
          await send(done, lines[line]!.end, true, at);
          line++;
        }
        const end = Math.min(typed, lines[line]?.end ?? typed);
        if (final) {
          if (end > done) await send(done, end, true, at);
          break;
        }
        if (end > done) await send(done, end, false, at);
      }
      console.log(`   ${b.name} raced to the final whistle (${b.wpm} wpm target, ${done} words locked)`);
    } catch (e) {
      check(false, (e as Error).message);
    }
  }

  // Results ---------------------------------------------------------------
  await sleep(Math.max(0, endAt + 2600 - Date.now()));
  await rpc(host, 'finalize_race', { p_race_id: raceId });
  let ended = false;
  for (let i = 0; i < 20 && !ended; i++) {
    const { data } = await second.sb.from('races').select('status').eq('id', raceId).single();
    ended = data?.status === 'finished';
    if (!ended) await sleep(500);
  }
  check(ended, 'race finalized when the timer ran out');
  await sleep(1000);
  check(events.includes('vote:result'), 'realtime: vote:result received');
  check(events.includes('race:start'), 'realtime: race:start received');
  check(events.includes('race:end'), 'realtime: race:end received');
  check(relayed.size > 0 && [...relayed].every((id) => bots.some((b) => b.id === id)), 'server relays verified progress for racers');

  const select = 'user_id, name, rank, net_wpm, gross_wpm, accuracy, errors, keystrokes, correct_chars, finished_at, flagged, samples';
  const views = await Promise.all(
    bots.filter((b) => !b.cheater).map(async (b) =>
      (await b.sb.from('race_players').select(select).eq('race_id', raceId).order('rank')).data ?? []),
  );
  const rows = views[0]!;
  check(views.every((v) => JSON.stringify(v) === JSON.stringify(rows)), 'every racer sees identical results');
  check(rows.find((r) => r.name === bots.at(-1)!.name)?.flagged === true, 'cheater flagged');
  check(rows.filter((r) => r.finished_at).every((r) => (r.samples as Sample[]).length > 0), 'server recorded samples for finishers');
  check(rows.filter((r) => !r.flagged).every((r) => r.finished_at === race!.end_at || Date.parse(r.finished_at) === endAt), 'everyone still racing at the final whistle is a finisher');
  check(rows.find((r) => r.flagged)?.finished_at === null, 'the cheater who left is not a finisher');

  const { data: finalRace } = await second.sb.from('races').select('start_at').eq('id', raceId).single();
  const raceStartMs = Date.parse(finalRace!.start_at);
  const ts = rankPlayers(
    rows.map((r) =>
      computeStats(
        {
          id: r.user_id, name: r.name, correctChars: r.correct_chars, keystrokes: r.keystrokes,
          errors: r.errors, finishedMs: r.finished_at ? Date.parse(r.finished_at) - raceStartMs : null,
        } satisfies PlayerProgress,
        1,
        durationMs,
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
    startAt: finalRace!.start_at, streaks: streakOf,
  });
  const awards = awardTrophies(results, { mode: race!.mode, durationMs });
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
