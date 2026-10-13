import type { TrophyId } from '@race/shared';
import { DEFAULT_BUILD, normalizeVehicle } from '../../art/vehicleArt';
import { normalizeLivery } from '../../art/worldArt';
import type { GuestView } from '../../components/account/Account';
import type { AccountState, AccountViewModel } from '../../components/account/accountViewModel';
import type { ProfileData, ProfileState, ProfileViewModel } from '../../components/profile/profileViewModel';
import type { Summary, TrophyRecord } from '../../lib/api';

/*
 * Account and profile snapshots for the dev gallery. Fictional racer; no auth,
 * email or backend: the gallery's mock actions only move between these states.
 */

const vehicle = (o: Record<string, unknown>) => ({
  ...normalizeVehicle({ ...DEFAULT_BUILD, ...o, playerName: String(o.playerName ?? 'Nova') }),
  ...normalizeLivery(o),
});

const GUEST: GuestView = { name: 'Nova', races: 4, wins: 1, trophies: 2, vehicle: vehicle({ model: 'rally', number: 42, primary: '#8dbdff', team: 'night', decal: 'checkered', driver: 'NOVA' }) };

// ---------------------------------------------------------------------------
// Account

export interface AccountFixture {
  kind: 'account';
  id: string;
  title: string;
  note?: string;
  model: AccountViewModel;
  /** Mock action outcomes: fail with these messages instead of moving on. */
  fail?: { submit?: string; verify?: string; password?: string; merge?: string };
}

const account = (id: string, title: string, state: AccountState, o: { busy?: boolean; error?: string | null; fail?: AccountFixture['fail']; note?: string } = {}): AccountFixture => ({
  kind: 'account',
  id,
  title,
  note: o.note,
  fail: o.fail,
  model: { state, busy: !!o.busy, error: o.error ?? null },
});

const RECEIPT = { name: 'Nova', races: 4, trophies: 2 };

export const ACCOUNT_FIXTURES: AccountFixture[] = [
  account('account-loading', 'Account · opening', { kind: 'loading' }),
  account('account-signup', 'Account · visitor sign-up', { kind: 'form', mode: 'signup', defaultName: '', guest: null }, { note: 'Mock actions: submitting moves to the next step after 0.8 s.' }),
  account('account-save', 'Account · save guest progress', { kind: 'form', mode: 'save', defaultName: 'Nova', guest: GUEST }),
  account('account-save-busy', 'Account · sending the confirmation', { kind: 'form', mode: 'save', defaultName: 'Nova', guest: GUEST }, { busy: true }),
  account('account-save-error', 'Account · email already registered', { kind: 'form', mode: 'save', defaultName: 'Nova', guest: GUEST }, { error: 'That email is already registered. Sign in instead.', fail: { submit: 'That email is already registered. Sign in instead.' } }),
  account('account-signin', 'Account · sign in', { kind: 'form', mode: 'signin', defaultName: '', guest: null }),
  account('account-signin-guest', 'Account · sign in with guest progress', { kind: 'form', mode: 'signin', defaultName: 'Nova', guest: GUEST }, { note: 'Signing in leads to the review (nothing moves until confirmed).' }),
  account('account-reset', 'Account · reset password', { kind: 'form', mode: 'reset', defaultName: '', guest: null }),
  account('account-verify', 'Verify · check your inbox', { kind: 'verify', email: 'nova@example.com', receipt: RECEIPT, confirmedElsewhere: false }, { fail: { verify: "We can't see the confirmation yet. Open the link in the email, then try again." }, note: '“I’ve confirmed my email” fails once (not confirmed yet).' }),
  account('account-verify-retry', 'Verify · not confirmed yet', { kind: 'verify', email: 'nova@example.com', receipt: null, confirmedElsewhere: false }, { error: "We can't see the confirmation yet. Open the link in the email, then try again." }),
  account('account-verified-elsewhere', 'Verify · confirmed in another tab', { kind: 'verify', email: null, receipt: null, confirmedElsewhere: true }),
  account('account-password-new', 'Password · after verification', { kind: 'password', purpose: 'new' }),
  account('account-password-reset', 'Password · recovery link', { kind: 'password', purpose: 'reset' }),
  account('account-password-error', 'Password · rejected', { kind: 'password', purpose: 'new' }, { error: 'Password should be at least 8 characters.', fail: { password: 'Password should be at least 8 characters.' } }),
  account('account-review', 'Preserve · review before linking', { kind: 'review', guest: GUEST, account: { name: 'Nova', races: 12, trophies: 5 } }, { note: 'Confirm moves to saving, then saved.' }),
  account('account-review-loading', 'Preserve · review loading', { kind: 'review', guest: null, account: { name: 'Nova', races: 12, trophies: 5 } }, { note: 'Known issue: reloading /account mid-review stays here (see handoff 18).' }),
  account('account-saving', 'Preserve · waiting for the server', { kind: 'saving' }),
  account('account-saved', 'Preserve · confirmed', { kind: 'saved', receipt: { name: 'Nova', races: 16, trophies: 6 } }),
  account('account-retry', 'Preserve · not confirmed, retry', { kind: 'retry' }, { error: 'The link could not be confirmed. Try again.', fail: { merge: 'The link could not be confirmed. Try again.' }, note: 'Retry fails again; cancel keeps the guest.' }),
  account('account-recovery', 'Recovery · email requested', { kind: 'recovery' }),
];

// ---------------------------------------------------------------------------
// Profile

export interface ProfileFixture {
  kind: 'profile';
  id: string;
  title: string;
  note?: string;
  model: ProfileViewModel;
  fail?: { save?: string };
}

const PERIODS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 0, label: 'All time' },
] as const;

const day = (i: number) => new Date(Date.UTC(2026, 8, 14 + i)).toISOString().slice(0, 10);
const record = (trophy: TrophyId, times: number, reason: string, mode = 'medium'): TrophyRecord => ({ trophy, times, reason, race_id: `fx-${trophy}`, mode, earned_at: '2026-10-12T10:00:00Z' });

function data(o: Partial<ProfileData> & { records?: TrophyRecord[] | null } = {}): ProfileData {
  const records = o.records === undefined ? [record('gold', 3, '1st place · 96.4 WPM'), record('sharpShooter', 1, '99.1% accuracy'), record('unstoppable', 1, '5 races in a row')] : o.records;
  return {
    name: 'Nova',
    handle: 'nova-7',
    memberSince: 'September 2026',
    avatar: 'car',
    vehicle: vehicle({ model: 'rally', number: 42, primary: '#8dbdff', team: 'night', decal: 'checkered', driver: 'NOVA' }),
    stats: { races: 12, wins: 3, best_wpm: 96.4, trophies: 5 },
    daily: Array.from({ length: 30 }, (_, i) => ({ date: day(i), wpm: 62 + Math.round(i * 0.9 + (i % 4) * 2), accuracy: 94 + (i % 5) * 0.8 })),
    modeBests: { easy: 96.4, medium: 88.1, hard: 74.5, coding: 61.2, shakespeare: 58 },
    recent: [
      { trophy: 'gold', reason: '1st place · 96.4 WPM', race_id: 'fx-1', at: '2026-10-12T10:00:00Z' },
      { trophy: 'sharpShooter', reason: '99.1% accuracy', race_id: 'fx-2', at: '2026-10-10T10:00:00Z' },
      { trophy: 'unstoppable', reason: '5 races in a row', race_id: 'fx-3', at: '2026-10-08T10:00:00Z' },
    ] as Summary['recent'],
    trophyCounts: { gold: 3, sharpShooter: 1, unstoppable: 1 },
    trophyRecords: records,
    ...o,
  };
}

const profile = (id: string, title: string, state: ProfileState, o: { days?: number; error?: string | null; busy?: boolean; edit?: { open: boolean; error: string | null }; fail?: ProfileFixture['fail']; note?: string } = {}): ProfileFixture => ({
  kind: 'profile',
  id,
  title,
  note: o.note,
  fail: o.fail,
  model: { state, period: { days: o.days ?? 30, options: PERIODS }, error: o.error ?? null, busy: !!o.busy, edit: o.edit ?? { open: false, error: null } },
});

const ready = (d: ProfileData): ProfileState => ({ kind: 'ready', data: d });

export const PROFILE_FIXTURES: ProfileFixture[] = [
  profile('profile-loading', 'Profile · checking sign-in', { kind: 'loading', stage: 'auth' }),
  profile('profile-loading-data', 'Profile · loading data', { kind: 'loading', stage: 'profile' }),
  profile('profile-guest', 'Profile · guest (no profile)', { kind: 'guest' }),
  profile('profile-unavailable', 'Profile · could not load', { kind: 'unavailable', error: 'Could not load your profile. Try again in a moment.' }),
  profile('profile-setup', 'Profile · verified, setup unfinished', { kind: 'setup' }),
  profile('profile-many', 'Profile · 30 days of data', ready(data()), { note: 'Mock actions: period buttons switch the selection; edit and avatar save after 0.8 s.' }),
  profile('profile-single', 'Profile · one race', ready(data({ stats: { races: 1, wins: 0, best_wpm: 54.2, trophies: 1 }, daily: [{ date: day(29), wpm: 54.2, accuracy: 93.1 }], modeBests: { easy: 54.2 }, recent: [{ trophy: 'participation', reason: 'First race', race_id: 'fx-1', at: '2026-10-12T10:00:00Z' }] as Summary['recent'], trophyCounts: { participation: 1 }, records: [record('participation', 1, 'First race', 'easy')] }))),
  profile('profile-gapped', 'Profile · gaps in the data', ready(data({ daily: Array.from({ length: 30 }, (_, i) => ({ date: day(i), wpm: i % 4 === 0 ? 70 + i : null, accuracy: i % 4 === 0 ? 95 : null })), modeBests: { easy: 81, medium: null, hard: null, coding: 60, shakespeare: null } })), { note: 'Days without counted races stay null (no invented values).' }),
  profile('profile-zero', 'Profile · account with no races', ready(data({ stats: { races: 0, wins: 0, best_wpm: null, trophies: 0 }, daily: [], modeBests: {}, recent: [], trophyCounts: {}, records: [] }))),
  profile('profile-trophies-loading', 'Profile · trophy cabinet loading', ready(data({ records: null }))),
  profile('profile-reload-error', 'Profile · period reload failed', ready(data()), { days: 7, error: 'Could not load that period. The last data is shown.' }),
  profile('profile-initials', 'Profile · initials avatar, long name', ready(data({ avatar: 'initials', name: 'Maximiliana-Ros', handle: 'maximiliana-rosalind-12' }))),
  profile('profile-edit', 'Profile · edit name', ready(data()), { edit: { open: true, error: null } }),
  profile('profile-edit-busy', 'Profile · saving the name', ready(data()), { busy: true, edit: { open: true, error: null } }),
  profile('profile-edit-error', 'Profile · name rejected', ready(data()), { edit: { open: true, error: 'That name is taken.' }, fail: { save: 'That name is taken.' } }),
];
