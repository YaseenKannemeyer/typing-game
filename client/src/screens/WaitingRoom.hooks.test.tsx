// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LobbyState } from '../game/useLobby';

/*
 * Contract 8 (04-phase0-handoff.md) without a backend: the real WaitingRoom and
 * Garage containers with their real views, walked through every waiting-room
 * and garage hook scripts/e2e.ts relies on. A rename in the views fails here
 * first; update scripts/e2e.ts in the same batch.
 */

vi.mock('../lib/supabase', () => ({
  supabase: null,
  requireSupabase: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }),
}));
vi.mock('../lib/storage', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/storage')>()), saveBuild: () => true }));
vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  api: {
    startVoting: vi.fn(async () => 'ok'),
    setRaceSettings: vi.fn(async () => {}),
    setCarColor: vi.fn(async () => {}),
    setVehicle: vi.fn(async (_l: string, b: unknown) => b),
    setProfileGarage: vi.fn(async () => {}),
  },
}));

const { WaitingRoom } = await import('./WaitingRoom');
const { api } = await import('../lib/api');

function lobby(): LobbyState {
  const players = [
    { user_id: 'alice', name: 'Alice', car_color: '#ff683b', joined_at: '', streak: 0, vehicle: {} },
    { user_id: 'bob', name: 'Bob', car_color: '#8dbdff', joined_at: '', streak: 0, vehicle: { model: 'rocket', team: 'night', driver: 'BOB3' } },
  ];
  return {
    phase: 'ready', error: null, errorKind: null, connected: true, userId: 'bob',
    lobby: { id: 'l', code: 'E2E123', host_id: 'alice', status: 'waiting', current_race_id: null, vote_ends_at: null, mode: null, race_seconds: 120, zero_mistakes: false, destination: null } as LobbyState['lobby'],
    players: players as LobbyState['players'], votes: [], race: null, passage: null, racePlayers: [], live: {},
    online: new Set(['alice', 'bob']), clockOffset: 0, voteResult: null, championship: null,
  };
}

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  HTMLElement.prototype.scrollIntoView = () => {};
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
});

const all = <T extends Element = HTMLElement>(sel: string) => [...host.querySelectorAll<T>(sel)];
/** Like Playwright's getByRole(role, { name }): accessible name from aria-label or text. */
const byRole = (role: 'button' | 'tab' | 'heading', name: RegExp | string) => {
  const sel = role === 'button' ? 'button' : role === 'tab' ? '[role="tab"]' : 'h1,h2,h3';
  return all(sel).find((el) => {
    const label = el.getAttribute('aria-label') ?? el.textContent ?? '';
    return typeof name === 'string' ? label.trim() === name : name.test(label);
  });
};
/** Like getByLabel: the control inside a <label> whose text starts with `text`. */
const byLabel = <T extends HTMLElement>(text: string) =>
  all('label').find((l) => l.textContent?.trim().startsWith(text))?.querySelector<T>('input,select');
const click = (el: Element | undefined) => {
  expect(el, 'element to click').toBeTruthy();
  return act(async () => (el as HTMLElement).click());
};

describe('e2e hooks (waiting room and garage)', () => {
  it('keeps every selector scripts/e2e.ts uses before the vote', async () => {
    await act(() => root.render(<WaitingRoom state={lobby()} refresh={async () => {}} />));

    // Alice's checks: Bob's bay with his car lettering, the racer count, the paddock heading.
    const bay = all('.w-parking-bay').find((b) => b.textContent?.includes('Bob'));
    expect(bay).toBeTruthy();
    expect([...bay!.querySelectorAll('text')].some((t) => t.textContent?.includes('BOB3'))).toBe(true);
    expect(host.textContent).toContain('2 / 15 racers');
    expect(byRole('heading', /The paddock/)).toBeTruthy();
    expect(byRole('button', /Start mode vote|Waiting for the host/)).toBeTruthy();
    expect(byRole('tab', 'Destination')).toBeTruthy();

    // Bob's garage walk: Open garage → Rocket Racer → effect → Livery → team → decal → lettering → confirm.
    await click(byRole('button', 'Open garage'));
    await click(byRole('button', /Rocket Racer/));
    const effect = byLabel<HTMLSelectElement>('Cosmetic effect');
    expect(effect?.tagName).toBe('SELECT');
    await click(byRole('tab', 'Livery'));
    await click(byRole('button', /Nightshift/));
    expect(byLabel<HTMLSelectElement>('Decal')?.tagName).toBe('SELECT');
    expect(byLabel<HTMLInputElement>('Driver lettering')?.tagName).toBe('INPUT');
    await click(byRole('button', /Rocket Racer/)); // a change, so confirm is enabled
    await click(byRole('button', /Confirm vehicle/));
    expect(host.textContent).toContain('Selection saved');
    expect(api.setVehicle).toHaveBeenCalled();

    // Race settings hooks (host-only controls are read-only for Bob, but present).
    expect(byLabel<HTMLInputElement>('Zero-mistake mode')).toBeTruthy();
    expect(host.textContent).toContain('Off: mistakes turn red');
    expect(byRole('button', '1 min')).toBeTruthy();
  });
});
