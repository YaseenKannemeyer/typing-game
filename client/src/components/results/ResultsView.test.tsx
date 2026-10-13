// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RESULTS_FIXTURES } from '../../dev/fixtures/results';
import { ResultsView } from './ResultsView';
import type { ResultsViewModel } from './resultsViewModel';

let host: HTMLDivElement;
let root: Root;
const actions = { rematch: vi.fn(), newVote: vi.fn(), backToLobby: vi.fn() };
const fixture = (id: string) => RESULTS_FIXTURES.find((f) => f.id === id)!.model;
const render = (model: ResultsViewModel) => act(() => root.render(<ResultsView model={model} actions={actions} slots={{ championship: null, debrief: null }} />));

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  vi.clearAllMocks();
});
afterEach(async () => { await act(() => root.unmount()); host.remove(); });

describe('official results presentation contract', () => {
  it('shows no award cards or award count until ready, even if arrays contain awards', async () => {
    const model = fixture('results-winner');
    await render({ ...model, awards: { ...model.awards, status: 'pending' } });
    expect(host.querySelectorAll('.g-award')).toHaveLength(0);
    expect(host.querySelector('.results-awards-pending')!.textContent).toContain('Confirming awards…');
    expect(host.querySelector('.results-section-heading > span')!.textContent).toContain('racers classified');
    expect(host.querySelector('.results-awards .results-section-heading > span')).toBeNull();
    expect(host.querySelector('.results-other-awards')).toBeNull();
    await render(model);
    expect(host.querySelectorAll('.g-award')).toHaveLength(5);
    expect(host.querySelector('.results-awards-pending')).toBeNull();
  });

  it('keeps tied results in server order rather than treating equal stats as equal places', async () => {
    const model = fixture('results-tied');
    await render(model);
    expect([...host.querySelectorAll('.g-results-table tbody tr th strong')].map((e) => e.textContent)).toEqual(model.rows.map((r) => `${r.name}${r.you ? 'YOU' : ''}`));
    expect([...host.querySelectorAll('.results-podium-place > span')].map((e) => e.textContent)).toEqual(['P1', 'P2', 'P3']);
  });

  it('excludes flagged/DNF racers from the podium and retains supplied places and missing stats', async () => {
    const model = fixture('results-3');
    const rows = model.rows.map((r, i) => ({ ...r, position: i + 5, status: i === 0 ? 'flagged' as const : i === 2 ? 'dnf' as const : 'finished' as const, wpm: i === 1 ? null : 240 }));
    await render({ ...model, rows });
    expect(host.querySelectorAll('.w-podium-list > li')).toHaveLength(1);
    expect(host.querySelector('.results-podium-place > span')!.textContent).toBe('P6');
    expect(host.querySelector('.w-podium-list b')!.textContent).toBe('—');
    expect(host.querySelectorAll('.g-results-table .g-position-badge')).toHaveLength(1);
    expect(host.querySelector('.w-podium-list .is-first')).toBeNull();
  });

  it('shows an empty podium when no eligible racer finishes', async () => {
    await render(fixture('results-nobody'));
    expect(host.querySelector('.w-podium-list')).toBeNull();
    expect(host.querySelector('.results-no-finish')!.textContent).toContain('No official finishers');
    expect(host.querySelectorAll('.g-results-table tbody tr')).toHaveLength(2);
  });

  it('does not present a spectator with personal trophies or host controls', async () => {
    await render(fixture('results-spectator'));
    expect(host.querySelector('#results-awards-title')).toBeNull();
    expect(host.querySelectorAll('.g-result-actions button')).toHaveLength(0);
    expect(host.querySelector('.g-result-actions [role="status"]')!.textContent).toContain('Waiting for the host');
    expect(host.querySelector('.results-other-awards')).not.toBeNull();
  });

  it('keeps all host actions locked while busy, with errors beside the recovered controls', async () => {
    const model = fixture('results-action-error');
    await render({ ...model, busy: 'rematch' });
    let buttons = [...host.querySelectorAll<HTMLButtonElement>('.g-result-actions button')];
    expect(buttons.every((b) => b.disabled)).toBe(true);
    expect(buttons[0]!.getAttribute('aria-busy')).toBe('true');
    await act(() => buttons.forEach((b) => b.click()));
    expect(actions.rematch).not.toHaveBeenCalled();
    await render(model);
    buttons = [...host.querySelectorAll<HTMLButtonElement>('.g-result-actions button')];
    expect(buttons.every((b) => !b.disabled)).toBe(true);
    expect(host.querySelector('.results-next [role="alert"]')!.textContent).toBe(model.error);
    await act(() => buttons[2]!.click());
    expect(actions.backToLobby).toHaveBeenCalledOnce();
  });

  it('distinguishes an under-review result from an eligible finish with no awards', async () => {
    await render(fixture('results-me-flagged'));
    expect(host.querySelector('.results-awards-empty')!.textContent).toContain('under review');
    expect(host.querySelectorAll('.g-results-table .is-flagged .g-position-badge')).toHaveLength(0);
  });
});
