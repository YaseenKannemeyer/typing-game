import type { PlayerStats, RankedPlayer } from '../src';

export function stats(over: Partial<PlayerStats> & { id: string }): PlayerStats {
  return {
    name: over.id,
    correctChars: 0,
    keystrokes: 0,
    errors: 0,
    finishedMs: null,
    progress: 0,
    netWpm: 0,
    grossWpm: 0,
    accuracy: 100,
    ...over,
  };
}

export function ranked(list: (Partial<PlayerStats> & { id: string })[]): RankedPlayer[] {
  return list.map((p, i) => ({ ...stats(p), rank: i + 1 }));
}
