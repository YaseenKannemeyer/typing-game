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

/**
 * Spectator lanes: there is no local racer, so the track shows the leaders.
 * A featured racer outside the top `count` takes the last lane, so the
 * featured car is always on the road. Order stays leader-most first.
 *
 * @param ranked leader first
 * @param featuredId the racer the spectator picked, or null
 */
export function getSpectatorLanes<T extends { id: PlayerId }>(
  ranked: readonly T[],
  featuredId: PlayerId | null,
  count = VISIBLE_CARS,
): T[] {
  const top = ranked.slice(0, count);
  if (featuredId === null || count < 1 || top.some((p) => p.id === featuredId)) return top;
  const featured = ranked.find((p) => p.id === featuredId);
  return featured ? [...top.slice(0, count - 1), featured] : top;
}
