import { useEffect, useMemo, useRef } from 'react';
import { MOTION, prefersReducedMotion } from '../../art/motion';
import { decorative, playerCarSvg, podiumVenueSvg } from '../../art/worldArt';
import { TrustedSvg } from '../TrustedSvg';
import type { VehicleProps } from '../../art/vehicleArt';
import { Car } from '../Car';
import { PositionBadge } from '../race/Hud';
import { TrophyIcon } from '../trophies/TrophyIcon';

/* React versions of 10-results/results.js. Inputs are sorted, server-verified results. */

export interface ResultRowView {
  id: string;
  name: string;
  vehicle: VehicleProps;
  position: number;
  status: 'finished' | 'dnf' | 'flagged';
  /** null when unavailable (never invented as 0). */
  wpm: number | null;
  accuracy: number | null;
  mistakes: number | null;
  /** Correct characters typed before the timer ran out. */
  chars: number | null;
  you: boolean;
}

export function formatRaceTime(ms: number): string {
  const total = ms / 1000;
  const m = Math.floor(total / 60);
  return `${String(m).padStart(2, '0')}:${(total - m * 60).toFixed(1).padStart(4, '0')}`;
}

const PODIUM_TROPHY = ['gold', 'silver', 'bronze'] as const;

/**
 * 20-finish-venue: grandstand and podium with the official top three (fewer
 * when fewer finished). The artwork is decorative; the list below it carries
 * the names and WPM for everyone, including screen readers.
 */
export function FinishVenue({ rows }: { rows: ResultRowView[] }) {
  const top = rows.filter((r) => r.status === 'finished').slice(0, 3);
  const key = JSON.stringify(top.map((p) => [p.id, p.name, p.vehicle]));
  const markup = useMemo(
    () => decorative(podiumVenueSvg(top.map((p) => ({ name: p.name, vehicle: p.vehicle })), playerCarSvg)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  if (!top.length) return null;
  return (
    <div className="g-stack">
      <div className="w-finish-venue">
        <TrustedSvg markup={markup} />
      </div>
      <ol className="w-podium-list" aria-label="Podium">
        {top.map((p, i) => (
          <li key={p.id} className={p.you ? 'is-you' : ''}>
            <TrophyIcon trophy={PODIUM_TROPHY[i]!} size={44} state="reveal" />
            <span>
              <small>{['1ST', '2ND', '3RD'][i]}</small>
              <strong>
                {p.name}
                {p.you && <em> YOU</em>}
              </strong>
            </span>
            <b>{p.wpm === null ? '—' : `${Math.round(p.wpm)} WPM`}</b>
          </li>
        ))}
      </ol>
    </div>
  );
}

const STATUS = { finished: 'Finished', dnf: 'Left early', flagged: 'Under review' } as const;

export function ResultsTable({ rows }: { rows: ResultRowView[] }) {
  return (
    <div className="g-results-scroll">
      <table className="g-results-table">
        <caption className="g-sr">Race results</caption>
        <thead>
          <tr>
            <th scope="col">Place</th>
            <th scope="col">Racer</th>
            <th scope="col">WPM</th>
            <th scope="col">Accuracy</th>
            <th scope="col">Mistakes</th>
            <th scope="col">Typed</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className={`${p.you ? 'is-you' : ''} ${p.status === 'flagged' ? 'is-flagged' : ''}`}>
              <td data-label="Place">{p.status === 'finished' ? <PositionBadge n={p.position} /> : <span className="g-muted">—</span>}</td>
              <th scope="row">
                <div className="g-result-player">
                  <span>
                    <Car vehicle={p.vehicle} />
                  </span>
                  <strong>
                    {p.name}
                    {p.you && <small>YOU</small>}
                  </strong>
                </div>
              </th>
              <td data-label="WPM">{p.wpm === null ? '—' : Math.round(p.wpm)}</td>
              <td data-label="Accuracy">{p.accuracy === null ? '—' : `${p.accuracy.toFixed(1)}%`}</td>
              <td data-label="Mistakes">{p.mistakes ?? '—'}</td>
              <td data-label="Typed">{p.chars === null ? '—' : `${p.chars.toLocaleString()} chars`}</td>
              <td data-label="Status">
                <span className="g-pill">{STATUS[p.status]}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Bounded one-shot confetti (skipped with reduced motion). */
export function Confetti() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const t = setTimeout(() => el.remove(), MOTION.ms.confetti + 300);
    return () => clearTimeout(t);
  }, []);
  if (prefersReducedMotion()) return null;
  return (
    <div ref={ref} className="g-confetti" aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => (
        <i
          key={i}
          style={{
            ['--x' as string]: `${(i * 100) / 28}%`,
            ['--delay' as string]: `${(i % 7) * 0.08}s`,
            ['--turn' as string]: `${(i % 2 ? 1 : -1) * 240}deg`,
            background: ['#b9f46a', '#ffce65', '#88bbff', '#e2ddc9'][i % 4],
          }}
        />
      ))}
    </div>
  );
}
