import { formatElapsed } from './Hud';
import { Speedometer } from './Speedometer';

interface Props {
  wpm: number;
  accuracy: number;
  mistakes: number;
  position?: number;
  total?: number;
  timeLabel: string;
  timeMs: number;
  progress: number;
  progressLabel: string;
  running: boolean;
}

/** Real typing units, with quiet live updates and readable labels at every width. */
export function Dashboard({ wpm, accuracy, mistakes, position, total, timeLabel, timeMs, progress, progressLabel, running }: Props) {
  const p = Math.min(1, Math.max(0, progress));
  return (
    <section className={`w-dashboard telemetry ${position === undefined ? 'telemetry--practice' : ''}`} aria-label="Live telemetry">
      <div className="telemetry-speed">
        <span>Typing speed</span>
        <Speedometer wpm={wpm} />
        <span className={`telemetry-status ${running ? 'is-running' : ''}`}><i aria-hidden="true" />{p >= 1 ? 'Complete' : running ? 'In motion' : 'Ready to type'}</span>
      </div>
      <div className="telemetry-body">
        <dl className="telemetry-stats">
          {position !== undefined && <div><dt>Position</dt><dd>P{position}<small> / {total}</small></dd></div>}
          <div><dt>{timeLabel === 'TIME LEFT' ? 'Time left' : 'Elapsed'}</dt><dd>{formatElapsed(timeMs)}</dd></div>
          <div><dt>Accuracy</dt><dd>{accuracy.toFixed(1)}<small>%</small></dd></div>
          <div><dt>Mistakes</dt><dd>{mistakes}</dd></div>
        </dl>
        <div className="telemetry-progress-copy"><span>{progressLabel}</span><strong>{Math.round(p * 100)}%</strong></div>
        <div className="telemetry-progress" role="progressbar" aria-label={progressLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)}><span style={{ transform: `scaleX(${p})` }} /></div>
      </div>
      {position !== undefined && <p className="g-sr" aria-live="polite">Position {position} of {total}</p>}
    </section>
  );
}
