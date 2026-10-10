import { useMemo, useRef, useState } from 'react';
import { MAX_PLAYERS, MIN_PLAYERS_FOR_RACE } from '@race/shared';
import { Garage } from '../components/garage/Garage';
import { HowTo, InviteLink, RoomCode, Roster, type RosterPlayer } from '../components/lobby/Lobby';
import { TrophyRoom } from '../components/trophies/TrophyRoom';
import { Button, Card, ErrorText, PageTitle, Pill, SectionTitle } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import type { LobbyState } from '../game/useLobby';
import { vehicleFor } from '../game/vehicles';

export function rosterFrom(state: LobbyState): RosterPlayer[] {
  const { players, lobby, userId, online } = state;
  return players.map((p, i) => ({
    id: p.user_id,
    name: p.name,
    vehicle: vehicleFor(p, i),
    you: p.user_id === userId,
    host: p.user_id === lobby?.host_id,
    ready: Object.keys(p.vehicle ?? {}).length > 0,
    online: online.has(p.user_id),
  }));
}

export function WaitingRoom({ state }: { state: LobbyState }) {
  const { lobby, players, userId } = state;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [garageOpen, setGarageOpen] = useState(false);
  const garageRef = useRef<HTMLElement>(null);
  const roster = useMemo(() => rosterFrom(state), [state]);
  if (!lobby) return null;
  const isHost = lobby.host_id === userId;
  const meIndex = players.findIndex((p) => p.user_id === userId);
  const me = players[meIndex];
  const canStart = players.length >= MIN_PLAYERS_FOR_RACE;

  const startVote = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.startVoting(lobby.id);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const openGarage = () => {
    setGarageOpen(true);
    requestAnimationFrame(() => garageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <>
      <PageTitle
        eyebrow="Waiting room"
        title="The crew is coming together."
        lead="Choose your ride. Share the code. We'll meet you on the starting line."
      />

      <div className="g-lobby-grid">
        <section>
          <div className="g-between">
            <h2 className="g-heading">
              The starting grid <span className="g-muted g-small">{players.length} / {MAX_PLAYERS}</span>
            </h2>
            <Pill lime>PRIVATE ROOM</Pill>
          </div>
          <Roster players={roster} />
        </section>

        <aside className="g-stack">
          <Card>
            <RoomCode code={lobby.code} />
            <div className="g-divider" />
            <p className="g-muted mb-4">Better with your crew. Share your invitation and save them a spot.</p>
            <InviteLink code={lobby.code} />
          </Card>
          <Card>
            <div className="g-eyebrow">YOUR NEXT MOVE</div>
            <h2 className="g-heading">Ready when you are.</h2>
            <p className="g-muted mb-4">Customize your vehicle, then join the vote.</p>
            <div className="g-stack">
              <Button variant="secondary" icon="gear" onClick={openGarage}>
                Open garage
              </Button>
              <Button icon="arrow" disabled={!isHost || !canStart} loading={busy} onClick={startVote}>
                {isHost ? 'Start mode vote' : 'Waiting for the host'}
              </Button>
            </div>
            <p className="g-small g-muted mt-3">
              {!isHost
                ? 'You can keep choosing your ride until voting starts.'
                : canStart
                  ? 'Only the host can start the vote.'
                  : 'You need at least one more racer to start.'}
            </p>
            <ErrorText>{error}</ErrorText>
          </Card>
        </aside>
      </div>

      {me && garageOpen && (
        <section ref={garageRef} className="space-y-4 scroll-mt-4">
          <SectionTitle
            eyebrow="Make your entrance"
            title="Your ride. Your rules."
            aside={<Button variant="ghost" icon="close" onClick={() => setGarageOpen(false)}>Close garage</Button>}
          />
          <p className="g-muted">Pick a silhouette and make it yours. It's 100% cosmetic: every car has the same speed.</p>
          <Garage lobbyId={lobby.id} me={me} meIndex={meIndex} players={players} locked={lobby.status !== 'waiting'} />
        </section>
      )}

      <section className="g-panel g-how-panel">
        <div className="g-eyebrow">THREE STEPS TO THE FINISH</div>
        <HowTo />
      </section>

      <section className="space-y-4">
        <SectionTitle
          eyebrow="Every finish has a story"
          title="The trophy room"
          aside={<span className="g-small g-muted">19 race trophies + 1 progression achievement</span>}
        />
        <TrophyRoom />
      </section>
    </>
  );
}
