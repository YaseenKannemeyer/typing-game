import { useEffect, useRef, useState } from 'react';
import type { Moment } from '../components/race/Moments';

const SHOW_MS = 2200;
/** Server finish times closer than this are announced as a photo finish. */
const PHOTO_FINISH_MS = 150;

interface Input {
  started: boolean;
  /** Id and name of the current leader (live order). */
  leader: { id: string; name: string } | null;
  myRank: number;
  myFinished: boolean;
  /** Server finish times (ms since epoch) of everyone who has finished. */
  finishTimes: number[];
}

/**
 * Turns race state changes into at most one banner at a time (motion spec:
 * queue one noncritical banner, replace stale ones). Finishing is critical and
 * always shown. Purely presentational: nothing here decides results.
 */
export function useRaceMoments({ started, leader, myRank, myFinished, finishTimes }: Input) {
  const [moment, setMoment] = useState<(Moment & { critical: boolean }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const prev = useRef({ leaderId: leader?.id ?? null, myRank, myFinished, photo: false, started });

  const show = (m: Moment, critical = false) => {
    setMoment((current) => (current?.critical && !critical ? current : { ...m, critical }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMoment(null), SHOW_MS);
  };

  useEffect(() => {
    const p = prev.current;
    if (started && p.started) {
      if (myFinished && !p.myFinished) show({ kind: 'finish' }, true);
      else if (!myFinished && myRank > 0 && p.myRank > 0 && myRank < p.myRank) show({ kind: 'gain', gain: p.myRank - myRank });
      else if (leader && p.leaderId && leader.id !== p.leaderId) show({ kind: 'leader', name: leader.name });
      if (!p.photo && finishTimes.length >= 2) {
        const sorted = [...finishTimes].sort((a, b) => a - b);
        if (sorted.some((t, i) => i > 0 && t - sorted[i - 1]! < PHOTO_FINISH_MS)) {
          p.photo = true;
          show({ kind: 'photo' });
        }
      }
    }
    prev.current = { leaderId: leader?.id ?? null, myRank, myFinished, photo: p.photo, started };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, leader?.id, myRank, myFinished, finishTimes.length]);

  useEffect(() => () => clearTimeout(timer.current), []);
  return moment;
}
