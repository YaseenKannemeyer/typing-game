import { describe, expect, it } from 'vitest';
import {
  backspace,
  createTypingState,
  currentTarget,
  hasError,
  passageLength,
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
