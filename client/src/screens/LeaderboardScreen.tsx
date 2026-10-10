import { useEffect, useState } from 'react';
import { DEFAULT_BUILD, normalizeVehicle } from '../art/vehicleArt';
import { Car } from '../components/Car';
import { TrophyIcon } from '../components/trophies/TrophyIcon';
import { Banner, Button, Page, Skeleton } from '../components/ui';
import { SoundToggle } from '../game/sound';
import { useAuth } from '../game/useAuth';
import { api, errorMessage, type LeaderRow } from '../lib/api';
import { navigate } from '../lib/router';

/* Kit 15 hall of fame + leaderboard. Rows come ranked from public.leaderboard(). */

const MODES = ['all', 'easy', 'medium', 'hard', 'coding', 'shakespeare'] as const;
const PERIODS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 0, label: 'All time' },
] as const;
const PODIUM = ['gold', 'silver', 'bronze'] as const;

const label = (m: string) => (m === 'all' ? 'All modes' : m[0]!.toUpperCase() + m.slice(1));
const vehicleOf = (r: LeaderRow, i: number) =>
  normalizeVehicle({ ...DEFAULT_BUILD, number: i + 1, ...r.vehicle, primary: r.car_color ?? '#ff683b', playerName: r.display_name });

function HallOfFame({ rows }: { rows: LeaderRow[] }) {
  return (
    <section className="a-hall">
      <div className="a-hall-label">
        <span className="g-eyebrow">THE HALL OF FAME</span>
        <h1>Fast hands.<br />Lasting names.</h1>
        <p>The fastest verified finishes in this view.</p>
      </div>
      <div className="a-champions">
        {[1, 0, 2].filter((i) => rows[i]).map((i) => {
          const p = rows[i]!;
          return (
            <article key={p.handle} className={`a-champion rank-${i + 1}`}>
              <div className="a-champion-medal">
                <TrophyIcon trophy={PODIUM[i]!} size={74} />
              </div>
              <span className="a-champion-rank">{String(i + 1).padStart(2, '0')}</span>
              <div className="a-champion-car">
                <Car vehicle={vehicleOf(p, i)} />
              </div>
              <h2>{p.display_name}{p.is_you && <small className="ml-1 text-[9px] text-lime">YOU</small>}</h2>
              <strong>
                {p.best_wpm.toFixed(1)} <small>WPM</small>
              </strong>
              <p>{p.accuracy.toFixed(1)}% accuracy</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function LeaderboardScreen() {
  const { permanent } = useAuth();
  const [days, setDays] = useState(30);
  const [mode, setMode] = useState<(typeof MODES)[number]>('all');
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, [days, mode]);

  const period = PERIODS.find((p) => p.days === days)!.label;

  return (
    <Page actions={<SoundToggle />}>
      {rows && rows.length > 0 ? (
        <HallOfFame rows={rows} />
      ) : (
        <section className="a-hall">
          <div className="a-hall-label">
            <span className="g-eyebrow">THE HALL OF FAME</span>
            <h1>Fast hands.<br />Lasting names.</h1>
            <p>{rows ? 'No account holder has a verified finish in this view yet.' : 'Loading the fastest finishes…'}</p>
          </div>
        </section>
      )}

      <div className="a-leader-controls">
        <div>
          <h2 className="m-0 text-[22px]">The full field</h2>
          <p className="a-footnote">Ranked by best verified race WPM · {period} · {label(mode)}</p>
        </div>
        <div className="g-row">
          <label className="g-sr" htmlFor="leader-mode">Leaderboard mode</label>
          <select id="leader-mode" className="g-select !w-44" value={mode} onChange={(e) => setMode(e.target.value as (typeof MODES)[number])}>
            {MODES.map((m) => <option key={m} value={m}>{label(m)}</option>)}
          </select>
          <label className="g-sr" htmlFor="leader-period">Leaderboard period</label>
          <select id="leader-period" className="g-select !w-44" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {PERIODS.map((p) => <option key={p.days} value={p.days}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {error && <Banner tone="error">{error}</Banner>}
      {!rows && !error && <Skeleton />}
      {rows && rows.length === 0 && (
        <div className="g-stack">
          <Banner tone="info">Only racers with an account appear here. Race, then save your progress to claim a spot.</Banner>
          {!permanent && <div><Button icon="arrow" onClick={() => navigate('/account')}>Save your progress</Button></div>}
        </div>
      )}
      {rows && rows.length > 0 && (
        <div className="a-leader-table">
          <table>
            <caption className="g-sr">Leaderboard by highest verified race WPM</caption>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Racer</th>
                <th scope="col">Best WPM</th>
                <th scope="col">Accuracy of best race</th>
                <th scope="col">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.handle} className={p.is_you ? 'is-you' : ''}>
                  <td>{String(p.rank).padStart(2, '0')}</td>
                  <th scope="row">
                    <span>
                      {p.display_name}
                      {p.is_you && <small>YOU</small>}
                    </span>
                  </th>
                  <td>{p.best_wpm.toFixed(1)}</td>
                  <td>{p.accuracy.toFixed(1)}%</td>
                  <td>{p.achieved_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="a-footnote">
        This is a profile leaderboard, not a single race's finishing order. Each account appears once, with its best finished, unflagged
        race; ties go to the higher accuracy, then the earlier finish.
      </p>
    </Page>
  );
}
