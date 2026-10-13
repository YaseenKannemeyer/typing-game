import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_BUILD, normalizeVehicle } from '../art/vehicleArt';
import { normalizeLivery } from '../art/worldArt';
import { ProfileView } from '../components/profile/ProfileView';
import type { ProfileActions, ProfileState } from '../components/profile/profileViewModel';
import { useAuth } from '../game/useAuth';
import { signOut } from '../lib/account';
import { api, errorMessage, type Summary, type TrophyRecord } from '../lib/api';
import { navigate } from '../lib/router';
import { saveName } from '../lib/storage';

const PERIODS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 0, label: 'All time' },
] as const;

const memberSince = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso)) : '—';

export function ProfileScreen() {
  const auth = useAuth();
  const [days, setDays] = useState<number>(30);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [trophies, setTrophies] = useState<TrophyRecord[] | null>(null);

  const load = useCallback(async (d: number) => {
    try {
      setError(null);
      setSummary(await api.mySummary(d));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    if (auth.ready && auth.permanent) void load(days);
  }, [auth.ready, auth.permanent, days, load]);
  useEffect(() => {
    if (auth.ready && auth.permanent) void api.myTrophies().then(setTrophies, () => setTrophies([]));
  }, [auth.ready, auth.permanent]);

  const profile = summary?.profile ?? null;
  const saveProfile = (name: string, avatar?: 'car' | 'initials') => async () => {
    if (!summary) return;
    setBusy(true);
    setEditError(null);
    try {
      const p = await api.saveProfile(name, avatar);
      saveName(p.display_name);
      setSummary({ ...summary, profile: p });
      setEditing(false);
    } catch (e) {
      setEditError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  let state: ProfileState;
  if (!auth.ready) state = { kind: 'loading', stage: 'auth' };
  else if (!auth.permanent) state = { kind: 'guest' };
  else if (!summary) state = error ? { kind: 'unavailable', error } : { kind: 'loading', stage: 'profile' };
  else if (!profile) state = { kind: 'setup' };
  else
    state = {
      kind: 'ready',
      data: {
        name: profile.display_name,
        handle: profile.handle,
        memberSince: memberSince(summary.member_since),
        avatar: profile.avatar,
        vehicle: {
          ...normalizeVehicle({ ...DEFAULT_BUILD, ...profile.vehicle, primary: profile.car_color ?? '#ff683b', playerName: profile.display_name }),
          ...normalizeLivery(profile.vehicle),
        },
        stats: summary.stats,
        daily: summary.daily,
        modeBests: summary.mode_bests,
        recent: summary.recent,
        trophyCounts: summary.trophy_counts,
        trophyRecords: trophies,
      },
    };

  const actions: ProfileActions = {
    selectPeriod: setDays,
    toggleAvatar: () => {
      if (profile) void saveProfile(profile.display_name, profile.avatar === 'car' ? 'initials' : 'car')();
    },
    openEditName: () => setEditing(true),
    saveName: (name) => void saveProfile(name)(),
    cancelEditName: () => setEditing(false),
    signOut: () => void signOut().then(() => navigate('/')),
    goToAccount: () => navigate('/account'),
    finishSetup: () => navigate('/account?step=verified'),
  };

  return (
    <ProfileView
      model={{ state, period: { days, options: PERIODS }, error: summary ? error : null, busy, edit: { open: editing, error: editError } }}
      actions={actions}
    />
  );
}
