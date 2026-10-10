import { MAX_PLAYERS } from '@race/shared';

/* React versions of 08-hud/hud.js. */

export function PositionBadge({ n }: { n: number }) {
  const p = Math.min(MAX_PLAYERS, Math.max(1, n));
  return (
    <span className={`g-position-badge ${p <= 3 ? `podium-${p}` : ''}`} aria-label={`Position ${p}`}>
      P{p}
    </span>
  );
}

export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

interface HudProps {
  /** Omit for practice (no position). */
  position?: number;
  total?: number;
  wpm: number;
  accuracy: number;
  mistakes: number;
  /** Shown in the time slot (elapsed in practice, time left in a timed race). */
  elapsedMs: number;
  timeLabel?: string;
  /** 0..1 */
  progress: number;
  progressLabel?: string;
}

export function Hud({ position, total, wpm, accuracy, mistakes, elapsedMs, timeLabel = 'TIME', progress, progressLabel = 'Passage progress' }: HudProps) {
  const p = Math.min(1, Math.max(0, progress));
  return (
    <div>
      <div className="g-hud" style={position ? undefined : { gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {position !== undefined && (
          <div className="g-hud-position">
            <PositionBadge n={position} />
            <div>
              <span className="g-eyebrow">YOUR POSITION</span>
              <strong>
                {position}
                <small> / {total}</small>
              </strong>
            </div>
          </div>
        )}
        <div className="g-stat" style={position ? undefined : { borderLeft: 0 }}>
          <span>WPM</span>
          <strong>{Math.round(wpm)}</strong>
        </div>
        <div className="g-stat">
          <span>ACCURACY</span>
          <strong>
            {accuracy.toFixed(1)}
            <small>%</small>
          </strong>
        </div>
        <div className="g-stat">
          <span>MISTAKES</span>
          <strong>{mistakes}</strong>
        </div>
        <div className="g-stat">
          <span>{timeLabel}</span>
          <strong>{formatElapsed(elapsedMs)}</strong>
        </div>
      </div>
      <div className="g-progress" role="progressbar" aria-label={progressLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)}>
        <span style={{ width: `${p * 100}%` }} />
      </div>
    </div>
  );
}

export interface MinimapRacer {
  id: string;
  name: string;
  position: number;
  progress: number;
}

/** Every racer on one strip (display only; ranking comes from the race state). */
export function Minimap({ racers, localId, endLabel = 'FINISH' }: { racers: MinimapRacer[]; localId: string | null; endLabel?: string }) {
  return (
    <div className="g-mini-wrap">
      <div className="g-between">
        <span className="g-eyebrow">FULL GRID</span>
        <span className="g-small g-muted">{racers.length} racers · hover or focus a marker</span>
      </div>
      <div className="g-minimap">
        <span className="g-mini-start">START</span>
        {racers.map((r, i) => {
          const p = Math.min(1, Math.max(0, r.progress));
          return (
            <span
              key={r.id}
              className={`g-mini-dot ${r.id === localId ? 'you' : ''}`}
              tabIndex={0}
              style={{ left: `${3 + p * 94}%`, top: 13 + (i % 3) * 14 }}
              aria-label={`${r.name}, position ${r.position}, ${Math.round(p * 100)} percent`}
            >
              <span className="g-mini-tip">{r.name} · P{r.position}</span>
            </span>
          );
        })}
        <span className="g-mini-end">{endLabel}</span>
      </div>
    </div>
  );
}
