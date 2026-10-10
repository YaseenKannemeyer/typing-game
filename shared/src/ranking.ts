import type { PlayerStats, RankedPlayer } from './types';

/**
 * Finished players by finish time, then unfinished by progress, then net WPM.
 * Ties fall back to player id so the order never flickers between updates.
 */
export function comparePlayers(a: PlayerStats, b: PlayerStats): number {
  const aDone = a.finishedMs !== null;
  const bDone = b.finishedMs !== null;
  if (aDone && bDone) {
    if (a.finishedMs !== b.finishedMs) return a.finishedMs! - b.finishedMs!;
  } else if (aDone !== bDone) {
    return aDone ? -1 : 1;
  } else {
    if (a.progress !== b.progress) return b.progress - a.progress;
    if (a.netWpm !== b.netWpm) return b.netWpm - a.netWpm;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function rankPlayers(players: readonly PlayerStats[]): RankedPlayer[] {
  return [...players].sort(comparePlayers).map((p, i) => ({ ...p, rank: i + 1 }));
}
