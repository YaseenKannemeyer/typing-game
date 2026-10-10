import { useState, type ReactNode } from 'react';
import { TROPHIES } from '@race/shared';
import { avatarSvg, lineChartSvg, modeBestsHtml } from '../../art/accountArt';
import type { VehicleProps } from '../../art/vehicleArt';
import type { Summary } from '../../lib/api';
import { Car } from '../Car';
import { TrophyIcon } from '../trophies/TrophyIcon';
import { TrustedSvg } from '../TrustedSvg';
import { Button, ErrorText } from '../ui';

/* React versions of design-kits/account-profile-kit/src/profile.js. */

interface HeaderProps {
  name: string;
  handle: string;
  memberSince: string;
  avatar: 'car' | 'initials';
  vehicle: VehicleProps;
  stats: Summary['stats'];
  onEditName: () => void;
}

export function ProfileHeader({ name, handle, memberSince, avatar, vehicle, stats, onEditName }: HeaderProps) {
  const metrics: [string, number | string | null][] = [
    ['BEST WPM', stats.best_wpm === null ? null : stats.best_wpm.toFixed(1)],
    ['RACES', stats.races],
    ['WINS', stats.wins],
    ['TROPHIES', stats.trophies],
  ];
  return (
    <section className="a-profile-header">
      <div className="a-profile-art">
        {avatar === 'initials' ? <TrustedSvg markup={avatarSvg(name, 124)} /> : <Car vehicle={vehicle} className="w-full" />}
      </div>
      <div className="a-profile-identity">
        <span className="g-eyebrow">YOUR DRIVER PROFILE</span>
        <h1>{name}</h1>
        <p>
          @{handle} <span>·</span> Member since {memberSince}
        </p>
        <div className="g-row">
          <span className="g-pill g-pill--lime">ACCOUNT LINKED</span>
          <button className="a-text-button" onClick={onEditName}>Edit display name</button>
        </div>
      </div>
      <div className="a-profile-metrics">
        {metrics.map(([label, v]) => (
          <div key={label}>
            <strong>{v ?? '—'}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function EditNameDialog({ initial, busy, error, onSave, onCancel }: {
  initial: string;
  busy: boolean;
  error: string | null;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#09120bcc] p-4" role="dialog" aria-modal="true" aria-labelledby="edit-name-title">
      <form
        className="a-edit-dialog g-stack"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(name);
        }}
      >
        <h2 id="edit-name-title">Edit display name</h2>
        <label className="g-field">
          Display name
          <input className="g-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={16} />
        </label>
        <span className="g-small g-muted">2–16 letters, numbers, spaces, _ . or -. Shown on the leaderboard.</span>
        <ErrorText>{error}</ErrorText>
        <div className="g-row">
          <Button type="submit" loading={busy}>Save</Button>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}

export function ChartCard({ title, kicker, children }: { title: string; kicker: string; children: ReactNode }) {
  return (
    <section className="a-chart-card">
      <div className="a-card-heading">
        <h2>{title}</h2>
        <span>{kicker}</span>
      </div>
      {children}
    </section>
  );
}

export function TrendCharts({ daily }: { daily: Summary['daily'] }) {
  return (
    <div className="g-grid-2">
      <ChartCard title="WPM over time" kicker="VERIFIED RACES">
        <TrustedSvg markup={lineChartSvg({ data: daily.map((d) => ({ date: d.date, value: d.wpm })), title: 'WPM over time' })} />
      </ChartCard>
      <ChartCard title="Accuracy trend" kicker="CORRECT / ALL ATTEMPTS">
        <TrustedSvg markup={lineChartSvg({ data: daily.map((d) => ({ date: d.date, value: d.accuracy })), metric: 'accuracy' })} />
      </ChartCard>
    </div>
  );
}

const MODES = ['easy', 'medium', 'hard', 'coding', 'shakespeare'] as const;

export function ModeBests({ bests }: { bests: Summary['mode_bests'] }) {
  return (
    <TrustedSvg
      markup={modeBestsHtml(MODES.map((m) => ({ mode: m[0]!.toUpperCase() + m.slice(1), wpm: bests?.[m] ?? null })))}
    />
  );
}

export function RecentTrophies({ recent }: { recent: Summary['recent'] }) {
  const latest = recent.slice(0, 3);
  if (!latest.length) return <p className="a-footnote">Finish a race to start your collection.</p>;
  return (
    <div className="a-trophy-strip">
      {latest.map((r) => (
        <div key={`${r.race_id}:${r.trophy}`} title={r.reason}>
          <TrophyIcon trophy={r.trophy} size={92} />
          <strong>{TROPHIES[r.trophy].name}</strong>
          <span>{TROPHIES[r.trophy].progression ? 'Progression' : 'Race award'}</span>
          <p className="trophy-rule">{TROPHIES[r.trophy].rule}</p>
        </div>
      ))}
    </div>
  );
}

