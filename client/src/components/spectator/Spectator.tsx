import { useLayoutEffect, useRef } from 'react';
import type { VehicleProps } from '../../art/vehicleArt';
import { Car } from '../Car';
import { Icon } from '../ui';

/* React versions of the race-experience kit's 26-spectator renderers. */

export interface StandingView {
  id: string;
  name: string;
  vehicle: VehicleProps;
  rank: number;
  /** 0..1 of the leader's correct characters (display only). */
  progress: number;
  wpm: number | null;
  status: 'racing' | 'finished' | 'dnf' | 'flagged';
}

const STATUS_LABEL: Record<StandingView['status'], string | null> = {
  racing: null,
  finished: null,
  dnf: 'DNF',
  flagged: 'FLAGGED',
};

/**
 * All racers, leader first. Each row is a button that features that racer;
 * featuring never changes the order. Rows are keyed by player id, and if a
 * re-rank moves the focused row, focus is put back on it.
 */
export function BroadcastStandings({
  racers,
  featuredId,
  onFeature,
  official,
}: {
  racers: StandingView[];
  featuredId: string | null;
  onFeature: (id: string | null) => void;
  /** Server ranks (results) rather than the live order. */
  official: boolean;
}) {
  const list = useRef<HTMLOListElement>(null);
  const focused = useRef<string | null>(null);
  const order = racers.map((r) => r.id).join();
  useLayoutEffect(() => {
    const id = focused.current;
    if (!id || !list.current || list.current.contains(document.activeElement)) return;
    list.current.querySelector<HTMLButtonElement>(`button[data-id="${CSS.escape(id)}"]`)?.focus();
  }, [order]);

  return (
    <aside className="sp-sidebar" aria-label={official ? 'Official standings' : 'Live standings'}>
      <div className="sp-standings-label">
        {official ? 'OFFICIAL RESULT' : 'LIVE ORDER'} <small>WPM</small>
      </div>
      {racers.length === 0 ? (
        <p className="g-small g-muted sp-standings-empty">No racers yet.</p>
      ) : (
        <ol
          ref={list}
          className="sp-standings"
          onFocus={(e) => (focused.current = (e.target as HTMLElement).dataset.id ?? null)}
          onBlur={(e) => {
            if (!list.current?.contains(e.relatedTarget as Node | null) && e.relatedTarget) focused.current = null;
          }}
        >
          {racers.map((r) => {
            const on = r.id === featuredId;
            const note = STATUS_LABEL[r.status];
            return (
              <li key={r.id} className={on ? 'is-featured' : ''}>
                <button
                  type="button"
                  data-id={r.id}
                  aria-pressed={on}
                  aria-label={`${r.name}, position ${r.rank}${note ? `, ${note}` : ''}. ${on ? 'Featured' : 'Feature this racer'}`}
                  onClick={() => onFeature(on ? null : r.id)}
                >
                  <span className="sp-pos">{r.rank}</span>
                  <span className="sp-name">{r.name}</span>
                  <strong>
                    {note ?? (r.wpm === null ? '–' : Math.round(r.wpm))}
                    {!note && r.wpm !== null && <small> WPM</small>}
                  </strong>
                  <i style={{ width: `${Math.round(Math.min(1, Math.max(0, r.progress)) * 90)}%` }} />
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}

export function FeaturedRacer({ racer, total, picked }: { racer: StandingView; total: number; picked: boolean }) {
  return (
    <section className="sp-featured" aria-label={`Featured racer ${racer.name}`}>
      <div className="sp-featured-car">
        <Car vehicle={racer.vehicle} />
      </div>
      <div>
        <span className="g-eyebrow">{picked ? 'FEATURED RACER' : 'RACE LEADER'}</span>
        <h3>{racer.name}</h3>
        <p>
          P{racer.rank} / {total}
          {STATUS_LABEL[racer.status] && <> · {STATUS_LABEL[racer.status]}</>}
        </p>
      </div>
      <strong>
        {racer.wpm === null ? '–' : Math.round(racer.wpm)}
        <small>WPM</small>
      </strong>
    </section>
  );
}

/** Only rendered for an official winner: rank 1, present at the end, not flagged. */
export function WinnerReveal({ winner, accuracy }: { winner: StandingView; accuracy: number | null }) {
  return (
    <section className="sp-winner" aria-label={`Winner: ${winner.name}`}>
      <span className="g-eyebrow">OFFICIAL RESULT</span>
      <div className="sp-winner-crown">
        <Icon name="crown" size={48} />
      </div>
      <h2>{winner.name}</h2>
      <p className="g-muted">First across the line</p>
      <div className="sp-winner-car">
        <Car vehicle={winner.vehicle} animation="winner" />
      </div>
      <dl className="sp-winner-stats">
        <div>
          <dt>Average WPM</dt>
          <dd>{winner.wpm === null ? '–' : winner.wpm.toFixed(1)}</dd>
        </div>
        <div>
          <dt>Accuracy</dt>
          <dd>{accuracy === null ? '–' : `${accuracy.toFixed(1)}%`}</dd>
        </div>
      </dl>
    </section>
  );
}
