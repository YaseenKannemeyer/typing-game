import { useEffect, useRef, useState } from 'react';
import { MODE_INFO, TROPHIES, type PassageMode, type TrophyCategory, type TrophyId } from '@race/shared';
import { trophyScope } from '../../art/trophyArt';
import type { TrophyRecord } from '../../lib/api';
import { Button } from '../ui';
import { TrophyIcon } from './TrophyIcon';

/* React version of 24-clubhouse: the trophy cabinet with an award detail dialog. */

const CATEGORY_ORDER: TrophyCategory[] = ['podium', 'speed', 'accuracy', 'funny', 'special'];
const IDS = (Object.keys(TROPHIES) as TrophyId[]).sort(
  (a, b) => CATEGORY_ORDER.indexOf(TROPHIES[a].category) - CATEGORY_ORDER.indexOf(TROPHIES[b].category),
);
const dateOf = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)) : null;

interface Props {
  /** Times each trophy type was awarded (authoritative counts from my_summary). */
  counts: Partial<Record<TrophyId, number>>;
  /** Latest verified award per trophy type (my_trophies); may still be loading. */
  records: TrophyRecord[] | null;
}

/**
 * Earned trophies in colour, the rest locked. "Locked" only means not earned
 * yet. Details show the exact statistic, race mode and date from the server.
 */
export function Clubhouse({ counts, records }: Props) {
  const [open, setOpen] = useState<TrophyId | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const byId = new Map((records ?? []).map((r) => [r.trophy, r]));
  const earnedTypes = IDS.filter((id) => (counts[id] ?? 0) > 0).length;
  const totalAwards = IDS.reduce((n, id) => n + (counts[id] ?? 0), 0);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const show = (id: TrophyId, el: HTMLElement) => {
    opener.current = el;
    setOpen(id);
  };
  const close = () => {
    setOpen(null);
    opener.current?.focus(); // return focus to the shelf slot
  };

  const info = open ? TROPHIES[open] : null;
  const n = open ? (counts[open] ?? 0) : 0;
  const record = open ? byId.get(open) : undefined;

  return (
    <section className="w-clubhouse">
      <div className="w-clubhouse-header">
        <span className="g-eyebrow">THE CLUBHOUSE</span>
        <h2>Your story, on the shelf.</h2>
        <p>
          {earnedTypes} of {IDS.length} trophy types collected · {totalAwards} {totalAwards === 1 ? 'award' : 'awards'} in total
        </p>
      </div>
      <div className="w-cabinet">
        {IDS.map((id) => {
          const times = counts[id] ?? 0;
          const t = TROPHIES[id];
          return (
            <button
              key={id}
              type="button"
              className={`w-cabinet-slot ${times ? 'earned' : 'locked'}`}
              aria-label={`${t.name}, ${times ? `earned ${times} ${times === 1 ? 'time' : 'times'}` : 'not yet earned'}. Show details`}
              onClick={(e) => show(id, e.currentTarget)}
            >
              <TrophyIcon trophy={id} size={112} state={times ? 'earned' : 'locked'} label="" />
              <strong>{t.name}</strong>
              <small>{times ? (times > 1 ? `EARNED ×${times}` : 'EARNED') : 'NOT YET EARNED'}</small>
            </button>
          );
        })}
      </div>

      <dialog ref={dialog} className="w-dialog" aria-labelledby="trophy-detail-title" onClose={close} onCancel={close}>
        {open && info && (
          <div className="w-trophy-details">
            <TrophyIcon key={open} trophy={open} size={150} state={n ? 'reveal' : 'locked'} className="mx-auto block w-fit" />
            <span className="g-eyebrow">
              {info.category} / {trophyScope(open)} / {n ? 'EARNED' : 'NOT YET EARNED'}
            </span>
            <h2 id="trophy-detail-title">{info.name}</h2>
            <p>{info.rule}</p>
            {n ? (
              <div className="g-panel">
                {record ? (
                  <>
                    <strong>{record.reason}</strong>
                    <p>
                      Latest: {[dateOf(record.earned_at), MODE_INFO[record.mode as PassageMode]?.label].filter(Boolean).join(' · ')}
                      {n > 1 && ` · earned ${n} times`}
                    </p>
                  </>
                ) : (
                  <p>Earned {n} {n === 1 ? 'time' : 'times'}.{records === null ? ' Loading the details…' : ''}</p>
                )}
              </div>
            ) : (
              <p className="g-muted">Keep racing. This space is waiting for your story.</p>
            )}
            <Button variant="secondary" onClick={close}>Close</Button>
          </div>
        )}
      </dialog>
      <p className="a-footnote mt-4">Trophy types are counted once; repeated awards stay in your race history.</p>
    </section>
  );
}
