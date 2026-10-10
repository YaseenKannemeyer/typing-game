import { describe, expect, it } from 'vitest';
import { accuracy, computeStats, wpm } from '../src';

describe('wpm', () => {
  it('uses 5 chars per word', () => {
    expect(wpm(300, 60_000)).toBe(60);
    expect(wpm(150, 30_000)).toBe(60);
  });
  it('is 0 before any time has passed', () => {
    expect(wpm(10, 0)).toBe(0);
  });
});

describe('accuracy', () => {
  it('is 100 with no keystrokes', () => expect(accuracy(0, 0)).toBe(100));
  it('counts errors against keystrokes', () => expect(accuracy(100, 5)).toBe(95));
  it('never goes negative', () => expect(accuracy(2, 5)).toBe(0));
});

describe('computeStats', () => {
  const base = { id: 'a', name: 'a', correctChars: 100, keystrokes: 110, errors: 10 };

  it('uses elapsed time while racing', () => {
    const s = computeStats({ ...base, finishedMs: null }, 200, 60_000);
    expect(s.netWpm).toBe(20);
    expect(s.grossWpm).toBe(22);
    expect(s.progress).toBe(0.5);
  });

  it('freezes at finish time', () => {
    const s = computeStats({ ...base, correctChars: 200, finishedMs: 30_000 }, 200, 90_000);
    expect(s.netWpm).toBe(80);
    expect(s.progress).toBe(1);
  });
});
