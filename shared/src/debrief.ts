import { CHARS_PER_WORD } from './constants';
import { lineWords, typedWords, type TypingState } from './typing';
import type { Sample } from './types';

/** One window of a race timeline. Null values mean "no data", never zero. */
export interface TimelinePoint {
  /** Window start and end, ms from race start. */
  startMs: number;
  endMs: number;
  /** Windowed WPM: correct characters gained in this window only. */
  wpm: number | null;
  /** Correct attempts / all attempts in this window (0..100). */
  accuracy: number | null;
  attempts: number;
}

/** Last sample at or before `ms` (samples are cumulative and time-ordered). */
function charsAt(samples: readonly Sample[], ms: number): number | null {
  let found: number | null = ms <= 0 ? 0 : null;
  for (const s of samples) {
    if (s[0] > ms) break;
    found = s[1];
  }
  return found;
}

/**
 * Splits a timed race into `sectionKeystrokes.length` equal windows. Speed
 * comes from the server's progress samples, accuracy from its per-window
 * attempt counts. A window with no sample at its end has no WPM (a gap).
 * Correct characters can dip when an unlocked line is re-scored, so a
 * window's gain is floored at 0.
 */
export function raceTimeline(
  samples: readonly Sample[],
  durationMs: number,
  sectionKeystrokes: readonly number[],
  sectionErrors: readonly number[],
): TimelinePoint[] | null {
  const n = sectionKeystrokes.length;
  if (durationMs <= 0 || n === 0 || sectionErrors.length !== n || samples.length === 0) return null;
  const size = durationMs / n;
  const out: TimelinePoint[] = [];
  for (let i = 0; i < n; i++) {
    const startMs = Math.round(i * size);
    const endMs = Math.round((i + 1) * size);
    const from = charsAt(samples, startMs);
    // The last window also takes the final lines locked just after the clock.
    const to = i === n - 1 ? (samples.at(-1)![0] >= startMs ? samples.at(-1)![1] : null) : charsAt(samples, endMs);
    const hasSampleIn = samples.some((s) => s[0] > startMs && (i === n - 1 || s[0] <= endMs));
    const wpm =
      from === null || to === null || !hasSampleIn ? null : Math.max(0, to - from) / CHARS_PER_WORD / ((endMs - startMs) / 60_000);
    const attempts = sectionKeystrokes[i] ?? 0;
    const errors = sectionErrors[i] ?? 0;
    out.push({
      startMs,
      endMs,
      wpm,
      accuracy: attempts > 0 ? (Math.max(0, attempts - errors) / attempts) * 100 : null,
      attempts,
    });
  }
  return out;
}

/**
 * The passage word an attempt was judged against, if that attempt was a
 * mistake. `before`/`after` are the typing states around one keystroke.
 * Space and Enter count against the word they end.
 */
export function mistakeWord(before: TypingState, after: TypingState): number | null {
  if (after.errors <= before.errors) return null;
  const line = before.lines[before.lineIndex];
  if (!line) return null;
  const k = typedWords(before).length - 1;
  return line.start + Math.min(k, lineWords(before).length - 1);
}

export interface DifficultWord {
  /** Word index in the passage: repeated words keep separate offsets. */
  index: number;
  text: string;
  mistakes: number;
}

/** Words with the most incorrect attempts, most first, then passage order. */
export function difficultWords(words: readonly string[], mistakes: Readonly<Record<number, number>>, limit = 5): DifficultWord[] {
  return Object.entries(mistakes)
    .map(([i, m]) => ({ index: Number(i), text: words[Number(i)] ?? '', mistakes: m }))
    .filter((w) => w.text && w.mistakes > 0)
    .sort((a, b) => b.mistakes - a.mistakes || a.index - b.index)
    .slice(0, limit);
}
