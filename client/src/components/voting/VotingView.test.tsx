// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { modeDesign } from '../../art/gridArt';
import { VOTE_FIXTURES } from '../../dev/fixtures/results';
import { VotingView } from './VotingView';
import type { VotingViewModel } from './votingViewModel';

let host: HTMLDivElement;
let root: Root;
const actions = { vote: vi.fn(), endVoting: vi.fn() };
const fixture = (id: string) => VOTE_FIXTURES.find((f) => f.id === id)!.model;
const render = (model: VotingViewModel) => act(() => root.render(<VotingView model={model} actions={actions} />));

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  vi.clearAllMocks();
});
afterEach(async () => { await act(() => root.unmount()); host.remove(); });

describe('mode vote presentation contract', () => {
  it('uses native pressed buttons, preserves mode order and sends the chosen mode', async () => {
    const model = fixture('vote-selected');
    await render(model);
    const buttons = [...host.querySelectorAll<HTMLButtonElement>('.g-mode')];
    expect(buttons.map((b) => b.querySelector('h3')!.textContent)).toEqual(model.options.map((o) => o.mode.name));
    expect(buttons.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
    expect(buttons[2]!.getAttribute('aria-pressed')).toBe('true');
    await act(() => buttons[3]!.click());
    expect(actions.vote).toHaveBeenCalledExactlyOnceWith('coding');
  });

  it('locks every vote and host control while awaiting the server selection', async () => {
    await render(fixture('vote-closing'));
    const buttons = [...host.querySelectorAll<HTMLButtonElement>('button')];
    expect(buttons).toHaveLength(7);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    expect(host.querySelector('[role="status"]')!.textContent).toContain('Confirming the server’s selection');
    await act(() => buttons.forEach((b) => b.click()));
    expect(actions.vote).not.toHaveBeenCalled();
    expect(actions.endVoting).not.toHaveBeenCalled();
    expect(host.querySelector('.g-vote-reveal')).toBeNull();
  });

  it('reveals only the supplied server mode even when another mode has more votes', async () => {
    await render({ ...fixture('vote-selected'), reveal: { mode: modeDesign('coding'), tie: true } });
    expect(host.querySelector('h1')!.textContent).toBe('Coding it is.');
    expect(host.textContent).toContain('TIE RESOLVED · SERVER SELECTION');
    expect(host.querySelectorAll('.g-mode')).toHaveLength(0);
    expect(host.querySelector('.g-vote-reveal')!.getAttribute('role')).toBe('status');
  });

  it('does not announce clock or tally ticks as a changed selection', async () => {
    const model = fixture('vote-selected');
    await render(model);
    const status = host.querySelector('[role="status"]')!;
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver((records) => mutations.push(...records));
    observer.observe(status, { subtree: true, childList: true, characterData: true });
    try {
      await render({ ...model, clock: { ...model.clock, remainingS: 7 }, votedCount: 6 });
      expect(mutations).toHaveLength(0);
      expect(host.querySelector('[role="status"]')).toBe(status);
    } finally { observer.disconnect(); }
  });

  it('keeps host controls out of guest votes and exposes errors as alerts', async () => {
    await render({ ...fixture('vote-guest'), error: 'Could not save your vote.' });
    expect(host.querySelectorAll('button')).toHaveLength(6);
    expect(host.querySelector('[role="alert"]')!.textContent).toBe('Could not save your vote.');
  });
});
