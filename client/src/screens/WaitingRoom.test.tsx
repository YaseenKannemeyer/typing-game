// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LobbyState } from '../game/useLobby';
import type { WaitingRoomViewProps } from '../components/lobby/waitingRoomViewModel';

/*
 * The waiting-room container's contract, independent of its presentation
 * (WaitingRoomView is replaced by a probe): host/guest facts, optimistic
 * settings with rollback, start-vote errors, the garage slot and tab target.
 */

let view: WaitingRoomViewProps;
vi.mock('../components/lobby/WaitingRoomView', () => ({ WaitingRoomView: (p: WaitingRoomViewProps) => ((view = p), null) }));
vi.mock('../lib/supabase', () => ({ supabase: null, requireSupabase: () => { throw new Error('no backend in tests'); } }));
vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  api: { startVoting: vi.fn(), setRaceSettings: vi.fn() },
}));

const { WaitingRoom } = await import('./WaitingRoom');
const { api } = await import('../lib/api');

function lobbyState(host: string, ids: string[], patch: Partial<NonNullable<LobbyState['lobby']>> = {}): LobbyState {
  return {
    phase: 'ready', error: null, errorKind: null, connected: true, userId: 'me',
    lobby: { id: 'l', code: 'ABC123', host_id: host, status: 'waiting', current_race_id: null, vote_ends_at: null, mode: null, race_seconds: 120, zero_mistakes: false, destination: null, ...patch } as LobbyState['lobby'],
    players: ids.map((id, i) => ({ user_id: id, name: id, car_color: '#ff683b', joined_at: '', streak: 0, vehicle: i === 0 ? { model: 'formula' } : {} })) as LobbyState['players'],
    votes: [], race: null, passage: null, racePlayers: [], live: {}, online: new Set(ids.slice(0, 1)), clockOffset: 0, voteResult: null, championship: null,
  };
}

let root: Root;
let state: LobbyState;
const render = (s: LobbyState = state) => {
  state = s;
  return act(() => root.render(<WaitingRoom state={state} refresh={async () => {}} />));
};
const run = (fn: () => void) => act(async () => fn());

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  root = createRoot(document.createElement('div'));
});
afterEach(async () => {
  await act(() => root.unmount());
});

describe('waiting room container', () => {
  it('describes the room for the host', async () => {
    await render(lobbyState('me', ['me', 'p1']));
    expect(view.model).toMatchObject({
      room: { code: 'ABC123', racerCount: 2, maxRacers: 15 },
      isHost: true,
      canStart: true,
      starting: false,
      settings: { seconds: 120, zeroMistakes: false, destination: null, editable: true, saving: false },
      error: null,
      tab: 'destination',
      connection: 'live',
    });
    expect(view.model.roster.map((p) => [p.id, p.you, p.host, p.ready, p.online])).toEqual([
      ['me', true, true, true, true],
      ['p1', false, false, false, false],
    ]);
    expect(view.slots.garage).not.toBeNull();
  });

  it('describes it for a guest, alone, and while reconnecting', async () => {
    await render({ ...lobbyState('p1', ['me']), connected: false });
    expect(view.model).toMatchObject({ isHost: false, canStart: false, settings: { editable: false }, connection: 'reconnecting' });
  });

  it('has no garage slot without a seat', async () => {
    await render(lobbyState('p1', ['p1', 'p2']));
    expect(view.slots.garage).toBeNull();
  });

  it('shows settings optimistically, then follows the server', async () => {
    vi.mocked(api.setRaceSettings).mockResolvedValue(undefined);
    await render(lobbyState('me', ['me', 'p1']));
    await run(() => view.actions.changeSettings(300, true));
    expect(api.setRaceSettings).toHaveBeenCalledWith('l', 300, true, null);
    expect(view.model.settings).toMatchObject({ seconds: 300, zeroMistakes: true, saving: false });
    // The lobby broadcast arrives with the new rules: the optimistic copy is dropped.
    await render(lobbyState('me', ['me', 'p1'], { race_seconds: 300, zero_mistakes: true }));
    expect(view.model.settings).toMatchObject({ seconds: 300, zeroMistakes: true });
    // A destination change keeps the current duration and mode.
    await run(() => view.actions.changeSettings(view.model.settings.seconds, view.model.settings.zeroMistakes, 'rain'));
    expect(api.setRaceSettings).toHaveBeenLastCalledWith('l', 300, true, 'rain');
  });

  it('shows saving while the request is in flight', async () => {
    let finish!: () => void;
    vi.mocked(api.setRaceSettings).mockImplementationOnce(() => new Promise<void>((r) => (finish = r)));
    await render(lobbyState('me', ['me', 'p1']));
    await run(() => view.actions.changeSettings(60, false));
    expect(view.model.settings).toMatchObject({ seconds: 60, saving: true });
    await run(() => finish());
    expect(view.model.settings.saving).toBe(false);
  });

  it('rolls back and reports a failed settings change', async () => {
    vi.mocked(api.setRaceSettings).mockRejectedValueOnce(new Error('Only the host can change the rules'));
    await render(lobbyState('me', ['me', 'p1']));
    await run(() => view.actions.changeSettings(300, true));
    expect(view.model.settings).toMatchObject({ seconds: 120, zeroMistakes: false, saving: false });
    expect(view.model.error).toBeTruthy();
  });

  it('reports a failed start vote and clears starting', async () => {
    vi.mocked(api.startVoting).mockRejectedValueOnce(new Error('Need at least two racers'));
    await render(lobbyState('me', ['me', 'p1']));
    await run(() => view.actions.startVote());
    expect(api.startVoting).toHaveBeenCalledWith('l');
    expect(view.model).toMatchObject({ starting: false });
    expect(view.model.error).toBeTruthy();
  });

  it('opens the garage tab and scrolls to the tab section', async () => {
    const section = document.createElement('section');
    section.scrollIntoView = vi.fn();
    await render(lobbyState('me', ['me', 'p1']));
    view.tabsRef.current = section;
    await run(() => view.actions.openGarage());
    expect(view.model.tab).toBe('garage');
    await act(() => new Promise((r) => requestAnimationFrame(() => r(undefined))));
    expect(section.scrollIntoView).toHaveBeenCalled();
    await run(() => view.actions.selectTab('trophies'));
    expect(view.model.tab).toBe('trophies');
  });
});
