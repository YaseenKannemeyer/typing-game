import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_PLAYERS, MIN_PLAYERS_FOR_RACE, TROPHIES } from '@race/shared';
import { Garage } from '../components/garage/Garage';
import { DestinationPicker } from '../components/lobby/Destinations';
import { HowTo, InviteLink, RaceSettings, RoomCode, type RosterPlayer } from '../components/lobby/Lobby';
import { Paddock } from '../components/lobby/Paddock';
import type { DestinationId } from '../art/worldArt';
import { TrophyRoom } from '../components/trophies/TrophyRoom';
import { Button, Card, ErrorText, PageTitle, Pill, SectionTabs, type SectionTab } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import type { LobbyState } from '../game/useLobby';
import { vehicleFor } from '../game/vehicles';

type RoomTab = 'destination' | 'garage' | 'how' | 'trophies';
const TROPHY_COUNT = Object.keys(TROPHIES).length;

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
  const [saving, setSaving] = useState(false);
  // Shown straight away while the server confirms (it broadcasts lobby:update).
  const [pending, setPending] = useState<{ seconds: number; zero: boolean; destination: DestinationId | null } | null>(null);
  const [tab, setTab] = useState<RoomTab>('destination');
  const tabsRef = useRef<HTMLElement>(null);
  const roster = useMemo(() => rosterFrom(state), [state]);
  // Drop the optimistic value once the lobby reflects it.
  useEffect(() => {
    if (pending && lobby && pending.seconds === lobby.race_seconds && pending.zero === lobby.zero_mistakes && pending.destination === lobby.destination)
      setPending(null);
  }, [pending, lobby]);
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

  const rules = {
    seconds: pending?.seconds ?? lobby.race_seconds,
    zero: pending?.zero ?? lobby.zero_mistakes,
    destination: pending ? pending.destination : lobby.destination,
  };
  const changeSettings = async (seconds: number, zeroMistakes: boolean, destination: DestinationId | null = rules.destination) => {
    setSaving(true);
    setPending({ seconds, zero: zeroMistakes, destination });
    setError(null);
    try {
      await api.setRaceSettings(lobby.id, seconds, zeroMistakes, destination);
    } catch (e) {
      setError(errorMessage(e));
      setPending(null);
    } finally {
      setSaving(false);
    }
  };

  const openGarage = () => {
    setTab('garage');
    requestAnimationFrame(() => tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  // Everything below the paddock lives in one tab set, so the room stays short on phones.
  const tabs: SectionTab<RoomTab>[] = [
    {
      key: 'destination',
      label: 'Destination',
      panel: (
        <DestinationPicker
          value={rules.destination}
          editable={isHost}
          busy={saving}
          onChange={(d) => void changeSettings(rules.seconds, rules.zero, d)}
        />
      ),
    },
    ...(me
      ? [
          {
            key: 'garage' as const,
            label: 'Garage',
            panel: (
              <div className="space-y-4">
                <p className="g-muted">Pick a silhouette and make it yours. It's 100% cosmetic: every car has the same speed.</p>
                <Garage lobbyId={lobby.id} me={me} meIndex={meIndex} players={players} locked={lobby.status !== 'waiting'} />
              </div>
            ),
          },
        ]
      : []),
    { key: 'how', label: 'How it works', panel: <section className="g-panel"><HowTo /></section> },
    { key: 'trophies', label: 'Trophies', badge: TROPHY_COUNT, panel: <TrophyRoom /> },
  ];

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
              The paddock <span className="g-muted g-small">{players.length} / {MAX_PLAYERS} parked</span>
            </h2>
            <Pill lime>PRIVATE PADDOCK</Pill>
          </div>
          <Paddock players={roster} />
        </section>

        <aside className="g-stack">
          <Card>
            <RoomCode code={lobby.code} />
            <div className="g-divider" />
            <p className="g-muted mb-4">Better with your crew. Share your invitation and save them a spot.</p>
            <InviteLink code={lobby.code} />
          </Card>
          <Card>
            <div className="g-eyebrow">RACE RULES</div>
            <h2 className="g-heading mb-4">Type until the clock stops.</h2>
            <RaceSettings
              seconds={rules.seconds}
              zeroMistakes={rules.zero}
              editable={isHost}
              busy={saving}
              onChange={changeSettings}
            />
          </Card>
          <Card>
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

      <section ref={tabsRef} className="scroll-mt-4" aria-label="Room details">
        <SectionTabs label="Room details" tabs={tabs} value={tab} onChange={setTab} />
      </section>
    </>
  );
}
