import { describe, expect, it } from 'vitest';
import {
  backspace,
  createTypingState,
  currentTarget,
  hasError,
  passageLength,
  resumeTypingState,
  sectionOf,
  SECTIONS,
  typeChar,
  typedCorrectChars,
  type TypingState,
} from '../src';

const typeAll = (s: TypingState, text: string) => [...text].reduce(typeChar, s);

describe('typing engine', () => {
  it('completes words including the trailing space', () => {
    let s = createTypingState('the cat');
    expect(currentTarget(s)).toBe('the ');
    s = typeAll(s, 'the');
    expect(s.wordIndex).toBe(0);
    s = typeChar(s, ' ');
    expect(s.wordIndex).toBe(1);
    expect(s.completedChars).toBe(4);
    expect(currentTarget(s)).toBe('cat');
  });

  it('finishes on the last char without a trailing space', () => {
    const s = typeAll(createTypingState('the cat'), 'the cat');
    expect(s.finished).toBe(true);
    expect(s.completedChars).toBe(passageLength(s.words));
    expect(s.keystrokes).toBe(7);
    expect(s.errors).toBe(0);
  });

  it('blocks progress until an error is corrected', () => {
    let s = typeAll(createTypingState('hello world'), 'hx');
    expect(hasError(s)).toBe(true);
    expect(typedCorrectChars(s)).toBe(1);
    s = typeAll(s, 'llo ');
    expect(s.wordIndex).toBe(0);
    expect(s.errors).toBe(5);
    for (let i = 0; i < 5; i++) s = backspace(s);
    s = typeAll(s, 'ello ');
    expect(s.wordIndex).toBe(1);
    expect(s.errors).toBe(5);
    expect(s.keystrokes).toBe(11);
    expect(s.deletions).toBe(5);
  });

  it('counts deletions only when backspace removes something', () => {
    let s = typeAll(createTypingState('ab cd'), 'ab');
    s = backspace(backspace(backspace(s)));
    expect(s.deletions).toBe(2);
  });

  it('backspace does not count as a keystroke and cannot cross words', () => {
    let s = typeAll(createTypingState('ab cd'), 'ab ');
    s = backspace(s);
    expect(s.wordIndex).toBe(1);
    expect(s.input).toBe('');
    expect(s.keystrokes).toBe(3);
  });

  it('ignores input after finishing and caps runaway wrong input', () => {
    let s = typeAll(createTypingState('a'), 'a');
    expect(typeChar(s, 'b')).toBe(s);
    s = typeAll(createTypingState('ab'), 'x'.repeat(50));
    expect(s.input.length).toBe(12);
  });

  it('normalises extra whitespace in passages', () => {
    const s = createTypingState('  one   two\nthree ');
    expect(s.words).toEqual(['one', 'two', 'three']);
  });
});

describe('sections', () => {
  it('splits the passage into ten equal sections by character index', () => {
    expect(sectionOf(0, 100)).toBe(0);
    expect(sectionOf(9, 100)).toBe(0);
    expect(sectionOf(10, 100)).toBe(1);
    expect(sectionOf(99, 100)).toBe(9);
    expect(sectionOf(500, 100)).toBe(9);
  });

  it('attributes attempts and mistakes to the expected character position', () => {
    // 'abcdefghij klmnopqrs' is 20 chars, so each section is 2 characters.
    let s = createTypingState('abcdefghij klmnopqrs');
    s = typeAll(s, 'abX');
    expect(s.sectionKeystrokes.slice(0, 2)).toEqual([2, 1]);
    expect(s.sectionErrors.slice(0, 2)).toEqual([0, 1]);
    s = typeAll(backspace(s), 'cdefghij klmnopqrs');
    expect(s.finished).toBe(true);
    expect(s.sectionKeystrokes.reduce((a, b) => a + b)).toBe(s.keystrokes);
    expect(s.sectionErrors.reduce((a, b) => a + b)).toBe(s.errors);
    expect(s.sectionKeystrokes.every((n) => n > 0)).toBe(true);
    expect(s.sectionKeystrokes).toHaveLength(SECTIONS);
  });
});

describe('resumeTypingState', () => {
  it('matches typing the same words from scratch', () => {
    const typed = typeAll(backspace(typeAll(createTypingState('one two three'), 'ox')), 'ne two ');
    const resumed = resumeTypingState('one two three', {
      wordsDone: 2,
      keystrokes: typed.keystrokes,
      errors: typed.errors,
      deletions: typed.deletions,
      sectionKeystrokes: typed.sectionKeystrokes,
      sectionErrors: typed.sectionErrors,
    });
    expect(resumed).toEqual(typed);
  });
  it('marks a fully completed passage as finished', () => {
    const p = { wordsDone: 2, keystrokes: 3, errors: 0, deletions: 0, sectionKeystrokes: [], sectionErrors: [] };
    expect(resumeTypingState('a b', p).finished).toBe(true);
  });
});
