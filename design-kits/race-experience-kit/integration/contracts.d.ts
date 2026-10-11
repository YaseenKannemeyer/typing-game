/** Proposed view-model contracts. Adapt to existing shared types; not backend implementations. */
export type Mode = 'easy' | 'medium' | 'hard' | 'coding' | 'shakespeare' | 'random';
export type Connection = 'live' | 'stale' | 'reconnecting';
export interface RacerView {
  playerId: string; displayName: string; model: string; primaryColour: string;
  rank: number | null; progress: number; averageWpm: number | null;
  status: 'waiting' | 'racing' | 'finished' | 'dnf' | 'flagged';
  completionTimeMs: number | null;
}
/** Read-only broadcast snapshot; sequence and timing originate at server. */
export interface SpectatorSnapshot {
  raceId: string; sequence: number; serverElapsedMs: number;
  receivedAtMonotonicMs: number; phase: 'waiting' | 'countdown' | 'racing' | 'results';
  connection: Connection; racers: readonly RacerView[];
  officialWinnerId: string | null;
}
export interface TimelineSample {
  elapsedMs: number; windowMs: number; correctCharacters: number;
  correctAttempts: number; allAttempts: number;
  wpm: number | null; accuracyPercent: number | null;
}
export interface DifficultWord {
  startOffset: number; endOffset: number; displayText: string;
  incorrectAttempts: number; totalAttempts: number;
}
export interface DebriefView {
  raceId: string; mode: Mode; passageId: string; passageVersion: string;
  averageWpm: number; accuracyPercent: number; mistakes: number; elapsedMs: number;
  timeline: readonly TimelineSample[] | null;
  difficultWords: readonly DifficultWord[] | null;
  comparablePreviousBestWpm: number | null;
  comparisonScope: 'same-passage-and-rules' | 'same-mode-and-rules';
}
export interface ComfortPreferences {
  passageFontPx: number; highContrast: boolean; reduceMotion: boolean;
}
/** Use milliseconds consistently in the app. Demo JSON uses seconds and requires conversion. */
export interface GhostRecording {
  id: string; ownerId: string; passageId: string; passageVersion: string; passageHash: string;
  mode: Mode; rulesVersion: string; elapsedBasis: 'race-start' | 'first-input';
  completed: true; durationMs: number; createdAt: string;
  samples: readonly { elapsedMs: number; correctProgress: number }[];
}
export interface PracticeChallenge {
  id: string; kind: 'precision' | 'punctuation' | 'steady'; passage: string;
  target: { kind: 'completion' } | { kind: 'accuracy'; minimumPercent: number };
}
export type EventPhase = 'setup' | 'ready' | 'racing' | 'review' | 'between' | 'complete' | 'cancelled';
export interface ChampionshipView {
  eventId: string; revision: number; hostId: string; phase: EventPhase;
  roundIndex: number; rounds: readonly { roundId: string; raceId: string | null; mode: Mode }[];
  pointsByRank: readonly number[]; committedRaceIds: readonly string[];
  participants: readonly { playerId: string; connected: boolean; totalPoints: number }[];
  /** Exact locked policy identifier; never use the demo's display sort as a tie-breaker. */
  tiePolicyId: string | null;
}
export interface CommitRoundRequest { eventId: string; raceId: string; expectedRevision: number; idempotencyKey: string; }
