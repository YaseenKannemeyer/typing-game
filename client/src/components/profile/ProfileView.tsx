import { SoundToggle } from '../../game/sound';
import { Clubhouse } from '../trophies/Clubhouse';
import { Banner, Button, Card, Loading, Page, PageTitle } from '../ui';
import { ChartCard, EditNameDialog, ModeBests, ProfileHeader, RecentTrophies, TrendCharts } from './Profile';
import type { ProfileViewProps } from './profileViewModel';

/** The profile page's presentation. Props only: ProfileScreen owns auth, data requests and saves. */
export function ProfileView({ model, actions }: ProfileViewProps) {
  const { state } = model;

  if (state.kind === 'loading' && state.stage === 'auth') return <Page><Loading label="Loading your profile" /></Page>;

  if (state.kind === 'guest') {
    return (
      <Page actions={<SoundToggle />}>
        <PageTitle title="Make your progress permanent." lead="Guests race freely, but only accounts keep a profile, charts, a trophy cabinet and a place in the hall of fame." />
        <div className="g-row">
          <Button icon="arrow" onClick={actions.goToAccount}>Save your progress</Button>
          <Button variant="secondary" onClick={actions.goToAccount}>Sign in</Button>
        </div>
      </Page>
    );
  }

  if (state.kind === 'loading' || state.kind === 'unavailable') {
    return (
      <Page actions={<SoundToggle />}>
        {state.kind === 'unavailable' ? <Banner tone="error">{state.error}</Banner> : <Loading label="Loading your profile" />}
      </Page>
    );
  }

  if (state.kind === 'setup') {
    return (
      <Page actions={<SoundToggle />}>
        <Card className="g-stack">
          <Banner tone="info">Your account is verified. Finish setting it up to get your profile.</Banner>
          <div><Button onClick={actions.finishSetup}>Finish setup</Button></div>
        </Card>
      </Page>
    );
  }

  const d = state.data;
  return (
    <Page
      actions={
        <>
          <SoundToggle />
          <Button variant="ghost" onClick={actions.signOut}>Sign out</Button>
        </>
      }
    >
      <ProfileHeader name={d.name} handle={d.handle} memberSince={d.memberSince} avatar={d.avatar} vehicle={d.vehicle} stats={d.stats} onEditName={actions.openEditName} />

      <div className="a-profile-toolbar">
        <h2>Your racing story</h2>
        <div className="g-row">
          <Button variant="secondary" disabled={model.busy} onClick={actions.toggleAvatar}>
            {d.avatar === 'car' ? 'Show avatar' : 'Show car'}
          </Button>
          <div className="a-period" role="group" aria-label="Chart period">
            {model.period.options.map((p) => (
              <button key={p.days} className="g-filter" aria-pressed={model.period.days === p.days} onClick={() => actions.selectPeriod(p.days)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {model.error && <Banner tone="error">{model.error}</Banner>}
      <TrendCharts daily={d.daily} />
      <div className="g-grid-2 a-section">
        <ChartCard title="Your best, by mode" kicker="SELECTED PERIOD">
          <ModeBests bests={d.modeBests} />
        </ChartCard>
        <ChartCard title="Recent trophies" kicker="YOUR COLLECTION">
          <RecentTrophies recent={d.recent} />
        </ChartCard>
      </div>
      <p className="a-footnote">
        Best WPM is your highest completed-race average, not a rolling peak. Accuracy is correct attempts ÷ all attempts per day.
        Charts use UTC dates and leave out unfinished and flagged races.
      </p>

      <Clubhouse counts={d.trophyCounts} records={d.trophyRecords} />

      {model.edit.open && (
        <EditNameDialog initial={d.name} busy={model.busy} error={model.edit.error} onSave={actions.saveName} onCancel={actions.cancelEditName} />
      )}
    </Page>
  );
}
