import {
  coefficientOfVariation,
  openingWpm,
  rollingWpms,
  sectionAccuracies,
  stdDev,
  timeToReach,
  valueAt,
} from './samples';
import { SECTIONS } from './typing';
import type { PassageMode, PlayerId, RaceResult } from './types';

/*
 * Trophy rules, implemented exactly as specified in "Exact trophy criteria for
 * the typing race game". Inputs are server-verified race statistics; awards are
 * computed on the server after the race (supabase/functions/award-trophies).
 *
 * Global rules:
 *  - Only players who completed the passage qualify (flagged players never do).
 *  - One winner per race trophy. Each trophy applies its own tie-breakers, then
 *    the official finishing order (server completion time, then event order).
 *  - A trophy whose metric cannot be calculated is not awarded.
 *  - Unstoppable is a progression achievement, separate from race trophies.
 */

export const SPEED_OVER_POWER_MIN_ACCURACY = 80;
export const SPEED_OVER_POWER_MAX_ACCURACY = 90;
export const QUICK_START_FRACTION = 0.2;
export const COMEBACK_CHECKPOINT_FRACTION = 0.2;
export const PEAK_WINDOW_MS = 5_000;
export const CONSISTENCY_WINDOW_MS = 10_000;
export const MIN_CONSISTENCY_WINDOWS = 3;
export const KEYBOARD_CHAOS_MIN_ATTEMPTS = 100;
export const UNSTOPPABLE_STREAK = 3;

export type TrophyCategory = 'podium' | 'speed' | 'accuracy' | 'funny' | 'special';

export type TrophyId =
  | 'gold' | 'silver' | 'bronze'
  | 'speedDemon' | 'fastestFingers' | 'speedOverPower' | 'quickStarter'
  | 'perfectionist' | 'sharpShooter' | 'cleanRun' | 'steadyHands'
  | 'oopsFactory' | 'keyboardChaos' | 'slowAndSteady' | 'lastButPersistent'
  | 'comebackKid' | 'consistency' | 'unstoppable' | 'codeWarrior' | 'participation';

export interface TrophyInfo {
  name: string;
  emoji: string;
  category: TrophyCategory;
  /** The exact criterion, shown to players. */
  rule: string;
  /** Progression achievements span races; everything else is a race trophy. */
  progression?: boolean;
}

export const TROPHIES: Record<TrophyId, TrophyInfo> = {
  gold: { name: 'Gold Champion', emoji: '🥇', category: 'podium', rule: 'Finish in 1st place based on official race completion time.' },
  silver: { name: 'Silver Runner-Up', emoji: '🥈', category: 'podium', rule: 'Finish in 2nd place.' },
  bronze: { name: 'Bronze Racer', emoji: '🥉', category: 'podium', rule: 'Finish in 3rd place.' },
  speedDemon: { name: 'Speed Demon', emoji: '🔥', category: 'speed', rule: 'Highest average WPM across the entire passage.' },
  fastestFingers: { name: 'Fastest Fingers', emoji: '⚡', category: 'speed', rule: 'Highest peak WPM in a rolling 5-second window.' },
  speedOverPower: { name: 'Speed Over Power', emoji: '💨', category: 'speed', rule: `Highest average WPM among finishers with accuracy of at least ${SPEED_OVER_POWER_MIN_ACCURACY}% but below ${SPEED_OVER_POWER_MAX_ACCURACY}%.` },
  quickStarter: { name: 'Quick Starter', emoji: '🚀', category: 'speed', rule: 'Highest average WPM during the first 20% of the passage.' },
  perfectionist: { name: 'Perfectionist', emoji: '💎', category: 'accuracy', rule: 'Finish with 100% accuracy and zero incorrect character attempts.' },
  sharpShooter: { name: 'Sharp Shooter', emoji: '🎯', category: 'accuracy', rule: 'Highest accuracy among finishers who made at least one mistake.' },
  cleanRun: { name: 'Clean Run', emoji: '✨', category: 'accuracy', rule: 'Complete the passage without backspace or delete and without any incorrect characters.' },
  steadyHands: { name: 'Steady Hands', emoji: '🤲', category: 'accuracy', rule: 'Lowest variation (standard deviation) in accuracy across ten equal sections of the passage.' },
  oopsFactory: { name: 'Oops Factory', emoji: '🙈', category: 'funny', rule: 'Most incorrect character attempts among finishers, including corrected ones.' },
  keyboardChaos: { name: 'Keyboard Chaos', emoji: '🌪️', category: 'funny', rule: `Most mistakes per 100 character attempts, with at least ${KEYBOARD_CHAOS_MIN_ATTEMPTS} attempts.` },
  slowAndSteady: { name: 'Slow and Steady', emoji: '🐢', category: 'funny', rule: 'Lowest average WPM among finishers.' },
  lastButPersistent: { name: 'Last but Persistent', emoji: '🏳️', category: 'funny', rule: 'Last place among players who completed the passage (at least two must finish).' },
  comebackKid: { name: 'Comeback Kid', emoji: '📈', category: 'special', rule: 'Most positions gained between reaching 20% of the passage and the final ranking (at least one).' },
  consistency: { name: 'Consistency King/Queen', emoji: '👑', category: 'special', rule: 'Lowest coefficient of variation in rolling 10-second WPM, with at least three windows.' },
  unstoppable: { name: 'Unstoppable', emoji: '🔁', category: 'special', rule: `Complete ${UNSTOPPABLE_STREAK} consecutive races in the same lobby without abandoning or disconnecting. Earned again every ${UNSTOPPABLE_STREAK} races.`, progression: true },
  codeWarrior: { name: 'Code Warrior', emoji: '👨‍💻', category: 'special', rule: 'Highest Coding Mode score: average WPM × accuracy ÷ 100.' },
  participation: { name: 'Participation Trophy', emoji: '🎗️', category: 'special', rule: 'Complete the race without qualifying for any other trophy.' },
};

export interface Award {
  trophy: TrophyId;
  /** The exact statistic that earned it, e.g. "112.4 average WPM". */
  reason: string;
}

export interface TrophyContext {
  mode: PassageMode;
  passageLength: number;
}

const one = (n: number) => n.toFixed(1);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
};
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/** A tie-breaker: larger values win. */
type Key = (r: RaceResult) => number;
const higherAccuracy: Key = (r) => r.accuracy;
const fewerMistakes: Key = (r) => -r.errors;

/**
 * Picks the candidate with the highest `metric`; ties go through `tieBreakers`
 * in order and finally to the official finishing order (lower rank).
 */
function pick(
  candidates: readonly RaceResult[],
  metric: (r: RaceResult) => number | null,
  tieBreakers: Key[] = [],
): { r: RaceResult; value: number } | undefined {
  const scored = candidates
    .map((r) => ({ r, value: metric(r) }))
    .filter((c): c is { r: RaceResult; value: number } => c.value !== null && Number.isFinite(c.value));
  scored.sort((a, b) => {
    if (a.value !== b.value) return b.value - a.value;
    for (const key of tieBreakers) {
      const d = key(b.r) - key(a.r);
      if (d !== 0) return d;
    }
    return a.r.rank - b.r.rank;
  });
  return scored[0];
}

/** Each player's position (1-based) among `field` at the moment they first reached `chars`. */
function positionWhenReached(r: RaceResult, field: readonly RaceResult[], chars: number): number | null {
  const t = timeToReach(r.samples, chars);
  if (t === null) return null;
  const ahead = field.filter((o) => {
    if (o === r) return false;
    const c = valueAt(o.samples, t, 1);
    if (c !== chars) return c > chars;
    const reached = timeToReach(o.samples, chars);
    return reached !== null && reached < t;
  }).length;
  return ahead + 1;
}

export function awardTrophies(
  results: readonly RaceResult[],
  ctx: TrophyContext,
): Map<PlayerId, Award[]> {
  const awards = new Map<PlayerId, Award[]>();
  const give = (r: RaceResult | undefined, trophy: TrophyId, reason: string) => {
    if (r) awards.set(r.id, [...(awards.get(r.id) ?? []), { trophy, reason }]);
  };

  const byRank = [...results].sort((a, b) => a.rank - b.rank);
  const racing = byRank.filter((r) => !r.flagged);
  const finishers = racing.filter((r) => r.finishedMs !== null);
  const speedTies = [higherAccuracy, fewerMistakes];

  // Podium ------------------------------------------------------------------
  (['gold', 'silver', 'bronze'] as const).forEach((trophy, i) => {
    const r = finishers[i];
    if (r) give(r, trophy, `Finished ${ordinal(i + 1)} in ${seconds(r.finishedMs!)}`);
  });

  // Speed -------------------------------------------------------------------
  const demon = pick(finishers, (r) => r.netWpm, speedTies);
  if (demon) give(demon.r, 'speedDemon', `${one(demon.value)} average WPM`);

  const fingers = pick(
    finishers,
    (r) => {
      const windows = rollingWpms(r.samples, r.finishedMs!, PEAK_WINDOW_MS);
      return windows.length ? Math.max(...windows) : null;
    },
    speedTies,
  );
  if (fingers) give(fingers.r, 'fastestFingers', `${one(fingers.value)} peak WPM`);

  const sop = pick(
    finishers.filter((r) => r.accuracy >= SPEED_OVER_POWER_MIN_ACCURACY && r.accuracy < SPEED_OVER_POWER_MAX_ACCURACY),
    (r) => r.netWpm,
    speedTies,
  );
  if (sop) give(sop.r, 'speedOverPower', `${one(sop.value)} WPM · ${one(sop.r.accuracy)}% accuracy`);

  const starter = pick(finishers, (r) => openingWpm(r.samples, ctx.passageLength, QUICK_START_FRACTION), speedTies);
  if (starter) give(starter.r, 'quickStarter', `${one(starter.value)} WPM · first 20%`);

  // Accuracy ----------------------------------------------------------------
  const flawless = finishers.filter((r) => r.errors === 0);
  // Every flawless finisher has 100%: the earliest completion wins.
  const perfect = pick(flawless, () => 0);
  if (perfect) give(perfect.r, 'perfectionist', `100% accuracy · 0 mistakes`);

  const sharp = pick(finishers.filter((r) => r.errors > 0), (r) => r.accuracy, [fewerMistakes]);
  if (sharp) give(sharp.r, 'sharpShooter', `${one(sharp.value)}% accuracy · ${plural(sharp.r.errors, 'mistake')}`);

  const clean = pick(flawless.filter((r) => r.deletions === 0), () => 0);
  if (clean) give(clean.r, 'cleanRun', '0 mistakes · 0 deletions');

  const steady = pick(finishers, (r) => {
    const accs = sectionAccuracies(r.sectionKeystrokes, r.sectionErrors, SECTIONS);
    return accs ? -stdDev(accs) : null;
  });
  if (steady) give(steady.r, 'steadyHands', `${(-steady.value).toFixed(2)} percentage-point deviation`);

  // Funny -------------------------------------------------------------------
  const mistakeRate: Key = (r) => (r.keystrokes > 0 ? r.errors / r.keystrokes : 0);

  const oops = pick(finishers.filter((r) => r.errors > 0), (r) => r.errors, [mistakeRate]);
  if (oops) give(oops.r, 'oopsFactory', `${plural(oops.value, 'incorrect attempt')}`);

  const chaos = pick(
    finishers.filter((r) => r.keystrokes >= KEYBOARD_CHAOS_MIN_ATTEMPTS && r.errors > 0),
    (r) => (r.errors / r.keystrokes) * 100,
    [(r) => r.errors],
  );
  if (chaos) give(chaos.r, 'keyboardChaos', `${one(chaos.value)} mistakes / 100 attempts`);

  const slow = pick(finishers, (r) => -r.netWpm);
  if (slow) give(slow.r, 'slowAndSteady', `${one(-slow.value)} average WPM`);

  if (finishers.length >= 2) {
    const last = finishers[finishers.length - 1]!;
    give(last, 'lastButPersistent', `${ordinal(finishers.length)} of ${finishers.length} finishers`);
  }

  // Special -----------------------------------------------------------------
  const checkpoint = Math.ceil(ctx.passageLength * COMEBACK_CHECKPOINT_FRACTION);
  const comeback = pick(finishers, (r) => {
    const start = positionWhenReached(r, racing, checkpoint);
    if (start === null) return null;
    const gained = start - (racing.indexOf(r) + 1);
    return gained >= 1 ? gained : null;
  });
  if (comeback) {
    const to = racing.indexOf(comeback.r) + 1;
    give(comeback.r, 'comebackKid', `+${plural(comeback.value, 'position')} · ${ordinal(to + comeback.value)} → ${ordinal(to)}`);
  }

  const consistent = pick(finishers, (r) => {
    const windows = rollingWpms(r.samples, r.finishedMs!, CONSISTENCY_WINDOW_MS);
    if (windows.length < MIN_CONSISTENCY_WINDOWS) return null;
    const cv = coefficientOfVariation(windows);
    return cv === null ? null : -cv;
  });
  if (consistent) give(consistent.r, 'consistency', `${one(-consistent.value)}% WPM variation`);

  if (ctx.mode === 'coding') {
    const coder = pick(finishers, (r) => r.netWpm * (r.accuracy / 100), [higherAccuracy]);
    if (coder) give(coder.r, 'codeWarrior', `${one(coder.value)} score · Coding Mode`);
  }

  // Participation: any finisher without a race trophy.
  for (const r of finishers) {
    if (!awards.has(r.id)) give(r, 'participation', 'Passage completed');
  }

  // Progression achievement, independent of race trophies.
  for (const r of finishers.filter((r) => r.streak > 0 && r.streak % UNSTOPPABLE_STREAK === 0)) {
    give(r, 'unstoppable', `${r.streak} consecutive completions`);
  }
  return awards;
}
