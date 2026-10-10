import { SECTIONS, type PlayerStats, type RaceResult, type Sample } from '../src';

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

/** Steady typist: `cps` correct chars per second, one sample per second, no errors. */
export function steadySamples(cps: number, totalChars: number): Sample[] {
  const out: Sample[] = [];
  for (let t = 1; ; t++) {
    const c = Math.min(totalChars, cps * t);
    out.push([t * 1000, c, c, 0]);
    if (c >= totalChars) return out;
  }
}

export const evenSections = (keystrokes: number, errors = 0) => ({
  sectionKeystrokes: Array<number>(SECTIONS).fill(keystrokes / SECTIONS),
  sectionErrors: Array<number>(SECTIONS).fill(errors / SECTIONS),
});

/** Results in rank order; rank comes from array position. */
export function results(list: (Partial<RaceResult> & { id: string })[]): RaceResult[] {
  return list.map((p, i) => ({
    ...stats(p),
    rank: i + 1,
    flagged: false,
    samples: [],
    deletions: 0,
    ...evenSections(100),
    streak: 1,
    ...p,
  }));
}
