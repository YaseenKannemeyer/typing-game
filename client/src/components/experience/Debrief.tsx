import { useEffect, useMemo, useState } from 'react';
import { difficultWords, raceTimeline, splitWords, type TimelinePoint } from '@race/shared';
import { api } from '../../lib/api';
import { navigate } from '../../lib/router';
import { loadRaceMistakes, saveDrill } from '../../lib/storage';
import type { Race, RacePlayer } from '../../game/types';
import { Button, Icon } from '../ui';

/* Kit 27: race debrief for the local racer. Every number comes from the
   server's stored result, samples and per-window attempt counts, except the
   hardest words, which this browser counted from your own incorrect attempts. */

type Metric = 'wpm' | 'accuracy';

const fmtTime = (ms: number) => `${Math.round(ms / 1000)}s`;

export function RaceDebrief({ race, me, passage }: { race: Race; me: RacePlayer; passage: string | null }) {
  const [metric, setMetric] = useState<Metric>('wpm');
  const durationMs = (race.duration_s ?? 60) * 1000;
  const timeline = useMemo(
    () => raceTimeline(me.samples, durationMs, me.section_keystrokes, me.section_errors),
    [me.samples, durationMs, me.section_keystrokes, me.section_errors],
  );
  const words = useMemo(() => (passage ? splitWords(passage) : []), [passage]);
  const hardest = useMemo(() => difficultWords(words, loadRaceMistakes(race.id), 5), [words, race.id]);

  const [best, setBest] = useState<{ best_wpm: number | null; races: number } | 'loading' | 'error'>('loading');
  useEffect(() => {
    let live = true;
    api.myPreviousBest(race.id).then((b) => live && setBest(b)).catch(() => live && setBest('error'));
    return () => {
      live = false;
    };
  }, [race.id]);

  const finished = me.finished_at !== null && !me.flagged;
  const wpm = finished ? me.net_wpm : null;

  return (
    <section className="x-debrief g-stack" aria-labelledby="debrief-title">
      <div className="x-debrief-top">
        <div>
          <span className="g-eyebrow">RACE DEBRIEF</span>
          <h2 className="g-heading" id="debrief-title">{headline(timeline)}</h2>
          <p className="g-muted">Your race, window by window. Coaching only: official results are above.</p>
        </div>
        <div className="x-debrief-score">
          <Icon name="flag" size={24} />
          <strong>{wpm === null ? '–' : wpm.toFixed(1)}</strong>
          <span>AVERAGE WPM</span>
          <small>
            {me.accuracy === null ? '–' : `${me.accuracy.toFixed(1)}%`} accuracy · {me.errors} {me.errors === 1 ? 'mistake' : 'mistakes'}
          </small>
        </div>
      </div>

      <div className="x-stats">
        <Comparison best={best} wpm={wpm} mode={race.mode} seconds={race.duration_s ?? 60} />
      </div>

      <div className="x-two-col">
        <section className="g-panel x-panel">
          <div className="x-panel-heading">
            <div>
              <span className="g-eyebrow">YOUR PACE</span>
              <h3>{metric === 'wpm' ? 'Speed through the race' : 'Accuracy through the race'}</h3>
            </div>
            <div className="x-segmented" role="group" aria-label="Chart metric">
              <button type="button" aria-pressed={metric === 'wpm'} onClick={() => setMetric('wpm')}>WPM</button>
              <button type="button" aria-pressed={metric === 'accuracy'} onClick={() => setMetric('accuracy')}>Accuracy</button>
            </div>
          </div>
          {timeline ? (
            <>
              <TimelineChart points={timeline} metric={metric} />
              <p className="x-caption">
                {metric === 'wpm'
                  ? `Correct characters gained in each ${fmtTime(durationMs / timeline.length)} window, as WPM. Different from your whole-race average. Gaps mean no progress was recorded in that window.`
                  : `Correct attempts out of all attempts in each window, including mistakes you fixed. Windows with no typing are left blank.`}
              </p>
              <details className="x-table">
                <summary>View the data as a table</summary>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Window</th>
                      <th scope="col">WPM</th>
                      <th scope="col">Accuracy</th>
                      <th scope="col">Attempts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeline.map((p) => (
                      <tr key={p.startMs}>
                        <td>{fmtTime(p.startMs)}–{fmtTime(p.endMs)}</td>
                        <td>{p.wpm === null ? 'No data' : p.wpm.toFixed(1)}</td>
                        <td>{p.accuracy === null ? 'No attempts' : `${p.accuracy.toFixed(1)}%`}</td>
                        <td>{p.attempts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          ) : (
            <div className="x-empty">
              <strong>Timeline unavailable</strong>
              <p>This race has no recorded progress for you, so there is no curve to show. Your result above still stands.</p>
            </div>
          )}
        </section>

        <aside className="g-panel x-panel x-coach">
          <span className="g-eyebrow">PIT WALL NOTE</span>
          {hardest.length > 0 ? (
            <>
              <h3>Precision before pace.</h3>
              <p className="g-muted">The words where you made the most incorrect attempts, counted on this device while you typed.</p>
              <ol className="x-word-list">
                {hardest.map((w) => (
                  <li key={w.index}>
                    <strong>{w.text}</strong>
                    <span>{w.mistakes} {w.mistakes === 1 ? 'mistake' : 'mistakes'} · word {w.index + 1}</span>
                  </li>
                ))}
              </ol>
              <Button
                icon="arrow"
                onClick={() => {
                  saveDrill(hardest.map((w) => w.text).join(' '));
                  navigate('/');
                  setTimeout(() => document.getElementById('practice')?.scrollIntoView({ block: 'start' }), 50);
                }}
              >
                Practise these words
              </Button>
              <p className="x-caption">Opens a practice drill you can edit or skip. It never starts a race.</p>
            </>
          ) : (
            <>
              <h3>No problem words recorded.</h3>
              <p className="g-muted">
                {me.errors === 0
                  ? 'Not a single incorrect attempt. Keep that rhythm.'
                  : 'Word-level mistakes are only counted on the device you raced on, so there is nothing to show here.'}
              </p>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}

function headline(timeline: TimelinePoint[] | null): string {
  const speeds = timeline?.map((p) => p.wpm).filter((v): v is number => v !== null) ?? [];
  if (speeds.length < 4) return 'Your race, in numbers.';
  const half = Math.floor(speeds.length / 2);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const first = avg(speeds.slice(0, half));
  const second = avg(speeds.slice(half));
  if (second > first * 1.08) return 'A strong finish.';
  if (second < first * 0.92) return 'Fast start, fading finish.';
  return 'A steady race.';
}

function Comparison({
  best,
  wpm,
  mode,
  seconds,
}: {
  best: { best_wpm: number | null; races: number } | 'loading' | 'error';
  wpm: number | null;
  mode: string;
  seconds: number;
}) {
  const scope = `Same mode (${mode}) and ${Math.round(seconds / 60)}-minute races, any passage`;
  if (best === 'loading') return <Stat label="Previous best" value="…" note={scope} />;
  if (best === 'error') return <Stat label="Previous best" value="Unavailable" note="Couldn't load your history just now." />;
  if (best.best_wpm === null) {
    return <Stat label="Previous best" value="Baseline" note="Your first finished race of this kind. The next one has something to beat." />;
  }
  const diff = wpm === null ? null : wpm - best.best_wpm;
  return (
    <>
      <Stat label="Previous best" value={`${best.best_wpm.toFixed(1)} WPM`} note={`${scope} · ${best.races} earlier`} />
      <Stat
        label="Difference"
        value={diff === null ? '–' : `${diff >= 0 ? '+' : '−'}${Math.abs(diff).toFixed(1)} WPM`}
        note={diff === null ? 'No finished result this race.' : diff > 0 ? 'A new personal best of this kind.' : 'One race is a single sample, not a trend.'}
      />
    </>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="x-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

/** Line chart with gaps for null windows; values are also in the table. */
function TimelineChart({ points, metric }: { points: TimelinePoint[]; metric: Metric }) {
  const values = points.map((p) => (metric === 'wpm' ? p.wpm : p.accuracy));
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) {
    return (
      <div className="x-empty">
        <strong>No data for this metric</strong>
        <p>Nothing was recorded in any window.</p>
      </div>
    );
  }
  // Scales: WPM from 0 to a round ceiling; accuracy from a round floor (never clipped) to 100.
  const min = metric === 'wpm' ? 0 : Math.max(0, Math.min(90, Math.floor(Math.min(...present) / 10) * 10));
  const max = metric === 'wpm' ? Math.max(20, Math.ceil(Math.max(...present) / 20) * 20) : 100;
  const W = 760, H = 250, L = 48, R = 20, T = 18, B = 40;
  const x = (i: number) => L + ((i + 0.5) * (W - L - R)) / points.length;
  const y = (v: number) => H - B - ((v - min) / (max - min || 1)) * (H - T - B);
  const color = metric === 'wpm' ? 'var(--g-lime)' : 'var(--g-blue)';

  // Break the line wherever a window has no value.
  const segments: string[] = [];
  let d = '';
  values.forEach((v, i) => {
    if (v === null) {
      if (d) segments.push(d);
      d = '';
    } else {
      d += `${d ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
    }
  });
  if (d) segments.push(d);

  const unit = metric === 'wpm' ? 'WPM' : '% accuracy';
  const label = `${metric === 'wpm' ? 'Speed' : 'Accuracy'} per window, ${min} to ${max}${metric === 'wpm' ? ' WPM' : '%'}. ${present.length} of ${points.length} windows have data; the table below lists every value.`;
  return (
    <svg className="x-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {Array.from({ length: 5 }, (_, i) => {
        const v = max - (i * (max - min)) / 4;
        return (
          <g key={i}>
            <path d={`M${L} ${y(v)}H${W - R}`} stroke="var(--g-border)" strokeDasharray="3 6" />
            <text x={L - 10} y={y(v) + 4} textAnchor="end" className="x-chart-label">{Math.round(v)}</text>
          </g>
        );
      })}
      <text x={L} y={H - 4} className="x-chart-label">{metric === 'wpm' ? 'WPM' : 'Accuracy %'} · window start</text>
      {segments.map((seg, i) => (
        <path key={i} d={seg} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {values.map((v, i) =>
        v === null ? (
          <text key={i} x={x(i)} y={H - B - 6} textAnchor="middle" className="x-chart-gap">no data</text>
        ) : metric === 'wpm' ? (
          <circle key={i} cx={x(i)} cy={y(v)} r={4.5} fill={color}>
            <title>{`${fmtTime(points[i]!.startMs)}: ${v.toFixed(1)} ${unit}`}</title>
          </circle>
        ) : (
          // Accuracy uses squares, so the two charts differ by shape as well as colour.
          <rect key={i} x={x(i) - 4} y={y(v) - 4} width={8} height={8} fill={color}>
            <title>{`${fmtTime(points[i]!.startMs)}: ${v.toFixed(1)} ${unit}`}</title>
          </rect>
        ),
      )}
      {points.map((p, i) =>
        i % 2 === 0 || i === points.length - 1 ? (
          <text key={`t${i}`} x={x(i)} y={H - 20} textAnchor="middle" className="x-chart-label">{fmtTime(p.startMs)}</text>
        ) : null,
      )}
    </svg>
  );
}
