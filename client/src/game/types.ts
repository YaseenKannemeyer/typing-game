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
  first_finish_at: string | null;
  ended_at: string | null;
  status: 'racing' | 'finished';
  mode: PassageMode;
  /** Set once the server has stored the race's trophies. */
  awarded_at: string | null;
}

export interface RacePlayer {
  user_id: string;
  name: string;
  words_done: number;
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
