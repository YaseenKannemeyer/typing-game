import { describe, expect, it } from 'vitest';
import {
  backspace,
  canLock,
  createTypingState,
  hasError,
  layoutLines,
  lineWords,
  lockedWords,
  lockLine,
  resumeTypingState,
  scoreWords,
  SECTIONS,
  sectionOf,
  typeChar,
  typedCorrectChars,
  type TypingState,
} from '../src';

const type = (s: TypingState, text: string, section = 0) => [...text].reduce((acc, c) => typeChar(acc, c, section), s);

describe('layoutLines', () => {
  it('wraps greedily at the width and keeps every word once', () => {
    const words = 'aaa bbb ccc ddd eee'.split(' ');
    expect(layoutLines(words, 7)).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
      { start: 4, end: 5 },
    ]);
  });

  it('gives an over-long word its own line', () => {
    expect(layoutLines(['a', 'abcdefghij', 'b'], 5)).toEqual([
      { start: 0, end: 1 },
      { start: 1, end: 2 },
      { start: 2, end: 3 },
    ]);
  });
});

describe('free typing', () => {
  const text = 'the cat sat';

  it('counts correct words with their separators', () => {
    const s = type(createTypingState(text), 'the cat sat');
    expect(typedCorrectChars(s)).toBe(11);
    expect(canLock(s)).toBe(true);
    const locked = lockLine(s);
    expect(locked.lockedChars).toBe(12); // Enter is the last word's separator
    expect(locked.keystrokes).toBe(12);
    expect(locked.errors).toBe(0);
    expect(locked.finished).toBe(true);
    expect(locked.input).toBe('');
  });

  it('moves on past a wrong word, which earns nothing', () => {
    const s = type(createTypingState(text), 'the cut sat');
    expect(s.errors).toBe(1);
    expect(typedCorrectChars(s)).toBe(4 + 3);
    expect(lockLine(s).lockedChars).toBe(8);
  });

  it('Space on an unfinished word moves on and counts one mistake', () => {
    const s = type(createTypingState(text), 'the ca ');
    expect(s.input).toBe('the ca ');
    expect(s.errors).toBe(1);
  });

  it('lets you go back and fix a word with Backspace', () => {
    let s = type(createTypingState(text), 'the cut ');
    s = backspace(backspace(backspace(s))); // remove ' ', 't', 'u'
    expect(s.input).toBe('the c');
    s = type(s, 'at sat');
    expect(s.deletions).toBe(3);
    expect(s.errors).toBe(1); // the corrected mistake still counts
    expect(lockLine(s).lockedChars).toBe(12);
  });

  it('ignores Space before a word starts', () => {
    const s = type(createTypingState(text), ' the  cat sat');
    expect(s.input).toBe('the cat sat');
  });

  it('Space on the last word locks the line, like Enter', () => {
    const viaSpace = type(createTypingState(text), 'the cat sat ');
    const viaEnter = lockLine(type(createTypingState(text), 'the cat sat'));
    expect(viaSpace).toEqual(viaEnter);
    expect(viaSpace.lockedChars).toBe(12);
  });

  it('marks extra characters as mistakes', () => {
    const s = type(createTypingState(text), 'thee');
    expect(hasError(s)).toBe(true);
    expect(s.errors).toBe(1);
  });

  it('Enter only works on the last word of the line', () => {
    const s = type(createTypingState(text), 'the cat');
    expect(canLock(s)).toBe(false);
    expect(lockLine(s)).toBe(s);
    expect(canLock(type(s, ' s'))).toBe(true);
  });
});

describe('zero-mistake mode', () => {
  const text = 'the cat sat';

  it('Space cannot leave a wrong word, but the attempt counts', () => {
    const s = type(createTypingState(text, true), 'the cut ');
    expect(s.input).toBe('the cut');
    expect(s.errors).toBe(2); // 'u' and the blocked space
  });

  it('Space on a wrong last word stays put and counts a mistake', () => {
    const s = type(createTypingState(text, true), 'the cat sab ');
    expect(s.input).toBe('the cat sab');
    expect(s.lineIndex).toBe(0);
    expect(s.errors).toBe(2); // 'b' and the blocked space
  });

  it('Enter needs every word right', () => {
    const wrong = type(createTypingState(text, true), 'the cat sab');
    expect(canLock(wrong)).toBe(false);
    const fixed = type(backspace(wrong), 't');
    expect(canLock(fixed)).toBe(true);
    expect(lockLine(fixed).lockedChars).toBe(12);
  });
});

describe('lines', () => {
  const text = Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ');

  it('locking moves to the next line and keeps what was typed', () => {
    let s = createTypingState(text);
    const first = lineWords(s);
    s = lockLine(type(s, first.join(' ')));
    expect(s.lineIndex).toBe(1);
    expect(lockedWords(s)).toBe(first.length);
    expect(s.lockedTyped[0]).toEqual(first);
    expect(s.finished).toBe(false);
    expect(typedCorrectChars(s)).toBe(first.join(' ').length + 1);
  });

  it('Backspace cannot reach into a locked line', () => {
    let s = createTypingState(text);
    s = lockLine(type(s, lineWords(s).join(' ')));
    expect(backspace(s)).toBe(s);
  });

  it('resumes from the server position after a reconnect', () => {
    const fresh = createTypingState(text);
    const done = fresh.lines[1]!.start;
    const s = resumeTypingState(text, false, {
      wordsDone: done, lockedChars: 50, keystrokes: 70, errors: 3, deletions: 2,
      sectionKeystrokes: [70, 0, 0, 0, 0, 0, 0, 0, 0, 0], sectionErrors: [3, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    expect(s.lineIndex).toBe(1);
    expect(lockedWords(s)).toBe(done);
    expect(typedCorrectChars(s)).toBe(50);
    expect(s.lockedTyped).toEqual([null]);
  });
});

describe('sections', () => {
  it('splits a length into ten equal slices', () => {
    expect(sectionOf(0, 60_000)).toBe(0);
    expect(sectionOf(5_999, 60_000)).toBe(0);
    expect(sectionOf(6_000, 60_000)).toBe(1);
    expect(sectionOf(70_000, 60_000)).toBe(SECTIONS - 1);
  });

  it('attributes keystrokes to the slice the caller passes', () => {
    const s = type(createTypingState('ab cd'), 'ax', 3);
    expect(s.sectionKeystrokes[3]).toBe(2);
    expect(s.sectionErrors[3]).toBe(1);
  });
});

describe('scoreWords', () => {
  it('matches the server: exact words earn length + 1', () => {
    expect(scoreWords(['the', 'cut', 'sat'], ['the', 'cat', 'sat'])).toBe(8);
    expect(scoreWords(['the', 'cat', 'sat', 'extra'], ['the', 'cat', 'sat'])).toBe(12);
  });
});
