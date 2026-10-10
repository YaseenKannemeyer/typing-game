import { CHARS_PER_WORD } from './constants';
import type { PlayerProgress, PlayerStats } from './types';

export function wpm(chars: number, ms: number): number {
  if (ms <= 0) return 0;
  return chars / CHARS_PER_WORD / (ms / 60_000);
}

export function accuracy(keystrokes: number, errors: number): number {
  if (keystrokes <= 0) return 100;
  return (Math.max(0, keystrokes - errors) / keystrokes) * 100;
}

/**
 * @param reference   characters that count as full progress (the leader's
 *                    total in a timed race, the passage length in practice).
 * @param elapsedMs   time since race start; ignored once the player has
 *                    finished (their finish time is used instead).
 */
export function computeStats(
  p: PlayerProgress,
  reference: number,
  elapsedMs: number,
): PlayerStats {
  const ms = p.finishedMs ?? elapsedMs;
  return {
    ...p,
    progress: reference > 0 ? Math.min(1, p.correctChars / reference) : 0,
    netWpm: wpm(p.correctChars, ms),
    grossWpm: wpm(p.keystrokes, ms),
    accuracy: accuracy(p.keystrokes, p.errors),
  };
}
