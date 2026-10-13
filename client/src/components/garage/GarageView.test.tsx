// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GARAGE_FIXTURES } from '../../dev/fixtures/lobby';
import { GarageView } from './GarageView';

let root: Root;
let host: HTMLDivElement;
const actions = { edit: vi.fn(), paint: vi.fn(), confirm: vi.fn() };
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  vi.clearAllMocks();
});
afterEach(async () => { await act(() => root.unmount()); host.remove(); });

describe('garage presentation contract', () => {
  it('puts confirmation before all 15 model choices and retains keyboard station navigation', async () => {
    const fixture = GARAGE_FIXTURES.find((f) => f.id === 'garage-draft')!;
    await act(() => root.render(<GarageView model={fixture.model} actions={actions} />));
    const confirm = host.querySelector<HTMLButtonElement>('.garage-confirm')!;
    const collection = host.querySelector('.garage-collection')!;
    expect(confirm.compareDocumentPosition(collection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(host.querySelectorAll('.garage-card')).toHaveLength(15);
    await act(() => confirm.click()); expect(actions.confirm).toHaveBeenCalledOnce();
    const overview = host.querySelector<HTMLButtonElement>('[role=tab][aria-selected=true]')!;
    overview.focus();
    await act(() => overview.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    const paint = host.querySelector<HTMLButtonElement>('[role=tab][aria-selected=true]')!;
    expect(paint.textContent).toBe('Paint'); expect(document.activeElement).toBe(paint);
    expect(host.querySelector('[role=tabpanel]')!.getAttribute('aria-labelledby')).toBe(paint.id);
  });

  it('keeps locked models, taken paint and confirmation unavailable', async () => {
    const taken = GARAGE_FIXTURES.find((f) => f.id === 'garage-taken')!;
    await act(() => root.render(<GarageView model={taken.model} actions={actions} initialStation="paint" />));
    expect(host.querySelectorAll('.garage-paint-swatch:disabled')).toHaveLength(12);
    await act(() => root.render(<GarageView model={{ ...taken.model, locked: true, dirty: true }} actions={actions} initialStation="paint" />));
    expect(host.querySelectorAll('.garage-card:disabled')).toHaveLength(15);
    expect(host.querySelectorAll('.garage-paint-swatch:disabled')).toHaveLength(15);
    expect(host.querySelector<HTMLButtonElement>('.garage-confirm')!.disabled).toBe(true);
    expect(host.querySelector('.garage-feedback')!.textContent).toContain('locked in');
  });
});
