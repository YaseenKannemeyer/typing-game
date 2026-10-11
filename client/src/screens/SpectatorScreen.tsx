import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeStats, getSpectatorLanes, rankPlayers, VISIBLE_CARS } from '@race/shared';
import { modeDesign } from '../art/gridArt';
import { formatElapsed } from '../components/race/Hud';
import { CountdownFrame } from '../components/race/Moments';
import { BroadcastStandings, FeaturedRacer, WinnerReveal, type StandingView } from '../components/spectator/Spectator';
import { SystemState } from '../components/SystemState';
import { Track, type TrackCar } from '../components/Track';
import { Banner, Button, Card, Loading, Page } from '../components/ui';
import { useServerNow } from '../lib/clock';
import { navigate } from '../lib/router';
import { destinationFor } from '../game/destinations';
import { DELAYED_AFTER_MS, useSpectator, type FeedStatus, type WatchSnapshot } from '../game/useSpectator';
import { vehicleFor } from '../game/vehicles';

/** Same track rule as the race screen: the leader drives to 90% as the clock runs out. */
const TRACK_END = 0.9;

type Phase = 'waiting' | 'voting' | 'countdown' | 'racing' | 'results';

function phaseOf(snap: WatchSnapshot, now: number): Phase {
  if (snap.lobby.status === 'voting') return 'voting';
  const race = snap.race;
  if (!race) return 'waiting';
  if (race.status === 'finished') return 'results';
  return now < Date.parse(race.start_at) ? 'countdown' : 'racing';
}

/**
 * Kit 26: read-only race broadcast at /r/<CODE>/watch. Watching never joins
 * the room or takes a seat. Live order is provisional (display only); the
 * results and winner come from the server's finalised ranks.
 */
export function SpectatorScreen({ code }: { code: string }) {
  const { state, retry } = useSpectator(code);
  const { snapshot: snap, live, clockOffset } = state;
  const now = useServerNow(clockOffset, 250);
  const [featuredId, setFeaturedId] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);

  const exitPresenting = useCallback(() => {
    setPresenting(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);
  useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitPresenting();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presenting, exitPresenting]);
  const fullscreen = () => {
    setPresenting(true);
    // Optional: the presentation layout works without it (e.g. iOS Safari).
    void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const vehicles = useMemo(
    () => new Map((snap?.players ?? []).map((p, i) => [p.user_id, vehicleFor(p, i)])),
    [snap?.players],
  );
  const neutral = (name: string) => vehicleFor({ name, car_color: '#748782', vehicle: {} });

  const phase = snap ? phaseOf(snap, now) : 'waiting';
  const race = snap?.race ?? null;
  const startAt = race ? Date.parse(race.start_at) : 0;
  const durationMs = (race?.duration_s ?? 60) * 1000;
  const endAt = race?.end_at ? Date.parse(race.end_at) : startAt + durationMs;
  const elapsed = Math.min(durationMs, Math.max(0, now - startAt));
  const racers = snap?.racers ?? [];
  const showRace = phase === 'countdown' || phase === 'racing' || phase === 'results';

  // Standings. Live: provisional order by correct characters, like the racers
  // see it. Results: the server's official ranks.
  let standings: StandingView[] = [];
  if (showRace && phase !== 'results') {
    const chars = (id: string, server: number) => live[id]?.chars ?? server;
    const leaderChars = Math.max(0, ...racers.map((r) => chars(r.user_id, r.correct_chars)));
    const ranked = rankPlayers(
      racers.map((r) =>
        computeStats(
          { id: r.user_id, name: r.name, correctChars: chars(r.user_id, r.correct_chars), keystrokes: 0, errors: 0, finishedMs: null },
          leaderChars,
          Math.max(1, elapsed),
        ),
      ),
    );
    standings = ranked.map((s) => ({
      id: s.id,
      name: s.name,
      vehicle: vehicles.get(s.id) ?? neutral(s.name),
      rank: s.rank,
      progress: s.progress,
      wpm: phase === 'racing' ? s.netWpm : null,
      status: 'racing',
    }));
  } else if (phase === 'results') {
    const best = Math.max(1, ...racers.map((r) => r.correct_chars));
    standings = [...racers]
      .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
      .map((r, i) => ({
        id: r.user_id,
        name: r.name,
        vehicle: vehicles.get(r.user_id) ?? neutral(r.name),
        rank: r.rank ?? i + 1,
        progress: r.correct_chars / best,
        wpm: r.flagged || !r.finished_at ? null : r.net_wpm,
        status: r.flagged ? 'flagged' : r.finished_at ? 'finished' : 'dnf',
      }));
  }

  const official = racers.find((r) => r.rank === 1 && r.finished_at && !r.flagged);
  const winner = phase === 'results' && official ? standings.find((s) => s.id === official.user_id) : undefined;
  const picked = featuredId !== null && standings.some((s) => s.id === featuredId) ? featuredId : null;
  const featured = standings.find((s) => s.id === picked) ?? standings[0];

  const leaderAt = phase === 'results' ? TRACK_END : phase === 'racing' ? TRACK_END * (elapsed / durationMs) : 0;
  const cars: TrackCar[] = getSpectatorLanes(standings, picked).map((s) => ({
    id: s.id,
    name: s.name,
    vehicle: s.vehicle,
    rank: s.rank,
    progress: s.progress * leaderAt,
    percent: s.progress * 100,
    wpm: s.wpm ?? 0,
    errors: live[s.id]?.errors ?? racers.find((r) => r.user_id === s.id)?.errors ?? 0,
    finished: phase === 'results',
    isMe: false,
  }));

  const feed: FeedStatus = !state.channelUp
    ? 'reconnecting'
    : Date.now() - state.receivedAt > DELAYED_AFTER_MS
      ? 'delayed'
      : 'live';

  const actions = (
    <>
      <span className="g-pill g-pill--lime hidden font-mono sm:inline-flex">ROOM {code}</span>
      {/* Presentation is for big screens; phones keep the brand visible instead. */}
      <Button variant="secondary" className="hidden sm:inline-flex" onClick={() => setPresenting(true)}>Present</Button>
      <Button variant="ghost" icon="arrow" onClick={() => navigate(`/r/${code}`)}>
        <span className="hidden sm:inline">Join race</span>
        <span className="sm:hidden">Join</span>
      </Button>
    </>
  );

  if (state.phase === 'error') {
    return (
      <Page actions={actions}>
        {state.notFound ? (
          <SystemState id="not-found" onAction={() => navigate('/')} />
        ) : (
          <Card className="g-stack">
            <Banner tone="error">{state.error}</Banner>
            <div className="g-row">
              <Button onClick={() => navigate('/')}>Back to home</Button>
            </div>
          </Card>
        )}
      </Page>
    );
  }
  if (state.phase === 'joining' || !snap) {
    return (
      <Page actions={actions}>
        <Loading label={`Tuning in to room ${code}`} />
      </Page>
    );
  }

  const modeName = race ? modeDesign(race.mode).name : snap.lobby.mode ? modeDesign(snap.lobby.mode).name : 'Next race';
  const headline =
    phase === 'results' ? 'Across the line.' : phase === 'racing' ? 'Race on.' : phase === 'countdown' ? 'On the grid.' : phase === 'voting' ? 'Racers are voting.' : 'Waiting for the next race.';
  const clock =
    phase === 'racing' ? formatElapsed(endAt - now) : phase === 'countdown' ? formatElapsed(durationMs) : phase === 'results' ? 'FINAL' : '--:--';
  const countdown = Math.ceil((startAt - now) / 1000);
  const announce =
    feed === 'reconnecting' ? 'Connection lost. Showing the last received positions.' : feed === 'delayed' ? 'Feed delayed.' : headline;

  return (
    <Page actions={actions} className={presenting ? 'is-presenting' : ''}>
      <section className="sp-broadcast" aria-label={`Spectating room ${code}`}>
        <header className="sp-top">
          <div className="sp-brand">
            GRID<span> / LIVE</span>
          </div>
          <div className="sp-top-right">
            <span className={`sp-feed sp-feed--${feed}`}>
              {feed === 'live' ? 'LIVE' : feed === 'delayed' ? 'FEED DELAYED' : 'RECONNECTING'}
            </span>
            <span className="sp-clock" aria-label={phase === 'racing' ? 'Time left' : undefined}>{clock}</span>
            {presenting ? (
              <Button variant="ghost" icon="close" onClick={exitPresenting} aria-label="Exit presentation (Escape)">
                <span className="hidden sm:inline">Exit</span>
              </Button>
            ) : (
              <Button variant="ghost" onClick={fullscreen} aria-label="Present full screen">Full screen</Button>
            )}
          </div>
        </header>
        {/* Phase and connection changes only; never per-update progress. */}
        <p className="sr-only" aria-live="polite">{announce}</p>

        <div className="sp-layout">
          <div className="sp-main">
            <div className="sp-title">
              <span>ROOM {snap.lobby.code} / SPECTATOR VIEW</span>
              <h2>{headline}</h2>
              <p>
                {modeName} · {showRace ? racers.length : snap.players.length} {showRace ? 'racers' : 'in the room'}
                {(race?.zero_mistakes ?? snap.lobby.zero_mistakes) && ' · Zero mistakes'}
              </p>
            </div>

            {feed !== 'live' && (
              <div className="sp-notice">
                <Banner tone="warning">
                  Last received positions shown. Waiting for a fresh race snapshot.
                </Banner>
                {feed === 'reconnecting' && (
                  <Button variant="secondary" icon="refresh" onClick={retry}>Retry connection</Button>
                )}
              </div>
            )}

            {phase === 'results' &&
              (winner ? (
                <WinnerReveal winner={winner} accuracy={official?.accuracy ?? null} />
              ) : (
                <Card className="sp-empty">
                  <h3 className="g-heading">No official winner</h3>
                  <p className="g-muted">
                    {racers.length === 0
                      ? 'Nobody took part in this race.'
                      : 'No racer was present at the finish with a valid result, so this race has no winner.'}
                  </p>
                </Card>
              ))}

            {(phase === 'countdown' || phase === 'racing') && (
              <div className="race-track relative">
                <Track
                  cars={cars}
                  total={racers.length}
                  started={phase === 'racing'}
                  destination={destinationFor(race?.mode, snap.lobby.destination)}
                  lanes={VISIBLE_CARS}
                />
                {phase === 'countdown' && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-ink/85">
                    <CountdownFrame value={countdown > 3 ? 'READY' : (String(Math.max(1, countdown)) as '3' | '2' | '1')} />
                  </div>
                )}
              </div>
            )}

            {(phase === 'waiting' || phase === 'voting') && (
              <Card className="sp-empty">
                <h3 className="g-heading">{phase === 'voting' ? 'Picking the next mode' : 'The grid is forming'}</h3>
                <p className="g-muted">
                  {snap.players.length} of 15 racers in the room. The broadcast starts when the host starts a race.
                </p>
                <ul className="sp-roster">
                  {snap.players.map((p) => (
                    <li key={p.user_id}>{p.name}</li>
                  ))}
                </ul>
              </Card>
            )}

            {showRace && featured && phase !== 'results' && (
              <FeaturedRacer racer={featured} total={standings.length} picked={picked !== null} />
            )}
          </div>

          <BroadcastStandings racers={standings} featuredId={picked} onFeature={setFeaturedId} official={phase === 'results'} />
        </div>

        <footer className="sp-footer">
          <span>GRID MOTOR CLUB</span>
          <span>{phase === 'results' ? 'OFFICIAL SERVER RESULT' : 'LIVE ORDER IS PROVISIONAL'}</span>
          <span>WATCHING DOESN'T TAKE A SEAT</span>
        </footer>
      </section>
    </Page>
  );
}
