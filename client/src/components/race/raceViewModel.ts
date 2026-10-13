import type { KeyboardEvent, RefObject } from 'react';
import type { TypingState } from '@race/shared';
import type { DestinationId } from '../../art/worldArt';
import type { Delivery } from '../../game/delivery';
import type { TrackCar } from '../Track';
import type { TypingVariant } from '../TypingPanel';
import type { MinimapRacer } from './Hud';
import type { ControlEvent } from './RaceControl';

/*
 * The contract between screens/Race.tsx (state, sync, sounds, timing) and
 * RaceView (presentation only). Race.tsx derives every value here from the
 * server-aligned clock and the lobby state; RaceView must not start its own
 * timers, read Date.now(), or call the API.
 */

export type RacePhase = 'countdown' | 'go' | 'racing' | 'time-up';
export type CountdownValue = 'READY' | '3' | '2' | '1' | 'GO!';

export interface RaceViewModel {
  session: {
    /** modeDesign(race.mode).name */
    modeName: string;
    /** The room voted "random" and this mode was drawn. */
    viaRandom: boolean;
    variant: TypingVariant;
    durationMs: number;
    /** Zero-mistake mode. */
    strict: boolean;
    /** Only while a championship is running. */
    round: { n: number; of: number } | null;
    destination: DestinationId;
    /** Racers on the grid (spectators excluded). */
    racerCount: number;
  };
  clock: {
    /** countdown: before start_at. go: the first GO_BANNER_MS. time-up: end_at passed (results not yet official). */
    phase: RacePhase;
    /** The start overlay's value; null once the GO banner has gone. */
    countdown: CountdownValue | null;
    /** Server-aligned time left (display only). Larger than durationMs during the countdown. */
    msLeft: number;
    /** 0..1 of the race time used. */
    usedFraction: number;
  };
  role: 'racer' | 'spectating';
  /** The local racer; null when spectating. */
  me: { position: number; total: number; wpm: number; accuracy: number; mistakes: number } | null;
  /** Visible lanes (≤ VISIBLE_CARS), leader-most first; the local car is always included. */
  cars: TrackCar[];
  /** Every racer, only when some have no lane on the track. */
  overflow: MinimapRacer[] | null;
  /** The current race-control board, or null between boards. */
  raceControl: ControlEvent | null;
  /** Standings are never final in the race view; "confirming" from time-up until the server finishes the race. */
  results: 'provisional' | 'confirming';
  /** Shown to the racer, e.g. input rejected as impossibly fast. */
  warning: string | null;
  /**
   * The realtime channel. LobbyScreen still renders the reconnect banner and Retry
   * above every phase; this is here so the race layout can reflect it without a remount.
   */
  connection: 'live' | 'reconnecting';
  /**
   * Whether the server has confirmed the racer's locked lines; null when spectating.
   * synced: every locked line acknowledged. sending: locked lines in flight.
   * retrying: an attempt failed; stays until acknowledged or a final outcome (no flapping).
   * rejected: the server refused a line. late: the race closed with lines unconfirmed.
   * unsentLines counts locked lines without an acknowledgement (plus the final line at time-up),
   * not the line being typed. Unacknowledged does not prove lost: the response may have been.
   */
  delivery: Delivery | null;
}

/** Everything the single typing input needs. Absent for spectators. */
export interface RaceTypingSlot {
  state: TypingState;
  inputRef: RefObject<HTMLInputElement | null>;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  waiting: boolean;
  doneLabel?: string;
}

export interface RaceViewProps {
  model: RaceViewModel;
  /** null when spectating. */
  typing: RaceTypingSlot | null;
}
