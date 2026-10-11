export const MAX_PLAYERS = 15;
export const MIN_PLAYERS_FOR_RACE = 2;
export const VISIBLE_CARS = 4;
/** Race lengths the host can pick, in seconds (1–5 minutes). */
export const RACE_DURATIONS = [60, 120, 180, 240, 300] as const;
export const DEFAULT_RACE_SECONDS = 60;
/** After the timer ends, clients wait this long for final lines before closing the race. */
export const RACE_END_GRACE_MS = 2_500;
/** Target width of one line of race text, in characters. */
export const LINE_CHARS = 44;
export const VOTE_DURATION_MS = 20_000;
export const PROGRESS_SUBMIT_MS = 1_000;
export const HEARTBEAT_MS = 15_000;
export const NAME_MIN = 2;
export const NAME_MAX = 16;
/** Standard "word" length for WPM purposes. */
export const CHARS_PER_WORD = 5;

/** Vehicle-kit palette. Keep in sync with private.car_colors() in the database. */
export const CAR_COLORS = [
  '#ff683b', '#8dbdff', '#a995e8', '#4ed7ba', '#d9dfec', '#d36de0', '#a7b94f', '#e58347',
  '#75a4c9', '#f29dbe', '#ce6147', '#6a6ae2', '#435973', '#ffd052', '#fa8763',
] as const;

export const PASSAGE_MODES = ['easy', 'medium', 'hard', 'coding', 'shakespeare'] as const;
export const VOTE_MODES = [...PASSAGE_MODES, 'random'] as const;

export const MODE_INFO: Record<(typeof VOTE_MODES)[number], { label: string; description: string }> = {
  easy: { label: 'Easy', description: 'Short passages with common words and simple punctuation.' },
  medium: { label: 'Medium', description: 'Longer sentences with varied vocabulary and punctuation.' },
  hard: { label: 'Hard', description: 'Complex vocabulary, numbers, and tricky punctuation.' },
  coding: { label: 'Coding', description: 'Real code: symbols, brackets, operators, and syntax.' },
  shakespeare: { label: 'Shakespeare', description: 'Classic verse with archaic words and punctuation.' },
  random: { label: 'Random', description: 'A surprise passage from any category.' },
};
