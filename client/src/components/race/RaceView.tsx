import { VISIBLE_CARS } from '@race/shared';
import { Track } from '../Track';
import { TypingPanel } from '../TypingPanel';
import { Banner, Pill } from '../ui';
import { formatElapsed, Minimap } from './Hud';
import { CountdownFrame } from './Moments';
import { DeliveryStatus } from './DeliveryStatus';
import { PitBoard } from './RaceControl';
import type { RaceViewProps } from './raceViewModel';

/** Display only. Keep the typing slot at this fixed tree position through every race update. */
export function RaceView({ model, typing }: RaceViewProps) {
  const { session, clock, me } = model;
  const started = clock.phase !== 'countdown';
  const localId = model.cars.find((car) => car.isMe)?.id ?? null;
  const time = formatElapsed(started ? clock.msLeft : session.durationMs);

  return (
    <div className="race-screen pit-race">
      <header className="race-session">
        <div>
          <p className="race-kicker">GRID / {model.role === 'spectating' ? 'Trackside' : 'Race session'}</p>
          <h1>{session.viaRandom && <span>Random / </span>}{session.modeName}</h1>
        </div>
        <div className="race-session-tags">
          {session.round && <Pill lime>ROUND {session.round.n} / {session.round.of}</Pill>}
          <Pill>{Math.round(session.durationMs / 60_000)} MIN</Pill>
          {session.strict && <Pill>ZERO MISTAKES</Pill>}
          <span>{session.racerCount} racers</span>
        </div>
      </header>

      {me ? <dl className="w-dashboard race-telemetry" aria-label="Race telemetry">
        <div className="race-stat-time"><dt>Time left</dt><dd>{time}</dd></div>
        <div className="race-stat-wpm"><dt>Net WPM</dt><dd>{Math.round(me.wpm)}</dd></div>
        <div><dt>Position <span>· live</span></dt><dd>P{me.position}<small> / {me.total}</small></dd></div>
        <div className="race-stat-secondary"><dt>Accuracy</dt><dd>{me.accuracy.toFixed(1)}<small>%</small></dd></div>
        <div className="race-stat-secondary"><dt>Mistakes</dt><dd>{me.mistakes}</dd></div>
      </dl> : <div className="race-spectator-status"><span>Time left <strong>{time}</strong></span><p>You're watching this race. You'll join the next grid.</p></div>}

      {/* Only position changes update this region; clock and WPM ticks stay quiet. */}
      <p className="g-sr race-position-announcement" role="status" aria-live="polite" aria-atomic="true">
        {me ? `Position ${me.position} of ${me.total}` : ''}
      </p>

      {/* One reserved announcement slot. CSS changes visual order, never input identity. */}
      <div className="race-control-strip" aria-live={clock.countdown ? 'off' : 'polite'} aria-atomic="true">
        {clock.countdown ? <CountdownFrame value={clock.countdown} /> : model.results === 'confirming' ? (
          <p><strong>Confirming results…</strong><span>Waiting for the official results.</span></p>
        ) : model.connection === 'reconnecting' ? (
          <p><strong>Connection interrupted</strong><span>Live positions may be delayed. See the reconnect controls above.</span></p>
        ) : model.raceControl ? <PitBoard event={model.raceControl} /> : (
          <p><strong>{started ? 'Green flag' : 'On the grid'}</strong><span>{model.role === 'spectating' ? 'Follow the live order until the clock stops.' : started ? 'Keep typing until the clock stops.' : 'Get comfortable. The start lights set the pace.'}</span></p>
        )}
      </div>

      {typing && (
        <div className="race-typing">
          <TypingPanel ref={typing.inputRef} state={typing.state} onKeyDown={typing.onKeyDown}
            variant={session.variant} waiting={typing.waiting} doneLabel={typing.doneLabel} />
          <DeliveryStatus delivery={model.delivery} timeUp={clock.phase === 'time-up'} />
          {model.warning && <Banner tone="warning">{model.warning}</Banner>}
        </div>
      )}

      {/* Reading order follows the passage-first phone layout. */}
      <section className="race-track" aria-label="Live race order">
        <div className="race-track-heading"><span>Live running order</span><span>Provisional · highest WPM wins</span></div>
        <Track cars={model.cars} total={session.racerCount} started={started} destination={session.destination} lanes={VISIBLE_CARS} compact />
      </section>

      {model.overflow && (
        <details className="race-minimap race-grid-details">
          <summary>All {session.racerCount} racers <span>Full running order</span></summary>
          <Minimap racers={model.overflow} localId={localId} endLabel="TRACK END" />
        </details>
      )}
    </div>
  );
}
