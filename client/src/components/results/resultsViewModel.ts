import type { ReactNode } from 'react';
import type { Award } from '@race/shared';
import type { ControlEvent } from '../race/RaceControl';
import type { ResultRowView } from './Results';

/*
 * The contract between screens/Results.tsx (official results, award requests,
 * sounds, achievements, host actions) and ResultsView (presentation only).
 * Everything here is the server's: order, ranks, stats and awards. The view
 * must not rank, pick a winner, or show a trophy before `awards.status` is ready.
 */

export type ResultsAction = 'rematch' | 'vote' | 'lobby';

export interface ResultsAwards {
  /** The server computes trophies after the race; until then nothing is earned. */
  status: 'pending' | 'ready';
  /** The local racer's awards (empty while pending); null when this player didn't race. */
  mine: { name: string; finished: boolean; race: Award[]; progression: Award[] } | null;
  /** Other racers with awards, in official order (shown once ready). */
  others: { id: string; name: string; awards: Award[] }[];
}

export interface ResultsViewModel {
  /** modeDesign(race.mode).name */
  modeName: string;
  /** Official order. The podium is the first three with status "finished"; DNF/flagged rows have no place. */
  rows: ResultRowView[];
  isHost: boolean;
  /** The host action in flight (the screen changes when it succeeds). */
  busy: ResultsAction | null;
  error: string | null;
  /** E.g. a confirmed personal best. */
  raceControl: ControlEvent | null;
  awards: ResultsAwards;
}

export interface ResultsActions {
  /** Host only: same mode, same rules. */
  rematch: () => void;
  newVote: () => void;
  backToLobby: () => void;
}

/** Self-contained components the container builds (they load their own data); the view only places them. */
export interface ResultsSlots {
  /** Championship standings, when a championship has committed rounds. */
  championship: ReactNode | null;
  /** The local racer's debrief; null when watching. */
  debrief: ReactNode | null;
}

export interface ResultsViewProps {
  model: ResultsViewModel;
  actions: ResultsActions;
  slots: ResultsSlots;
}
