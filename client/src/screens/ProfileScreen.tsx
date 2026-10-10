import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_BUILD, normalizeVehicle } from '../art/vehicleArt';
import { ChartCard, EditNameDialog, ModeBests, ProfileHeader, RecentTrophies, TrendCharts, TrophyCabinet } from '../components/profile/Profile';
import { Banner, Button, Card, Loading, Page, PageTitle } from '../components/ui';
import { SoundToggle } from '../game/sound';
import { useAuth } from '../game/useAuth';
import { signOut } from '../lib/account';
import { api, errorMessage, type Summary } from '../lib/api';
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

  if (!auth.ready) return <Page><Loading label="Loading your profile" /></Page>;

  if (!auth.permanent) {
    return (
      <Page actions={<SoundToggle />}>
        <PageTitle eyebrow="Your driver profile" title="Make your progress permanent." lead="Guests race freely, but only accounts keep a profile, charts, a trophy cabinet and a place in the hall of fame." />
        <div className="g-row">
          <Button icon="arrow" onClick={() => navigate('/account')}>Save your progress</Button>
          <Button variant="secondary" onClick={() => navigate('/account')}>Sign in</Button>
        </div>
      </Page>
    );
  }

  if (!summary) {
    return (
      <Page actions={<SoundToggle />}>
        {error ? <Banner tone="error">{error}</Banner> : <Loading label="Loading your profile" />}
      </Page>
    );
  }

  const profile = summary.profile;
  if (!profile) {
    return (
      <Page actions={<SoundToggle />}>
        <Card className="g-stack">
          <Banner tone="info">Your account is verified. Finish setting it up to get your profile.</Banner>
          <div><Button onClick={() => navigate('/account?step=verified')}>Finish setup</Button></div>
        </Card>
      </Page>
    );
  }

  const vehicle = normalizeVehicle({ ...DEFAULT_BUILD, ...profile.vehicle, primary: profile.car_color ?? '#ff683b', playerName: profile.display_name });
  const saveProfile = (name: string, avatar?: 'car' | 'initials') => async () => {
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

  return (
    <Page
      actions={
        <>
          <SoundToggle />
          <Button variant="ghost" onClick={async () => { await signOut(); navigate('/'); }}>Sign out</Button>
        </>
      }
    >
      <ProfileHeader
        name={profile.display_name}
        handle={profile.handle}
        memberSince={memberSince(summary.member_since)}
        avatar={profile.avatar}
        vehicle={vehicle}
        stats={summary.stats}
        onEditName={() => setEditing(true)}
      />

      <div className="a-profile-toolbar">
        <h2>Your racing story</h2>
        <div className="g-row">
          <Button variant="secondary" disabled={busy} onClick={saveProfile(profile.display_name, profile.avatar === 'car' ? 'initials' : 'car')}>
            {profile.avatar === 'car' ? 'Show avatar' : 'Show car'}
          </Button>
          <div className="a-period" role="group" aria-label="Chart period">
            {PERIODS.map((p) => (
              <button key={p.days} className="g-filter" aria-pressed={days === p.days} onClick={() => setDays(p.days)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <Banner tone="error">{error}</Banner>}
      <TrendCharts daily={summary.daily} />
      <div className="g-grid-2 a-section">
        <ChartCard title="Your best, by mode" kicker="SELECTED PERIOD">
          <ModeBests bests={summary.mode_bests} />
        </ChartCard>
        <ChartCard title="Recent trophies" kicker="YOUR COLLECTION">
          <RecentTrophies recent={summary.recent} />
        </ChartCard>
      </div>
      <p className="a-footnote">
        Best WPM is your highest completed-race average, not a rolling peak. Accuracy is correct attempts ÷ all attempts per day.
        Charts use UTC dates and leave out unfinished and flagged races.
      </p>

      <TrophyCabinet counts={summary.trophy_counts} />

      {editing && (
        <EditNameDialog
          initial={profile.display_name}
          busy={busy}
          error={editError}
          onSave={(name) => void saveProfile(name)()}
          onCancel={() => setEditing(false)}
        />
      )}
    </Page>
  );
}
