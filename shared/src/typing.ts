/**
 * TypeRacer-style typing engine: you cannot leave a word until it is typed
 * exactly (including its trailing space). Pure and immutable so the same logic
 * can run in the browser and in bot scripts.
 */

/** The passage is split into this many equal-sized sections (Steady Hands). */
export const SECTIONS = 10;

export interface TypingState {
  readonly words: readonly string[];
  /** Total passage length in characters (words joined by single spaces). */
  readonly length: number;
  readonly wordIndex: number;
  /** What the player has typed for the current word so far. */
  readonly input: string;
  /** Characters of fully completed words, including their trailing spaces. */
  readonly completedChars: number;
  /** Character attempts (backspace excluded). */
  readonly keystrokes: number;
  /** Incorrect character attempts, even if corrected later. */
  readonly errors: number;
  /** Backspace/delete presses that removed a character. */
  readonly deletions: number;
  /** Character attempts per passage section, attributed to the expected position. */
  readonly sectionKeystrokes: readonly number[];
  /** Incorrect attempts per passage section. */
  readonly sectionErrors: readonly number[];
  readonly finished: boolean;
}

/** Extra wrong characters allowed past the target before input is ignored. */
const MAX_OVERFLOW = 10;

export function splitWords(passage: string): string[] {
  return passage.trim().split(/\s+/);
}

export function passageLength(words: readonly string[]): number {
  return words.join(' ').length;
}

/** Section (0..SECTIONS-1) of a character position: floor(index × 10 / length). */
export function sectionOf(position: number, length: number): number {
  if (length <= 0) return 0;
  const p = Math.max(0, Math.min(length - 1, position));
  return Math.floor((p * SECTIONS) / length);
}

const zeros = () => Array<number>(SECTIONS).fill(0);

export function createTypingState(passage: string): TypingState {
  const words = splitWords(passage);
  return {
    words,
    length: passageLength(words),
    wordIndex: 0,
    input: '',
    completedChars: 0,
    keystrokes: 0,
    errors: 0,
    deletions: 0,
    sectionKeystrokes: zeros(),
    sectionErrors: zeros(),
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

const bump = (list: readonly number[], i: number) => list.map((v, j) => (j === i ? v + 1 : v));

export function typeChar(s: TypingState, char: string): TypingState {
  if (s.finished || char.length !== 1) return s;
  const target = currentTarget(s);
  if (s.input.length >= target.length + MAX_OVERFLOW) return s;

  const input = s.input + char;
  const correct = !hasError(s) && target[s.input.length] === char;
  const section = sectionOf(s.completedChars + s.input.length, s.length);
  const next: TypingState = {
    ...s,
    input,
    keystrokes: s.keystrokes + 1,
    errors: correct ? s.errors : s.errors + 1,
    sectionKeystrokes: bump(s.sectionKeystrokes, section),
    sectionErrors: correct ? s.sectionErrors : bump(s.sectionErrors, section),
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
  return { ...s, input: s.input.slice(0, -1), deletions: s.deletions + 1 };
}

/** Server-accepted progress for one racer, used to resume after a reconnect. */
export interface AcceptedProgress {
  wordsDone: number;
  keystrokes: number;
  errors: number;
  deletions: number;
  sectionKeystrokes: readonly number[];
  sectionErrors: readonly number[];
}

/** Rebuilds state after a reconnect from the server's accepted progress. */
export function resumeTypingState(passage: string, p: AcceptedProgress): TypingState {
  const s = createTypingState(passage);
  const done = Math.min(p.wordsDone, s.words.length);
  const completedChars =
    done === 0 ? 0 : s.words.slice(0, done).join(' ').length + (done < s.words.length ? 1 : 0);
  const sections = (list: readonly number[]) => (list.length === SECTIONS ? [...list] : zeros());
  return {
    ...s,
    wordIndex: done,
    completedChars,
    keystrokes: p.keystrokes,
    errors: p.errors,
    deletions: p.deletions,
    sectionKeystrokes: sections(p.sectionKeystrokes),
    sectionErrors: sections(p.sectionErrors),
    finished: done === s.words.length,
  };
}
