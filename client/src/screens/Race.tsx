import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  computeStats,
  getVisibleCars,
  RACE_END_GRACE_MS,
  rankPlayers,
  resumeTypingState,
  sectionOf,
  typedCorrectChars,
} from '@race/shared';
import { modeDesign } from '../art/gridArt';
import { useRaceControl } from '../components/race/RaceControl';
import { RaceView } from '../components/race/RaceView';
import type { RaceViewModel } from '../components/race/raceViewModel';
import type { TrackCar } from '../components/Track';
import type { TypingVariant } from '../components/TypingPanel';
import { Loading } from '../components/ui';
import { api } from '../lib/api';
import { useServerNow } from '../lib/clock';
import { clearActiveRace, loadRaceMistakes, saveActiveRace, saveRaceMistakes } from '../lib/storage';
import { useSound } from '../game/sound';
import type { LobbyState } from '../game/useLobby';
import { SUBMIT_TIMEOUT_MS, useSubmitQueue } from '../game/useSubmitQueue';
import { useTyping } from '../game/useTyping';
import { destinationFor } from '../game/destinations';
import { vehicleFor } from '../game/vehicles';

interface Props {
  state: LobbyState;
}

/** Re-rank at most this often so lanes don't jitter on every keystroke. */
const RANK_INTERVAL_MS = 250;
const GO_BANNER_MS = 900;
/**
 * The race is on a clock, so the track follows the clock: the leader drives from
 * the start to TRACK_END as the time runs out (never reaching the flag), and
 * everyone else sits at their share of the leader's characters.
 */
const TRACK_END = 0.9;

export function Race({ state }: Props) {
  const { race, passage, racePlayers, players, live, userId, clockOffset, lobby } = state;
  const now = useServerNow(clockOffset, 100);
  const { play } = useSound();
  const startAt = race ? Date.parse(race.start_at) : 0;
  const durationMs = (race?.duration_s ?? 60) * 1000;
  const endAt = race?.end_at ? Date.parse(race.end_at) : startAt + durationMs;
  const myRow = racePlayers.find((p) => p.user_id === userId);
  const isRacer = !!myRow;
  const started = now >= startAt;
  const racing = race?.status === 'racing';
  const timeUp = now >= endAt || race?.status === 'finished';
  const strict = !!race?.zero_mistakes;
  const elapsed = Math.min(durationMs, Math.max(0, now - startAt));

  // Incorrect attempts per passage word, for this racer's debrief.
  const mistakes = useRef<Record<number, number> | null>(null);
  const onMistake = useCallback(
    (word: number) => {
      if (!race) return;
      mistakes.current ??= loadRaceMistakes(race.id);
      mistakes.current[word] = (mistakes.current[word] ?? 0) + 1;
      saveRaceMistakes(race.id, mistakes.current);
    },
    [race],
  );

  const typing = useTyping(passage ?? '', isRacer && started && racing && !timeUp, {
    onMistake,
    strict,
    // Keystrokes are counted per tenth of the race time (Steady Hands).
    section: () => sectionOf(Date.now() + clockOffset - startAt, durationMs),
    // After a refresh mid-race, resume from the lines the server already locked in.
    initial: () =>
      resumeTypingState(passage ?? '', strict, {
        wordsDone: myRow?.words_done ?? 0,
        lockedChars: myRow?.locked_chars ?? 0,
        keystrokes: myRow?.keystrokes ?? 0,
        errors: myRow?.errors ?? 0,
        deletions: myRow?.deletions ?? 0,
        sectionKeystrokes: myRow?.section_keystrokes ?? [],
        sectionErrors: myRow?.section_errors ?? [],
      }),
  });
  const { state: ts } = typing;
  const inputRef = useRef<HTMLInputElement>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (started && isRacer && !timeUp) inputRef.current?.focus();
  }, [started, isRacer, timeUp]);

  // Countdown sounds, keyed to the server-aligned start time.
  const countdown = Math.ceil((startAt - now) / 1000);
  const lastBeep = useRef<number | null>(null);
  useEffect(() => {
    if (!race) return;
    const value = started ? 0 : countdown;
    if (value === lastBeep.current || value > 3) return;
    lastBeep.current = value;
    play(value === 0 ? 'go-horn' : value === 1 ? 'countdown-final' : 'countdown-beep');
  }, [countdown, started, race, play]);

  // Server sync (game/useSubmitQueue): locked lines first, then provisional
  // progress; at time-up the current line is locked in, with bounded retries.
  const raceId = race?.id;
  const onTooFast = useCallback(() => setWarning('Your input was rejected as impossibly fast.'), []);
  const submit = useSubmitQueue({
    raceId,
    typing: ts,
    wordsDone: myRow?.words_done ?? 0,
    active: isRacer && racing && started && !timeUp,
    final: isRacer && timeUp && started,
    // Local time at which any client may finalize the race: final retries stop there.
    deadline: endAt - clockOffset + RACE_END_GRACE_MS,
    onTooFast,
  });

  // Remember this race so the player can rejoin it from home after leaving.
  const lobbyCode = lobby?.code;
  useEffect(() => {
    if (!raceId || !lobbyCode || !userId || !isRacer) return;
    if (timeUp) clearActiveRace(raceId);
    else saveActiveRace({ code: lobbyCode, raceId, endAt: endAt - clockOffset, userId });
  }, [raceId, lobbyCode, userId, isRacer, timeUp, endAt, clockOffset]);

  const myChars = typedCorrectChars(ts);

  // Close the race once the timer (plus a moment for final lines) has run out.
  // Any client may ask; the server checks the clock.
  // This client waits while its own final lines are still in flight (at most one request timeout).
  const lastFinalize = useRef(0);
  const holdFinalize = submit.pending && now < endAt + RACE_END_GRACE_MS + SUBMIT_TIMEOUT_MS;
  useEffect(() => {
    if (!race || !racing || holdFinalize || now < endAt + RACE_END_GRACE_MS || now - lastFinalize.current < 3000) return;
    lastFinalize.current = now;
    void api.finalizeRace(race.id).catch(() => {});
  }, [race, racing, holdFinalize, now, endAt]);

  // Standings by correct characters, re-ranked on a fixed cadence. Cars are
  // placed relative to the leader, who sits just short of the flag.
  const vehicles = useMemo(() => new Map(players.map((p, i) => [p.user_id, vehicleFor(p, i)])), [players]);
  const [order, setOrder] = useState<string[]>([]);
  const charsOf = (id: string, server: number) => (id === userId ? myChars : (live[id]?.chars ?? server));
  const leaderChars = Math.max(0, ...racePlayers.map((rp) => charsOf(rp.user_id, rp.correct_chars)));
  const standings = racePlayers.map((rp) =>
    computeStats(
      { id: rp.user_id, name: rp.name, correctChars: charsOf(rp.user_id, rp.correct_chars), keystrokes: 0, errors: 0, finishedMs: null },
      leaderChars,
      Math.max(1, elapsed),
    ),
  );
  const standingsRef = useRef(standings);
  standingsRef.current = standings;
  useEffect(() => {
    const update = () => setOrder(rankPlayers(standingsRef.current).map((p) => p.id));
    update();
    const t = setInterval(update, RANK_INTERVAL_MS);
    return () => clearInterval(t);
  }, []);

  const byId = new Map(standings.map((s) => [s.id, s]));
  const ranked = order.map((id) => byId.get(id)).filter((s) => s !== undefined);
  for (const s of standings) if (!order.includes(s.id)) ranked.push(s);
  const rankOf = (id: string) => ranked.findIndex((s) => s.id === id) + 1;
  const leaderAt = started ? TRACK_END * Math.min(1, elapsed / durationMs) : 0;
  const cars: TrackCar[] = getVisibleCars(ranked, userId ?? '').map((s) => ({
    id: s.id,
    name: s.name,
    // Racers who left the lobby keep a neutral car.
    vehicle: vehicles.get(s.id) ?? vehicleFor({ name: s.name, car_color: '#748782', vehicle: {} }),
    rank: rankOf(s.id),
    progress: s.progress * leaderAt,
    percent: s.progress * 100, // of the leader's total
    wpm: s.netWpm,
    errors: s.id === userId ? ts.errors : (live[s.id]?.errors ?? 0),
    finished: timeUp && started,
    isMe: s.id === userId,
  }));
  const myRank = rankOf(userId ?? '');
  const myStats = computeStats(
    { id: 'me', name: 'me', correctChars: myChars, keystrokes: ts.keystrokes, errors: ts.errors, finishedMs: null },
    leaderChars,
    Math.max(1, elapsed),
  );

  // Sound + race moments for the local racer.
  const prevMine = useRef({ errors: ts.errors, rank: myRank, timeUp });
  useEffect(() => {
    const p = prevMine.current;
    if (started && isRacer) {
      if (timeUp && !p.timeUp) play('finish');
      else if (ts.errors > p.errors) play('mistake');
      else if (myRank > 0 && p.rank > 0 && myRank < p.rank) play('overtake');
    }
    prevMine.current = { errors: ts.errors, rank: myRank, timeUp };
  }, [ts.errors, timeUp, myRank, started, isRacer, play]);

  const leader = ranked[0] && leaderChars > 0 ? { id: ranked[0].id, name: ranked[0].name } : null;
  const msLeft = Math.max(0, endAt - now);
  const board = useRaceControl({ raceId: race?.id, started, myId: userId, leader, myRank, msLeft, timeUp: timeUp && started });

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) play('key-click');
      typing.onKeyDown(e);
    },
    [typing, play],
  );

  if (!race || !passage) return <Loading label="Loading the race" />;

  const variant: TypingVariant = race.mode === 'coding' ? 'coding' : race.mode === 'shakespeare' ? 'shakespeare' : 'standard';
  const finished = timeUp && started;
  const championship = state.championship?.status === 'running' ? state.championship : null;
  const model: RaceViewModel = {
    session: {
      modeName: modeDesign(race.mode).name,
      viaRandom: lobby?.mode === 'random',
      variant,
      durationMs,
      strict,
      round: championship ? { n: Math.min(championship.rounds, championship.committed.length + 1), of: championship.rounds } : null,
      destination: destinationFor(race.mode, lobby?.destination),
      racerCount: racePlayers.length,
    },
    clock: {
      phase: !started ? 'countdown' : finished ? 'time-up' : elapsed < GO_BANNER_MS ? 'go' : 'racing',
      countdown: !started ? (countdown > 3 ? 'READY' : (String(countdown) as '3' | '2' | '1')) : elapsed < GO_BANNER_MS ? 'GO!' : null,
      msLeft,
      usedFraction: elapsed / durationMs,
    },
    role: isRacer ? 'racer' : 'spectating',
    me: isRacer
      ? { position: myRank || racePlayers.length, total: racePlayers.length, wpm: myStats.netWpm, accuracy: myStats.accuracy, mistakes: ts.errors }
      : null,
    cars,
    overflow:
      racePlayers.length > cars.length
        ? ranked.map((s) => ({ id: s.id, name: s.name, position: rankOf(s.id), progress: s.progress * leaderAt }))
        : null,
    raceControl: board,
    results: finished ? 'confirming' : 'provisional',
    warning,
    connection: state.connected ? 'live' : 'reconnecting',
    delivery: isRacer ? submit.delivery : null,
  };

  return (
    <RaceView
      model={model}
      typing={isRacer ? { state: ts, inputRef, onKeyDown, waiting: !started, doneLabel: finished ? "TIME'S UP" : undefined } : null}
    />
  );
}
