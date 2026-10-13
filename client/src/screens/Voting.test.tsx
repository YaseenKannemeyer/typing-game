// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MODE_DESIGN } from '../art/gridArt';
import type { LobbyState } from '../game/useLobby';
import type { VotingViewProps } from '../components/voting/votingViewModel';

/*
 * The vote container's contract, independent of its presentation (VotingView
 * is replaced by a probe): server clock, tallies, the server-chosen result,
 * closing at the deadline, sounds and API calls.
 */

let view: VotingViewProps;
vi.mock('../components/voting/VotingView', () => ({ VotingView: (p: VotingViewProps) => ((view = p), null) }));
const play = vi.fn();
vi.mock('../game/sound', () => ({ useSound: () => ({ play }) }));
vi.mock('../lib/supabase', () => ({ supabase: null, requireSupabase: () => { throw new Error('no backend in tests'); } }));
vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  api: { castVote: vi.fn(async () => {}), closeVoting: vi.fn(async () => 'easy') },
}));

const { Voting } = await import('./Voting');
const { api } = await import('../lib/api');
const NOW = Date.parse('2026-10-13T12:00:00Z');

function lobbyState(o: { host?: string; votes?: [string, string][]; endsIn?: number; voteResult?: LobbyState['voteResult'] } = {}): LobbyState {
  const ids = ['me', 'p1', 'p2', 'p3'];
  return {
    phase: 'ready', error: null, errorKind: null, connected: true, userId: 'me',
    lobby: { id: 'l', code: 'ABC123', host_id: o.host ?? 'me', status: 'voting', current_race_id: null, vote_ends_at: new Date(NOW + (o.endsIn ?? 20_000)).toISOString(), mode: null, race_seconds: 180, zero_mistakes: true, destination: 'rain' } as LobbyState['lobby'],
    players: ids.map((id, i) => ({ user_id: id, name: id, car_color: '#ff683b', joined_at: '', streak: 0, vehicle: { number: i } })) as LobbyState['players'],
    votes: (o.votes ?? []).map(([user_id, mode]) => ({ user_id, mode })) as LobbyState['votes'],
    race: null, passage: null, racePlayers: [], live: {}, online: new Set(ids), clockOffset: 0, voteResult: o.voteResult ?? null, championship: null,
  };
}

let root: Root;
const render = (s: LobbyState) => act(() => root.render(<Voting state={s} />));
const run = (fn: () => void) => act(async () => fn());

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  root = createRoot(document.createElement('div'));
});
afterEach(async () => {
  await act(() => root.unmount());
  vi.useRealTimers();
});

describe('voting container', () => {
  it('tallies votes per mode, in MODE_DESIGN order, with your vote marked', async () => {
    await render(lobbyState({ votes: [['me', 'hard'], ['p1', 'hard'], ['p2', 'coding']] }));
    expect(view.model.options.map((o) => o.mode.id)).toEqual(MODE_DESIGN.map((m) => m.id));
    const hard = view.model.options.find((o) => o.mode.id === 'hard')!;
    expect(hard).toMatchObject({ count: 2, selected: true });
    expect(hard.voters.map((v) => v.id)).toEqual(['me', 'p1']);
    expect(view.model.options.find((o) => o.mode.id === 'coding')).toMatchObject({ count: 1, selected: false });
    expect(view.model).toMatchObject({
      votedCount: 3,
      racerCount: 4,
      rules: { raceSeconds: 180, zeroMistakes: true, destination: 'Midnight Rain' },
      isHost: true,
      error: null,
      reveal: null,
      closing: false,
    });
    expect(view.model.clock.remainingS).toBeCloseTo(20, 0);
  });

  it('casts and changes votes through the API with a click sound, and reports errors', async () => {
    await render(lobbyState());
    await run(() => view.actions.vote('shakespeare'));
    expect(play).toHaveBeenCalledWith('ui-click');
    expect(api.castVote).toHaveBeenCalledWith('l', 'shakespeare');
    vi.mocked(api.castVote).mockRejectedValueOnce(new Error('Voting has closed'));
    await run(() => view.actions.vote('easy'));
    expect(view.model.error).toBeTruthy();
  });

  it('lets the host end the vote, and reports a failure', async () => {
    await render(lobbyState());
    vi.mocked(api.closeVoting).mockRejectedValueOnce(new Error('Only the host can end the vote'));
    await run(() => view.actions.endVoting());
    expect(api.closeVoting).toHaveBeenCalledWith('l');
    expect(view.model.error).toBeTruthy();
  });

  it('marks a guest, who cannot end the vote', async () => {
    await render(lobbyState({ host: 'p1' }));
    expect(view.model.isHost).toBe(false);
  });

  it('asks the server to close once the deadline passes, retrying until the result arrives', async () => {
    const state = lobbyState({ endsIn: 300 });
    await render(state);
    expect(view.model.closing).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(400)); // the 100 ms clock passes the deadline
    expect(view.model.closing).toBe(true);
    expect(view.model.clock.remainingS).toBe(0);
    await act(() => vi.advanceTimersByTimeAsync(800)); // random 0–800 ms spread across clients
    expect(api.closeVoting).toHaveBeenCalledTimes(1);
    // The request was lost or refused (e.g. clock skew): ask again every 3 s, idempotently.
    await act(() => vi.advanceTimersByTimeAsync(3_000));
    expect(api.closeVoting).toHaveBeenCalledTimes(2);
    // The result arrives: closing ends and the requests stop.
    await render({ ...state, voteResult: 'easy' });
    expect(view.model.closing).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(api.closeVoting).toHaveBeenCalledTimes(2);
  });

  it('keeps the pending close request when the room refreshes during the spread', async () => {
    const state = lobbyState({ endsIn: 0 });
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // the latest slot in the spread
    await render(state);
    await act(() => vi.advanceTimersByTimeAsync(300));
    // A vote update refreshes the lobby (a new object, same room) before the request fires.
    await render({ ...state, lobby: { ...state.lobby! }, votes: [{ user_id: 'p1', mode: 'easy' }] as LobbyState['votes'] });
    await act(() => vi.advanceTimersByTimeAsync(600));
    expect(api.closeVoting).toHaveBeenCalledTimes(1);
    vi.mocked(Math.random).mockRestore();
  });

  it("reveals the server's choice; a tie only when several modes share the top count", async () => {
    await render(lobbyState({ votes: [['me', 'hard'], ['p1', 'hard'], ['p2', 'coding']], voteResult: 'hard' }));
    expect(view.model.reveal).toMatchObject({ mode: { id: 'hard' }, tie: false });
    expect(view.model.closing).toBe(false);
    await render(lobbyState({ votes: [['me', 'hard'], ['p1', 'coding']], voteResult: 'coding' }));
    expect(view.model.reveal).toMatchObject({ mode: { id: 'coding' }, tie: true });
    // Nobody voted: the server draws "random".
    await render(lobbyState({ voteResult: 'random' }));
    expect(view.model.reveal).toMatchObject({ mode: { id: 'random' }, tie: false });
  });
});
