import { useEffect, useMemo, useRef, useState } from 'react';
import { raceResultsFromRows, TROPHIES, type Award, type RaceResult } from '@race/shared';
import { modeDesign } from '../art/gridArt';
import { Confetti, FinishVenue, ResultsTable, type ResultRowView } from '../components/results/Results';
import { useAchievements } from '../components/achievements/Achievements';
import { AwardCard } from '../components/trophies/AwardCard';
import { PitBoard, useControlBoard } from '../components/race/RaceControl';
import { Button, Card, ErrorText, PageTitle, Pill, Skeleton } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { useSound } from '../game/sound';
import type { LobbyState } from '../game/useLobby';
import { vehicleFor } from '../game/vehicles';

export function Results({ state }: { state: LobbyState }) {
  const { race, racePlayers, players, lobby, userId } = state;
  const { play } = useSound();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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

  const run = (key: string, action: () => Promise<unknown>) => async () => {
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
  const mine = split(awards.get(userId ?? ''));

  return (
    <div className="results-screen space-y-8">
      <PageTitle
        eyebrow={`${design.name} · Final results`}
        title="Every finish has a story."
        lead="Highest WPM when the clock stopped wins. Official order and awards come from the server."
      />

      <div aria-live="polite">{board && <PitBoard key={board.id} event={board} />}</div>

      <Card className="relative overflow-hidden">
        {rows.some((r) => r.status === 'finished') ? (
          <>
            <FinishVenue rows={rows} />
            <Confetti />
          </>
        ) : (
          <p className="g-muted py-8 text-center">Nobody was still racing when the clock stopped.</p>
        )}
      </Card>

      {/* What's next sits right under the podium, not 3,000px down. */}
      <div className="g-result-actions">
        {isHost ? (
          <>
            <Button icon="refresh" loading={busy === 'rematch'} disabled={!!busy} onClick={run('rematch', () => api.startRace(lobby.id))}>
              Race again
            </Button>
            <Button variant="secondary" loading={busy === 'vote'} disabled={!!busy} onClick={run('vote', () => api.startVoting(lobby.id))}>
              New mode vote
            </Button>
            <Button variant="ghost" loading={busy === 'lobby'} disabled={!!busy} onClick={run('lobby', () => api.returnToLobby(lobby.id))}>
              Back to lobby
            </Button>
          </>
        ) : (
          <p className="g-muted">Waiting for the host to choose what's next…</p>
        )}
      </div>

      <section className="g-stack">
        <h2 className="g-heading">Official standings</h2>
        <ResultsTable rows={rows} />
      </section>

      {me && (
        <section className="g-stack">
          <div className="g-between">
            <h2 className="g-heading">Your trophy haul</h2>
            <Pill>{mine.race.length} race {mine.race.length === 1 ? 'award' : 'awards'}</Pill>
          </div>
          {!awarded ? (
            <Skeleton />
          ) : mine.race.length + mine.progression.length === 0 ? (
            <p className="g-muted">{me.finishedMs === null ? 'Trophies are for racers still on the grid when the clock stops. Next race is yours.' : 'No trophies this time.'}</p>
          ) : (
            <>
              <div className="g-grid-2">
                {mine.race.map((a) => <AwardCard key={a.trophy} award={a} recipient={me.name} />)}
              </div>
              {mine.progression.length > 0 && (
                <>
                  <div className="g-divider" />
                  <div className="g-eyebrow">PROGRESSION ACHIEVEMENTS</div>
                  <div className="g-grid-2">
                    {mine.progression.map((a) => <AwardCard key={a.trophy} award={a} recipient={me.name} />)}
                  </div>
                </>
              )}
            </>
          )}
        </section>
      )}

      {awarded && (
        <section className="g-stack">
          <h2 className="g-heading">Everyone's awards</h2>
          {results
            .filter((r) => r.id !== userId && awards.has(r.id))
            .map((r) => {
              const theirs = split(awards.get(r.id));
              return (
                <div key={r.id} className="g-stack">
                  <p className="g-eyebrow">{r.name}</p>
                  <div className="award-grid--compact">
                    {[...theirs.race, ...theirs.progression].map((a) => (
                      <AwardCard key={a.trophy} award={a} recipient={r.name} reveal={false} compact />
                    ))}
                  </div>
                </div>
              );
            })}
        </section>
      )}

      <ErrorText>{error}</ErrorText>
    </div>
  );
}
