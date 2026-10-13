// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountViewProps } from '../components/account/accountViewModel';

/*
 * The account container's contract, independent of its presentation
 * (AccountView is replaced by a probe). Auth, verification, recovery, guest
 * preservation and profile adoption stay here; everything external is mocked:
 * no auth, email or backend is touched.
 */

let view: AccountViewProps;
vi.mock('../components/account/AccountView', () => ({ AccountView: (p: AccountViewProps) => ((view = p), null) }));
type Auth = { ready: boolean; session: unknown; permanent: boolean; email: string | null; recovering: boolean };
let auth: Auth;
vi.mock('../game/useAuth', () => ({ useAuth: () => auth }));
vi.mock('../lib/supabase', () => ({ supabase: null, requireSupabase: () => { throw new Error('no backend in tests'); } }));
const navigate = vi.fn();
vi.mock('../lib/router', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/router')>()), navigate: (p: string) => navigate(p) }));
const acct = {
  checkVerified: vi.fn(async () => false), clearGuestStash: vi.fn(), clearPendingName: vi.fn(), guestAccessToken: vi.fn(async (): Promise<string | null> => 'guest-token'),
  hasGuestStash: vi.fn(() => false), pendingDisplayName: vi.fn((): string | null => null), requestPasswordReset: vi.fn(async () => {}), restoreGuest: vi.fn(async () => true),
  setPassword: vi.fn(async () => {}), signIn: vi.fn(async () => {}), startSaveProgress: vi.fn(async () => {}), signOut: vi.fn(async () => {}),
};
vi.mock('../lib/account', () => acct);
const summary = (o: Record<string, unknown> = {}) => ({
  anonymous: false, member_since: '2026-09-01T00:00:00Z',
  profile: { display_name: 'Nova', handle: 'nova-7', avatar: 'car', vehicle: { model: 'rally', number: 42 }, car_color: '#8dbdff', created_at: '2026-09-01T00:00:00Z' },
  stats: { races: 12, wins: 3, best_wpm: 96.4, trophies: 5 }, daily: [], mode_bests: {}, trophy_counts: {}, recent: [], ...o,
});
const guestSummary = () => summary({ anonymous: true, profile: null, stats: { races: 4, wins: 1, best_wpm: 70, trophies: 2 } });
const api = {
  mySummary: vi.fn(async () => summary()),
  saveProfile: vi.fn(async (name: string) => ({ ...summary().profile, display_name: name })),
  mergeGuest: vi.fn(async () => {}),
};
vi.mock('../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/api')>()), api }));

const { AccountScreen } = await import('./AccountScreen');

let root: Root;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const mount = async (a: Partial<Auth>, url = '/account') => {
  auth = { ready: true, session: null, permanent: false, email: null, recovering: false, ...a };
  window.history.replaceState(null, '', url);
  await act(async () => root.render(<AccountScreen />));
  await flush();
};
const run = async (fn: () => void) => {
  await act(async () => fn());
  await flush();
};
const state = () => view.model.state;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('typeracer:name', 'Nova');
  root = createRoot(document.createElement('div'));
});
afterEach(async () => {
  await act(() => root.unmount());
});

describe('account: starting view', () => {
  it('waits for auth, then offers sign-up to a visitor', async () => {
    await mount({ ready: false });
    expect(state()).toEqual({ kind: 'loading' });
    await mount({});
    expect(state()).toEqual({ kind: 'form', mode: 'signup', defaultName: 'Nova', guest: null });
  });

  it('offers to save a guest with race history, showing what will be kept', async () => {
    api.mySummary.mockResolvedValueOnce(guestSummary() as never);
    await mount({ session: {} });
    expect(state()).toMatchObject({ kind: 'form', mode: 'save', guest: { name: 'Nova', races: 4, wins: 1, trophies: 2 } });
  });

  it('treats a guest without races as a plain sign-up (nothing to preserve)', async () => {
    api.mySummary.mockResolvedValueOnce(summary({ anonymous: true, profile: null, stats: { races: 0, wins: 0, best_wpm: null, trophies: 0 } }) as never);
    await mount({ session: {} });
    expect(state()).toMatchObject({ kind: 'form', mode: 'signup', guest: null });
  });

  it('routes recovery links, verified links and existing accounts', async () => {
    await mount({ recovering: true }, '/account?step=reset');
    expect(state()).toEqual({ kind: 'password', purpose: 'reset' });
    await act(() => root.unmount());
    root = createRoot(document.createElement('div'));
    await mount({ permanent: true, session: {} }, '/account?step=verified');
    expect(state()).toEqual({ kind: 'password', purpose: 'new' });
    await act(() => root.unmount());
    root = createRoot(document.createElement('div'));
    await mount({}, '/account?step=verified');
    expect(state()).toEqual({ kind: 'verify', email: null, receipt: null, confirmedElsewhere: true });
    await act(() => root.unmount());
    root = createRoot(document.createElement('div'));
    await mount({ permanent: true, session: {} });
    expect(navigate).toHaveBeenCalledWith('/profile');
  });
});

describe('account: actions', () => {
  it('starts saving progress, then waits for the email link; errors keep the form', async () => {
    api.mySummary.mockResolvedValueOnce(guestSummary() as never);
    await mount({ session: {} });
    acct.startSaveProgress.mockRejectedValueOnce(new Error('That email is already registered'));
    await run(() => view.actions.submitAuth({ displayName: 'Nova', email: 'nova@example.com', password: '' }));
    expect(view.model).toMatchObject({ busy: false, error: 'That email is already registered', state: { kind: 'form', mode: 'save' } });
    await run(() => view.actions.submitAuth({ displayName: 'Nova', email: 'nova@example.com', password: '' }));
    expect(acct.startSaveProgress).toHaveBeenLastCalledWith('Nova', 'nova@example.com');
    expect(state()).toEqual({ kind: 'verify', email: 'nova@example.com', receipt: { name: 'Nova', races: 4, trophies: 2 }, confirmedElsewhere: false });
  });

  it('checks verification, then finishes the account after the password', async () => {
    await mount({});
    await run(() => view.actions.submitAuth({ displayName: 'Nova', email: 'nova@example.com', password: '' }));
    await run(() => view.actions.confirmVerified());
    expect(view.model.error).toMatch(/can't see the confirmation/);
    expect(state().kind).toBe('verify');
    acct.checkVerified.mockResolvedValueOnce(true);
    await run(() => view.actions.confirmVerified());
    expect(state()).toEqual({ kind: 'password', purpose: 'new' });
    await run(() => view.actions.submitPassword('abcdefgh'));
    expect(acct.setPassword).toHaveBeenCalledWith('abcdefgh');
    expect(api.saveProfile).toHaveBeenCalledWith('Nova');
    expect(acct.clearPendingName).toHaveBeenCalled();
    expect(state()).toEqual({ kind: 'saved', receipt: { name: 'Nova', races: 12, trophies: 5 } });
    await run(() => view.actions.viewProfile());
    expect(navigate).toHaveBeenCalledWith('/profile');
  });

  it('signs in an account with a profile: adopts it locally and opens the profile', async () => {
    await mount({});
    await run(() => view.actions.chooseMode('signin'));
    expect(state()).toMatchObject({ kind: 'form', mode: 'signin' });
    await run(() => view.actions.submitAuth({ displayName: '', email: 'nova@example.com', password: 'secret123' }));
    expect(acct.signIn).toHaveBeenCalledWith('nova@example.com', 'secret123', false);
    expect(localStorage.getItem('typeracer:name')).toBe('Nova');
    expect(JSON.parse(localStorage.getItem('typeracer:vehicle')!)).toMatchObject({ build: { model: 'rally', number: 42 }, primary: '#8dbdff' });
    expect(navigate).toHaveBeenCalledWith('/profile');
  });

  it('asks a guest with progress to review before anything moves, then preserves it', async () => {
    api.mySummary.mockResolvedValueOnce(guestSummary() as never);
    await mount({ session: {}, email: 'nova@example.com' });
    await run(() => view.actions.chooseMode('signin'));
    await run(() => view.actions.submitAuth({ displayName: '', email: 'nova@example.com', password: 'secret123' }));
    expect(acct.signIn).toHaveBeenCalledWith('nova@example.com', 'secret123', true);
    expect(state()).toMatchObject({ kind: 'review', guest: { races: 4 }, account: { name: 'Nova', races: 12, trophies: 5 } });
    expect(api.mergeGuest).not.toHaveBeenCalled();

    let finish!: () => void;
    api.mergeGuest.mockImplementationOnce(() => new Promise<void>((r) => (finish = r)));
    await act(async () => view.actions.confirmMerge());
    expect(state()).toEqual({ kind: 'saving' });
    await run(() => finish());
    expect(api.mergeGuest).toHaveBeenCalledWith('guest-token');
    expect(acct.clearGuestStash).toHaveBeenCalled();
    expect(state()).toMatchObject({ kind: 'saved' });
  });

  it('keeps the guest session when the move fails or is cancelled', async () => {
    api.mySummary.mockResolvedValueOnce(guestSummary() as never);
    await mount({ session: {} });
    await run(() => view.actions.chooseMode('signin'));
    await run(() => view.actions.submitAuth({ displayName: '', email: 'nova@example.com', password: 'secret123' }));
    api.mergeGuest.mockRejectedValueOnce(new Error('Merge failed'));
    await run(() => view.actions.confirmMerge());
    expect(view.model).toMatchObject({ state: { kind: 'retry' }, error: 'Merge failed', busy: false });
    expect(acct.clearGuestStash).not.toHaveBeenCalled();
    acct.guestAccessToken.mockResolvedValueOnce(null);
    await run(() => view.actions.confirmMerge());
    expect(view.model.error).toMatch(/guest session has expired/);
    await run(() => view.actions.cancelMerge());
    expect(acct.restoreGuest).toHaveBeenCalled();
    expect(state()).toMatchObject({ kind: 'form', mode: 'save' });
  });

  it('requests a recovery email, then returns to sign-in', async () => {
    await mount({});
    await run(() => view.actions.chooseMode('reset'));
    await run(() => view.actions.submitAuth({ displayName: '', email: 'nova@example.com', password: '' }));
    expect(acct.requestPasswordReset).toHaveBeenCalledWith('nova@example.com');
    expect(state()).toEqual({ kind: 'recovery' });
    await run(() => view.actions.backToSignIn());
    expect(state()).toMatchObject({ kind: 'form', mode: 'signin' });
    await run(() => view.actions.continueAsGuest());
    expect(navigate).toHaveBeenCalledWith('/');
  });
});
