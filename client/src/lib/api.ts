import { lineWords, lockedWords, typedWords, type TrophyId, type TypingState, type VoteMode } from '@race/shared';
import type { VehicleBuild } from '../art/vehicleArt';
import type { DestinationId } from '../art/worldArt';
import type { WatchSnapshot } from '../game/useSpectator';
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
  invalid_destination: 'Pick one of the six destinations.',
  invalid_duration: 'Pick a race length between 1 and 5 minutes.',
  spectators_full: 'This room has too many spectators right now. Try again in a minute.',
  not_in_race: 'You were not in that race.',
  invalid_ghost: 'That practice lap could not be saved.',
  invalid_rounds: 'Pick between 2 and 5 rounds.',
  championship_exists: 'This room already has a championship.',
  no_championship: 'There is no open championship in this room.',
  championship_locked: 'The championship rules are locked.',
  stale_revision: 'Someone changed the championship just now. Showing the latest version.',
  invalid_action: 'That action is not available.',
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

async function call<T>(fn: string, args: Record<string, unknown> = {}, signal?: AbortSignal): Promise<T> {
  const request = requireSupabase().rpc(fn, args);
  const { data, error } = await (signal ? request.abortSignal(signal) : request);
  if (error) throw new ApiError(error.message);
  return data as T;
}

export interface SubmitResult {
  ok: boolean;
  reason?: 'race_not_active' | 'not_started' | 'race_over' | 'out_of_sync' | 'mismatch' | 'bad_counters' | 'too_fast';
  /** Words locked in so far. */
  words_done: number;
  correct_chars?: number;
}

/**
 * The words a submit covers: a locked line (all typed words), or the current
 * line's finished words (provisional; the word being typed is left out).
 * `final` sends everything typed, used when the timer runs out.
 */
export function lineSubmission(s: TypingState, final = false): { from: number; words: string[] } {
  const typed = typedWords(s);
  const targets = lineWords(s);
  let words = (final ? typed.filter((w, i) => w !== '' || i < typed.length - 1) : typed.slice(0, -1)).slice(0, targets.length);
  // Zero-mistake races reject any wrong word, so stop before the first one.
  if (s.strict) {
    const wrong = words.findIndex((w, i) => w !== targets[i]);
    if (wrong >= 0) words = words.slice(0, wrong);
  }
  return { from: lockedWords(s), words };
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
  setRaceSettings: (lobbyId: string, seconds: number, zeroMistakes: boolean, destination: DestinationId | null) =>
    call<void>('set_race_settings', { p_lobby_id: lobbyId, p_seconds: seconds, p_zero_mistakes: zeroMistakes, p_destination: destination }),
  /** Earned trophy types with the latest verified statistic (accounts and guests). */
  myTrophies: () => call<TrophyRecord[]>('my_trophies'),
  /** Sends the words typed from `fromWord`; `lock` locks them in (Enter). `signal` cancels the request. */
  submitTyping: (raceId: string, fromWord: number, words: string[], lock: boolean, s: TypingState, signal?: AbortSignal) =>
    call<SubmitResult>('submit_typing', {
      p_race_id: raceId,
      p_from_word: fromWord,
      p_words: words,
      p_lock: lock,
      p_keystrokes: s.keystrokes,
      p_errors: s.errors,
      p_deletions: s.deletions,
      p_section_keystrokes: s.sectionKeystrokes,
      p_section_errors: s.sectionErrors,
    }, signal),
  /** Asks the server to compute and store this race's trophies (idempotent). */
  awardTrophies: async (raceId: string) => {
    const { error } = await requireSupabase().functions.invoke('award-trophies', { body: { race_id: raceId } });
    if (error) throw new ApiError(error.message);
  },
  serverNow: () => call<string>('server_now'),
  /** Best earlier result in the same mode and race length (this race excluded). */
  myPreviousBest: (raceId: string) => call<{ best_wpm: number | null; races: number }>('my_previous_best', { p_race_id: raceId }),
  savePracticeGhost: (passageHash: string, rulesVersion: string, durationMs: number, trace: readonly (readonly [number, number])[]) =>
    call<{ saved: boolean; best_ms: number }>('save_practice_ghost', {
      p_passage_hash: passageHash, p_rules_version: rulesVersion, p_duration_ms: durationMs, p_trace: trace,
    }),
  /** The caller's saved lap for this exact passage and rules version (RLS: owner only). */
  loadPracticeGhost: async (passageHash: string, rulesVersion: string) => {
    const { data, error } = await requireSupabase()
      .from('practice_ghosts')
      .select('duration_ms, trace, created_at')
      .eq('passage_hash', passageHash)
      .eq('rules_version', rulesVersion)
      .maybeSingle();
    if (error) throw new ApiError(error.message);
    return data as { duration_ms: number; trace: unknown; created_at: string } | null;
  },
  deletePracticeGhost: async (passageHash: string, rulesVersion: string) => {
    const { error } = await requireSupabase().from('practice_ghosts').delete().eq('passage_hash', passageHash).eq('rules_version', rulesVersion);
    if (error) throw new ApiError(error.message);
  },
  lobbyChampionship: (lobbyId: string) => call<Championship | null>('lobby_championship', { p_lobby_id: lobbyId }),
  createChampionship: (lobbyId: string, rounds: number) => call<void>('create_championship', { p_lobby_id: lobbyId, p_rounds: rounds }),
  updateChampionship: (lobbyId: string, action: 'rounds' | 'lock' | 'cancel', expectedRevision: number, rounds?: number) =>
    call<void>('update_championship', { p_lobby_id: lobbyId, p_action: action, p_expected_revision: expectedRevision, p_rounds: rounds ?? null }),
  /** Registers as a spectator (heartbeat) and returns the room's public snapshot. */
  watchLobby: (code: string) => call<WatchSnapshot>('watch_lobby', { p_code: code }),

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

export interface TrophyRecord {
  trophy: TrophyId;
  /** Times this trophy type was awarded. */
  times: number;
  /** The most recent award's verified statistic. */
  reason: string;
  race_id: string;
  mode: string;
  earned_at: string | null;
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

/** Kit 25 championship, as the server reports it (points and standings are server-derived). */
export interface Championship {
  id: string;
  status: 'setup' | 'running' | 'complete' | 'cancelled';
  rounds: number;
  revision: number;
  /** Points by official rank (index 0 = P1); DNF and flagged score 0. */
  points: number[];
  committed: { round: number; race_id: string; mode: string }[];
  standings: {
    user_id: string;
    name: string;
    total: number;
    /** Shared for equal totals. */
    position: number;
    rounds: Record<string, { points: number; status: 'finished' | 'dnf' | 'flagged' }>;
  }[];
}
