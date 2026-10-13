// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileViewProps } from '../components/profile/profileViewModel';

/*
 * The profile container's contract, independent of its presentation
 * (ProfileView is replaced by a probe): which state to show, the server's
 * numbers passed through untouched (gaps stay null), the chart period,
 * name/avatar saves, sign-out and navigation. No backend is touched.
 */

let view: ProfileViewProps;
vi.mock('../components/profile/ProfileView', () => ({ ProfileView: (p: ProfileViewProps) => ((view = p), null) }));
type Auth = { ready: boolean; session: unknown; permanent: boolean; email: string | null; recovering: boolean };
let auth: Auth;
vi.mock('../game/useAuth', () => ({ useAuth: () => auth }));
vi.mock('../lib/supabase', () => ({ supabase: null, requireSupabase: () => { throw new Error('no backend in tests'); } }));
const navigate = vi.fn();
vi.mock('../lib/router', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/router')>()), navigate: (p: string) => navigate(p) }));
const signOut = vi.fn(async () => {});
vi.mock('../lib/account', () => ({ signOut: () => signOut() }));
const DAILY = [{ date: '2026-10-10', wpm: 80, accuracy: 96 }, { date: '2026-10-11', wpm: null, accuracy: null }, { date: '2026-10-12', wpm: 88, accuracy: 97.5 }];
const summary = (o: Record<string, unknown> = {}) => ({
  anonymous: false, member_since: '2026-09-01T00:00:00Z',
  profile: { display_name: 'Nova', handle: 'nova-7', avatar: 'car', vehicle: { model: 'rally', number: 42, team: 'night', driver: 'NOVA' }, car_color: '#8dbdff', created_at: '2026-09-01T00:00:00Z' },
  stats: { races: 12, wins: 3, best_wpm: 96.4, trophies: 5 }, daily: DAILY, mode_bests: { easy: 96.4, hard: null }, trophy_counts: { gold: 3 },
  recent: [{ trophy: 'gold', reason: '1st place', race_id: 'r1', at: '2026-10-12T10:00:00Z' }], ...o,
});
const RECORDS = [{ trophy: 'gold', times: 3, reason: '1st place', race_id: 'r1', mode: 'easy', earned_at: '2026-10-12T10:00:00Z' }];
const api = {
  mySummary: vi.fn(async (_days: number) => summary()),
  myTrophies: vi.fn(async () => RECORDS),
  saveProfile: vi.fn(async (name: string, avatar?: string) => ({ ...summary().profile, display_name: name, avatar: avatar ?? 'car' })),
};
vi.mock('../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/api')>()), api }));

const { ProfileScreen } = await import('./ProfileScreen');

let root: Root;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const mount = async (a: Partial<Auth>) => {
  auth = { ready: true, session: {}, permanent: true, email: 'nova@example.com', recovering: false, ...a };
  await act(async () => root.render(<ProfileScreen />));
  await flush();
};
const run = async (fn: () => void) => {
  await act(async () => fn());
  await flush();
};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  localStorage.clear();
  root = createRoot(document.createElement('div'));
});
afterEach(async () => {
  await act(() => root.unmount());
});

describe('profile: which state', () => {
  it('auth unknown → loading; guest → guest (no requests)', async () => {
    await mount({ ready: false });
    expect(view.model.state).toEqual({ kind: 'loading', stage: 'auth' });
    await mount({ permanent: false });
    expect(view.model.state).toEqual({ kind: 'guest' });
    expect(api.mySummary).not.toHaveBeenCalled();
  });

  it('loading → unavailable when the first load fails; setup when there is no profile', async () => {
    api.mySummary.mockImplementationOnce(() => new Promise(() => {}));
    await mount({});
    expect(view.model.state).toEqual({ kind: 'loading', stage: 'profile' });
    await act(() => root.unmount());
    root = createRoot(document.createElement('div'));
    api.mySummary.mockRejectedValueOnce(new Error('Could not load your profile'));
    await mount({});
    expect(view.model.state).toEqual({ kind: 'unavailable', error: 'Could not load your profile' });
    expect(view.model.error).toBeNull();
    await act(() => root.unmount());
    root = createRoot(document.createElement('div'));
    api.mySummary.mockResolvedValueOnce(summary({ profile: null }) as never);
    await mount({});
    expect(view.model.state).toEqual({ kind: 'setup' });
    await run(() => view.actions.finishSetup());
    expect(navigate).toHaveBeenCalledWith('/account?step=verified');
  });

  it('passes the server’s numbers through untouched, including gaps', async () => {
    await mount({});
    expect(api.mySummary).toHaveBeenCalledWith(30);
    const { state } = view.model;
    if (state.kind !== 'ready') throw new Error(`expected ready, got ${state.kind}`);
    expect(state.data).toMatchObject({
      name: 'Nova', handle: 'nova-7', memberSince: 'September 2026', avatar: 'car',
      stats: { races: 12, wins: 3, best_wpm: 96.4, trophies: 5 }, daily: DAILY, modeBests: { easy: 96.4, hard: null }, trophyCounts: { gold: 3 }, trophyRecords: RECORDS,
    });
    expect(state.data.vehicle).toMatchObject({ model: 'rally', number: 42, primary: '#8dbdff', team: 'night', driver: 'NOVA', playerName: 'Nova' });
    expect(view.model.period).toMatchObject({ days: 30, options: [{ days: 7 }, { days: 30 }, { days: 0 }] });
  });

  it('shows the trophy cabinet as loading until its request answers (an error reads as empty)', async () => {
    api.myTrophies.mockImplementationOnce(() => new Promise(() => {}));
    await mount({});
    expect(view.model.state.kind === 'ready' && view.model.state.data.trophyRecords).toBeNull();
    await act(() => root.unmount());
    root = createRoot(document.createElement('div'));
    api.myTrophies.mockRejectedValueOnce(new Error('nope'));
    await mount({});
    expect(view.model.state.kind === 'ready' && view.model.state.data.trophyRecords).toEqual([]);
  });
});

describe('profile: actions', () => {
  it('reloads for a new period and keeps the last data when that fails', async () => {
    await mount({});
    api.mySummary.mockRejectedValueOnce(new Error('Could not load that period'));
    await run(() => view.actions.selectPeriod(7));
    expect(api.mySummary).toHaveBeenLastCalledWith(7);
    expect(view.model).toMatchObject({ period: { days: 7 }, error: 'Could not load that period', state: { kind: 'ready' } });
    await run(() => view.actions.selectPeriod(0));
    expect(view.model).toMatchObject({ period: { days: 0 }, error: null });
  });

  it('edits the name: busy while saving, errors keep the dialog open, success closes it and saves locally', async () => {
    await mount({});
    await run(() => view.actions.openEditName());
    expect(view.model.edit).toEqual({ open: true, error: null });
    api.saveProfile.mockRejectedValueOnce(new Error('That name is taken'));
    await run(() => view.actions.saveName('Kestrel'));
    expect(view.model).toMatchObject({ busy: false, edit: { open: true, error: 'That name is taken' } });
    let finish!: (p: unknown) => void;
    api.saveProfile.mockImplementationOnce(() => new Promise((r) => (finish = r)) as never);
    await act(async () => view.actions.saveName('Kestrel'));
    expect(view.model.busy).toBe(true);
    await run(() => finish({ ...summary().profile, display_name: 'Kestrel' }));
    expect(view.model).toMatchObject({ busy: false, edit: { open: false } });
    expect(view.model.state.kind === 'ready' && view.model.state.data.name).toBe('Kestrel');
    expect(localStorage.getItem('typeracer:name')).toBe('Kestrel');
    await run(() => view.actions.openEditName());
    await run(() => view.actions.cancelEditName());
    expect(view.model.edit.open).toBe(false);
  });

  it('toggles the avatar through the server', async () => {
    await mount({});
    await run(() => view.actions.toggleAvatar());
    expect(api.saveProfile).toHaveBeenCalledWith('Nova', 'initials');
    expect(view.model.state.kind === 'ready' && view.model.state.data.avatar).toBe('initials');
  });

  it('signs out before leaving; guests go to the account page', async () => {
    await mount({});
    await run(() => view.actions.signOut());
    expect(signOut).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/');
    await mount({ permanent: false });
    await run(() => view.actions.goToAccount());
    expect(navigate).toHaveBeenCalledWith('/account');
  });
});
