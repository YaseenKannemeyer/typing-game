import type { VoteMode } from '@race/shared';
import type { ModeDesign } from '../../art/gridArt';
import type { Voter } from './Voting';

/*
 * The contract between screens/Voting.tsx (server clock, votes, closing the
 * vote, sounds, API) and VotingView (presentation only). The view must not
 * call the API, read the clock or decide the winner: the server picks the
 * mode, including on a tie.
 */

export interface VotingOption {
  mode: ModeDesign;
  count: number;
  /** Who voted for it, with their cars (join order). */
  voters: Voter[];
  /** This player's current vote (it can change until the deadline). */
  selected: boolean;
}

export interface VotingViewModel {
  /** Server-aligned seconds left (display only). */
  clock: { remainingS: number; totalS: number };
  /** The deadline passed and the result has not arrived yet. */
  closing: boolean;
  /** Every mode, in MODE_DESIGN order. */
  options: VotingOption[];
  votedCount: number;
  racerCount: number;
  /** The room's rules for this race; destination is a display name, null = matches the mode. */
  rules: { raceSeconds: number; zeroMistakes: boolean; destination: string | null };
  isHost: boolean;
  error: string | null;
  /**
   * The server's choice. When set, the vote is over and the view reveals it.
   * `tie` (several modes shared the top count) only dramatises that result.
   */
  reveal: { mode: ModeDesign; tie: boolean } | null;
}

export interface VotingActions {
  vote: (mode: VoteMode) => void;
  /** Host only. */
  endVoting: () => void;
}

export interface VotingViewProps {
  model: VotingViewModel;
  actions: VotingActions;
}
