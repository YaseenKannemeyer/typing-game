import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_BUILD, normalizeVehicle } from '../art/vehicleArt';
import { normalizeLivery } from '../art/worldArt';
import type { AuthMode, GuestView } from '../components/account/Account';
import { AccountView } from '../components/account/AccountView';
import type { AccountActions, AccountState } from '../components/account/accountViewModel';
import { useAuth } from '../game/useAuth';
import {
  checkVerified,
  clearGuestStash,
  clearPendingName,
  guestAccessToken,
  hasGuestStash,
  pendingDisplayName,
  requestPasswordReset,
  restoreGuest,
  setPassword,
  signIn,
  startSaveProgress,
} from '../lib/account';
import { api, errorMessage, type Summary } from '../lib/api';
import { navigate } from '../lib/router';
import { loadBuild, loadName, saveBuild, saveName } from '../lib/storage';

type View =
  | { kind: 'form'; mode: AuthMode }
  | { kind: 'verify'; email: string }
  | { kind: 'password'; purpose: 'new' | 'reset' }
  | { kind: 'review'; account: Summary }
  | { kind: 'saving' }
  | { kind: 'saved'; summary: Summary }
  | { kind: 'retry' }
  | { kind: 'recovery' };

const step = () => new URLSearchParams(window.location.search).get('step');

function guestFrom(summary: Summary | null): GuestView | null {
  if (!summary) return null;
  const saved = loadBuild();
  return {
    name: loadName() || 'Guest racer',
    races: summary.stats.races,
    wins: summary.stats.wins,
    trophies: summary.stats.trophies,
    vehicle: {
      ...normalizeVehicle({ ...DEFAULT_BUILD, ...(saved?.build ?? {}), primary: saved?.primary ?? '#ff683b', playerName: loadName() || 'Guest' }),
      ...normalizeLivery(saved?.build ?? {}),
    },
  };
}

/** Applies a server profile locally (lobby name + garage build). */
function adoptProfile(summary: Summary) {
  const p = summary.profile;
  if (!p) return;
  saveName(p.display_name);
  if (p.car_color && Object.keys(p.vehicle).length) {
    const v = normalizeVehicle({ ...p.vehicle, primary: p.car_color });
    saveBuild({ build: { model: v.model, accent: v.accent, wheels: v.wheels, stripes: v.stripes, number: v.number, effect: v.effect, ...normalizeLivery(p.vehicle) }, primary: v.primary });
  }
}

export function AccountScreen() {
  const auth = useAuth();
  const [view, setView] = useState<View | null>(null);
  const [guestSummary, setGuestSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, []);

  // Decide the starting view once auth is known.
  useEffect(() => {
    if (!auth.ready || view) return;
    const s = step();
    if (auth.recovering || s === 'reset') return setView({ kind: 'password', purpose: 'reset' });
    if (s === 'verified') {
      if (auth.permanent) return setView({ kind: 'password', purpose: 'new' });
      return setView({ kind: 'verify', email: '' });
    }
    if (auth.permanent && hasGuestStash()) {
      void api.mySummary(0).then((account) => setView({ kind: 'review', account }));
      return;
    }
    if (auth.permanent) return navigate('/profile');
    if (auth.session) {
      void api.mySummary(0).then((summary) => {
        setGuestSummary(summary);
        setView({ kind: 'form', mode: summary.stats.races > 0 ? 'save' : 'signup' });
      }, () => setView({ kind: 'form', mode: 'signup' }));
    } else setView({ kind: 'form', mode: 'signup' });
  }, [auth.ready, auth.permanent, auth.session, auth.recovering, view]);

  const guest = guestFrom(guestSummary);
  const hasProgress = !!guestSummary && guestSummary.stats.races > 0;

  const finishAccount = async () => {
    const name = pendingDisplayName() || loadName() || auth.email?.split('@')[0] || 'Racer';
    await api.saveProfile(name).catch(() => api.saveProfile('Racer'));
    clearPendingName();
    const summary = await api.mySummary(0);
    adoptProfile(summary);
    setView({ kind: 'saved', summary });
  };

  const submitForm = (mode: AuthMode) => (values: { displayName: string; email: string; password: string }) =>
    run(async () => {
      if (mode === 'save' || mode === 'signup') {
        await startSaveProgress(values.displayName, values.email);
        setView({ kind: 'verify', email: values.email });
      } else if (mode === 'reset') {
        await requestPasswordReset(values.email);
        setView({ kind: 'recovery' });
      } else {
        await signIn(values.email, values.password, hasProgress);
        const account = await api.mySummary(0);
        if (hasProgress) setView({ kind: 'review', account });
        else if (account.profile) {
          adoptProfile(account);
          navigate('/profile');
        } else await finishAccount(); // verified earlier but never finished setup
      }
    });

  const merge = () =>
    run(async () => {
      setView({ kind: 'saving' });
      try {
        const token = await guestAccessToken();
        if (!token) throw new Error('Your guest session has expired, so there is nothing left to move.');
        await api.mergeGuest(token);
        clearGuestStash();
        const summary = await api.mySummary(0);
        adoptProfile(summary);
        setView({ kind: 'saved', summary });
      } catch (e) {
        setView({ kind: 'retry' });
        throw e;
      }
    });

  const cancelMerge = () =>
    run(async () => {
      await restoreGuest();
      setView({ kind: 'form', mode: 'save' });
    });

  const keep = guest && hasProgress ? guest : null;
  let state: AccountState;
  if (!view) state = { kind: 'loading' };
  else if (view.kind === 'form') state = { kind: 'form', mode: view.mode, defaultName: loadName(), guest: keep };
  else if (view.kind === 'verify')
    state = {
      kind: 'verify',
      email: view.email || null,
      receipt: keep ? { name: keep.name, races: keep.races, trophies: keep.trophies } : null,
      confirmedElsewhere: step() === 'verified' && !auth.permanent,
    };
  else if (view.kind === 'review')
    state = {
      kind: 'review',
      guest,
      account: { name: view.account.profile?.display_name ?? auth.email ?? 'Your account', races: view.account.stats.races, trophies: view.account.stats.trophies },
    };
  else if (view.kind === 'saved')
    state = { kind: 'saved', receipt: { name: view.summary.profile?.display_name ?? 'Racer', races: view.summary.stats.races, trophies: view.summary.stats.trophies } };
  else state = view;

  const actions: AccountActions = {
    chooseMode: (mode) => {
      setError(null);
      setView({ kind: 'form', mode });
    },
    submitAuth: (values) => {
      if (view?.kind === 'form') void submitForm(view.mode)(values);
    },
    continueAsGuest: () => navigate('/'),
    confirmVerified: () =>
      void run(async () => {
        if (await checkVerified()) setView({ kind: 'password', purpose: 'new' });
        else throw new Error("We can't see the confirmation yet. Open the link in the email, then try again.");
      }),
    useDifferentEmail: () => setView({ kind: 'form', mode: hasProgress ? 'save' : 'signup' }),
    submitPassword: (password) =>
      void run(async () => {
        await setPassword(password);
        if (view?.kind === 'password' && view.purpose === 'reset') navigate('/profile');
        else await finishAccount();
      }),
    confirmMerge: () => void merge(),
    cancelMerge: () => void cancelMerge(),
    viewProfile: () => navigate('/profile'),
    backToSignIn: () => setView({ kind: 'form', mode: 'signin' }),
  };

  return <AccountView model={{ state, busy, error }} actions={actions} />;
}
