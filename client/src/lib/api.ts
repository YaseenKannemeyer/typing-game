import type { TrophyId, TypingState, VoteMode } from '@race/shared';
import type { VehicleBuild } from '../art/vehicleArt';
import { requireSupabase } from './supabase';

const MESSAGES: Record<string, string> = {
  lobby_not_found: 'That lobby does not exist or has closed.',
  lobby_full: 'That lobby is full (15 players).',
  name_taken: 'Someone in this lobby already has that name.',
  invalid_name: 'Names must be 2–16 letters, numbers, spaces, _ . or -.',
  rate_limited: 'Too many lobbies created. Try again in a few minutes.',
  not_host: 'Only the host can do that.',
  race_in_progress: 'A race is already in progress.',
  not_enough_players: 'You need at least 2 players.',
  color_taken: 'Another player already has that colour.',
  voting_closed: 'Voting has closed.',
  voting_open: 'Voting is still open.',
  not_member: 'You are no longer in this lobby.',
  not_authenticated: 'Could not sign you in. Refresh and try again.',
  invalid_email: 'Enter a valid email address.',
  email_exists: 'That email already has an account. Sign in instead to bring your guest progress with you.',
  invalid_credentials: "That email and password don't match an account.",
  weak_password: 'Choose a stronger password (at least 8 characters).',
  same_password: 'Choose a password different from your current one.',
  email_rate_limited: 'Too many emails were sent just now. Please wait a few minutes and try again.',
  email_not_confirmed: 'Confirm your email first. Check your inbox for the link.',
  linking_disabled: 'Saving guest progress is not enabled on the server yet.',
  account_required: 'You need an account for that. Save your progress first.',
  profile_required: 'Finish setting up your profile first.',
  invalid_avatar: 'Choose the car or initials avatar.',
  captcha_failed: "We couldn't confirm you're human. Refresh the page and try again.",
};

export class ApiError extends Error {}

export function errorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  return MESSAGES[raw] ?? raw;
}

export function errorCode(e: unknown): string | null {
  return e instanceof ApiError ? e.message : null;
}

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await requireSupabase().rpc(fn, args);
  if (error) throw new ApiError(error.message);
  return data as T;
}

export interface SubmitResult {
  ok: boolean;
  reason?: 'race_not_active' | 'not_started' | 'out_of_sync' | 'mismatch' | 'bad_counters' | 'too_fast';
  words_done: number;
  finished?: boolean;
}

export const api = {
  createLobby: async (name: string) =>
    (await call<{ lobby_id: string; code: string }[]>('create_lobby', { p_name: name }))[0]!,
  joinLobby: (code: string, name: string) => call<string>('join_lobby', { p_code: code, p_name: name }),
  leaveLobby: (lobbyId: string) => call<void>('leave_lobby', { p_lobby_id: lobbyId }),
  heartbeat: (lobbyId: string) => call<void>('heartbeat', { p_lobby_id: lobbyId }),
  setCarColor: (lobbyId: string, color: string) =>
    call<void>('set_car_color', { p_lobby_id: lobbyId, p_color: color }),
  setVehicle: (lobbyId: string, build: VehicleBuild) =>
    call<VehicleBuild>('set_vehicle', { p_lobby_id: lobbyId, p_vehicle: build }),
  startVoting: (lobbyId: string) => call<string>('start_voting', { p_lobby_id: lobbyId }),
  castVote: (lobbyId: string, mode: VoteMode) =>
    call<void>('cast_vote', { p_lobby_id: lobbyId, p_mode: mode }),
  closeVoting: (lobbyId: string) => call<VoteMode>('close_voting', { p_lobby_id: lobbyId }),
  startRace: (lobbyId: string, mode?: VoteMode) =>
    call<string>('start_race', { p_lobby_id: lobbyId, p_mode: mode ?? null }),
  returnToLobby: (lobbyId: string) => call<void>('return_to_lobby', { p_lobby_id: lobbyId }),
  finalizeRace: (raceId: string) => call<boolean>('finalize_race', { p_race_id: raceId }),
  submitProgress: (raceId: string, fromWord: number, words: string[], s: TypingState) =>
    call<SubmitResult>('submit_progress', {
      p_race_id: raceId,
      p_from_word: fromWord,
      p_words: words,
      p_keystrokes: s.keystrokes,
      p_errors: s.errors,
      p_deletions: s.deletions,
      p_section_keystrokes: s.sectionKeystrokes,
      p_section_errors: s.sectionErrors,
    }),
  /** Asks the server to compute and store this race's trophies (idempotent). */
  awardTrophies: async (raceId: string) => {
    const { error } = await requireSupabase().functions.invoke('award-trophies', { body: { race_id: raceId } });
    if (error) throw new ApiError(error.message);
  },
  serverNow: () => call<string>('server_now'),

  // Phase 4: accounts and stats --------------------------------------------
  mySummary: (days = 0) => call<Summary>('my_summary', { p_days: days }),
  saveProfile: (displayName: string, avatar?: 'car' | 'initials') =>
    call<Profile>('save_profile', { p_display_name: displayName, p_avatar: avatar ?? null }),
  setProfileGarage: (build: VehicleBuild, color: string) =>
    call<void>('set_profile_garage', { p_vehicle: build, p_color: color }),
  leaderboard: (days: number, mode: string) => call<LeaderRow[]>('leaderboard', { p_days: days, p_mode: mode }),
  /** Moves a verified guest's history to the signed-in account (server-checked). */
  mergeGuest: async (guestAccessToken: string) => {
    const { data, error } = await requireSupabase().functions.invoke('merge-guest', { body: { guest_token: guestAccessToken } });
    if (error) throw new ApiError(error.message);
    return data as { ok: boolean; already_merged: boolean; moved_races: number };
  },
};

export interface Profile {
  display_name: string;
  handle: string;
  avatar: 'car' | 'initials';
  vehicle: Partial<VehicleBuild>;
  car_color: string | null;
  created_at: string;
}

export interface Summary {
  anonymous: boolean;
  member_since: string | null;
  profile: Profile | null;
  stats: { races: number; wins: number; best_wpm: number | null; trophies: number };
  daily: { date: string; wpm: number | null; accuracy: number | null }[];
  mode_bests: Record<string, number | null>;
  trophy_counts: Partial<Record<TrophyId, number>>;
  recent: { trophy: TrophyId; reason: string; race_id: string; at: string }[];
}

export interface LeaderRow {
  rank: number;
  display_name: string;
  handle: string;
  vehicle: Partial<VehicleBuild>;
  car_color: string | null;
  best_wpm: number;
  accuracy: number;
  achieved_at: string;
  is_you: boolean;
}
