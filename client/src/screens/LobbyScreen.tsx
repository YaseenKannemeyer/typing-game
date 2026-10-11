import { useEffect, useRef, useState } from 'react';
import { SystemState } from '../components/SystemState';
import { useToast } from '../components/Toasts';
import { Banner, Button, Card, Loading, Page } from '../components/ui';
import { api } from '../lib/api';
import { navigate } from '../lib/router';
import { SoundToggle } from '../game/sound';
import { useLobby } from '../game/useLobby';
import { Race } from './Race';
import { Results } from './Results';
import { Voting } from './Voting';
import { WaitingRoom } from './WaitingRoom';

interface Props {
  code: string;
  name: string;
  onChangeName: () => void;
}

export function LobbyScreen({ code, name, onChangeName }: Props) {
  const { state, retry, refresh } = useLobby(code, name);
  const { phase, error, errorKind, lobby, race, userId, connected } = state;
  const [leaving, setLeaving] = useState(false);
  const toast = useToast();

  // "You are now the host" when the server hands host to this player.
  const wasHost = useRef<boolean | null>(null);
  const isHost = !!lobby && lobby.host_id === userId;
  useEffect(() => {
    if (!lobby || !userId) return;
    if (wasHost.current === false && isHost) toast('You are now the host. The room controls are yours.', 'success');
    wasHost.current = isHost;
  }, [isHost, lobby, userId, toast]);

  const leave = async () => {
    setLeaving(true);
    if (lobby) await api.leaveLobby(lobby.id).catch(() => {});
    if (race?.status === 'racing') toast('You left the race. Use "Rejoin race" on the home page to get back in before time runs out.', 'info');
    navigate('/');
  };

  let body;
  if (phase === 'error') {
    body =
      errorKind === 'generic' || !errorKind ? (
        <Card className="g-stack">
          <Banner tone="error">{error}</Banner>
          <div className="g-row">
            <Button onClick={() => navigate('/')}>Back to home</Button>
          </div>
        </Card>
      ) : errorKind === 'name-taken' ? (
        <SystemState id="name-taken" onAction={onChangeName} />
      ) : errorKind === 'full' ? (
        <SystemState id="full" onAction={() => navigate('/')} />
      ) : errorKind === 'inactive' ? (
        <SystemState id="inactive" onAction={() => navigate('/')} />
      ) : (
        <SystemState id="not-found" onAction={() => navigate('/')} />
      );
  } else if (phase === 'joining' || !lobby) {
    body = <Loading label={`Joining room ${code}`} />;
  } else if (lobby.status === 'voting') {
    body = <Voting state={state} />;
  } else if (race?.status === 'racing') {
    body = <Race key={race.id} state={state} />;
  } else if (race?.status === 'finished') {
    body = <Results state={state} />;
  } else {
    body = <WaitingRoom state={state} refresh={refresh} />;
  }

  return (
    <Page
      actions={
        <>
          <span className="g-pill g-pill--lime hidden font-mono sm:inline-flex">ROOM {code}</span>
          <SoundToggle />
          {phase !== 'error' && (
            <Button variant="ghost" icon="close" onClick={leave} disabled={leaving} aria-label="Leave the room">
              <span className="hidden sm:inline">Leave</span>
            </Button>
          )}
        </>
      }
    >
      {phase === 'ready' && !connected && (
        <div className="g-stack">
          <Banner tone="warning">Connection lost. Finding your way back… Your last confirmed progress is shown until the server responds.</Banner>
          <div>
            <Button variant="secondary" icon="refresh" onClick={retry}>Retry connection</Button>
          </div>
        </div>
      )}
      {body}
    </Page>
  );
}
