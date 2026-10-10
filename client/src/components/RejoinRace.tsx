import { useEffect, useState } from 'react';
import { clearActiveRace, loadActiveRace, type ActiveRace } from '../lib/storage';
import { navigate } from '../lib/router';
import { supabase } from '../lib/supabase';
import { formatElapsed } from './race/Hud';
import { Button } from './ui';

/**
 * "Rejoin race": shown while a race this player left is still running. The
 * server kept their race entry, so rejoining resumes their locked-in lines and
 * they still count as a finisher if they're back before the final whistle.
 */
export function RejoinRace() {
  const [race, setRace] = useState<ActiveRace | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const saved = loadActiveRace();
    if (!saved || !supabase) return;
    if (saved.endAt <= Date.now()) return clearActiveRace();
    // Only the same identity can rejoin (a guest in another tab is someone else).
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user.id === saved.userId) setRace(saved);
    });
  }, []);

  useEffect(() => {
    if (!race) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [race]);

  if (!race) return null;
  const left = race.endAt - now;
  if (left <= 0) {
    clearActiveRace(race.raceId);
    return null;
  }
  return (
    <section className="g-rejoin" aria-label="Race in progress">
      <div>
        <span className="g-eyebrow">RACE IN PROGRESS · ROOM {race.code}</span>
        <strong>Your race is still running.</strong>
        <p>
          <span className="font-mono">{formatElapsed(left)}</span> left. Your locked-in lines are saved. Get back on the grid before the final whistle to count as a finisher.
        </p>
      </div>
      <Button icon="arrow" onClick={() => navigate(`/r/${race.code}`)}>
        Rejoin race
      </Button>
    </section>
  );
}
