import { useState } from 'react';
import { TROPHIES, type TrophyCategory, type TrophyId } from '@race/shared';
import { trophyScope } from '../../art/trophyArt';
import { TrophyIcon } from './TrophyIcon';

const FILTERS: { id: TrophyCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All trophies' },
  { id: 'podium', label: 'Podium' },
  { id: 'speed', label: 'Speed' },
  { id: 'accuracy', label: 'Accuracy' },
  { id: 'funny', label: 'Funny' },
  { id: 'special', label: 'Special' },
];

const IDS = Object.keys(TROPHIES) as TrophyId[];

/** Browsable gallery of every trophy with its exact rule (the kit's trophy room). */
export function TrophyRoom() {
  const [filter, setFilter] = useState<TrophyCategory | 'all'>('all');
  const [selected, setSelected] = useState<TrophyId>('gold');
  const [replay, setReplay] = useState(0);
  const info = TROPHIES[selected];

  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-2" aria-label="Filter trophies">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className="rounded-full border border-line-hi bg-panel px-4 py-2 text-sm text-muted aria-pressed:border-lime aria-pressed:bg-lime aria-pressed:text-lime-ink"
          >
            {f.label}
          </button>
        ))}
      </nav>

      <section className="grid gap-5 rounded-2xl border border-line bg-panel p-5 sm:grid-cols-[180px_1fr]" aria-live="polite">
        <TrophyIcon key={`${selected}:${replay}`} trophy={selected} size={160} state="reveal" className="mx-auto" />
        <div className="space-y-2">
          <p className="eyebrow">{info.category} / {trophyScope(selected)}</p>
          <h3 className="text-2xl font-semibold">{info.name}</h3>
          <p className="text-muted">{info.rule}</p>
          <p className="text-xs text-subtle">Only finishers qualify. Ties use this trophy's own tie-breakers, then the official finishing order. Calculated on the server after each race.</p>
          <button className="rounded-lg bg-lime px-4 py-2 text-sm font-semibold text-lime-ink" onClick={() => setReplay((r) => r + 1)}>
            Replay reveal
          </button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {IDS.filter((id) => filter === 'all' || TROPHIES[id].category === filter).map((id, i) => (
          <button
            key={id}
            aria-pressed={selected === id}
            onClick={() => setSelected(id)}
            className="flex flex-col justify-start rounded-card border border-line bg-panel p-3 text-left transition hover:border-line-hi hover:bg-panel-hi aria-pressed:border-lime"
          >
            <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-subtle">
              <span>{TROPHIES[id].category}</span>
              <span>{String(IDS.indexOf(id) + 1 || i + 1).padStart(2, '0')}</span>
            </div>
            <TrophyIcon trophy={id} size={96} className="mx-auto mt-1 block w-fit" />
            <p className="mt-2 text-center text-sm font-semibold">{TROPHIES[id].name}</p>
            <p className="trophy-rule text-center">{TROPHIES[id].rule}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
