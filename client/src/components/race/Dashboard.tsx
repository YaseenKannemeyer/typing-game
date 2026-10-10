import { useMemo } from 'react';
import { wpmGaugeSvg } from '../../art/worldArt';
import { TrustedSvg } from '../TrustedSvg';
import { formatElapsed } from './Hud';

/* React version of 22-dashboard/dashboard.js. Real typing units only. */

interface Props {
  wpm: number;
  accuracy: number;
  mistakes: number;
  /** Omit in practice (no position). */
  position?: number;
  total?: number;
  timeLabel: string;
  timeMs: number;
  /** 0..1 */
  progress: number;
  progressLabel: string;
  running: boolean;
}

/** Needle stops at this WPM; the number always shows the real value. */
const GAUGE_MAX = 160;

export function Dashboard({ wpm, accuracy, mistakes, position, total, timeLabel, timeMs, progress, progressLabel, running }: Props) {
  const rounded = Math.round(wpm);
  const gauge = useMemo(() => wpmGaugeSvg(rounded, GAUGE_MAX), [rounded]);
  const p = Math.min(1, Math.max(0, progress));
  return (
    <section className="w-dashboard" aria-label="Live telemetry">
      <div className="w-gauge">
        <TrustedSvg markup={gauge} />
      </div>
      <div className="w-dash-main">
        <div className="w-dash-kicker">
          LIVE TELEMETRY <span>{running ? '● RUNNING' : '○ STANDBY'}</span>
        </div>
        <div className="w-dash-stats" style={position === undefined ? { gridTemplateColumns: 'repeat(3, 1fr)' } : undefined}>
          {position !== undefined && (
            <div>
              <span>POSITION</span>
              <strong>
                P{position}
                <small> / {total}</small>
              </strong>
            </div>
          )}
          <div>
            <span>{timeLabel}</span>
            <strong>{formatElapsed(timeMs)}</strong>
          </div>
          <div>
            <span>ACCURACY</span>
            <strong>
              {accuracy.toFixed(1)}
              <small>%</small>
            </strong>
          </div>
          <div>
            <span>MISTAKES</span>
            <strong>{mistakes}</strong>
          </div>
        </div>
        <div className="w-dash-progress" role="progressbar" aria-label={progressLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)}>
          <span style={{ width: `${p * 100}%` }} />
        </div>
        <div className="w-dash-progress-label">
          <span>{progressLabel.toUpperCase()}</span>
          <strong>{Math.round(p * 100)}%</strong>
        </div>
      </div>
      {/* Announce position changes, not every WPM tick. */}
      {position !== undefined && <p className="g-sr" aria-live="polite">Position {position} of {total}</p>}
    </section>
  );
}
