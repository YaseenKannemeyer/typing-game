/**
 * TypeRacer-style typing engine: you cannot leave a word until it is typed
 * exactly (including its trailing space). Pure and immutable so the same logic
 * can run in the browser and in bot scripts.
 */

export interface TypingState {
  readonly words: readonly string[];
  readonly wordIndex: number;
  /** What the player has typed for the current word so far. */
  readonly input: string;
  /** Characters of fully completed words, including their trailing spaces. */
  readonly completedChars: number;
  readonly keystrokes: number;
  readonly errors: number;
  readonly finished: boolean;
}

/** Extra wrong characters allowed past the target before input is ignored. */
const MAX_OVERFLOW = 10;

export function splitWords(passage: string): string[] {
  return passage.trim().split(/\s+/);
}

export function createTypingState(passage: string): TypingState {
  return {
    words: splitWords(passage),
    wordIndex: 0,
    input: '',
    completedChars: 0,
    keystrokes: 0,
    errors: 0,
    finished: false,
  };
}

/** The exact text needed to complete the current word. */
export function currentTarget(s: TypingState): string {
  const word = s.words[s.wordIndex] ?? '';
  return s.wordIndex < s.words.length - 1 ? word + ' ' : word;
}

/** Length of the correct prefix of the current input. */
export function correctPrefixLength(s: TypingState): number {
  const target = currentTarget(s);
  let i = 0;
  while (i < s.input.length && s.input[i] === target[i]) i++;
  return i;
}

export function hasError(s: TypingState): boolean {
  return correctPrefixLength(s) < s.input.length;
}

/** Correct characters including the correct part of the current word. */
export function typedCorrectChars(s: TypingState): number {
  return s.completedChars + correctPrefixLength(s);
}

export function typeChar(s: TypingState, char: string): TypingState {
  if (s.finished || char.length !== 1) return s;
  const target = currentTarget(s);
  if (s.input.length >= target.length + MAX_OVERFLOW) return s;

  const input = s.input + char;
  const correct = !hasError(s) && target[s.input.length] === char;
  const next: TypingState = {
    ...s,
    input,
    keystrokes: s.keystrokes + 1,
    errors: correct ? s.errors : s.errors + 1,
  };
  if (input !== target) return next;

  const wordIndex = s.wordIndex + 1;
  return {
    ...next,
    wordIndex,
    input: '',
    completedChars: s.completedChars + target.length,
    finished: wordIndex >= s.words.length,
  };
}

export function backspace(s: TypingState): TypingState {
  if (s.finished || s.input.length === 0) return s;
  return { ...s, input: s.input.slice(0, -1) };
}

export function passageLength(words: readonly string[]): number {
  return words.join(' ').length;
}
