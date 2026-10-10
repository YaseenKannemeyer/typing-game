import { useEffect, useRef, useState } from 'react';
import type { Moment } from '../components/race/Moments';

const SHOW_MS = 2200;

interface Input {
  started: boolean;
  /** Id and name of the current leader (live order). */
  leader: { id: string; name: string } | null;
  myRank: number;
  /** The race clock has run out. */
  timeUp: boolean;
}

/**
 * Turns race state changes into at most one banner at a time (motion spec:
 * queue one noncritical banner, replace stale ones). Time up is critical and
 * always shown. Purely presentational: nothing here decides results.
 */
export function useRaceMoments({ started, leader, myRank, timeUp }: Input) {
  const [moment, setMoment] = useState<(Moment & { critical: boolean }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const prev = useRef({ leaderId: leader?.id ?? null, myRank, timeUp, started });

  const show = (m: Moment, critical = false) => {
    setMoment((current) => (current?.critical && !critical ? current : { ...m, critical }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMoment(null), SHOW_MS);
  };

  useEffect(() => {
    const p = prev.current;
    if (started && p.started) {
      if (timeUp && !p.timeUp) show({ kind: 'timeup' }, true);
      else if (!timeUp && myRank > 0 && p.myRank > 0 && myRank < p.myRank) show({ kind: 'gain', gain: p.myRank - myRank });
      else if (leader && p.leaderId && leader.id !== p.leaderId) show({ kind: 'leader', name: leader.name });
    }
    prev.current = { leaderId: leader?.id ?? null, myRank, timeUp, started };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, leader?.id, myRank, timeUp]);

  useEffect(() => () => clearTimeout(timer.current), []);
  return moment;
}
