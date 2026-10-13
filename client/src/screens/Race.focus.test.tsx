// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LobbyState } from '../game/useLobby';
import type { RacePlayer } from '../game/types';

/*
 * Contract 1 (04-phase0-handoff.md): the race has exactly one typing input, and
 * it is never remounted. Focus is only re-applied when started/isRacer/timeUp
 * change, so a remount mid-race would silently drop the racer's focus.
 *
 * This mounts the real LobbyScreen → Race container → RaceView with the lobby
 * state, API and Supabase client mocked (no network), then drives the updates
 * a live race produces and checks the input element and focus survive them.
 */

let lobbyState: LobbyState;
vi.mock('../game/useLobby', () => ({ useLobby: () => ({ state: lobbyState, retry: () => {}, refresh: async () => {} }) }));
vi.mock('../lib/supabase', () => ({ supabase: null, requireSupabase: () => { throw new Error('no backend in tests'); }, ensureSession: async () => 'me', resetSessionCache: () => {} }));
vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  api: {
    submitTyping: vi.fn(async () => ({ ok: true, words_done: 0 })),
    finalizeRace: vi.fn(async () => false),
    leaveLobby: vi.fn(async () => {}),
  },
}));

const { LobbyScreen } = await import('./LobbyScreen');
const { RaceView } = await import('../components/race/RaceView');
const { RACE_FIXTURES } = await import('../dev/fixtures/race');

const TEXT = Array.from({ length: 30 }, () => 'steady hands win long races on the grid').join(' ');
const ME = 'me';
const RIVALS = ['r1', 'r2', 'r3'];

function row(user_id: string, name: string): RacePlayer {
  return {
    user_id, name, words_done: 0, locked_chars: 0, correct_chars: 0, keystrokes: 0, errors: 0, finished_at: null, rank: null,
    net_wpm: null, gross_wpm: null, accuracy: null, flagged: false, samples: [], deletions: 0, section_keystrokes: [], section_errors: [], awards: [],
  } as unknown as RacePlayer;
}

function makeState(startInMs: number, durationS = 60): LobbyState {
  const start = Date.now() + startInMs;
  const ids = [ME, ...RIVALS];
  return {
    phase: 'ready', error: null, errorKind: null, connected: true, userId: ME,
    lobby: { id: 'lobby', code: 'FOCUS1', host_id: ME, status: 'racing', current_race_id: 'race', vote_ends_at: null, mode: 'easy', race_seconds: durationS, zero_mistakes: false, destination: null } as LobbyState['lobby'],
    players: ids.map((id, i) => ({ user_id: id, name: id.toUpperCase(), car_color: '#ffd23f', joined_at: '', streak: 0, vehicle: { number: i + 1 } })) as LobbyState['players'],
    votes: [],
    race: {
      id: 'race', passage_id: 1, start_at: new Date(start).toISOString(), end_at: new Date(start + durationS * 1000).toISOString(),
      duration_s: durationS, zero_mistakes: false, ended_at: null, status: 'racing', mode: 'easy', awarded_at: null,
    } as LobbyState['race'],
    passage: TEXT,
    racePlayers: ids.map((id) => row(id, id.toUpperCase())),
    live: {},
    online: new Set(ids),
    clockOffset: 0,
    voteResult: null,
    championship: null,
  };
}

let root: Root;
let host: HTMLDivElement;
const render = () => act(() => root.render(<LobbyScreen code="FOCUS1" name="ME" onChangeName={() => {}} />));
/** Lets real timers run (the server clock ticks every 100 ms, ranks every 250 ms). */
const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));
const update = async (patch: Partial<LobbyState>) => {
  lobbyState = { ...lobbyState, ...patch };
  await render();
};
const input = () => host.querySelector<HTMLInputElement>('.g-type-input');

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  sessionStorage.clear();
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
});

describe('race typing input', () => {
  it('keeps one input element and its focus through rank, WPM, race-control and connection updates', async () => {
    lobbyState = makeState(-5_000);
    await render();
    await wait(50);
    const el = input();
    expect(el).not.toBeNull();
    expect(host.querySelectorAll('.g-type-input')).toHaveLength(1);
    expect(el!.getAttribute('aria-describedby')).toBeTruthy();
    expect(host.querySelector(`label[for="${el!.id}"]`)?.textContent).toBe('Type the current line');
    expect(document.activeElement).toBe(el);

    const same = (step: string) => {
      expect(input(), `input remounted after ${step}`).toBe(el);
      expect(host.querySelectorAll('.g-type-input'), step).toHaveLength(1);
      expect(document.activeElement, `focus lost after ${step}`).toBe(el);
    };

    // Rank and WPM: rivals' relayed progress changes the order and every speed.
    await update({ live: { r1: { chars: 120, wpm: 40 }, r2: { chars: 60, wpm: 20 } } });
    await wait(300);
    same('a rival takes the lead');
    const wpmBefore = host.querySelector('.w-dashboard')?.textContent;
    await update({ live: { r1: { chars: 120, wpm: 40 }, r2: { chars: 300, wpm: 70 }, r3: { chars: 200, wpm: 50 } } });
    await wait(300);
    same('the order is reshuffled');

    // Race control: the lead change above raises a board (desktop slot and phone slot).
    expect(host.querySelector('.w-pitboard:not(.w-pitboard--idle)'), 'race-control board shown').not.toBeNull();
    same('a race-control board appears');

    // Server rows refresh (new array identity, new counts).
    await update({ racePlayers: lobbyState.racePlayers.map((p) => ({ ...p, correct_chars: p.user_id === ME ? 0 : p.correct_chars + 10 })) });
    same('server rows refresh');

    // Connection lost, then back: LobbyScreen inserts and removes its banner above the race.
    await update({ connected: false });
    expect(host.textContent).toContain('Connection lost');
    same('the connection drops');
    await update({ connected: true });
    expect(host.textContent).not.toContain('Connection lost');
    same('the connection returns');

    await wait(250);
    expect(host.querySelector('.w-dashboard')?.textContent).not.toBe(wpmBefore);
    same('the clock ticks');
  });

  it('keeps the same input from the countdown through GO and time-up', async () => {
    lobbyState = makeState(400, 1);
    await render();
    const el = input();
    expect(el?.disabled).toBe(true);
    expect(host.querySelector('.g-countdown-frame')).not.toBeNull();

    await wait(700); // GO
    expect(input()).toBe(el);
    expect(el!.disabled).toBe(false);
    expect(document.activeElement).toBe(el);

    await wait(1_100); // past end_at: time's up, results still provisional
    expect(input()).toBe(el);
    expect(el!.disabled).toBe(true);
    expect(host.textContent).toMatch(/official results/i);
    expect(host.textContent).not.toMatch(/winner|podium|P1 wins/i);

    // Contract 4: standings are provisional until the server finishes the race, so no
    // car on the race track may play the winner (star) or finish celebration yet.
    const states = [...host.querySelectorAll<SVGElement>('.race-track svg[data-state]')].map((svg) => svg.dataset.state);
    expect(states).toHaveLength(4);
    expect(states.filter((s) => s === 'winner' || s === 'finish'), `car states: ${states.join(', ')}`).toEqual([]);
  });

  it('keeps the input through every delivery state (the delivery row must not remount it)', async () => {
    const base = RACE_FIXTURES.find((f) => f.id === 'race-p1')!;
    const deliveries = RACE_FIXTURES.filter((f) => f.id.startsWith('race-delivery-') && f.model.clock.phase === 'racing').map((f) => f.model.delivery);
    const ref = { current: null as HTMLInputElement | null };
    const view = (delivery: (typeof deliveries)[number]) =>
      act(() => root.render(<RaceView model={{ ...base.model, delivery }} typing={{ state: base.typing!.state, inputRef: ref, onKeyDown: () => {}, waiting: false }} />));
    await view(base.model.delivery);
    const el = input()!;
    el.focus();
    for (const d of [...deliveries, base.model.delivery]) {
      await view(d);
      expect(input(), `input remounted at delivery ${d?.status}`).toBe(el);
      expect(document.activeElement).toBe(el);
    }
  });
});
