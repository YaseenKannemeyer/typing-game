export type PlayerId = string;

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

export type TrophyKind =
  | 'first'
  | 'second'
  | 'third'
  | 'mostAccurate'
  | 'mostMistakes'
  | 'speedOverPower';

export type LobbyStatus = 'waiting' | 'countdown' | 'racing' | 'finished';
