import type { PASSAGE_MODES, VOTE_MODES } from './constants';

export type PlayerId = string;
export type PassageMode = (typeof PASSAGE_MODES)[number];
export type VoteMode = (typeof VOTE_MODES)[number];
export type LobbyStatus = 'waiting' | 'voting' | 'racing';

/** Raw counters for one player in one race. */
export interface PlayerProgress {
  id: PlayerId;
  name: string;
  /** Passage characters typed correctly (including spaces between words). */
  correctChars: number;
  /** Character-producing keystrokes (backspace excluded). */
  keystrokes: number;
  /** Keystrokes that produced a wrong character, even if corrected later. */
  errors: number;
  /** Ms from race start to finish, or null if not finished. */
  finishedMs: number | null;
}

export interface PlayerStats extends PlayerProgress {
  /** 0..1 */
  progress: number;
  netWpm: number;
  grossWpm: number;
  /** 0..100 */
  accuracy: number;
}

export interface RankedPlayer extends PlayerStats {
  /** 1-based */
  rank: number;
}

/**
 * Server-recorded snapshot taken on every accepted progress submission:
 * [ms since race start, correct chars, keystrokes, errors]. Cumulative.
 */
export type Sample = readonly [number, number, number, number];

/** Verified final data for one racer, as stored by the server. */
export interface RaceResult extends RankedPlayer {
  flagged: boolean;
  samples: readonly Sample[];
  /** Backspace/delete presses that removed a character. */
  deletions: number;
  /** Character attempts per passage section (SECTIONS entries). */
  sectionKeystrokes: readonly number[];
  /** Incorrect attempts per passage section. */
  sectionErrors: readonly number[];
  /** Consecutive completed races in this lobby, including this one. */
  streak: number;
}
