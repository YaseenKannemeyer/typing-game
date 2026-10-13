// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LobbyState } from '../game/useLobby';

/*
 * The real Voting and Results containers with their real views (no probes),
 * driven through the transitions a live room produces, with the API mocked
 * (no network). Also walks the hooks scripts/e2e.ts relies on for these screens.
 */

vi.mock('../lib/supabase', () => ({ supabase: null, requireSupabase: () => { throw new Error('no backend in tests'); } }));
vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  api: {
    castVote: vi.fn(async () => {}),
    closeVoting: vi.fn(async () => 'hard'),
    awardTrophies: vi.fn(async () => {}),
    mySummary: vi.fn(async () => ({ trophy_counts: {}, stats: { races: 1, best_wpm: null } })),
    myPreviousBest: vi.fn(async () => ({ best_wpm: null, races: 0 })),
    startRace: vi.fn(async () => 'race'),
    startVoting: vi.fn(async () => 'ok'),
    returnToLobby: vi.fn(async () => {}),
  },
}));

const { Voting } = await import('./Voting');
const { Results } = await import('./Results');
const { api } = await import('../lib/api');
const NOW = Date.parse('2026-10-13T12:00:00Z');

const IDS = ['me', 'p1', 'p2', 'p3', 'p4'];
function room(o: { host?: string; votes?: [string, string][]; endsIn?: number; voteResult?: LobbyState['voteResult'] } = {}): LobbyState {
  return {
    phase: 'ready', error: null, errorKind: null, connected: true, userId: 'me',
    lobby: { id: 'l', code: 'ABC123', host_id: o.host ?? 'me', status: 'voting', current_race_id: 'r', vote_ends_at: new Date(NOW + (o.endsIn ?? 20_000)).toISOString(), mode: null, race_seconds: 120, zero_mistakes: false, destination: null } as LobbyState['lobby'],
    players: IDS.map((id, i) => ({ user_id: id, name: id === 'me' ? 'Alice' : id === 'p1' ? 'Bob' : id.toUpperCase(), car_color: '#ff683b', joined_at: '', streak: 0, vehicle: { number: i } })) as LobbyState['players'],
    votes: (o.votes ?? []).map(([user_id, mode]) => ({ user_id, mode })) as LobbyState['votes'],
    race: null, passage: 'one two three', racePlayers: [], live: {}, online: new Set(IDS), clockOffset: 0, voteResult: o.voteResult ?? null, championship: null,
  };
}

type Row = { id: string; rank: number | null; wpm: number; flagged?: boolean; finished?: boolean; awards?: { trophy: string; reason: string }[] };
function finished(rows: Row[], o: { host?: string; me?: string; awarded?: boolean } = {}): LobbyState {
  const base = room({ host: o.host });
  return {
    ...base,
    userId: o.me ?? 'me',
    lobby: { ...base.lobby!, status: 'racing', mode: 'hard' },
    race: { id: 'r', passage_id: 1, start_at: new Date(NOW - 121_000).toISOString(), end_at: new Date(NOW - 1000).toISOString(), duration_s: 120, zero_mistakes: false, ended_at: new Date(NOW).toISOString(), status: 'finished', mode: 'hard', awarded_at: o.awarded ? new Date(NOW).toISOString() : null } as unknown as LobbyState['race'],
    racePlayers: rows.map((r) => ({
      user_id: r.id, name: base.players.find((p) => p.user_id === r.id)!.name, words_done: 10, locked_chars: 300, correct_chars: 400, keystrokes: 420, errors: 3,
      finished_at: r.finished === false ? null : new Date(NOW - 1000).toISOString(), rank: r.rank, net_wpm: r.wpm, gross_wpm: r.wpm + 4, accuracy: 97.5, flagged: !!r.flagged,
      samples: [], deletions: 0, section_keystrokes: Array(10).fill(42), section_errors: Array(10).fill(0), awards: r.awards ?? [],
    })) as unknown as LobbyState['racePlayers'],
  };
}

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

const all = <T extends Element = HTMLElement>(sel: string) => [...host.querySelectorAll<T>(sel)];
const mode = (name: string) => all<HTMLButtonElement>('.g-mode').find((b) => b.querySelector('h3')?.textContent === name)!;
const button = (name: string) => all<HTMLButtonElement>('button').find((b) => b.textContent?.includes(name));
const show = (s: LobbyState, el: 'vote' | 'results') => act(async () => root.render(el === 'vote' ? <Voting state={s} /> : <Results state={s} />));
const click = (el: HTMLElement | undefined) => act(async () => el!.click());
const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe('vote: container → view transitions', () => {
  it('votes, locks at the deadline, shows a late refusal, then reveals the server’s choice (not the local leader)', async () => {
    const s = room({ endsIn: 2_000, votes: [['p1', 'coding'], ['p2', 'coding']] });
    await show(s, 'vote');
    expect(host.textContent).toContain('Pick your kind of fast.');
    await click(mode('Hard'));
    expect(api.castVote).toHaveBeenCalledWith('l', 'hard');

    // A change of mind just before the deadline; its answer is slow.
    let refuse!: (e: Error) => void;
    vi.mocked(api.castVote).mockImplementationOnce(() => new Promise((_, reject) => (refuse = reject)));
    const voted = { ...s, votes: [...s.votes, { user_id: 'me', mode: 'hard' }] } as LobbyState;
    await show(voted, 'vote');
    expect(mode('Hard').getAttribute('aria-pressed')).toBe('true');
    await click(mode('Easy'));

    // The deadline passes: every option and the host control lock, and the server is asked to close.
    await tick(2_100);
    expect(all<HTMLButtonElement>('.g-mode').every((b) => b.disabled)).toBe(true);
    expect(button('End voting now')!.disabled).toBe(true);
    expect(host.textContent).toContain('Confirming the server’s selection');
    await tick(800);
    expect(api.closeVoting).toHaveBeenCalled();

    // The slow vote comes back refused after the close: shown, options still locked, vote unchanged.
    await act(async () => refuse(new Error('Voting has closed')));
    expect(host.querySelector('.vote-controls')?.textContent).toMatch(/closed/i);
    expect(all<HTMLButtonElement>('.g-mode').every((b) => b.disabled)).toBe(true);
    expect(mode('Hard').getAttribute('aria-pressed')).toBe('true');

    // The server picks Hard although Coding led locally: the view shows Hard.
    await show({ ...voted, voteResult: 'hard' }, 'vote');
    const reveal = host.querySelector('.g-vote-reveal')!;
    expect(reveal.textContent).toContain('Hard it is.');
    expect(reveal.textContent).not.toContain('TIE');
  });

  it('reveals a server-resolved tie and Random as the server sent them', async () => {
    await show(room({ votes: [['me', 'hard'], ['p1', 'coding']], voteResult: 'coding' }), 'vote');
    expect(host.querySelector('.g-vote-reveal')!.textContent).toMatch(/TIE RESOLVED · SERVER SELECTION[\s\S]*Coding it is\./);
    await show(room({ voteResult: 'random' }), 'vote');
    expect(host.querySelector('.g-vote-reveal')!.textContent).toContain('The server will draw a passage mode.');
  });

  it('shows no host control to a guest', async () => {
    await show(room({ host: 'p1' }), 'vote');
    expect(button('End voting now')).toBeUndefined();
  });
});

describe('results: container → view transitions', () => {
  const FIELD: Row[] = [
    { id: 'p2', rank: 1, wpm: 140, flagged: true },
    { id: 'p1', rank: 2, wpm: 101.6 },
    { id: 'me', rank: 3, wpm: 92.2, awards: [{ trophy: 'silver', reason: '2nd' }] },
    { id: 'p3', rank: 4, wpm: 92.2 },
    { id: 'p4', rank: 5, wpm: 50, finished: false },
  ];

  it('keeps official order, puts only finishers on the podium, and keeps the e2e hooks', async () => {
    await show(finished(FIELD), 'results');
    expect(host.textContent).toContain('Every finish has a story.');
    // Flagged P1 and the racer who left early get no podium slot; places stay the server's.
    const podium = all('.w-podium-list li').map((li) => [li.querySelector('.results-podium-place span')?.textContent, li.querySelector('h2')?.textContent]);
    expect(podium).toEqual([['P2', 'Bob'], ['P3', 'Alice'], ['P4', 'P3']]);
    expect(all('.w-podium-list b').map((b) => b.textContent)).toEqual(['102 WPM', '92 WPM', '92 WPM']);
    // Podium cars are the real Car renderer, idle.
    expect(all<SVGElement>('.w-podium-list svg.vehicle').map((s) => s.dataset.state)).toEqual(['idle', 'idle', 'idle']);
    // The table keeps every row in server order.
    expect(all('.g-results-table tbody tr').map((tr) => tr.querySelector('th strong')?.firstChild?.textContent)).toEqual(['P2', 'Bob', 'Alice', 'P3', 'P4']);
    expect(all('.g-results-table tbody tr').find((tr) => tr.textContent?.includes('Bob'))).toBeTruthy();
  });

  it('confirms awards only once the server stored them', async () => {
    await show(finished(FIELD), 'results');
    expect(host.textContent).toContain('Confirming awards…');
    expect(all('.g-award')).toHaveLength(0); // even though the row already carries an award
    expect(api.awardTrophies).toHaveBeenCalledWith('r');
    await show(finished(FIELD, { awarded: true }), 'results');
    expect(host.textContent).not.toContain('Confirming awards…');
    expect(all('.g-award').length).toBeGreaterThan(0);
  });

  it('shows a failed host action inline and re-enables the actions', async () => {
    vi.mocked(api.startRace).mockRejectedValueOnce(new Error('Not enough racers for a rematch'));
    await show(finished(FIELD, { awarded: true }), 'results');
    await click(button('Race again'));
    expect(host.querySelector('.results-next')!.textContent).toContain('Not enough racers');
    expect(button('Race again')!.disabled).toBe(false);
    expect(button('Back to lobby')).toBeTruthy();
  });

  it('gives a spectator no trophy haul, no debrief and no host controls', async () => {
    await show(finished(FIELD, { me: 'watcher', host: 'p1', awarded: true }), 'results');
    expect(host.textContent).not.toContain('Your trophy haul');
    expect(host.querySelector('.x-debrief')).toBeNull();
    expect(button('Race again')).toBeUndefined();
    expect(host.textContent).toContain('Waiting for the host');
  });
});
