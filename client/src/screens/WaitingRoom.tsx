import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_PLAYERS, MIN_PLAYERS_FOR_RACE } from '@race/shared';
import { Garage } from '../components/garage/Garage';
import type { RosterPlayer } from '../components/lobby/Lobby';
import { WaitingRoomView } from '../components/lobby/WaitingRoomView';
import type { RoomTab, WaitingRoomViewModel } from '../components/lobby/waitingRoomViewModel';
import { ChampionshipHostPanel } from '../components/experience/Championship';
import type { DestinationId } from '../art/worldArt';
import { api, errorMessage } from '../lib/api';
import type { LobbyState } from '../game/useLobby';
import { vehicleFor } from '../game/vehicles';
import { prefersReducedMotion } from '../art/motion';

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

export function WaitingRoom({ state, refresh }: { state: LobbyState; refresh: () => Promise<void> }) {
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
    requestAnimationFrame(() => {
      tabsRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      tabsRef.current?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true });
    });
  };

  const model: WaitingRoomViewModel = {
    room: { code: lobby.code, racerCount: players.length, maxRacers: MAX_PLAYERS },
    isHost,
    canStart,
    starting: busy,
    roster,
    settings: { seconds: rules.seconds, zeroMistakes: rules.zero, destination: rules.destination, editable: isHost, saving },
    error,
    tab,
    connection: state.connected ? 'live' : 'reconnecting',
  };

  return (
    <WaitingRoomView
      model={model}
      actions={{ startVote: () => void startVote(), changeSettings: (...args) => void changeSettings(...args), openGarage, selectTab: setTab }}
      slots={{
        garage: me ? <Garage lobbyId={lobby.id} me={me} meIndex={meIndex} players={players} locked={lobby.status !== 'waiting'} /> : null,
        championship: <ChampionshipHostPanel lobbyId={lobby.id} championship={state.championship} isHost={isHost} myId={userId} refresh={refresh} />,
      }}
      tabsRef={tabsRef}
    />
  );
}
