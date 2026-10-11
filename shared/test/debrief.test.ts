import { describe, expect, it } from 'vitest';
import { backspace, createTypingState, difficultWords, lockLine, mistakeWord, raceTimeline, typeChar, type Sample, type TypingState } from '../src';

const type = (s: TypingState, text: string) => [...text].reduce((acc, c) => typeChar(acc, c), s);

describe('raceTimeline', () => {
  const tens = Array(10).fill(10);
  const none = Array(10).fill(0);

  it('turns cumulative samples into windowed WPM', () => {
    // 5 chars per second for 60 s = 60 WPM in every window.
    const samples: Sample[] = Array.from({ length: 60 }, (_, i) => [(i + 1) * 1000, (i + 1) * 5, (i + 1) * 5, 0]);
    const t = raceTimeline(samples, 60_000, tens, none)!;
    expect(t).toHaveLength(10);
    for (const p of t) expect(p.wpm).toBeCloseTo(60);
    expect(t.every((p) => p.accuracy === 100)).toBe(true);
  });

  it('leaves windows without samples as gaps, not zero', () => {
    const samples: Sample[] = [[3000, 20, 20, 0], [40_000, 100, 110, 5]];
    const t = raceTimeline(samples, 60_000, tens, none)!;
    expect(t[0]!.wpm).not.toBeNull();
    expect(t[2]!.wpm).toBeNull();
    expect(t[9]!.wpm).toBeNull();
  });

  it('accuracy counts corrected mistakes and is null for windows with no attempts', () => {
    const t = raceTimeline([[6000, 10, 10, 0]], 60_000, [10, 0, ...Array(8).fill(0)], [3, 0, ...Array(8).fill(0)])!;
    expect(t[0]!.accuracy).toBeCloseTo(70);
    expect(t[1]!.accuracy).toBeNull();
  });

  it('never reports a negative speed when a provisional line is re-scored', () => {
    const t = raceTimeline([[6000, 30, 30, 0], [12_000, 20, 40, 2]], 60_000, tens, none)!;
    expect(t[1]!.wpm).toBe(0);
  });

  it('returns null without data', () => {
    expect(raceTimeline([], 60_000, tens, none)).toBeNull();
    expect(raceTimeline([[1000, 5, 5, 0]], 60_000, [], [])).toBeNull();
  });
});

describe('mistakeWord / difficultWords', () => {
  it('attributes a wrong letter to the word being typed', () => {
    const s = createTypingState('alpha beta gamma');
    const a = type(s, 'alpha b');
    const b = typeChar(a, 'x');
    expect(mistakeWord(a, b)).toBe(1);
    expect(mistakeWord(b, backspace(b))).toBeNull();
  });

  it('counts an early Space against the word it ends', () => {
    const a = type(createTypingState('alpha beta'), 'alp');
    expect(mistakeWord(a, typeChar(a, ' '))).toBe(0);
  });

  it('uses passage offsets across lines', () => {
    const text = Array.from({ length: 12 }, (_, i) => `word${i}`).join(' ');
    let s = createTypingState(text);
    s = lockLine(type(s, s.words.slice(s.lines[0]!.start, s.lines[0]!.end).join(' ')));
    const line2 = s.lines[1]!.start;
    expect(mistakeWord(s, typeChar(s, 'x'))).toBe(line2);
  });

  it('keeps repeated words apart and sorts by mistakes', () => {
    const words = ['the', 'cat', 'the', 'dog'];
    expect(difficultWords(words, { 0: 1, 2: 3, 3: 1 })).toEqual([
      { index: 2, text: 'the', mistakes: 3 },
      { index: 0, text: 'the', mistakes: 1 },
      { index: 3, text: 'dog', mistakes: 1 },
    ]);
    expect(difficultWords(words, {})).toEqual([]);
  });
});
