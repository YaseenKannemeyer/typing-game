import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  computeStats,
  FINISH_GRACE_MS,
  getVisibleCars,
  passageLength,
  PROGRESS_BROADCAST_MS,
  PROGRESS_SUBMIT_MS,
  RACE_HARD_CAP_MS,
  rankPlayers,
  resumeTypingState,
  typedCorrectChars,
  wpm,
} from '@race/shared';
import { modeDesign } from '../art/gridArt';
import { CountdownFrame, MomentBanner } from '../components/race/Moments';
import { Hud, Minimap } from '../components/race/Hud';
import { Track, type TrackCar } from '../components/Track';
import { TypingPanel, type TypingVariant } from '../components/TypingPanel';
import { Banner, Loading, Pill } from '../components/ui';
import { api } from '../lib/api';
import { useServerNow } from '../lib/clock';
import { useSound } from '../game/sound';
import type { LobbyState } from '../game/useLobby';
import type { LiveProgress } from '../game/types';
import { useRaceMoments } from '../game/useRaceMoments';
import { useTyping } from '../game/useTyping';
import { vehicleFor } from '../game/vehicles';

interface Props {
  state: LobbyState;
  sendProgress: (id: string, p: LiveProgress) => void;
}

/** Re-rank at most this often so lanes don't jitter on every keystroke. */
const RANK_INTERVAL_MS = 250;
const GO_BANNER_MS = 900;

export function Race({ state, sendProgress }: Props) {
  const { race, passage, racePlayers, players, live, userId, clockOffset, lobby } = state;
  const now = useServerNow(clockOffset, 100);
  const { play } = useSound();
  const startAt = race ? Date.parse(race.start_at) : 0;
  const myRow = racePlayers.find((p) => p.user_id === userId);
  const isRacer = !!myRow;
  const started = now >= startAt;
  const racing = race?.status === 'racing';
  const serverFinished = !!myRow?.finished_at;

  const typing = useTyping(
    passage ?? '',
    isRacer && started && racing && !serverFinished,
    // After a refresh mid-race, resume from what the server already accepted.
    () =>
      resumeTypingState(passage ?? '', {
        wordsDone: myRow?.words_done ?? 0,
        keystrokes: myRow?.keystrokes ?? 0,
        errors: myRow?.errors ?? 0,
        deletions: myRow?.deletions ?? 0,
        sectionKeystrokes: myRow?.section_keystrokes ?? [],
        sectionErrors: myRow?.section_errors ?? [],
      }),
  );
  const { state: ts } = typing;
  const total = passageLength(ts.words);
  const elapsed = Math.max(0, now - startAt);
  const inputRef = useRef<HTMLInputElement>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (started && isRacer) inputRef.current?.focus();
  }, [started, isRacer]);

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

  // Submit completed words in batches; the server validates and timestamps them.
  const tsRef = useRef(ts);
  tsRef.current = ts;
  const submitted = useRef(myRow?.words_done ?? 0);
  const inFlight = useRef(false);
  const flush = useRef(async () => {});
  flush.current = async () => {
    const s = tsRef.current;
    if (!race || inFlight.current || s.wordIndex <= submitted.current) return;
    inFlight.current = true;
    const from = submitted.current;
    try {
      const res = await api.submitProgress(race.id, from, s.words.slice(from, s.wordIndex), s);
      submitted.current = res.words_done;
      if (res.reason === 'too_fast') setWarning('Your input was rejected as impossibly fast.');
    } catch {
      // Network blip: the next tick retries from the same word.
    } finally {
      inFlight.current = false;
    }
  };
  useEffect(() => {
    if (!isRacer || !racing) return;
    const t = setInterval(() => void flush.current(), PROGRESS_SUBMIT_MS);
    return () => clearInterval(t);
  }, [isRacer, racing]);
  useEffect(() => {
    if (ts.finished) void flush.current();
  }, [ts.finished]);

  // Cosmetic live progress for other players' cars.
  const myChars = typedCorrectChars(ts);
  const liveRef = useRef({ chars: myChars, errors: ts.errors });
  liveRef.current = { chars: myChars, errors: ts.errors };
  useEffect(() => {
    if (!isRacer || !racing || !userId) return;
    let last = '';
    const t = setInterval(() => {
      const { chars, errors } = liveRef.current;
      if (`${chars}:${errors}` === last) return;
      last = `${chars}:${errors}`;
      sendProgress(userId, { chars, errors, wpm: wpm(chars, Date.now() + clockOffset - startAt) });
    }, PROGRESS_BROADCAST_MS);
    return () => clearInterval(t);
  }, [isRacer, racing, userId, sendProgress, clockOffset, startAt]);

  // Close the race once its deadline passes (any client may; the server checks).
  const deadline = race
    ? Math.min(startAt + RACE_HARD_CAP_MS, race.first_finish_at ? Date.parse(race.first_finish_at) + FINISH_GRACE_MS : Infinity)
    : Infinity;
  const lastFinalize = useRef(0);
  useEffect(() => {
    if (!race || !racing || now < deadline + 500 || now - lastFinalize.current < 3000) return;
    lastFinalize.current = now;
    void api.finalizeRace(race.id).catch(() => {});
  }, [race, racing, now, deadline]);

  // Standings: everyone's best-known progress, re-ranked on a fixed cadence.
  const vehicles = useMemo(() => new Map(players.map((p, i) => [p.user_id, vehicleFor(p, i)])), [players]);
  const [order, setOrder] = useState<string[]>([]);
  const standings = racePlayers.map((rp) => {
    const isMe = rp.user_id === userId;
    const chars = isMe ? myChars : Math.max(rp.correct_chars, live[rp.user_id]?.chars ?? 0);
    const finishedMs = rp.finished_at ? Date.parse(rp.finished_at) - startAt : isMe && ts.finished ? elapsed : null;
    return computeStats(
      { id: rp.user_id, name: rp.name, correctChars: Math.min(chars, total), keystrokes: 0, errors: 0, finishedMs },
      total,
      elapsed,
    );
  });
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
  const cars: TrackCar[] = getVisibleCars(ranked, userId ?? '').map((s) => ({
    id: s.id,
    name: s.name,
    // Racers who left the lobby keep a neutral car.
    vehicle: vehicles.get(s.id) ?? vehicleFor({ name: s.name, car_color: '#748782', vehicle: {} }),
    rank: rankOf(s.id),
    progress: s.progress,
    wpm: s.netWpm,
    errors: s.id === userId ? ts.errors : (live[s.id]?.errors ?? 0),
    finished: s.finishedMs !== null,
    isMe: s.id === userId,
  }));
  const myRank = rankOf(userId ?? '');
  const myStats = computeStats(
    {
      id: 'me', name: 'me', correctChars: myChars, keystrokes: ts.keystrokes, errors: ts.errors,
      finishedMs: ts.finished ? (myRow?.finished_at ? Date.parse(myRow.finished_at) - startAt : elapsed) : null,
    },
    total,
    elapsed,
  );

  // Sound + race moments for the local racer.
  const prevMine = useRef({ errors: ts.errors, rank: myRank, finished: ts.finished });
  useEffect(() => {
    const p = prevMine.current;
    if (started && isRacer) {
      if (ts.finished && !p.finished) play('finish');
      else if (ts.errors > p.errors) play('mistake');
      else if (myRank > 0 && p.rank > 0 && myRank < p.rank) play('overtake');
    }
    prevMine.current = { errors: ts.errors, rank: myRank, finished: ts.finished };
  }, [ts.errors, ts.finished, myRank, started, isRacer, play]);

  const finishTimes = useMemo(
    () => racePlayers.filter((r) => r.finished_at).map((r) => Date.parse(r.finished_at!)),
    [racePlayers],
  );
  const leader = ranked[0] ? { id: ranked[0].id, name: ranked[0].name } : null;
  const moment = useRaceMoments({ started, leader, myRank, myFinished: ts.finished, finishTimes });

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

  return (
    <div className="space-y-4">
      <div className="g-between">
        <div>
          <p className="g-eyebrow" style={{ color: design.color }}>{design.tag}</p>
          <h1 className="g-heading mt-1">
            {lobby?.mode === 'random' && <span className="text-muted">Random → </span>}
            {design.name}
          </h1>
        </div>
        {isRacer ? <Pill lime>{racePlayers.length} RACERS</Pill> : <Pill>SPECTATING</Pill>}
      </div>

      {!isRacer && <Banner tone="info">The race is under way. You'll be on the grid for the next one.</Banner>}
      {isRacer && serverFinished && <Banner tone="success">Your race is complete. Watching the rest of the grid…</Banner>}

      {isRacer && (
        <Hud
          position={myRank || racePlayers.length}
          total={racePlayers.length}
          wpm={myStats.netWpm}
          accuracy={myStats.accuracy}
          mistakes={ts.errors}
          elapsedMs={myStats.finishedMs ?? elapsed}
          progress={myStats.progress}
        />
      )}

      <div className="relative">
        <Track cars={cars} total={racePlayers.length} started={started} scene={design.scene} />
        {(!started || elapsed < GO_BANNER_MS) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-ink/85">
            <CountdownFrame value={started ? 'GO!' : countdownValue} />
          </div>
        )}
      </div>

      <Minimap
        racers={ranked.map((s) => ({ id: s.id, name: s.name, position: rankOf(s.id), progress: s.progress }))}
        localId={userId}
      />

      <div className="min-h-[86px]" aria-live="polite">
        {moment && <MomentBanner key={`${moment.kind}:${moment.name ?? ''}:${moment.gain ?? ''}`} moment={moment} />}
      </div>

      {isRacer && (
        <>
          <TypingPanel ref={inputRef} state={ts} onKeyDown={onKeyDown} variant={variant} waiting={!started || serverFinished} />
          {ts.finished && (
            <p className="g-small g-muted">
              The race closes in at most {Math.max(0, Math.ceil((deadline - now) / 1000))}s.
            </p>
          )}
          {warning && <Banner tone="warning">{warning}</Banner>}
        </>
      )}
    </div>
  );
}
