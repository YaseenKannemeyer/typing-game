import { TROPHIES } from '@race/shared';
import { TrophyRoom } from '../trophies/TrophyRoom';
import { Car } from '../Car';
import { CopyButton } from '../CopyButton';
import { Button, Card, ErrorText, PageTitle, Pill, SectionTabs, type SectionTab } from '../ui';
import { DestinationPicker } from './Destinations';
import { HowTo, InviteLink, RaceSettings, WatchLink, type RosterPlayer } from './Lobby';
import type { RoomTab, WaitingRoomViewProps } from './waitingRoomViewModel';

const TROPHY_COUNT = Object.keys(TROPHIES).length;

function GridRoster({ players, open }: { players: RosterPlayer[]; open: number }) {
  return (
    <div className="pit-roster-wrap">
      <ol className="pit-roster">
        {players.map((p, i) => (
          <li key={p.id} className={`w-parking-bay occupied pit-roster-entry ${p.you ? 'is-you' : ''}`}>
            <span className="pit-roster-index"><span className="g-sr">Entry </span>{String(i + 1).padStart(2, '0')}</span>
            <div className="pit-roster-car"><Car vehicle={p.vehicle} /></div>
            <div className="pit-roster-driver"><strong>{p.name}</strong><div>{p.you && <span className="pit-driver-you">You</span>}{p.host && <span>Host</span>}<span className={!p.online ? 'pit-driver-offline' : ''}>{!p.online ? 'Connecting…' : p.ready ? 'Ride confirmed' : 'Choosing a ride'}</span></div></div>
          </li>
        ))}
      </ol>
      {open > 0 && <p className="pit-open-seats"><strong>{open} open {open === 1 ? 'seat' : 'seats'}</strong><span>Share the invitation to fill the grid.</span></p>}
    </div>
  );
}

/** The waiting room's presentation. Props only: screens/WaitingRoom.tsx owns state and network. */
export function WaitingRoomView({ model, actions, slots, tabsRef }: WaitingRoomViewProps) {
  const { room, isHost, canStart, settings } = model;

  // Everything below the paddock lives in one tab set, so the room stays short on phones.
  const tabs: SectionTab<RoomTab>[] = [
    {
      key: 'destination',
      label: 'Destination',
      panel: (
        <DestinationPicker
          value={settings.destination}
          editable={settings.editable}
          busy={settings.saving}
          onChange={(d) => actions.changeSettings(settings.seconds, settings.zeroMistakes, d)}
        />
      ),
    },
    ...(slots.garage
      ? [
          {
            key: 'garage' as const,
            label: 'Garage',
            panel: (
              <div className="space-y-4">
                <p className="g-muted">Pick a silhouette and make it yours. It's 100% cosmetic: every car has the same speed.</p>
                {slots.garage}
              </div>
            ),
          },
        ]
      : []),
    { key: 'how', label: 'How it works', panel: <section className="g-panel"><HowTo /></section> },
    { key: 'trophies', label: 'Trophies', badge: TROPHY_COUNT, panel: <TrophyRoom /> },
  ];

  return (
    <div className="waiting-screen pit-waiting">
      <PageTitle
        title="Your starting grid."
        lead="Choose your car. Invite your racers. The host starts the mode vote."
      />

      <div className="room-command">
        <div className="room-command-code"><span className="room-command-label">Room code</span><strong>{room.code}</strong><CopyButton text={room.code} label="Copy code" /></div>
        <div className="room-command-actions"><Button icon="arrow" disabled={!isHost || !canStart || settings.saving} loading={model.starting} onClick={actions.startVote}>{isHost ? 'Start mode vote' : 'Waiting for the host'}</Button>{slots.garage && <Button variant="secondary" icon="gear" onClick={actions.openGarage}>Open garage</Button>}</div>
        <p>{!isHost ? 'You can customize your car while the host prepares the vote.' : canStart ? 'Choose the race rules below, then start the mode vote.' : 'Invite at least one more racer to start a vote.'}</p>
        <ErrorText>{model.error}</ErrorText>
      </div>
      <div className="g-lobby-grid room-grid">
        <section className="room-roster">
          <div className="g-between">
            <h2 className="g-heading">
              The paddock <span className="g-muted g-small">{room.racerCount} / {room.maxRacers} racers</span>
            </h2>
            <Pill lime>{room.racerCount < room.maxRacers ? `${room.maxRacers - room.racerCount} OPEN SEATS` : 'FULL GRID'}</Pill>
          </div>
          <GridRoster players={model.roster} open={Math.max(0, room.maxRacers - room.racerCount)} />
        </section>

        <aside className="g-stack">
          <Card className="room-invite">
            <h2 className="g-heading">Invite racers</h2>
            <p className="g-muted">An invitation takes your racers straight to this room.</p>
            <InviteLink code={room.code} />
            <p className="g-small g-muted mt-4 mb-2">Spectators can watch without taking a seat.</p>
            <WatchLink code={room.code} />
          </Card>
          <Card className="room-rules">
            <h2 className="g-heading mb-4">Race settings</h2>
            <RaceSettings
              seconds={settings.seconds}
              zeroMistakes={settings.zeroMistakes}
              editable={settings.editable}
              busy={settings.saving}
              onChange={(seconds, zero) => actions.changeSettings(seconds, zero)}
            />
          </Card>
          {slots.championship}
        </aside>
      </div>

      <section ref={tabsRef} className="pit-room-details scroll-mt-4" aria-label="Room details">
        <SectionTabs label="Room details" tabs={tabs} value={model.tab} onChange={actions.selectTab} />
      </section>
    </div>
  );
}
