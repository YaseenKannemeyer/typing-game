import { useEffect, useMemo, useState } from 'react';
import { VOTE_DURATION_MS, type VoteMode } from '@race/shared';
import { MODE_DESIGN, modeDesign } from '../art/gridArt';
import type { Voter } from '../components/voting/Voting';
import { VotingView } from '../components/voting/VotingView';
import type { VotingViewModel } from '../components/voting/votingViewModel';
import { api, errorMessage } from '../lib/api';
import { useServerNow } from '../lib/clock';
import { useSound } from '../game/sound';
import type { LobbyState } from '../game/useLobby';
import { vehicleFor } from '../game/vehicles';
import { destinationInfo } from '../game/destinations';

/** While the vote is closing, ask the server again this often until it answers. */
const CLOSE_RETRY_MS = 3_000;

export function Voting({ state }: { state: LobbyState }) {
  const { lobby, votes, userId, players, clockOffset, voteResult } = state;
  const now = useServerNow(clockOffset, 100);
  const { play } = useSound();
  const [error, setError] = useState<string | null>(null);
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

  // When the deadline passes any client may ask the server to close the vote
  // (spread over 0.8 s so clients don't all ask at once). It's idempotent, so
  // keep asking every few seconds until the result arrives: the view locks the
  // options while closing, so one lost request must not strand the room.
  const lobbyId = lobby?.id;
  const expired = !!lobby && remaining <= 0;
  useEffect(() => {
    if (!lobbyId || !expired || voteResult) return;
    const close = () => void api.closeVoting(lobbyId).catch(() => {});
    const first = setTimeout(close, Math.random() * 800);
    const retry = setInterval(close, CLOSE_RETRY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(retry);
    };
  }, [lobbyId, expired, voteResult]);

  if (!lobby) return null;

  const counts = [...voters.values()].map((v) => v.length);
  const top = Math.max(0, ...counts);
  const model: VotingViewModel = {
    clock: { remainingS: remaining, totalS: VOTE_DURATION_MS / 1000 },
    closing: remaining <= 0 && !voteResult,
    options: MODE_DESIGN.map((mode) => ({ mode, count: voters.get(mode.id)?.length ?? 0, voters: voters.get(mode.id) ?? [], selected: myVote === mode.id })),
    votedCount: votes.length,
    racerCount: players.length,
    rules: { raceSeconds: lobby.race_seconds, zeroMistakes: lobby.zero_mistakes, destination: lobby.destination ? destinationInfo(lobby.destination).name : null },
    isHost,
    error,
    reveal: voteResult ? { mode: modeDesign(voteResult), tie: top > 0 && counts.filter((c) => c === top).length > 1 } : null,
  };

  return (
    <VotingView
      model={model}
      actions={{
        vote: (mode) => {
          play('ui-click');
          api.castVote(lobby.id, mode).catch((e) => setError(errorMessage(e)));
        },
        endVoting: () => void api.closeVoting(lobby.id).catch((e) => setError(errorMessage(e))),
      }}
    />
  );
}
