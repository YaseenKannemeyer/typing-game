import { useEffect, useMemo, useRef, useState } from 'react';
import { raceResultsFromRows, TROPHIES, type Award, type RaceResult } from '@race/shared';
import { modeDesign } from '../art/gridArt';
import type { ResultRowView } from '../components/results/Results';
import { ResultsView } from '../components/results/ResultsView';
import type { ResultsAction, ResultsViewModel } from '../components/results/resultsViewModel';
import { useAchievements } from '../components/achievements/Achievements';
import { RaceDebrief } from '../components/experience/Debrief';
import { ChampionshipStandings } from '../components/experience/Championship';
import { useControlBoard } from '../components/race/RaceControl';
import { api, errorMessage } from '../lib/api';
import { useSound } from '../game/sound';
import type { LobbyState } from '../game/useLobby';
import { vehicleFor } from '../game/vehicles';

export function Results({ state }: { state: LobbyState }) {
  const { race, racePlayers, players, lobby, userId } = state;
  const { play } = useSound();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ResultsAction | null>(null);

  // Ranks and stats are the server's; trophies were computed and stored by the
  // award-trophies Edge Function. The browser only displays them.
  const results = useMemo(() => {
    if (!race) return [] as RaceResult[];
    return raceResultsFromRows(racePlayers, {
      startAt: race.start_at,
      streaks: new Map(players.map((p) => [p.user_id, p.streak])),
    });
  }, [race, racePlayers, players]);
  const awards = useMemo(
    () => new Map(racePlayers.filter((r) => r.awards.length).map((r) => [r.user_id, r.awards] as const)),
    [racePlayers],
  );
  const awarded = !!race?.awarded_at;

  // Ask the server to calculate trophies; retried until stored (idempotent).
  const raceId = race?.id;
  useEffect(() => {
    if (!raceId || awarded) return;
    const attempt = () => api.awardTrophies(raceId).catch(() => {});
    void attempt();
    const t = setInterval(() => void attempt(), 4000);
    return () => clearInterval(t);
  }, [raceId, awarded]);

  const vehicles = useMemo(() => new Map(players.map((p, i) => [p.user_id, vehicleFor(p, i)])), [players]);
  const rows: ResultRowView[] = results.map((r) => {
    const finished = r.finishedMs !== null;
    const status = r.flagged ? 'flagged' : finished ? 'finished' : 'dnf';
    return {
      id: r.id,
      name: r.name,
      vehicle: vehicles.get(r.id) ?? vehicleFor({ name: r.name, car_color: '#748782', vehicle: {} }),
      position: r.rank,
      status,
      wpm: status === 'dnf' ? null : r.netWpm,
      accuracy: status === 'dnf' ? null : r.accuracy,
      mistakes: status === 'dnf' ? null : r.errors,
      chars: status === 'dnf' ? null : r.correctChars,
      you: r.id === userId,
    };
  });

  const me = results.find((r) => r.id === userId);
  const myRow = racePlayers.find((r) => r.user_id === userId);
  const iWon = rows.find((r) => r.status === 'finished')?.id === userId;
  const sounded = useRef({ winner: false, awards: false });
  useEffect(() => {
    if (iWon && !sounded.current.winner) {
      sounded.current.winner = true;
      play('winner');
    }
  }, [iWon, play]);
  useEffect(() => {
    if (awarded && awards.has(userId ?? '') && !sounded.current.awards) {
      sounded.current.awards = true;
      play('award-reveal');
    }
  }, [awarded, awards, userId, play]);

  // "Unlocked" toasts: trophy types earned for the first time, and progression
  // achievements. Only server-stored awards are used; ids dedupe across reloads.
  const pushAchievement = useAchievements();
  const myAwards = awards.get(userId ?? '');
  const announced = useRef(false);
  useEffect(() => {
    if (!awarded || !myAwards?.length || !race || announced.current) return;
    announced.current = true;
    const myName = results.find((r) => r.id === userId)?.name ?? 'You';
    void api
      .mySummary(0)
      .then((summary) => {
        for (const a of myAwards) {
          const firstTime = (summary.trophy_counts[a.trophy] ?? 0) === 1;
          if (firstTime || TROPHIES[a.trophy].progression) {
            pushAchievement({ eventId: `${race.id}:${a.trophy}`, trophy: a.trophy, statistic: a.reason, recipient: myName });
          }
        }
      })
      .catch(() => {});
  }, [awarded, myAwards, race, results, userId, pushAchievement]);

  // Race control: a confirmed personal best (server stats include this race).
  const { board, show } = useControlBoard(race ? `${race.id}:results` : undefined);
  const myWpm = me && me.finishedMs !== null && !me.flagged ? me.netWpm : null;
  useEffect(() => {
    if (!awarded || !race || myWpm === null) return;
    void api
      .mySummary(0)
      .then((summary) => {
        const best = summary.stats.best_wpm;
        if (summary.stats.races > 1 && best !== null && Math.abs(best - Math.round(myWpm * 10) / 10) < 0.05)
          show({ id: `${race.id}:best`, type: 'best', detail: `${myWpm.toFixed(1)} WPM. Your best verified finish yet.` }, true);
      })
      .catch(() => {});
  }, [awarded, race, myWpm, show]);

  if (!race || !lobby) return null;
  const isHost = lobby.host_id === userId;
  const design = modeDesign(race.mode);

  const run = (key: ResultsAction, action: () => Promise<unknown>) => async () => {
    setBusy(key);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  };

  const split = (list: Award[] = []) => ({
    race: list.filter((a) => !TROPHIES[a.trophy].progression),
    progression: list.filter((a) => TROPHIES[a.trophy].progression),
  });

  const model: ResultsViewModel = {
    modeName: design.name,
    rows,
    isHost,
    busy,
    error,
    raceControl: board,
    awards: {
      status: awarded ? 'ready' : 'pending',
      mine: me ? { name: me.name, finished: me.finishedMs !== null, ...split(awards.get(userId ?? '')) } : null,
      others: results
        .filter((r) => r.id !== userId && awards.has(r.id))
        .map((r) => {
          const theirs = split(awards.get(r.id));
          return { id: r.id, name: r.name, awards: [...theirs.race, ...theirs.progression] };
        }),
    },
  };

  return (
    <ResultsView
      model={model}
      actions={{
        rematch: () => void run('rematch', () => api.startRace(lobby.id))(),
        newVote: () => void run('vote', () => api.startVoting(lobby.id))(),
        backToLobby: () => void run('lobby', () => api.returnToLobby(lobby.id))(),
      }}
      slots={{
        championship:
          state.championship && state.championship.status !== 'cancelled' && state.championship.committed.length > 0 ? (
            <ChampionshipStandings championship={state.championship} myId={userId} />
          ) : null,
        debrief: race && myRow ? <RaceDebrief race={race} me={myRow} passage={state.passage} /> : null,
      }}
    />
  );
}
