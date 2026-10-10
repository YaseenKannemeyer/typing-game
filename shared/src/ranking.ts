import type { PlayerStats, RankedPlayer } from './types';

/**
 * Timed races: racers still on the grid at the final whistle (finishedMs set)
 * rank above those who left; then highest net WPM, higher accuracy, fewer
 * mistakes. Ties fall back to player id so the order never flickers.
 */
export function comparePlayers(a: PlayerStats, b: PlayerStats): number {
  const aDone = a.finishedMs !== null;
  const bDone = b.finishedMs !== null;
  if (aDone !== bDone) return aDone ? -1 : 1;
  if (a.netWpm !== b.netWpm) return b.netWpm - a.netWpm;
  if (a.accuracy !== b.accuracy) return b.accuracy - a.accuracy;
  if (a.errors !== b.errors) return a.errors - b.errors;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function rankPlayers(players: readonly PlayerStats[]): RankedPlayer[] {
  return [...players].sort(comparePlayers).map((p, i) => ({ ...p, rank: i + 1 }));
}
