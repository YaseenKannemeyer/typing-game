import { useEffect, useMemo, useRef, useState } from 'react';
import { VOTE_DURATION_MS, type VoteMode } from '@race/shared';
import { MODE_DESIGN, modeDesign } from '../art/gridArt';
import { ModeCard, TimerRing, VoteReveal, type Voter } from '../components/voting/Voting';
import { Button, ErrorText, PageTitle, Pill } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { useServerNow } from '../lib/clock';
import { useSound } from '../game/sound';
import type { LobbyState } from '../game/useLobby';
import { vehicleFor } from '../game/vehicles';
import { destinationInfo } from '../game/destinations';

export function Voting({ state }: { state: LobbyState }) {
  const { lobby, votes, userId, players, clockOffset, voteResult } = state;
  const now = useServerNow(clockOffset, 100);
  const { play } = useSound();
  const [error, setError] = useState<string | null>(null);
  const closing = useRef(false);
  const endsAt = lobby?.vote_ends_at ? Date.parse(lobby.vote_ends_at) : now;
  const remaining = Math.max(0, (endsAt - now) / 1000);
  const isHost = lobby?.host_id === userId;
  const myVote = votes.find((v) => v.user_id === userId)?.mode;

  const voters = useMemo(() => {
    const byId = new Map(players.map((p, i) => [p.user_id, { id: p.user_id, name: p.name, vehicle: vehicleFor(p, i) }]));
    const out = new Map<VoteMode, Voter[]>();
    for (const v of votes) {
      const voter = byId.get(v.user_id);
      if (voter) out.set(v.mode, [...(out.get(v.mode) ?? []), voter]);
    }
    return out;
  }, [votes, players]);

  // When the deadline passes any client may ask the server to close the vote.
  useEffect(() => {
    if (!lobby || remaining > 0 || closing.current) return;
    closing.current = true;
    const t = setTimeout(() => api.closeVoting(lobby.id).catch(() => {}), Math.random() * 800);
    return () => clearTimeout(t);
  }, [lobby, remaining]);

  if (!lobby) return null;

  if (voteResult) {
    const counts = [...voters.values()].map((v) => v.length);
    const top = Math.max(0, ...counts);
    const tie = top > 0 && counts.filter((c) => c === top).length > 1;
    return <VoteReveal mode={modeDesign(voteResult)} tie={tie} />;
  }

  return (
    <>
      <div className="g-voting-head gap-6">
        <PageTitle title="Pick your kind of fast." lead="One racer, one vote. Choose the challenge for the whole grid." />
        <TimerRing seconds={remaining} total={VOTE_DURATION_MS / 1000} />
      </div>
      <div className="g-row">
        <Pill lime>{votes.length} / {players.length} VOTED</Pill>
        <Pill>{lobby.race_seconds / 60} MIN RACE</Pill>
        {lobby.zero_mistakes && <Pill>ZERO MISTAKES</Pill>}
        <Pill>{lobby.destination ? destinationInfo(lobby.destination).name.toUpperCase() : 'SCENERY MATCHES THE MODE'}</Pill>
        <p className="g-small g-muted">You can change your vote until time runs out. Ties are broken by the server.</p>
      </div>
      <div className="g-grid-3">
        {MODE_DESIGN.map((mode) => (
          <ModeCard
            key={mode.id}
            mode={mode}
            count={voters.get(mode.id)?.length ?? 0}
            selected={myVote === mode.id}
            voters={voters.get(mode.id) ?? []}
            onVote={() => {
              play('ui-click');
              api.castVote(lobby.id, mode.id).catch((e) => setError(errorMessage(e)));
            }}
          />
        ))}
      </div>
      {isHost && (
        <div className="g-row">
          <Button variant="secondary" icon="clock" onClick={() => api.closeVoting(lobby.id).catch((e) => setError(errorMessage(e)))}>
            End voting now
          </Button>
        </div>
      )}
      <ErrorText>{error}</ErrorText>
    </>
  );
}
