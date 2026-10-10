import type { Award, LobbyStatus, PassageMode, Sample, VoteMode } from '@race/shared';
import type { VehicleBuild } from '../art/vehicleArt';

export interface Lobby {
  id: string;
  code: string;
  host_id: string;
  status: LobbyStatus;
  current_race_id: string | null;
  vote_ends_at: string | null;
  mode: VoteMode | null;
  /** Race length the host picked (60–300). */
  race_seconds: number;
  /** Zero-mistake mode: a wrong word blocks you until it is fixed. */
  zero_mistakes: boolean;
}

export interface LobbyPlayer {
  user_id: string;
  name: string;
  car_color: string;
  joined_at: string;
  streak: number;
  /** Garage build ({} until the player customises their car). */
  vehicle: Partial<VehicleBuild>;
}

export interface Race {
  id: string;
  passage_id: number;
  start_at: string;
  /** The timer: the race ends here (null for races from before timed races). */
  end_at: string | null;
  duration_s: number | null;
  zero_mistakes: boolean;
  ended_at: string | null;
  status: 'racing' | 'finished';
  mode: PassageMode;
  /** Set once the server has stored the race's trophies. */
  awarded_at: string | null;
}

export interface RacePlayer {
  user_id: string;
  name: string;
  /** Words locked in with Enter. */
  words_done: number;
  /** Correct characters on locked lines. */
  locked_chars: number;
  /** locked_chars plus the provisional current line. */
  correct_chars: number;
  keystrokes: number;
  errors: number;
  finished_at: string | null;
  rank: number | null;
  net_wpm: number | null;
  gross_wpm: number | null;
  accuracy: number | null;
  flagged: boolean;
  samples: Sample[];
  deletions: number;
  section_keystrokes: number[];
  section_errors: number[];
  /** Server-computed trophies for this race. */
  awards: Award[];
}

export interface Vote {
  user_id: string;
  mode: VoteMode;
}

/** Cosmetic progress other clients broadcast about themselves. */
export interface LiveProgress {
  chars: number;
  wpm: number;
  /** Mistakes so far; only used to play the mistake animation. */
  errors?: number;
}
