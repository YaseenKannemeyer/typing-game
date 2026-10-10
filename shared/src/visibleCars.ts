import { VISIBLE_CARS } from './constants';
import type { PlayerId } from './types';

/**
 * Picks which cars to draw: two players ahead of you, you, and one behind.
 * The window is clamped at either end, so first place shows you on top with
 * three chasers, and last place shows the three players directly ahead.
 *
 * @param ranked leader first
 * @returns a contiguous slice of `ranked`, leader-most first
 */
export function getVisibleCars<T extends { id: PlayerId }>(
  ranked: readonly T[],
  myId: PlayerId,
  count = VISIBLE_CARS,
): T[] {
  const n = ranked.length;
  if (n <= count) return [...ranked];
  const i = ranked.findIndex((p) => p.id === myId);
  if (i === -1) return ranked.slice(0, count);
  const start = Math.max(0, Math.min(i - 2, n - count));
  return ranked.slice(start, start + count);
}
