// @vitest-environment jsdom
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RACE_FIXTURES } from '../../dev/fixtures/race';
import { RaceView } from './RaceView';
import type { RaceViewModel } from './raceViewModel';

const fixture = RACE_FIXTURES.find((f) => f.id === 'race-p1')!;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
});

const render = (model: RaceViewModel) => act(() => root.render(
  <RaceView model={model} typing={{ state: fixture.typing!.state, inputRef: createRef(), onKeyDown: () => {}, waiting: false }} />,
));

describe('race reading and announcements', () => {
  it('announces changed positions without repeating on clock or WPM updates', async () => {
    await render(fixture.model);
    const announcement = host.querySelector('.race-position-announcement')!;
    expect(announcement.getAttribute('aria-live')).toBe('polite');
    expect(announcement.getAttribute('aria-atomic')).toBe('true');
    expect(announcement.textContent).toBe('Position 1 of 4');

    const changes: MutationRecord[] = [];
    const observer = new MutationObserver((records) => changes.push(...records));
    observer.observe(announcement, { characterData: true, childList: true, subtree: true });
    try {
      await render({ ...fixture.model, me: { ...fixture.model.me!, wpm: 88 }, clock: { ...fixture.model.clock, msLeft: 42_000 } });
      expect(changes).toHaveLength(0);
      expect(host.querySelector('.race-position-announcement')).toBe(announcement);
      await render({ ...fixture.model, me: { ...fixture.model.me!, position: 2 } });
      expect(announcement.textContent).toBe('Position 2 of 4');
      expect(changes.length).toBeGreaterThan(0);
    } finally {
      observer.disconnect();
    }
  });

  it('places the typing input before the track in document reading order', async () => {
    await render(fixture.model);
    const input = host.querySelector('.g-type-input')!;
    const track = host.querySelector('.race-track')!;
    expect(input.compareDocumentPosition(track) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('announces delivery failures and recovery without repeating changed line counts', async () => {
    await render({ ...fixture.model, delivery: { status: 'retrying', unsentLines: 2 } });
    const announcement = host.querySelector('.race-delivery-announcement')!;
    expect(announcement.textContent).toBe('Keep typing. Retrying delivery.');
    const changes: MutationRecord[] = [];
    const observer = new MutationObserver((records) => changes.push(...records));
    observer.observe(announcement, { characterData: true, childList: true, subtree: true });
    try {
      await render({ ...fixture.model, delivery: { status: 'retrying', unsentLines: 3 } });
      expect(changes).toHaveLength(0);
      expect(host.querySelector('.race-delivery strong')!.textContent).toBe('3 locked lines awaiting confirmation');
      await render({ ...fixture.model, delivery: { status: 'synced', unsentLines: 0 } });
      expect(announcement.textContent).toBe('Delivery restored. Locked lines received.');
    } finally { observer.disconnect(); }
  });

  it('keeps final confirmation primary while reporting final-line retry', async () => {
    await render({ ...fixture.model, clock: { ...fixture.model.clock, phase: 'time-up', msLeft: 0 }, results: 'confirming', delivery: { status: 'retrying', unsentLines: 1 } });
    expect(host.querySelector('.race-control-strip strong')!.textContent).toBe('Confirming results…');
    expect(host.querySelector('.race-delivery strong')!.textContent).toBe('1 locked line awaiting confirmation');
    expect(host.querySelector('.race-delivery-announcement')!.textContent).toBe('Retrying your final locked lines.');
  });

  it('describes rejected provisional progress without claiming a locked line was lost', async () => {
    await render({ ...fixture.model, delivery: { status: 'rejected', unsentLines: 0 } });
    expect(host.querySelector('.race-delivery strong')!.textContent).toBe('Typing submission rejected');
    expect(host.querySelector('.race-delivery')!.textContent).not.toContain('locked line');
  });
});
