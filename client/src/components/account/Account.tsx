import { useState, type FormEvent, type ReactNode } from 'react';
import { preserveArtSvg } from '../../art/accountArt';
import type { VehicleProps } from '../../art/vehicleArt';
import { Car } from '../Car';
import { TrophyIcon } from '../trophies/TrophyIcon';
import { TrustedSvg } from '../TrustedSvg';
import { Button, Icon } from '../ui';

/* React versions of design-kits/account-profile-kit/src/account.js. */

export interface GuestView {
  name: string;
  races: number;
  wins: number;
  trophies: number;
  vehicle: VehicleProps;
}

export function GuestSummary({ guest }: { guest: GuestView }) {
  return (
    <section className="a-guest-summary">
      <div className="g-eyebrow">YOUR GUEST GARAGE</div>
      <div className="a-summary-car">
        <Car vehicle={guest.vehicle} />
      </div>
      <div className="a-guest-name">
        {guest.name} <span className="g-pill">GUEST</span>
      </div>
      <div className="a-guest-stats">
        {([['Races', guest.races], ['Wins', guest.wins], ['Trophies', guest.trophies]] as const).map(([label, v]) => (
          <div key={label}>
            <strong>{v}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="a-keep-list">
        <div><Icon name="check" size={16} /> Verified race history</div>
        <div><Icon name="check" size={16} /> Earned trophies and bests</div>
        <div><Icon name="check" size={16} /> Your customized ride</div>
      </div>
      <p>Your progress stays with this guest identity while you finish verification.</p>
    </section>
  );
}

export type AuthMode = 'save' | 'signup' | 'signin' | 'reset';

interface StoryProps {
  mode: AuthMode;
  guest: GuestView | null;
}

export function AuthStory({ mode, guest }: StoryProps) {
  const save = mode === 'save' && guest;
  const signup = mode === 'signup' || mode === 'save';
  const reset = mode === 'reset';
  return (
    <section className="a-auth-story">
      <div className="g-eyebrow">{save ? 'KEEP YOUR MOMENTUM' : 'ONE ACCOUNT. EVERY FINISH.'}</div>
      <h1>
        {save ? <>You earned it.<br />Make it yours.</> : signup ? 'Your starting line.' : reset ? 'Back on the grid.' : <>Welcome back,<br />racer.</>}
      </h1>
      <p>
        {save
          ? `${guest.races} ${guest.races === 1 ? 'race' : 'races'}${guest.wins ? `, ${guest.wins} ${guest.wins === 1 ? 'win' : 'wins'}` : ''} and a ride that feels like you. Give your progress a permanent home.`
          : signup
            ? 'Build your race history, collect your awards, and find your next personal best.'
            : reset
              ? 'Request a recovery email and get back to your next race.'
              : 'Your garage, race history, and trophy collection are waiting for you.'}
      </p>
      {save ? (
        <GuestSummary guest={guest} />
      ) : (
        <>
          <div className="a-auth-art">
            <TrustedSvg markup={preserveArtSvg()} />
          </div>
          <div className="a-story-note">
            <Icon name="flag" size={22} />
            <span>
              Every finish adds to your story.
              <br />
              <small>Race as a guest whenever you like.</small>
            </span>
          </div>
        </>
      )}
    </section>
  );
}

interface FormProps {
  mode: AuthMode;
  defaultName: string;
  hasGuestProgress: boolean;
  busy: boolean;
  error: string | null;
  onMode: (m: AuthMode) => void;
  onSubmit: (values: { displayName: string; email: string; password: string }) => void;
  onGuest: () => void;
}

export function AuthForm({ mode, defaultName, hasGuestProgress, busy, error, onMode, onSubmit, onGuest }: FormProps) {
  const signup = mode === 'signup' || mode === 'save';
  const reset = mode === 'reset';
  const save = mode === 'save' && hasGuestProgress;
  const [showPassword, setShowPassword] = useState(false);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    onSubmit({
      displayName: String(f.get('displayName') ?? ''),
      email: String(f.get('email') ?? ''),
      password: String(f.get('password') ?? ''),
    });
  };

  return (
    <section className="a-auth-form-panel">
      <div className="a-auth-tabs" role="group" aria-label="Account action">
        <button type="button" className={signup ? 'selected' : ''} aria-pressed={signup} onClick={() => onMode(hasGuestProgress ? 'save' : 'signup')}>
          Create account
        </button>
        <button type="button" className={!signup && !reset ? 'selected' : ''} aria-pressed={!signup && !reset} onClick={() => onMode('signin')}>
          Sign in
        </button>
      </div>
      <div className="a-form-heading">
        <h2>{save ? 'Save your guest progress' : signup ? 'Create your account' : reset ? 'Reset your password' : 'Sign in to GRID'}</h2>
        <p>
          {save
            ? 'Keep this racer, history, and garage together.'
            : signup
              ? 'Your current racer becomes your account, so nothing you have earned is lost.'
              : reset
                ? "We'll email you a link to choose a new password."
                : 'Use your email and password to continue.'}
        </p>
      </div>
      <form className="g-stack" noValidate onSubmit={submit} key={mode}>
        {error && <div className="a-form-error" role="alert">{error}</div>}
        {signup && (
          <label className="g-field">
            Display name
            <input className="g-input" name="displayName" autoComplete="nickname" maxLength={16} defaultValue={defaultName} placeholder="Your racing name" required />
          </label>
        )}
        <label className="g-field">
          Email address
          <input className="g-input" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
        </label>
        {mode === 'signin' && (
          <label className="g-field">
            Password
            <div className="a-password">
              <input className="g-input" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Your password" required />
              <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((s) => !s)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>
        )}
        {mode === 'signin' && (
          <button type="button" className="a-text-button" onClick={() => onMode('reset')}>
            Forgot password?
          </button>
        )}
        <Button type="submit" icon="arrow" loading={busy}>
          {save ? 'Create account & keep progress' : signup ? 'Create account' : reset ? 'Send recovery email' : 'Sign in'}
        </Button>
        <p className="a-form-note">
          {signup
            ? "We'll email you a confirmation link, then you'll choose your password. Your progress is only marked saved once that's done."
            : reset
              ? 'If an account exists for that address, a link is on its way.'
              : hasGuestProgress
                ? "You'll review your guest progress before anything is moved."
                : 'You can return to the lobby after signing in.'}
        </p>
      </form>
      {save && (
        <div className="a-existing">
          <span>Already have an account?</span>
          <button className="a-text-button" onClick={() => onMode('signin')}>Sign in & review guest progress</button>
        </div>
      )}
      <div className="a-auth-bottom">
        <button className="a-text-button" onClick={onGuest}>
          {save ? 'Keep playing as a guest' : 'Continue as a guest'}
        </button>
      </div>
    </section>
  );
}

export type StatusKind = 'verify' | 'saving' | 'saved' | 'retry' | 'recovery';

interface StatusProps {
  kind: StatusKind;
  email?: string;
  receipt?: { name: string; races: number; trophies: number } | null;
  busy?: boolean;
  error?: string | null;
  action?: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
  children?: ReactNode;
}

const STATUS: Record<StatusKind, { label: string; title: string }> = {
  verify: { label: 'ONE MORE STEP', title: 'Check your inbox.' },
  saving: { label: 'PRESERVING YOUR PROGRESS', title: 'Keeping your story together.' },
  saved: { label: 'ACCOUNT LINK CONFIRMED', title: 'All yours. Every finish.' },
  retry: { label: 'WE COULDN’T CONFIRM THE LINK', title: 'Your guest session stays put.' },
  recovery: { label: 'RECOVERY REQUESTED', title: 'Check your email.' },
};

export function AuthStatus({ kind, email, receipt, busy, error, action, secondary, children }: StatusProps) {
  const s = STATUS[kind];
  const body = {
    verify: `Confirm the link sent to ${email ?? 'your email'}. Your guest progress stays attached to this racer while you verify.`,
    saving: 'Waiting for the server to confirm the account link and ownership of your race history.',
    saved: receipt
      ? `Your ${receipt.races} ${receipt.races === 1 ? 'race' : 'races'}, ${receipt.trophies} ${receipt.trophies === 1 ? 'trophy' : 'trophies'} and customized ride are linked to your account.`
      : 'Your account is ready.',
    retry: 'Account preservation has not been confirmed. Your guest progress is untouched. Try again.',
    recovery: 'If an account exists for that address, you’ll receive recovery instructions shortly.',
  }[kind];
  return (
    <section className="a-auth-status">
      <div className="a-status-art">
        {kind === 'saved' ? <TrophyIcon trophy="participation" size={120} /> : <TrustedSvg markup={preserveArtSvg()} />}
      </div>
      <div className="g-eyebrow">{s.label}</div>
      <h1 className="g-title">{s.title}</h1>
      <p>{body}</p>
      {receipt && (
        <div className="a-preserve-receipt">
          <span><Icon name="user" size={18} /> {receipt.name}</span>
          <span>{receipt.races} races</span>
          <span>{receipt.trophies} trophies</span>
        </div>
      )}
      {error && <div className="a-form-error mb-4" role="alert">{error}</div>}
      {children}
      {action && (
        <Button icon="arrow" loading={busy || kind === 'saving'} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      {secondary && (
        <button className="a-text-button" onClick={secondary.onClick}>{secondary.label}</button>
      )}
    </section>
  );
}

interface ReviewProps {
  guest: GuestView;
  account: { name: string; races: number; trophies: number };
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Existing-account review: nothing moves until the player confirms. */
export function MergeReview({ guest, account, busy, error, onConfirm, onCancel }: ReviewProps) {
  return (
    <section className="a-merge-review">
      <div className="g-eyebrow">REVIEW BEFORE YOU LINK</div>
      <h1 className="g-title">One racer. Two histories.</h1>
      <p className="g-muted">
        You signed in to an existing account while holding guest progress. Confirm to move the guest’s verified races and trophies into
        this account. Your guest session is kept until the server confirms.
      </p>
      <div className="g-grid-2">
        <div className="g-panel">
          <span className="g-pill">CURRENT GUEST</span>
          <h2>{guest.name}</h2>
          <p>{guest.races} verified races · {guest.trophies} trophies</p>
          <div style={{ maxWidth: 220 }}>
            <Car vehicle={guest.vehicle} />
          </div>
        </div>
        <div className="g-panel">
          <span className="g-pill g-pill--lime">YOUR ACCOUNT</span>
          <h2>{account.name}</h2>
          <p>{account.races} verified races · {account.trophies} distinct trophies</p>
          <p className="g-small g-muted">Totals are recalculated by the server after the move; races you both ran are not counted twice.</p>
        </div>
      </div>
      <div className="a-merge-note">
        <Icon name="check" />
        <span>Existing results remain intact. Nothing is replaced or deleted from your account.</span>
      </div>
      {error && <div className="a-form-error mb-4" role="alert">{error}</div>}
      <div className="g-row">
        <Button icon="arrow" loading={busy} onClick={onConfirm}>Confirm & preserve history</Button>
        <Button variant="secondary" disabled={busy} onClick={onCancel}>Cancel and keep guest session</Button>
      </div>
    </section>
  );
}

interface PasswordProps {
  title: string;
  lead: string;
  busy: boolean;
  error: string | null;
  onSubmit: (password: string) => void;
}

/** Choose a password after email verification, or after a recovery link. */
export function PasswordForm({ title, lead, busy, error, onSubmit }: PasswordProps) {
  const [mismatch, setMismatch] = useState(false);
  return (
    <section className="a-auth-form-panel mx-auto max-w-lg">
      <div className="a-form-heading">
        <h2>{title}</h2>
        <p>{lead}</p>
      </div>
      <form
        className="g-stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const a = String(f.get('password') ?? '');
          const b = String(f.get('confirm') ?? '');
          setMismatch(a !== b);
          if (a === b) onSubmit(a);
        }}
      >
        {(error || mismatch) && <div className="a-form-error" role="alert">{mismatch ? 'The passwords don’t match.' : error}</div>}
        <label className="g-field">
          New password
          <input className="g-input" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        <label className="g-field">
          Confirm password
          <input className="g-input" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        <span className="g-muted g-small">At least 8 characters.</span>
        <Button type="submit" icon="arrow" loading={busy}>Save password</Button>
      </form>
    </section>
  );
}
