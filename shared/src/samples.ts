import { wpm } from './stats';
import type { Sample } from './types';

const ORIGIN: Sample = [0, 0, 0, 0];
const MS = 0;
const CHARS = 1;

/** Rolling windows advance by one server second. */
export const WINDOW_STEP_MS = 1_000;

function points(samples: readonly Sample[]): readonly Sample[] {
  return [ORIGIN, ...samples];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Linearly interpolated value of `field` at `ms`; holds the last value afterwards. */
export function valueAt(samples: readonly Sample[], ms: number, field: 1 | 2 | 3): number {
  const pts = points(samples);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (ms <= b[MS]) {
      const span = b[MS] - a[MS];
      return span > 0 ? lerp(a[field], b[field], (ms - a[MS]) / span) : b[field];
    }
  }
  return pts[pts.length - 1]![field];
}

/** Interpolated time at which `chars` correct characters were reached, or null if never. */
export function timeToReach(samples: readonly Sample[], chars: number): number | null {
  const pts = points(samples);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (b[CHARS] >= chars) {
      const span = b[CHARS] - a[CHARS];
      return span > 0 ? lerp(a[MS], b[MS], (chars - a[CHARS]) / span) : b[MS];
    }
  }
  return null;
}

/**
 * Net WPM in every full window of `windowMs` between GO and `endMs`, stepping
 * one second at a time. Zero-progress windows are included; partial windows
 * are not.
 */
export function rollingWpms(samples: readonly Sample[], endMs: number, windowMs: number): number[] {
  const out: number[] = [];
  for (let t = 0; t + windowMs <= endMs; t += WINDOW_STEP_MS) {
    out.push(wpm(valueAt(samples, t + windowMs, CHARS) - valueAt(samples, t, CHARS), windowMs));
  }
  return out;
}

/** Net WPM from GO until `ms` (e.g. the first 20% of the race time). */
export function wpmUntil(samples: readonly Sample[], ms: number): number | null {
  return ms > 0 ? wpm(valueAt(samples, ms, CHARS), ms) : null;
}

/** Net WPM from GO until the first `fraction` of the passage was typed correctly. */
export function openingWpm(samples: readonly Sample[], passageLength: number, fraction: number): number | null {
  const target = Math.ceil(passageLength * fraction);
  const t = timeToReach(samples, target);
  return t === null || t <= 0 ? null : wpm(target, t);
}

/** Accuracy (%) per section, or null unless every section has at least one attempt. */
export function sectionAccuracies(keystrokes: readonly number[], errors: readonly number[], sections: number): number[] | null {
  if (keystrokes.length !== sections || errors.length !== sections) return null;
  if (keystrokes.some((k) => k <= 0)) return null;
  return keystrokes.map((k, i) => (Math.max(0, k - errors[i]!) / k) * 100);
}

export function mean(values: readonly number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/** Population standard deviation. */
export function stdDev(values: readonly number[]): number {
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

/** Standard deviation / mean × 100, or null if the mean is not positive. */
export function coefficientOfVariation(values: readonly number[]): number | null {
  const m = mean(values);
  return m > 0 ? (stdDev(values) / m) * 100 : null;
}
