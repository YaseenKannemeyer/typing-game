// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LobbyPlayer } from '../../game/types';
import type { GarageViewProps } from './garageViewModel';

/*
 * The garage container's contract, independent of its presentation: GarageView
 * is replaced by a probe. Covers the draft/server sync and the confirmation
 * sequence (colour, then build, then local and profile copies), which the
 * presentation extraction must not change.
 */

let view: GarageViewProps;
vi.mock('./GarageView', () => ({ GarageView: (p: GarageViewProps) => ((view = p), null) }));
const calls: string[] = [];
let session: { user: { is_anonymous: boolean } } | null = null;
vi.mock('../../lib/supabase', () => ({ requireSupabase: () => ({ auth: { getSession: async () => (calls.push('session'), { data: { session } }) } }) }));
vi.mock('../../lib/storage', () => ({ saveBuild: vi.fn(() => (calls.push('saveBuild'), true)) }));
vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  api: {
    setCarColor: vi.fn(async () => void calls.push('setCarColor')),
    setVehicle: vi.fn(async (_l: string, b: unknown) => (calls.push('setVehicle'), b)),
    setProfileGarage: vi.fn(async () => void calls.push('setProfileGarage')),
  },
}));

const { Garage } = await import('./Garage');
const { api } = await import('../../lib/api');
const { saveBuild } = await import('../../lib/storage');

const player = (id: string, color: string, vehicle: LobbyPlayer['vehicle'] = {}): LobbyPlayer =>
  ({ user_id: id, name: id === 'me' ? 'Nova' : id, car_color: color, joined_at: '', streak: 0, vehicle }) as LobbyPlayer;

let root: Root;
const render = (me: LobbyPlayer, players: LobbyPlayer[], locked = false) =>
  act(() => root.render(<Garage lobbyId="lobby" me={me} meIndex={0} players={players} locked={locked} />));
const run = (fn: () => void) => act(async () => fn());

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  calls.length = 0;
  session = null;
  vi.clearAllMocks();
  root = createRoot(document.createElement('div'));
});
afterEach(async () => {
  await act(() => root.unmount());
});

describe('garage container', () => {
  it('marks colours held by other racers as taken, never your own', async () => {
    const me = player('me', '#ff683b');
    await render(me, [me, player('a', '#8dbdff'), player('b', '#a995e8')]);
    const taken = view.model.colors.filter((c) => c.taken).map((c) => c.value);
    expect(taken.sort()).toEqual(['#8dbdff', '#a995e8']);
    expect(view.model.colors.find((c) => c.value === '#ff683b')!.taken).toBe(false);
    expect(view.model).toMatchObject({ driverName: 'Nova', locked: false, busy: false, dirty: false, feedback: { kind: 'idle' } });
  });

  it('follows the server build until the player edits, then keeps the draft', async () => {
    const me = player('me', '#ff683b', { model: 'formula', number: 7 });
    await render(me, [me]);
    expect(view.model.draft).toMatchObject({ model: 'formula', number: 7 });
    const updated = { ...me, vehicle: { model: 'rally' as const, number: 12 } };
    await render(updated, [updated]);
    expect(view.model.draft).toMatchObject({ model: 'rally', number: 12 });

    await run(() => view.actions.edit({ number: 999 }));
    expect(view.model).toMatchObject({ dirty: true, feedback: { kind: 'draft' } });
    const again = { ...me, vehicle: { model: 'taxi' as const, number: 1 } };
    await render(again, [again]);
    expect(view.model.draft).toMatchObject({ model: 'rally', number: 999 });
  });

  it('confirms colour, then build, then the local copy and session check, in that order', async () => {
    const me = player('me', '#ff683b');
    await render(me, [me]);
    await run(() => view.actions.paint('#4ed7ba'));
    await run(() => view.actions.edit({ model: 'rocket' }));
    await run(() => view.actions.confirm());
    expect(calls).toEqual(['setCarColor', 'setVehicle', 'saveBuild', 'session']);
    expect(api.setCarColor).toHaveBeenCalledWith('lobby', '#4ed7ba');
    expect(vi.mocked(api.setVehicle).mock.calls[0]![1]).toMatchObject({ model: 'rocket' });
    expect(view.model).toMatchObject({ dirty: false, busy: false, feedback: { kind: 'saved', stored: true } });
  });

  it('skips the colour call when the colour is unchanged, and saves to the profile for accounts', async () => {
    session = { user: { is_anonymous: false } };
    const me = player('me', '#ff683b');
    await render(me, [me]);
    await run(() => view.actions.edit({ stripes: true }));
    await run(() => view.actions.confirm());
    expect(calls).toEqual(['setVehicle', 'saveBuild', 'session', 'setProfileGarage']);
  });

  it('reports storage failure as confirmed for this lobby only', async () => {
    vi.mocked(saveBuild).mockImplementationOnce(() => false);
    const me = player('me', '#ff683b');
    await render(me, [me]);
    await run(() => view.actions.edit({ number: 0 }));
    await run(() => view.actions.confirm());
    expect(view.model.feedback).toEqual({ kind: 'saved', stored: false });
  });

  it('keeps the draft and reports the error when saving fails', async () => {
    vi.mocked(api.setVehicle).mockRejectedValueOnce(new Error('Vehicle locked: a race is on'));
    const me = player('me', '#ff683b');
    await render(me, [me]);
    await run(() => view.actions.edit({ model: 'kart' }));
    await run(() => view.actions.confirm());
    expect(view.model).toMatchObject({ dirty: true, busy: false, feedback: { kind: 'error' } });
    expect(view.model.draft.model).toBe('kart');
  });

  it('shows busy while confirming', async () => {
    let finish!: (v: unknown) => void;
    vi.mocked(api.setVehicle).mockImplementationOnce(() => new Promise((r) => (finish = r)) as never);
    const me = player('me', '#ff683b');
    await render(me, [me]);
    await run(() => view.actions.edit({ model: 'kart' }));
    await run(() => view.actions.confirm());
    expect(view.model.busy).toBe(true);
    await run(() => finish({ model: 'kart' }));
    expect(view.model.busy).toBe(false);
  });

  it('passes the lock through', async () => {
    const me = player('me', '#ff683b');
    await render(me, [me], true);
    expect(view.model.locked).toBe(true);
  });
});
