import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  computeStats,
  getVisibleCars,
  VISIBLE_CARS,
  lineWords,
  lockedWords,
  PROGRESS_SUBMIT_MS,
  RACE_END_GRACE_MS,
  rankPlayers,
  resumeTypingState,
  sectionOf,
  typedCorrectChars,
} from '@race/shared';
import { modeDesign } from '../art/gridArt';
import { CountdownFrame } from '../components/race/Moments';
import { Dashboard } from '../components/race/Dashboard';
import { PitBoard, useRaceControl } from '../components/race/RaceControl';
import { LiveStandings } from '../components/race/LiveStandings';
import { Track, type TrackCar } from '../components/Track';
import { TypingPanel, type TypingVariant } from '../components/TypingPanel';
import { Banner, Loading, Pill } from '../components/ui';
import { api, lineSubmission } from '../lib/api';
import { useServerNow } from '../lib/clock';
import { clearActiveRace, loadRaceMistakes, saveActiveRace, saveRaceMistakes } from '../lib/storage';
import { useSound } from '../game/sound';
import type { LobbyState } from '../game/useLobby';
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

  // Server sync. Locked lines go first, in order; then the current line's
  // finished words are sent as provisional progress (re-scored next time).
  // When time runs out, everything typed on the current line is locked in.
  const tsRef = useRef(ts);
  tsRef.current = ts;
  const serverDone = useRef(myRow?.words_done ?? 0);
  const lastSent = useRef('');
  const queue = useRef<Promise<void>>(Promise.resolve());
  const busy = useRef(false);
  const raceId = race?.id;
  const sync = useCallback(
    (final: boolean) => {
      if (!raceId || (busy.current && !final)) return queue.current;
      busy.current = true;
      queue.current = queue.current
        .then(async () => {
          for (let guard = 0; guard < 50; guard++) {
            const s = tsRef.current;
            let from: number;
            let words: string[];
            let lock: boolean;
            if (serverDone.current < lockedWords(s)) {
              const idx = s.lines.findIndex((l) => l.start === serverDone.current);
              const typed = idx >= 0 ? s.lockedTyped[idx] : null;
              if (!typed) return;
              from = serverDone.current;
              words = typed.slice(0, lineWords(s, idx).length);
              lock = true;
            } else {
              ({ from, words } = lineSubmission(s, final));
              lock = final && words.length > 0;
            }
            const key = `${from}|${lock}|${words.join(' ')}|${s.keystrokes}|${s.errors}|${s.deletions}`;
            if (key === lastSent.current) return;
            const res = await api.submitTyping(raceId, from, words, lock, s);
            lastSent.current = key;
            serverDone.current = res.words_done;
            if (res.reason === 'too_fast') setWarning('Your input was rejected as impossibly fast.');
            if (!res.ok) return;
            if (from === lockedWords(s)) return; // caught up: that was the current line
          }
        })
        .catch(() => {
          // Network blip: the next tick retries from the server's position.
        })
        .finally(() => {
          busy.current = false;
        });
      return queue.current;
    },
    [raceId],
  );

  const syncing = isRacer && racing && started && !timeUp;
  useEffect(() => {
    if (!syncing) return;
    const t = setInterval(() => void sync(false), PROGRESS_SUBMIT_MS);
    return () => clearInterval(t);
  }, [syncing, sync]);
  // Enter: send the locked line straight away.
  const locked = lockedWords(ts);
  useEffect(() => {
    if (syncing && locked > 0) void sync(false);
  }, [locked, syncing, sync]);
  // The final whistle: lock in whatever is on the current line.
  const finalSent = useRef<string | null>(null);
  useEffect(() => {
    if (!raceId || !isRacer || !timeUp || !started || finalSent.current === raceId) return;
    finalSent.current = raceId;
    void sync(true);
  }, [raceId, isRacer, timeUp, started, sync]);

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
  const lastFinalize = useRef(0);
  useEffect(() => {
    if (!race || !racing || now < endAt + RACE_END_GRACE_MS || now - lastFinalize.current < 3000) return;
    lastFinalize.current = now;
    void api.finalizeRace(race.id).catch(() => {});
  }, [race, racing, now, endAt]);

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

  const design = modeDesign(race.mode);
  const variant: TypingVariant = race.mode === 'coding' ? 'coding' : race.mode === 'shakespeare' ? 'shakespeare' : 'standard';
  const countdownValue = countdown > 3 ? 'READY' : (String(countdown) as '3' | '2' | '1');
  const minutes = Math.round(durationMs / 60_000);

  return (
    <div className="race-screen race-layout">
      <div className="g-between race-context">
        <div>
          <h1 className="g-heading">
            {lobby?.mode === 'random' && <span className="text-muted">Random → </span>}
            {design.name}
          </h1>
        </div>
        <div className="g-row">
          {state.championship?.status === 'running' && (
            <Pill lime>
              ROUND {Math.min(state.championship.rounds, state.championship.committed.length + 1)} / {state.championship.rounds}
            </Pill>
          )}
          <Pill>{minutes} MIN</Pill>
          {strict && <Pill>ZERO MISTAKES</Pill>}
          {isRacer ? <Pill lime>{racePlayers.length} RACERS</Pill> : <Pill>SPECTATING</Pill>}
        </div>
      </div>

      {!isRacer && <Banner tone="info">The race is under way. You'll be on the grid for the next one.</Banner>}

      {isRacer && (
        <div className="race-top">
          <Dashboard
            position={myRank || racePlayers.length}
            total={racePlayers.length}
            wpm={myStats.netWpm}
            accuracy={myStats.accuracy}
            mistakes={ts.errors}
            timeMs={started ? msLeft : durationMs}
            timeLabel="TIME LEFT"
            progress={elapsed / durationMs}
            progressLabel="Race time used"
            running={started && !timeUp}
          />
        </div>
      )}

      <div className="race-field">
        <LiveStandings racers={ranked.map((s) => ({ id: s.id, name: s.name, wpm: s.netWpm }))} localId={userId} />
        <div className="race-track relative">
          <Track cars={cars} total={racePlayers.length} started={started} destination={destinationFor(race.mode, lobby?.destination)} lanes={VISIBLE_CARS} />
          {(!started || elapsed < GO_BANNER_MS) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-ink/85">
              <CountdownFrame value={started ? 'GO!' : countdownValue} />
            </div>
          )}
        </div>
      </div>

      <div className={`race-status-strip ${!started ? 'is-waiting' : timeUp ? 'is-finished' : ''}`}>
        <span className="race-flag"><i aria-hidden="true" />{!started ? 'ON THE GRID' : timeUp ? 'CHEQUERED FLAG' : 'GREEN FLAG'}</span>
        <div className="race-status-message" role="status">
          {board ? <PitBoard key={board.id} event={board} /> : <span>{!started ? 'Get ready for the countdown' : timeUp ? 'Confirming official results…' : 'Race in progress'}</span>}
        </div>
      </div>

      {isRacer && (
        <div className="race-typing">
          <TypingPanel
            ref={inputRef}
            state={ts}
            onKeyDown={onKeyDown}
            variant={variant}
            compact
            waiting={!started}
            doneLabel={timeUp && started ? "TIME'S UP" : undefined}
          />
          <p className="race-provisional g-small g-muted">{timeUp && started ? "Time’s up. Locking in the final lines and the official results…" : 'Positions are provisional until results are confirmed.'}</p>
          {warning && <Banner tone="warning">{warning}</Banner>}
        </div>
      )}
    </div>
  );
}
