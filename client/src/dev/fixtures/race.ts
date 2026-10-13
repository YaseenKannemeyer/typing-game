import {
  backspace,
  computeStats,
  createTypingState,
  getVisibleCars,
  lockLine,
  rankPlayers,
  typeChar,
  typedCorrectChars,
  type TypingState,
} from '@race/shared';
import { modeDesign } from '../../art/gridArt';
import { VEHICLE_MODELS, type VehicleModel } from '../../art/vehicleArt';
import type { DestinationId } from '../../art/worldArt';
import type { CountdownValue, RacePhase, RaceViewModel } from '../../components/race/raceViewModel';
import type { TrackCar } from '../../components/Track';
import type { TypingVariant } from '../../components/TypingPanel';
import { deliveryOf, type Delivery, type DeliveryStatus } from '../../game/delivery';
import { vehicleFor } from '../../game/vehicles';

/*
 * Frozen race snapshots for the dev gallery. Every value is derived the way
 * screens/Race.tsx derives it (real typing engine, computeStats, rankPlayers,
 * getVisibleCars, vehicleFor), so layouts are tested against realistic data.
 * All players are fictional.
 */

const STANDARD = Array.from({ length: 12 }, () =>
  'The pit wall went quiet as the lights came on. Every driver on the grid knew the plan: hold a steady rhythm, keep the hands loose, and never chase a word that has already gone. Clean laps win long races, and the clock is the only judge that matters.',
).join(' ');

const CODING = Array.from({ length: 6 }, () =>
  'const telemetry = createTelemetryBuffer({ capacity: 4096, sampleIntervalMs: 250 }); export function normalizeVehicleLiveryConfigurationForBroadcast(previousSnapshot, nextSnapshot) { return Object.assign({}, previousSnapshot, nextSnapshot?.livery ?? {}); } if (raceControl.finalStretch && !telemetry.isPaused()) { telemetry.flush(); }',
).join(' ');

const SHAKESPEARE = Array.from({ length: 8 }, () =>
  'Once more unto the starting line, dear friends, once more; for in the race there is nothing so becomes a typist as modest stillness and an even hand, but when the green light blows in our ears, then imitate the action of the tiger.',
).join(' ');

/** The real engine, driven by keys: '\n' locks the line, '\b' is Backspace, anything else is typed. */
function drive(text: string, strict: boolean, keys: string): TypingState {
  let s = createTypingState(text, strict);
  for (const k of keys) s = k === '\n' ? lockLine(s) : k === '\b' ? backspace(s) : typeChar(s, k);
  return s;
}

/** The first `n` words typed correctly, each followed by Space (which locks a finished line). */
const words = (text: string, n: number) => text.split(' ').slice(0, n).join(' ') + (n > 0 ? ' ' : '');

interface Rival {
  name: string;
  chars: number;
  errors?: number;
  model: VehicleModel;
  color: string;
  number?: number;
}

const ME_ID = 'fixture-me';
const ME_NAME = 'You (fixture)';
const COLORS = ['#ffd23f', '#70e3c6', '#9fcaff', '#ff8a5c', '#c6a3ff', '#b9f46a', '#f472b6', '#e5e7eb'];
const NAMES = ['Nova', 'Kestrel', 'Juniper', 'Maximiliana-Rosalind', 'Bo', 'Ostara', 'Quill', 'Rennick', 'Tamsin', 'Ulla', 'Vesper', 'Wren', 'Xan', 'Yusuf', 'Zola'];

/** Rivals with the given correct-character counts, cycling through all 15 models. */
function rivals(chars: number[], offset = 0): Rival[] {
  return chars.map((c, i) => {
    const k = i + offset;
    return { name: NAMES[k % NAMES.length]!, chars: c, errors: k % 3, model: VEHICLE_MODELS[k % VEHICLE_MODELS.length]!, color: COLORS[k % COLORS.length]!, number: (k * 37) % 1000 };
  });
}

interface Spec {
  mode?: 'easy' | 'coding' | 'shakespeare';
  phase: RacePhase;
  countdown?: CountdownValue | null;
  durationMs?: number;
  usedFraction?: number;
  strict?: boolean;
  round?: { n: number; of: number } | null;
  destination?: DestinationId;
  rivals: Rival[];
  /** Keys the local racer has typed; null = spectating. */
  keys: string | null;
  myModel?: VehicleModel;
  raceControl?: RaceViewModel['raceControl'];
  warning?: string | null;
  connection?: RaceViewModel['connection'];
  viaRandom?: boolean;
  /** Delivery state; lines are counted from the real typing state. Default: synced. */
  delivery?: DeliverySpec;
}

interface DeliverySpec {
  status: DeliveryStatus;
  /** Unacknowledged lines, including the final line when `finalPending`. */
  unacked: number;
  finalPending?: boolean;
}

/** The model value the real queue would report with `unacked` lines outstanding. */
function deliveryFor(ts: TypingState, d: DeliverySpec = { status: 'synced', unacked: 0 }): Delivery {
  const finalPending = !!d.finalPending;
  const behind = d.unacked - (finalPending ? 1 : 0);
  const serverDone = ts.lines[Math.max(0, ts.lineIndex - behind)]!.start;
  const terminal = d.status === 'rejected' || d.status === 'late' ? d.status : null;
  return deliveryOf(ts, { serverDone, failed: d.status === 'retrying', terminal, finalPending });
}

const TRACK_END = 0.9;

export interface RaceFixture {
  kind: 'race';
  id: string;
  title: string;
  note?: string;
  model: RaceViewModel;
  /** The gallery cycles the delivery through these states (fixture page timer, not RaceView). */
  deliverySequence?: { delivery: Delivery; ms: number }[];
  /** Live typing in the gallery starts from this engine state (null when spectating). */
  typing: { text: string; strict: boolean; state: TypingState; enabled: boolean } | null;
}

function build(id: string, title: string, spec: Spec, note?: string): RaceFixture {
  const mode = spec.mode ?? 'easy';
  const text = mode === 'coding' ? CODING : mode === 'shakespeare' ? SHAKESPEARE : STANDARD;
  const variant: TypingVariant = mode === 'coding' ? 'coding' : mode === 'shakespeare' ? 'shakespeare' : 'standard';
  const strict = !!spec.strict;
  const durationMs = spec.durationMs ?? 120_000;
  const usedFraction = spec.phase === 'countdown' ? 0 : spec.phase === 'time-up' ? 1 : (spec.usedFraction ?? 0.5);
  const elapsed = Math.max(1, usedFraction * durationMs);
  const started = spec.phase !== 'countdown';

  const ts = spec.keys === null ? null : drive(text, strict, spec.keys);
  const players = [
    ...spec.rivals.map((r, i) => ({ id: `fixture-${i}`, ...r })),
    ...(ts ? [{ id: ME_ID, name: ME_NAME, chars: typedCorrectChars(ts), errors: ts.errors, model: spec.myModel ?? 'formula', color: '#ffd23f', number: 7 }] : []),
  ];
  const vehicles = new Map(players.map((p, i) => [p.id, vehicleFor({ name: p.name, car_color: p.color, vehicle: { model: p.model, number: p.number ?? i + 1 } }, i)]));
  const leaderChars = Math.max(0, ...players.map((p) => p.chars));
  const standings = players.map((p) =>
    computeStats({ id: p.id, name: p.name, correctChars: p.chars, keystrokes: 0, errors: 0, finishedMs: null }, leaderChars, elapsed),
  );
  const ranked = rankPlayers(standings);
  const rankOf = (pid: string) => ranked.findIndex((s) => s.id === pid) + 1;
  const leaderAt = started ? TRACK_END * Math.min(1, usedFraction) : 0;
  const errorsOf = new Map(players.map((p) => [p.id, p.errors ?? 0]));
  const cars: TrackCar[] = getVisibleCars(ranked, ts ? ME_ID : '').map((s) => ({
    id: s.id,
    name: s.name,
    vehicle: vehicles.get(s.id)!,
    rank: rankOf(s.id),
    progress: s.progress * leaderAt,
    percent: s.progress * 100,
    wpm: s.netWpm,
    errors: errorsOf.get(s.id) ?? 0,
    finished: spec.phase === 'time-up',
    isMe: s.id === ME_ID,
  }));
  const myStats = ts
    ? computeStats({ id: 'me', name: 'me', correctChars: typedCorrectChars(ts), keystrokes: ts.keystrokes, errors: ts.errors, finishedMs: null }, leaderChars, elapsed)
    : null;

  const model: RaceViewModel = {
    session: {
      modeName: modeDesign(mode).name,
      viaRandom: !!spec.viaRandom,
      variant,
      durationMs,
      strict,
      round: spec.round ?? null,
      destination: spec.destination ?? 'city',
      racerCount: players.length,
    },
    clock: {
      phase: spec.phase,
      countdown: spec.countdown !== undefined ? spec.countdown : spec.phase === 'go' ? 'GO!' : spec.phase === 'countdown' ? 'READY' : null,
      msLeft: spec.phase === 'countdown' ? durationMs + 3_000 : Math.max(0, durationMs - usedFraction * durationMs),
      usedFraction,
    },
    role: ts ? 'racer' : 'spectating',
    me: myStats ? { position: rankOf(ME_ID), total: players.length, wpm: myStats.netWpm, accuracy: myStats.accuracy, mistakes: ts!.errors } : null,
    cars,
    overflow: players.length > cars.length ? ranked.map((s) => ({ id: s.id, name: s.name, position: rankOf(s.id), progress: s.progress * leaderAt })) : null,
    raceControl: spec.raceControl ?? null,
    results: spec.phase === 'time-up' ? 'confirming' : 'provisional',
    warning: spec.warning ?? null,
    connection: spec.connection ?? 'live',
    delivery: ts ? deliveryFor(ts, spec.delivery) : null,
  };

  return {
    kind: 'race',
    id,
    title,
    note,
    model,
    typing: ts ? { text, strict, state: ts, enabled: spec.phase === 'go' || spec.phase === 'racing' } : null,
  };
}

const MID = words(STANDARD, 70); // ≈ 360 correct chars
const three = (a: number, b: number, c: number) => rivals([a, b, c]);

export const RACE_FIXTURES: RaceFixture[] = [
  build('race-countdown-ready', 'Countdown · READY', { phase: 'countdown', countdown: 'READY', rivals: three(0, 0, 0), keys: '' }),
  build('race-countdown-3', 'Countdown · 3', { phase: 'countdown', countdown: '3', rivals: three(0, 0, 0), keys: '' }),
  build('race-go', 'GO! banner', { phase: 'go', usedFraction: 0.004, rivals: three(4, 0, 2), keys: 'The ' }, 'Live: the input is enabled, type the passage.'),
  build('race-p1', 'Racing · local P1', { phase: 'racing', rivals: three(300, 240, 120), keys: MID }),
  build('race-middle', 'Racing · local P2 of 4', { phase: 'racing', rivals: three(520, 200, 90), keys: MID, raceControl: { id: 'fx:gain', type: 'gain', detail: '+1 · now P2. Keep that rhythm.' } }),
  build('race-last', 'Racing · local last', { phase: 'racing', rivals: three(700, 640, 600), keys: words(STANDARD, 20) }),
  build('race-2-racers', '2 racers', { phase: 'racing', rivals: rivals([410]), keys: MID }),
  build('race-15-racers', '15 racers · overflow minimap', { phase: 'racing', rivals: rivals([900, 860, 800, 760, 700, 650, 600, 300, 260, 220, 180, 140, 90, 40]), keys: MID }, 'Local racer is P8; the track windows around them.'),
  build('race-165-wpm', 'WPM 165', { phase: 'racing', durationMs: 120_000, usedFraction: 0.5, rivals: three(700, 500, 300), keys: words(STANDARD, 160) }, '≈165 net WPM after 60 s.'),
  build('race-mistake', 'Mistake on the current word', { phase: 'racing', rivals: three(300, 240, 120), keys: MID + 'stedy' }),
  build('race-strict-blocked', 'Zero-mistake · blocked at line end', {
    phase: 'racing',
    strict: true,
    rivals: three(300, 240, 120),
    keys: (() => {
      // Zero-mistake mode never moves past a wrong word, so the typo is in the line's last word.
      const base = drive(STANDARD, true, words(STANDARD, 12));
      const line = base.lines[base.lineIndex]!;
      const target = STANDARD.split(' ').slice(line.start, line.end);
      const last = target[target.length - 1]!;
      return words(STANDARD, line.start) + target.slice(0, -1).map((w) => w + ' ').join('') + 'x' + last.slice(1);
    })(),
  }),
  build('race-coding', 'Code passage · long tokens', { mode: 'coding', phase: 'racing', rivals: three(200, 150, 60), keys: words(CODING, 9), destination: 'neon' }),
  build('race-shakespeare', 'Shakespeare variant', { mode: 'shakespeare', phase: 'racing', rivals: three(200, 150, 60), keys: words(SHAKESPEARE, 12), destination: 'country' }),
  build('race-final-stretch', 'Final stretch board', { phase: 'racing', usedFraction: 0.93, rivals: three(800, 600, 400), keys: words(STANDARD, 140), raceControl: { id: 'fx:stretch', type: 'stretch', detail: '8 seconds left. Keep your rhythm.' } }),
  build('race-time-up', 'Time up · confirming results', { phase: 'time-up', rivals: three(900, 700, 500), keys: words(STANDARD, 150), raceControl: { id: 'fx:finish', type: 'finish', detail: "Time's up. Your official result is on its way." } }),
  build('race-reconnecting', 'Reconnecting', { phase: 'racing', rivals: three(300, 240, 120), keys: MID, connection: 'reconnecting' }, 'LobbyScreen banner shown above the race, as in a real room.'),
  build('race-warning', 'Input rejected warning', { phase: 'racing', rivals: three(300, 240, 120), keys: MID, warning: 'Your input was rejected as impossibly fast.' }),
  build('race-championship', 'Championship round · random mode', { phase: 'racing', round: { n: 2, of: 3 }, viaRandom: true, rivals: three(300, 240, 120), keys: MID, destination: 'coast' }),
  build('race-spectating', 'Spectating (joined mid-race)', { phase: 'racing', rivals: rivals([600, 520, 480, 300, 210]), keys: null }),
  // Delivery (game/useSubmitQueue): what the racer is told about their locked lines.
  build('race-delivery-sending-1', 'Delivery · sending 1 line', { phase: 'racing', rivals: three(300, 240, 120), keys: MID, delivery: { status: 'sending', unacked: 1 } }),
  build('race-delivery-sending-2', 'Delivery · sending 2 lines', { phase: 'racing', rivals: three(300, 240, 120), keys: MID, delivery: { status: 'sending', unacked: 2 } }),
  build('race-delivery-retrying', 'Delivery · retrying mid-race', { phase: 'racing', rivals: three(300, 240, 120), keys: MID, delivery: { status: 'retrying', unacked: 2 } }, 'Keep typing; delivery is retried every second.'),
  withSequence(
    build('race-delivery-recovery', 'Delivery · retrying → recovered', { phase: 'racing', rivals: three(300, 240, 120), keys: MID, delivery: { status: 'retrying', unacked: 3 } }, 'Cycles retrying (3 lines) → synced every 3 s, for the recovery announcement.'),
    [{ status: 'retrying', unacked: 3 }, { status: 'synced', unacked: 0 }],
  ),
  build('race-delivery-reconnecting', 'Delivery · retrying while reconnecting', { phase: 'racing', rivals: three(300, 240, 120), keys: MID, connection: 'reconnecting', delivery: { status: 'retrying', unacked: 2 } }, 'LobbyScreen reconnect banner plus delivery retrying: the 720px laptop worst case.'),
  build('race-delivery-final-retry', 'Delivery · final retry at time-up', { phase: 'time-up', rivals: three(900, 700, 500), keys: words(STANDARD, 150) + 'Clea', delivery: { status: 'retrying', unacked: 2, finalPending: true } }, 'One locked line plus the final line, awaiting confirmation.'),
  build('race-delivery-rejected', 'Delivery · line rejected', { phase: 'racing', rivals: three(300, 240, 120), keys: MID, delivery: { status: 'rejected', unacked: 1 } }),
  build('race-delivery-late', 'Delivery · race closed, 3 unconfirmed', { phase: 'time-up', rivals: three(900, 700, 500), keys: words(STANDARD, 150) + 'Clea', delivery: { status: 'late', unacked: 3, finalPending: true } }),
  build('race-delivery-late-1', 'Delivery · race closed, 1 unconfirmed', { phase: 'time-up', rivals: three(900, 700, 500), keys: words(STANDARD, 150) + 'Clea', delivery: { status: 'late', unacked: 1, finalPending: true } }),
];

function withSequence(f: RaceFixture, steps: DeliverySpec[], ms = 3_000): RaceFixture {
  return { ...f, deliverySequence: steps.map((d) => ({ delivery: deliveryFor(f.typing!.state, d), ms })) };
}

/** Every model once, for checking artwork at each viewport. */
export const ALL_MODELS: { model: VehicleModel; name: string; color: string; number: number }[] = VEHICLE_MODELS.map((model, i) => ({
  model,
  name: NAMES[i]!,
  color: COLORS[i % COLORS.length]!,
  number: [0, 7, 42, 99, 100, 512, 999][i % 7]!,
}));
