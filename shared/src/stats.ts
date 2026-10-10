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
 * @param elapsedMs time since race start; ignored once the player has finished
 *                  (their finish time is used instead).
 */
export function computeStats(
  p: PlayerProgress,
  passageLength: number,
  elapsedMs: number,
): PlayerStats {
  const ms = p.finishedMs ?? elapsedMs;
  return {
    ...p,
    progress: passageLength > 0 ? Math.min(1, p.correctChars / passageLength) : 0,
    netWpm: wpm(p.correctChars, ms),
    grossWpm: wpm(p.keystrokes, ms),
    accuracy: accuracy(p.keystrokes, p.errors),
  };
}
