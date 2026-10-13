// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LobbyState } from '../game/useLobby';
import type { ResultsViewProps } from '../components/results/resultsViewModel';

/*
 * The results container's contract, independent of its presentation
 * (ResultsView is replaced by a probe): official order and stats only from the
 * server, awards only once the server stored them (requested until then),
 * winner/award sounds, host actions and the championship/debrief slots.
 */

let view: ResultsViewProps;
vi.mock('../components/results/ResultsView', () => ({ ResultsView: (p: ResultsViewProps) => ((view = p), null) }));
const play = vi.fn();
vi.mock('../game/sound', () => ({ useSound: () => ({ play }) }));
vi.mock('../lib/supabase', () => ({ supabase: null, requireSupabase: () => { throw new Error('no backend in tests'); } }));
vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  api: {
    awardTrophies: vi.fn(async () => {}),
    mySummary: vi.fn(async () => ({ trophy_counts: {}, stats: { races: 1, best_wpm: null } })),
    myPreviousBest: vi.fn(async () => ({ best_wpm: null, races: 0 })),
    startRace: vi.fn(async () => {}),
    startVoting: vi.fn(async () => {}),
    returnToLobby: vi.fn(async () => {}),
  },
}));

const { Results } = await import('./Results');
const { api } = await import('../lib/api');
const NOW = Date.parse('2026-10-13T12:00:00Z');

type Row = { id: string; rank: number | null; wpm?: number; flagged?: boolean; finished?: boolean; awards?: { trophy: string; reason: string }[] };
function racePlayer(r: Row) {
  const finished = r.finished ?? r.rank !== null;
  return {
    user_id: r.id, name: r.id.toUpperCase(), words_done: 10, locked_chars: 300, correct_chars: 400, keystrokes: 420, errors: 3,
    finished_at: finished ? new Date(NOW - 1000).toISOString() : null, rank: r.rank, net_wpm: r.wpm ?? 80, gross_wpm: 85, accuracy: 97.5, flagged: !!r.flagged,
    samples: [], deletions: 0, section_keystrokes: Array(10).fill(42), section_errors: Array(10).fill(0), awards: r.awards ?? [],
  };
}
function lobbyState(rows: Row[], o: { host?: string; me?: string; awarded?: boolean; championship?: unknown } = {}): LobbyState {
  return {
    phase: 'ready', error: null, errorKind: null, connected: true, userId: o.me ?? 'me',
    lobby: { id: 'l', code: 'ABC123', host_id: o.host ?? 'me', status: 'racing', current_race_id: 'r', vote_ends_at: null, mode: 'hard', race_seconds: 120, zero_mistakes: false, destination: null } as LobbyState['lobby'],
    players: rows.map((r, i) => ({ user_id: r.id, name: r.id.toUpperCase(), car_color: '#ff683b', joined_at: '', streak: 0, vehicle: { number: i } })) as LobbyState['players'],
    votes: [],
    race: { id: 'r', passage_id: 1, start_at: new Date(NOW - 121_000).toISOString(), end_at: new Date(NOW - 1000).toISOString(), duration_s: 120, zero_mistakes: false, ended_at: new Date(NOW).toISOString(), status: 'finished', mode: 'hard', awarded_at: o.awarded ? new Date(NOW).toISOString() : null } as unknown as LobbyState['race'],
    passage: 'one two three', racePlayers: rows.map(racePlayer) as unknown as LobbyState['racePlayers'], live: {}, online: new Set(), clockOffset: 0, voteResult: null,
    championship: (o.championship ?? null) as LobbyState['championship'],
  };
}

let root: Root;
const render = (s: LobbyState) => act(() => root.render(<Results state={s} />));
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

const FIELD = [
  { id: 'p1', rank: 1, wpm: 101 },
  { id: 'me', rank: 2, wpm: 88 },
  { id: 'p2', rank: 3, wpm: 88 },
  { id: 'p3', rank: 4, flagged: true },
  { id: 'p4', rank: null, finished: false },
];

describe('results container', () => {
  it('passes the server order and stats; left-early and flagged rows keep their server status', async () => {
    await render(lobbyState(FIELD));
    expect(view.model.rows.map((r) => [r.id, r.position, r.status, r.wpm])).toEqual([
      ['p1', 1, 'finished', 101],
      ['me', 2, 'finished', 88],
      ['p2', 3, 'finished', 88],
      ['p3', 4, 'flagged', 80],
    ]);
    expect(view.model.rows.find((r) => r.id === 'me')!.you).toBe(true);
    expect(view.model).toMatchObject({ modeName: 'Hard', isHost: true, busy: null, error: null, raceControl: null });
  });

  it('shows awards as pending (nothing earned) and requests them until the server has stored them', async () => {
    const withAwards = FIELD.map((r) => (r.id === 'me' ? { ...r, awards: [{ trophy: 'silver', reason: '2nd' }] } : r));
    await render(lobbyState(withAwards));
    expect(view.model.awards).toEqual({ status: 'pending', mine: { name: 'ME', finished: true, race: [{ trophy: 'silver', reason: '2nd' }], progression: [] }, others: [] });
    expect(api.awardTrophies).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(8_000));
    expect(api.awardTrophies).toHaveBeenCalledTimes(3);

    await render(lobbyState(withAwards, { awarded: true }));
    await act(() => vi.advanceTimersByTimeAsync(8_000));
    expect(api.awardTrophies).toHaveBeenCalledTimes(3);
    expect(view.model.awards.status).toBe('ready');
    expect(play).toHaveBeenCalledWith('award-reveal');
  });

  it('splits race and progression awards, and lists others in official order', async () => {
    const rows = [
      { id: 'p1', rank: 1, awards: [{ trophy: 'unstoppable', reason: '3 in a row' }, { trophy: 'gold', reason: '1st' }] },
      { id: 'me', rank: 2, awards: [{ trophy: 'silver', reason: '2nd' }, { trophy: 'unstoppable', reason: '3 in a row' }] },
      { id: 'p2', rank: 3, awards: [{ trophy: 'bronze', reason: '3rd' }] },
    ];
    await render(lobbyState(rows, { awarded: true }));
    expect(view.model.awards.mine).toMatchObject({ race: [{ trophy: 'silver' }], progression: [{ trophy: 'unstoppable' }] });
    expect(view.model.awards.others.map((o) => [o.id, o.awards.map((a) => a.trophy)])).toEqual([
      ['p1', ['gold', 'unstoppable']],
      ['p2', ['bronze']],
    ]);
  });

  it('plays the winner sound only for the first finished racer (a flagged P1 does not count)', async () => {
    await render(lobbyState([{ id: 'p1', rank: 1, flagged: true }, { id: 'me', rank: 2 }]));
    expect(play).toHaveBeenCalledWith('winner');
    play.mockClear();
    await act(() => root.unmount());
    root = createRoot(document.createElement('div'));
    await render(lobbyState(FIELD));
    expect(play).not.toHaveBeenCalledWith('winner');
  });

  it('runs host actions with busy state, and clears busy on failure', async () => {
    let finish!: () => void;
    vi.mocked(api.startRace).mockImplementationOnce(() => new Promise<string>((r) => (finish = () => r('race'))));
    await render(lobbyState(FIELD));
    await run(() => view.actions.rematch());
    expect(api.startRace).toHaveBeenCalledWith('l');
    expect(view.model.busy).toBe('rematch');
    await run(() => finish());
    vi.mocked(api.startVoting).mockRejectedValueOnce(new Error('Only the host can start a vote'));
    await run(() => view.actions.newVote());
    expect(view.model).toMatchObject({ busy: null });
    expect(view.model.error).toBeTruthy();
    await run(() => view.actions.backToLobby());
    expect(api.returnToLobby).toHaveBeenCalledWith('l');
  });

  it('fills the slots: championship only with committed rounds, debrief only for racers', async () => {
    const champ = { id: 'c', status: 'running', rounds: 3, revision: 1, points: [10, 8], committed: [{ round: 1, race_id: 'r', mode: 'hard' }], standings: [] };
    await render(lobbyState(FIELD, { championship: champ }));
    expect(view.slots.championship).not.toBeNull();
    expect(view.slots.debrief).not.toBeNull();
    await render(lobbyState(FIELD, { championship: { ...champ, committed: [] } }));
    expect(view.slots.championship).toBeNull();
    await render(lobbyState(FIELD, { championship: { ...champ, status: 'cancelled' } }));
    expect(view.slots.championship).toBeNull();
    // A spectator: no debrief, no trophy haul.
    await render(lobbyState(FIELD, { me: 'watcher', host: 'p1' }));
    expect(view.slots.debrief).toBeNull();
    expect(view.model).toMatchObject({ isHost: false, awards: { mine: null } });
  });

  it('marks a racer who left early as not finished', async () => {
    await render(lobbyState([{ id: 'p1', rank: 1 }, { id: 'me', rank: 2, finished: false }], { awarded: true }));
    expect(view.model.rows.find((r) => r.id === 'me')).toMatchObject({ status: 'dnf', wpm: null, accuracy: null });
    expect(view.model.awards.mine).toMatchObject({ finished: false });
  });
});
