/**
 * Line-based typing engine for timed races. The text is laid out in lines;
 * the player types the current line freely (Space moves to the next word even
 * if this one is wrong, Backspace corrects anything on the line) and presses
 * Enter on the last word to lock the line in. In zero-mistake (strict) mode a
 * wrong word blocks Space and Enter until it is fixed.
 *
 * Pure and immutable so the same logic runs in the browser and in bot scripts.
 * The server re-scores every submitted line word by word.
 */
import { LINE_CHARS } from './constants';

/** Race time is split into this many equal slices (Steady Hands). */
export const SECTIONS = 10;

/** Words [start, end) of the text shown on one line. */
export interface Line {
  readonly start: number;
  readonly end: number;
}

export interface TypingState {
  readonly words: readonly string[];
  readonly lines: readonly Line[];
  readonly lineIndex: number;
  /** Raw input for the current line: typed words separated by single spaces. */
  readonly input: string;
  /** What was typed on each locked line (null when unknown after a reconnect). */
  readonly lockedTyped: readonly (readonly string[] | null)[];
  /** Correct characters on locked lines (word + its separator per correct word). */
  readonly lockedChars: number;
  /** Character attempts, including Space and Enter (Backspace excluded). */
  readonly keystrokes: number;
  /** Incorrect attempts, even if corrected later. */
  readonly errors: number;
  /** Backspace presses that removed a character. */
  readonly deletions: number;
  /** Attempts per time slice of the race. */
  readonly sectionKeystrokes: readonly number[];
  /** Incorrect attempts per time slice. */
  readonly sectionErrors: readonly number[];
  /** Zero-mistake mode: a word must be right before moving on. */
  readonly strict: boolean;
  /** Every line is locked (only reachable when the text is finite, e.g. practice). */
  readonly finished: boolean;
}

/** Extra wrong characters allowed past the end of a word before input is ignored. */
const MAX_OVERFLOW = 10;

export function splitWords(text: string): string[] {
  const t = text.trim();
  return t ? t.split(/\s+/) : [];
}

export function passageLength(words: readonly string[]): number {
  return words.join(' ').length;
}

/** Greedy word wrap; a word longer than `width` gets a line of its own. */
export function layoutLines(words: readonly string[], width = LINE_CHARS): Line[] {
  const lines: Line[] = [];
  let start = 0;
  let len = 0;
  words.forEach((w, i) => {
    if (i > start && len + 1 + w.length > width) {
      lines.push({ start, end: i });
      start = i;
      len = w.length;
    } else {
      len += (i > start ? 1 : 0) + w.length;
    }
  });
  if (start < words.length) lines.push({ start, end: words.length });
  return lines;
}

/** Slice (0..SECTIONS-1) of `position` within `length` (time or characters). */
export function sectionOf(position: number, length: number): number {
  if (length <= 0) return 0;
  const p = Math.max(0, Math.min(length - 1, position));
  return Math.floor((p * SECTIONS) / length);
}

const zeros = () => Array<number>(SECTIONS).fill(0);

export function createTypingState(text: string, strict = false): TypingState {
  const words = splitWords(text);
  const lines = layoutLines(words);
  return {
    words,
    lines,
    lineIndex: 0,
    input: '',
    lockedTyped: [],
    lockedChars: 0,
    keystrokes: 0,
    errors: 0,
    deletions: 0,
    sectionKeystrokes: zeros(),
    sectionErrors: zeros(),
    strict,
    finished: lines.length === 0,
  };
}

/** Target words of the current line. */
export function lineWords(s: TypingState, index = s.lineIndex): readonly string[] {
  const line = s.lines[index];
  return line ? s.words.slice(line.start, line.end) : [];
}

/** Words typed on the current line; the last entry is the word in progress. */
export function typedWords(s: TypingState): string[] {
  return s.input.split(' ');
}

/** Words of the text locked in so far (the server's words_done). */
export function lockedWords(s: TypingState): number {
  return s.lines[s.lineIndex]?.start ?? s.words.length;
}

/** Correct characters a typed line earns: each exactly-right word plus its separator. */
export function scoreWords(typed: readonly string[], targets: readonly string[]): number {
  let chars = 0;
  typed.forEach((w, i) => {
    if (i < targets.length && w === targets[i]) chars += w.length + 1;
  });
  return chars;
}

/** True if a typed word is a (possibly complete) correct prefix of its target. */
const onTrack = (typed: string, target: string) => target.startsWith(typed);

/**
 * Correct characters so far: locked lines, finished correct words on this
 * line, and the correct part of the word being typed. Drives WPM and the car.
 */
export function typedCorrectChars(s: TypingState): number {
  const typed = typedWords(s);
  const targets = lineWords(s);
  const done = scoreWords(typed.slice(0, -1), targets);
  const cur = typed[typed.length - 1]!;
  const target = targets[typed.length - 1] ?? '';
  return s.lockedChars + done + (onTrack(cur, target) ? cur.length : 0);
}

/** True if the word being typed already contains a wrong character. */
export function hasError(s: TypingState): boolean {
  const typed = typedWords(s);
  return !onTrack(typed[typed.length - 1]!, lineWords(s)[typed.length - 1] ?? '');
}

/** Whether Enter would lock the current line now. */
export function canLock(s: TypingState): boolean {
  if (s.finished) return false;
  const typed = typedWords(s);
  const targets = lineWords(s);
  if (typed.length !== targets.length || typed[typed.length - 1] === '') return false;
  return !s.strict || typed.every((w, i) => w === targets[i]);
}

const bump = (list: readonly number[], i: number) => list.map((v, j) => (j === i ? v + 1 : v));

function count(s: TypingState, correct: boolean, section: number): Pick<TypingState, 'keystrokes' | 'errors' | 'sectionKeystrokes' | 'sectionErrors'> {
  const sec = Math.max(0, Math.min(SECTIONS - 1, section));
  return {
    keystrokes: s.keystrokes + 1,
    errors: correct ? s.errors : s.errors + 1,
    sectionKeystrokes: bump(s.sectionKeystrokes, sec),
    sectionErrors: correct ? s.sectionErrors : bump(s.sectionErrors, sec),
  };
}

/**
 * Types one character. `section` is the race time slice the keystroke falls
 * in (callers without timing can leave it at 0).
 */
export function typeChar(s: TypingState, char: string, section = 0): TypingState {
  if (s.finished || char.length !== 1) return s;
  const typed = typedWords(s);
  const targets = lineWords(s);
  const k = typed.length - 1;
  const cur = typed[k]!;
  const target = targets[k] ?? '';

  // Attempts are judged by position: is this the character expected here?
  if (char === ' ') {
    // Nothing to separate yet, or the line ends here (Enter locks it).
    if (cur === '' || k >= targets.length - 1) return s;
    // Zero-mistake mode: leaving a wrong word is a failed attempt; you stay on it.
    if (s.strict && cur !== target) return { ...s, ...count(s, false, section) };
    return { ...s, input: s.input + ' ', ...count(s, cur.length === target.length, section) };
  }

  if (cur.length >= target.length + MAX_OVERFLOW) return s;
  const correct = target[cur.length] === char;
  return { ...s, input: s.input + char, ...count(s, correct, section) };
}

export function backspace(s: TypingState): TypingState {
  if (s.finished || s.input.length === 0) return s;
  return { ...s, input: s.input.slice(0, -1), deletions: s.deletions + 1 };
}

/** Enter: locks the current line in (if allowed) and clears the input. */
export function lockLine(s: TypingState, section = 0): TypingState {
  if (!canLock(s)) return s;
  const typed = typedWords(s);
  const targets = lineWords(s);
  const lineIndex = s.lineIndex + 1;
  return {
    ...s,
    // Enter is the last word's separator, expected right after its last letter.
    ...count(s, typed[typed.length - 1]!.length === targets[targets.length - 1]!.length, section),
    lineIndex,
    input: '',
    lockedTyped: [...s.lockedTyped, typed],
    lockedChars: s.lockedChars + scoreWords(typed, targets),
    finished: lineIndex >= s.lines.length,
  };
}

/** Server-accepted progress for one racer, used to resume after a reconnect. */
export interface AcceptedProgress {
  wordsDone: number;
  lockedChars: number;
  keystrokes: number;
  errors: number;
  deletions: number;
  sectionKeystrokes: readonly number[];
  sectionErrors: readonly number[];
}

/** Rebuilds state after a reconnect from the server's accepted progress. */
export function resumeTypingState(text: string, strict: boolean, p: AcceptedProgress): TypingState {
  const s = createTypingState(text, strict);
  // Locked lines always end on a line boundary of the same layout.
  let lineIndex = s.lines.findIndex((l) => l.start >= p.wordsDone);
  if (lineIndex < 0) lineIndex = s.lines.length;
  const sections = (list: readonly number[]) => (list.length === SECTIONS ? [...list] : zeros());
  return {
    ...s,
    lineIndex,
    lockedTyped: Array<null>(lineIndex).fill(null),
    lockedChars: p.lockedChars,
    keystrokes: p.keystrokes,
    errors: p.errors,
    deletions: p.deletions,
    sectionKeystrokes: sections(p.sectionKeystrokes),
    sectionErrors: sections(p.sectionErrors),
    finished: lineIndex >= s.lines.length,
  };
}
