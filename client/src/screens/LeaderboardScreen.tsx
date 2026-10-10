import { useEffect, useState } from 'react';
import { DEFAULT_BUILD, normalizeVehicle } from '../art/vehicleArt';
import { normalizeLivery } from '../art/worldArt';
import { Car } from '../components/Car';
import { TrophyIcon } from '../components/trophies/TrophyIcon';
import { Button, Page } from '../components/ui';
import { SoundToggle } from '../game/sound';
import { useAuth } from '../game/useAuth';
import { api, errorMessage, type LeaderRow } from '../lib/api';
import { navigate } from '../lib/router';
import '../styles/leaderboard.css';

/* Kit 15 hall of fame + leaderboard. Rows come ranked from public.leaderboard(). */

const MODES = ['all', 'easy', 'medium', 'hard', 'coding', 'shakespeare'] as const;
const PERIODS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 0, label: 'All time' },
] as const;
const PODIUM = ['gold', 'silver', 'bronze'] as const;
const PLACE_LABELS = ['01 / POLE POSITION', '02 / SECOND', '03 / THIRD'];

const label = (m: string) => (m === 'all' ? 'All modes' : m[0]!.toUpperCase() + m.slice(1));
const vehicleOf = (r: LeaderRow, i: number) => ({
  ...normalizeVehicle({ ...DEFAULT_BUILD, number: i + 1, ...r.vehicle, primary: r.car_color ?? '#ff683b', playerName: r.display_name }),
  ...normalizeLivery(r.vehicle),
});
const dateLabel = (iso: string) => new Intl.DateTimeFormat('en', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
}).format(new Date(iso));

function HallOfFame({ rows, loading }: { rows: LeaderRow[] | null; loading: boolean }) {
  return (
    <section className="lb-hall" aria-labelledby="leaderboard-title">
      <div className="lb-intro">
        <span className="g-eyebrow">THE HALL OF FAME</span>
        <h1 id="leaderboard-title">Fast hands.<br /><span>Lasting names.</span></h1>
        <p>One great race can put you here. The fastest verified finishes, from across the grid.</p>
        <span className="lb-caption">PRECISION MEETS PACE / GRID MOTOR CLUB</span>
      </div>
      {rows && rows.length > 0 ? <div className="lb-champions">
        {/* Always three places; unclaimed ones stay open (never fake racers). */}
        {PODIUM.map((trophy, i) => {
          const p = rows[i];
          if (!p) {
            return (
              <article key={trophy} className={`lb-champion lb-champion--open lb-place-${i + 1}`}>
                <div className="lb-champion-place">
                  <span>{PLACE_LABELS[i]}</span>
                  <TrophyIcon trophy={trophy} size={48} state="locked" />
                </div>
                <div className="lb-open-bay" aria-hidden="true">+</div>
                <h2>Open spot</h2>
                <p>Finish a race to claim it.</p>
              </article>
            );
          }
          return (
            <article key={p.handle} className={`lb-champion lb-place-${i + 1}`}>
              <div className="lb-champion-place">
                <span>{PLACE_LABELS[i]}</span>
                <TrophyIcon trophy={trophy} size={48} />
              </div>
              <div className="lb-champion-car">
                <Car vehicle={vehicleOf(p, i)} />
              </div>
              <h2>{p.display_name}{p.is_you && <small className="lb-you">YOU</small>}</h2>
              <strong>
                {p.best_wpm.toFixed(1)} <small>WPM</small>
              </strong>
              <p>{p.accuracy.toFixed(1)}% accuracy</p>
            </article>
          );
        })}
      </div> : (
        <div className={`lb-hall-placeholder ${loading ? 'is-loading' : ''}`} aria-hidden="true">
          <TrophyIcon trophy="gold" size={128} state="locked" />
          <span>{loading ? 'PREPARING THE PODIUM' : 'A PLACE WORTH RACING FOR'}</span>
        </div>
      )}
    </section>
  );
}

export function LeaderboardScreen() {
  const { permanent } = useAuth();
  const [days, setDays] = useState(30);
  const [mode, setMode] = useState<(typeof MODES)[number]>('all');
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setRows(null);
    setError(null);
    api.leaderboard(days, mode).then(
      (r) => live && setRows(r),
      (e) => live && setError(errorMessage(e)),
    );
    return () => {
      live = false;
    };
  }, [days, mode, attempt]);

  const period = PERIODS.find((p) => p.days === days)!.label;
  const loading = rows === null && error === null;
  const filtered = days !== 0 || mode !== 'all';
  const changeView = (nextDays: number, nextMode: (typeof MODES)[number]) => {
    if (nextDays === days && nextMode === mode) return;
    setRows(null);
    setError(null);
    setDays(nextDays);
    setMode(nextMode);
  };
  const retry = () => {
    setRows(null);
    setError(null);
    setAttempt((n) => n + 1);
  };

  return (
    <Page actions={<SoundToggle />}>
      <div className="lb-page">
      <HallOfFame rows={rows} loading={loading} />

      <div className="lb-controls">
        <div>
          <h2 id="leaderboard-field">The full field</h2>
          <p>Best race WPM · {period} · {label(mode)}</p>
        </div>
        <div className="lb-filters">
          <label className="lb-mode" htmlFor="leader-mode"><span>Race mode</span>
          <select id="leader-mode" className="g-select" value={mode} onChange={(e) => changeView(days, e.target.value as (typeof MODES)[number])}>
            {MODES.map((m) => <option key={m} value={m}>{label(m)}</option>)}
          </select>
          </label>
          <div className="lb-period" role="group" aria-label="Leaderboard period">
            {PERIODS.map((p) => <button type="button" key={p.days} aria-pressed={days === p.days} onClick={() => changeView(p.days, mode)}>{p.label}</button>)}
          </div>
        </div>
      </div>

      <p className="g-sr" role="status" aria-atomic="true">
        {loading ? `Loading ${label(mode)}, ${period}.` : error ? 'Leaderboard could not be loaded.' : `${rows?.length ?? 0} racers shown. ${label(mode)}, ${period}.`}
      </p>
      <section aria-labelledby="leaderboard-field" aria-busy={loading}>
      {error && (
        <div className="lb-state lb-state--error">
          <span className="g-eyebrow">CONNECTION INTERRUPTED</span>
          <h3>The standings couldn’t load.</h3>
          <p>{error}</p>
          <p>Your filters are saved. Try again to bring the field back.</p>
          <Button icon="refresh" onClick={retry}>Retry leaderboard</Button>
        </div>
      )}
      {loading && (
        <div className="lb-skeleton" aria-hidden="true">
          <div className="lb-skeleton-heading"><span /><span /></div>
          {[0, 1, 2, 3, 4].map((i) => <div className="lb-skeleton-row" key={i}><i /><span /><span /><span /></div>)}
        </div>
      )}
      {rows && rows.length === 0 && (
        <div className="lb-state">
          <span className="g-eyebrow">THE GRID IS OPEN</span>
          <h3>{filtered ? 'No finishes in this field. Yet.' : 'Be the first name on the board.'}</h3>
          <p>{filtered ? `No verified account finishes for ${label(mode).toLowerCase()} · ${period.toLowerCase()}. Try a wider view, or set the pace yourself.` : 'Finish a race with an account to put your best WPM on the board.'}</p>
          <div className="lb-state-actions">
            {filtered && <Button variant="secondary" onClick={() => changeView(0, 'all')}>Show all-time standings</Button>}
            <Button icon="arrow" onClick={() => navigate('/')}>Go racing</Button>
          </div>
          {!permanent && <button type="button" className="lb-text-button" onClick={() => navigate('/account')}>Racing as a guest? Save your progress</button>}
        </div>
      )}
      {rows && rows.length > 0 && (
        <div className="lb-table">
          <table>
            <caption className="g-sr">Leaderboard by highest verified race WPM</caption>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Racer</th>
                <th scope="col">Best WPM</th>
                <th scope="col">Accuracy<span className="g-sr"> of best race</span></th>
                <th scope="col" className="lb-date">Set on <span className="g-sr">(UTC)</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.handle} className={p.is_you ? 'is-you' : ''}>
                  <td className="lb-rank">{String(p.rank).padStart(2, '0')}</td>
                  <th scope="row">
                    <span>
                      {p.display_name}
                      {p.is_you && <small className="lb-you">YOU</small>}
                    </span>
                    <time className="lb-mobile-date" dateTime={p.achieved_at}>{dateLabel(p.achieved_at)} UTC</time>
                  </th>
                  <td className="lb-speed">{p.best_wpm.toFixed(1)}</td>
                  <td>{p.accuracy.toFixed(1)}%</td>
                  <td className="lb-date"><time dateTime={p.achieved_at}>{dateLabel(p.achieved_at)}</time></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </section>
      <footer className="lb-rules">
        <span className="g-eyebrow">HOW THE FIELD IS RANKED</span>
        <p>One account. One best finish. Only completed, unflagged races count. Ties go to higher accuracy, then the earlier finish. Dates are shown in UTC.</p>
      </footer>
      </div>
    </Page>
  );
}
