import type { VehicleProps } from '../../art/vehicleArt';
import type { Summary, TrophyRecord } from '../../lib/api';

/*
 * The contract between screens/ProfileScreen.tsx (auth, summary/trophy
 * requests, the chart period, profile saves, sign-out, navigation) and
 * ProfileView (presentation only). Every number is the server's; the view must
 * not fetch, compute statistics or fill gaps (null stays "no data").
 */

export interface ProfileData {
  name: string;
  handle: string;
  /** Formatted, e.g. "September 2026" ("—" when unknown). */
  memberSince: string;
  avatar: 'car' | 'initials';
  vehicle: VehicleProps;
  stats: Summary['stats'];
  /** One row per UTC day in the period; wpm/accuracy null on days without a counted race. */
  daily: Summary['daily'];
  /** Best WPM per mode in the period; null or absent = no counted race. */
  modeBests: Summary['mode_bests'];
  recent: Summary['recent'];
  trophyCounts: Summary['trophy_counts'];
  /** Trophy cabinet details; null while loading (an error shows as empty). */
  trophyRecords: TrophyRecord[] | null;
}

export type ProfileState =
  /** `auth`: signed-in state unknown; `profile`: loading the summary. */
  | { kind: 'loading'; stage: 'auth' | 'profile' }
  /** Not signed in to an account (guests have no profile). */
  | { kind: 'guest' }
  /** The summary could not be loaded and there is nothing to show. */
  | { kind: 'unavailable'; error: string }
  /** Verified account without a profile yet. */
  | { kind: 'setup' }
  | { kind: 'ready'; data: ProfileData };

export interface ProfileViewModel {
  state: ProfileState;
  /** The chart period (days; 0 = all time). */
  period: { days: number; options: readonly { days: number; label: string }[] };
  /** Reloading a period failed; the last loaded data stays on screen. */
  error: string | null;
  /** A profile save (name or avatar) is in flight. */
  busy: boolean;
  /** The edit-name dialog. */
  edit: { open: boolean; error: string | null };
}

export interface ProfileActions {
  selectPeriod: (days: number) => void;
  /** Switch between showing the car and the initials avatar. */
  toggleAvatar: () => void;
  openEditName: () => void;
  saveName: (name: string) => void;
  cancelEditName: () => void;
  signOut: () => void;
  /** Guests: to the account page (save progress / sign in). */
  goToAccount: () => void;
  /** Verified account without a profile: finish setup. */
  finishSetup: () => void;
}

export interface ProfileViewProps {
  model: ProfileViewModel;
  actions: ProfileActions;
}
