import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { TROPHIES, type TrophyId } from '@race/shared';
import { useAuth } from '../../game/useAuth';
import { TrophyIcon } from '../trophies/TrophyIcon';
import { Icon } from '../ui';

/**
 * Kit 15 achievement queue, as a React provider mounted outside the routes so
 * race screens can remount freely. Only server-confirmed awards are pushed.
 *  - one visible toast; later ones queue
 *  - each event id shows once, remembered across reloads (localStorage)
 *  - 6.5 s, paused while hovered, focused or the tab is hidden
 *  - never takes focus; dismissible
 */

export interface AwardEvent {
  eventId: string;
  trophy: TrophyId;
  statistic: string;
  recipient: string;
}

const DISPLAY_MS = 6500;
const SEEN_KEY = 'typeracer:seenAwards';
const SEEN_LIMIT = 300;

function loadSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function saveSeen(ids: string[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-SEEN_LIMIT)));
  } catch {
    // In-memory dedupe still applies for this visit.
  }
}

const AchievementContext = createContext<(e: AwardEvent) => boolean>(() => false);
export const useAchievements = () => useContext(AchievementContext);

export function AchievementProvider({ children }: { children: ReactNode }) {
  const { permanent } = useAuth();
  const seen = useRef(new Set(loadSeen()));
  const [queue, setQueue] = useState<AwardEvent[]>([]);
  const active = queue[0];
  const region = useRef<HTMLDivElement>(null);
  const remaining = useRef(DISPLAY_MS);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const push = useCallback((e: AwardEvent) => {
    if (!e.eventId || seen.current.has(e.eventId) || !TROPHIES[e.trophy]) return false;
    seen.current.add(e.eventId);
    saveSeen([...seen.current]);
    setQueue((q) => [...q, e]);
    return true;
  }, []);

  const next = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    setQueue((q) => q.slice(1));
  }, []);

  const pause = useCallback(() => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = undefined;
    remaining.current = Math.max(0, remaining.current - (performance.now() - started.current));
  }, []);

  const resume = useCallback(() => {
    const el = region.current;
    if (!el || timer.current || document.hidden || el.matches(':hover') || el.contains(document.activeElement)) return;
    started.current = performance.now();
    timer.current = setTimeout(next, remaining.current);
  }, [next]);

  // New active toast: full time, then start (unless paused).
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    remaining.current = DISPLAY_MS;
    if (active) resume();
  }, [active, resume]);

  useEffect(() => {
    const onVisibility = () => (document.hidden ? pause() : resume());
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(timer.current);
    };
  }, [pause, resume]);

  return (
    <AchievementContext.Provider value={push}>
      {children}
      <div
        ref={region}
        className="a-achievement-region"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        onPointerEnter={pause}
        onPointerLeave={resume}
        onFocus={pause}
        onBlur={() => setTimeout(resume, 0)}
      >
        {active && (
          <article key={active.eventId} className="a-achievement-toast" data-event-id={active.eventId}>
            <div className="a-unlock-art">
              <TrophyIcon trophy={active.trophy} size={86} state="reveal" />
            </div>
            <div className="a-unlock-copy">
              <span className="g-eyebrow">{TROPHIES[active.trophy].progression ? 'ACHIEVEMENT UNLOCKED' : 'TROPHY UNLOCKED'}</span>
              <h2>{TROPHIES[active.trophy].name}</h2>
              <p>{active.statistic}</p>
              <span className="a-unlock-recipient">
                {active.recipient} · {permanent ? 'Saved to your collection' : 'Save your progress to keep it'}
              </span>
            </div>
            <button className="a-toast-dismiss" aria-label="Dismiss trophy notification" onClick={next}>
              <Icon name="close" size={18} />
            </button>
          </article>
        )}
      </div>
    </AchievementContext.Provider>
  );
}
