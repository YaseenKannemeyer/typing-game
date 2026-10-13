import { SoundToggle } from '../../game/sound';
import { Loading, Page } from '../ui';
import { AuthForm, AuthStatus, AuthStory, MergeReview, PasswordForm } from './Account';
import type { AccountViewProps } from './accountViewModel';

/** The account page's presentation. Props only: AccountScreen owns auth, storage and navigation. */
export function AccountView({ model, actions }: AccountViewProps) {
  const { state, busy, error } = model;

  let body;
  if (state.kind === 'loading') body = <Loading label="Opening your account" />;
  else if (state.kind === 'form')
    body = (
      <div className="a-auth-layout">
        <AuthStory mode={state.mode} guest={state.guest} />
        <AuthForm
          mode={state.mode}
          defaultName={state.defaultName}
          hasGuestProgress={state.guest !== null}
          busy={busy}
          error={error}
          onMode={actions.chooseMode}
          onSubmit={actions.submitAuth}
          onGuest={actions.continueAsGuest}
        />
      </div>
    );
  else if (state.kind === 'verify')
    body = (
      <AuthStatus
        kind="verify"
        email={state.email ?? 'your email'}
        receipt={state.receipt}
        busy={busy}
        error={error}
        action={{ label: "I've confirmed my email", onClick: actions.confirmVerified }}
        secondary={{ label: 'Use a different email', onClick: actions.useDifferentEmail }}
      >
        {state.confirmedElsewhere && (
          <p className="g-small g-muted mb-4">Email confirmed. If you started in another tab, return there and press the button below.</p>
        )}
      </AuthStatus>
    );
  else if (state.kind === 'password')
    body = (
      <PasswordForm
        title={state.purpose === 'reset' ? 'Choose a new password' : 'Email confirmed. Choose your password.'}
        lead={state.purpose === 'reset' ? 'Set a new password for your account.' : 'This is the last step. Your racer, history and garage are already yours.'}
        busy={busy}
        error={error}
        onSubmit={actions.submitPassword}
      />
    );
  else if (state.kind === 'review')
    body = state.guest ? (
      <MergeReview guest={state.guest} account={state.account} busy={busy} error={error} onConfirm={actions.confirmMerge} onCancel={actions.cancelMerge} />
    ) : (
      <Loading label="Preparing your review" />
    );
  else if (state.kind === 'saving') body = <AuthStatus kind="saving" />;
  else if (state.kind === 'saved')
    body = <AuthStatus kind="saved" receipt={state.receipt} action={{ label: 'View your profile', onClick: actions.viewProfile }} />;
  else if (state.kind === 'retry')
    body = (
      <AuthStatus
        kind="retry"
        error={error}
        busy={busy}
        action={{ label: 'Retry preservation', onClick: actions.confirmMerge }}
        secondary={{ label: 'Cancel and keep guest session', onClick: actions.cancelMerge }}
      />
    );
  else body = <AuthStatus kind="recovery" action={{ label: 'Back to sign in', onClick: actions.backToSignIn }} />;

  return <Page actions={<SoundToggle />}>{body}</Page>;
}
