import { SECTIONS, passageLength, splitWords } from './typing';
import type { RaceResult, Sample } from './types';

/** The race_players columns needed to rebuild verified results. */
export interface RacePlayerRow {
  user_id: string;
  name: string;
  rank: number | null;
  correct_chars: number;
  keystrokes: number;
  errors: number;
  deletions: number;
  section_keystrokes: number[] | null;
  section_errors: number[] | null;
  finished_at: string | null;
  net_wpm: number | null;
  gross_wpm: number | null;
  accuracy: number | null;
  flagged: boolean;
  samples: Sample[] | null;
}

export interface RaceRowContext {
  passage: string;
  /** races.start_at (server GO). */
  startAt: string;
  /** user_id → consecutive completions in this lobby. */
  streaks: ReadonlyMap<string, number>;
}

const sections = (v: number[] | null) => (v && v.length === SECTIONS ? v : Array<number>(SECTIONS).fill(0));

/**
 * Converts finalised race_players rows into RaceResults (rank order). Ranks,
 * WPM and accuracy are the server's; nothing is recomputed from client clocks.
 */
export function raceResultsFromRows(rows: readonly RacePlayerRow[], ctx: RaceRowContext): RaceResult[] {
  const startAt = Date.parse(ctx.startAt);
  const len = passageLength(splitWords(ctx.passage));
  return rows
    .filter((r) => r.rank !== null)
    .sort((a, b) => a.rank! - b.rank!)
    .map((r) => ({
      id: r.user_id,
      name: r.name,
      rank: r.rank!,
      correctChars: r.correct_chars,
      keystrokes: r.keystrokes,
      errors: r.errors,
      deletions: r.deletions,
      sectionKeystrokes: sections(r.section_keystrokes),
      sectionErrors: sections(r.section_errors),
      finishedMs: r.finished_at ? Date.parse(r.finished_at) - startAt : null,
      progress: len ? Math.min(1, r.correct_chars / len) : 0,
      netWpm: r.net_wpm ?? 0,
      grossWpm: r.gross_wpm ?? 0,
      accuracy: r.accuracy ?? 100,
      flagged: r.flagged,
      samples: r.samples ?? [],
      streak: ctx.streaks.get(r.user_id) ?? 0,
    }));
}
