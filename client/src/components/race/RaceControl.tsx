import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { CONTROL_TYPES, type ControlType } from '../../art/worldArt';

/* React version of 23-race-control: short pit-board messages. Presentation only. */

export interface ControlEvent {
  /** Stable per race, so the same event never shows twice (even after a reconnect). */
  id: string;
  type: ControlType;
  detail?: string;
}

export function PitBoard({ event }: { event: ControlEvent }) {
  const t = CONTROL_TYPES[event.type];
  return (
    <aside className="w-pitboard" style={{ '--board-accent': t.color } as CSSProperties}>
      <span className="w-board-source">RACE CONTROL / GRID</span>
      <strong>{t.label}</strong>
      <p>{event.detail ?? t.text}</p>
    </aside>
  );
}

/** The board at rest, so the race-control column is never an empty gap. */
export function IdleBoard() {
  return (
    <aside className="w-pitboard w-pitboard--idle" aria-hidden="true">
      <span className="w-board-source">RACE CONTROL / GRID</span>
      <strong>GREEN FLAG</strong>
      <p>All clear. Eyes on the text.</p>
    </aside>
  );
}

const SHOW_MS = 3500;
/** Non-critical boards wait at least this long after the previous one. */
const MIN_GAP_MS = 2500;

const storageKey = (scope: string) => `grid:control:${scope}`;
function loadSeen(scope: string): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(storageKey(scope)) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

/**
 * One board at a time. Events are deduplicated by id for the whole race
 * lifecycle (kept in sessionStorage across reconnects) and rate-limited.
 */
export function useControlBoard(scope: string | undefined) {
  const [board, setBoard] = useState<ControlEvent | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const lastShown = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    seen.current = scope ? loadSeen(scope) : new Set();
  }, [scope]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const show = useCallback(
    (event: ControlEvent, critical = false) => {
      if (!scope || seen.current.has(event.id)) return;
      const now = Date.now();
      if (!critical && now - lastShown.current < MIN_GAP_MS) return;
      seen.current.add(event.id);
      try {
        sessionStorage.setItem(storageKey(scope), JSON.stringify([...seen.current].slice(-50)));
      } catch {
        // Storage unavailable: dedupe still works for this page.
      }
      lastShown.current = now;
      setBoard(event);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setBoard(null), SHOW_MS);
    },
    [scope],
  );

  return { board, show };
}

interface RaceInput {
  raceId: string | undefined;
  started: boolean;
  myId: string | null;
  /** Current leader in the live order (null before anyone has typed). */
  leader: { id: string; name: string } | null;
  myRank: number;
  msLeft: number;
  timeUp: boolean;
}

const FINAL_STRETCH_MS = 10_000;

/** Race-control events derived from the race state: lead changes, gains, final stretch, time up. */
export function useRaceControl({ raceId, started, myId, leader, myRank, msLeft, timeUp }: RaceInput) {
  const { board, show } = useControlBoard(raceId);
  const prev = useRef<{ leaderId: string | null; rank: number } | null>(null);

  useEffect(() => {
    if (!raceId || !started) return;
    const p = prev.current;
    // Coarse time bucket keeps ids stable within a moment but distinct across the race.
    const bucket = Math.floor(msLeft / 5000);
    if (timeUp) show({ id: `${raceId}:finish`, type: 'finish', detail: "Time's up. Your official result is on its way." }, true);
    else if (msLeft <= FINAL_STRETCH_MS) show({ id: `${raceId}:stretch`, type: 'stretch', detail: `${Math.ceil(msLeft / 1000)} seconds left. Keep your rhythm.` }, true);
    else if (p && leader && p.leaderId && leader.id !== p.leaderId)
      show({ id: `${raceId}:leader:${leader.id}:${bucket}`, type: 'leader', detail: leader.id === myId ? undefined : `${leader.name} takes the lead.` });
    else if (p && myRank > 0 && p.rank > 0 && myRank < p.rank)
      show({ id: `${raceId}:gain:${myRank}:${bucket}`, type: 'gain', detail: `+${p.rank - myRank} · now P${myRank}. Keep that rhythm.` });
    prev.current = { leaderId: leader?.id ?? null, rank: myRank };
    // msLeft is read for the stretch check; re-run only on meaningful changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceId, started, leader?.id, myRank, timeUp, msLeft <= FINAL_STRETCH_MS, show]);

  return board;
}
