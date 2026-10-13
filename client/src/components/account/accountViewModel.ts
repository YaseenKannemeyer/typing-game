import type { AuthMode, GuestView } from './Account';

/*
 * The contract between screens/AccountScreen.tsx (auth, verification,
 * recovery, guest preservation, profile adoption, storage, navigation) and
 * AccountView (presentation only). The view must not call auth, the API,
 * storage or the router: it renders the state and calls actions.
 */

/** What a confirmation shows: who, and how much history. */
export interface AccountReceipt {
  name: string;
  races: number;
  trophies: number;
}

export type AccountState =
  /** Auth not known yet, or the starting view is being decided. */
  | { kind: 'loading' }
  /** Sign up / save progress / sign in / reset. `guest` is set only when the guest has race history to keep. */
  | { kind: 'form'; mode: AuthMode; defaultName: string; guest: GuestView | null }
  /** Waiting for the email link. `email` null = not known (e.g. confirmed in another tab). */
  | { kind: 'verify'; email: string | null; receipt: AccountReceipt | null; confirmedElsewhere: boolean }
  /** Choose a password: after verification ('new') or from a recovery link ('reset'). */
  | { kind: 'password'; purpose: 'new' | 'reset' }
  /** An existing account signed in while holding guest progress: nothing moves until confirmed. `guest` null = still loading. */
  | { kind: 'review'; guest: GuestView | null; account: AccountReceipt }
  /** Waiting for the server to confirm the guest → account move. */
  | { kind: 'saving' }
  | { kind: 'saved'; receipt: AccountReceipt }
  /** The move was not confirmed; the guest session is untouched. */
  | { kind: 'retry' }
  /** Recovery email requested. */
  | { kind: 'recovery' };

export interface AccountViewModel {
  state: AccountState;
  /** An auth request is in flight. */
  busy: boolean;
  error: string | null;
}

export interface AuthValues {
  displayName: string;
  email: string;
  password: string;
}

export interface AccountActions {
  /** Switch form mode (clears the error). */
  chooseMode: (mode: AuthMode) => void;
  /** Submit the current form mode. */
  submitAuth: (values: AuthValues) => void;
  continueAsGuest: () => void;
  /** "I've confirmed my email": checks with the server. */
  confirmVerified: () => void;
  useDifferentEmail: () => void;
  submitPassword: (password: string) => void;
  /** Move the guest's verified history into the account (also "Retry preservation"). */
  confirmMerge: () => void;
  /** Keep the guest session instead (restores it). */
  cancelMerge: () => void;
  viewProfile: () => void;
  backToSignIn: () => void;
}

export interface AccountViewProps {
  model: AccountViewModel;
  actions: AccountActions;
}
