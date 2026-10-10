import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SoundPlayer, type SoundId } from '../lib/sound';
import { Icon } from '../components/ui';

const PREFS_KEY = 'typeracer:sound';

interface Prefs {
  enabled: boolean;
  keyClicks: boolean;
}

function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<Prefs>;
    return { enabled: p.enabled === true, keyClicks: p.keyClicks === true };
  } catch {
    return { enabled: false, keyClicks: false };
  }
}

interface SoundApi extends Prefs {
  play: (id: SoundId) => void;
  setEnabled: (on: boolean) => void;
  setKeyClicks: (on: boolean) => void;
}

const SoundContext = createContext<SoundApi>({
  enabled: false,
  keyClicks: false,
  play: () => {},
  setEnabled: () => {},
  setKeyClicks: () => {},
});

/**
 * Sound is muted by default and the audio context is only created from a user
 * gesture (the toggle). Preferences persist; a remembered "on" still needs one
 * click per visit because browsers block audio before interaction.
 */
export function SoundProvider({ children }: { children: ReactNode }) {
  const player = useRef<SoundPlayer | null>(null);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    player.current = new SoundPlayer();
    return () => player.current?.destroy();
  }, []);

  const save = (p: Prefs) => {
    setPrefs(p);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    } catch {
      // Not persisted; still applies for this visit.
    }
  };

  const setEnabled = useCallback(
    (on: boolean) => {
      const p = player.current;
      if (!p) return;
      if (on) {
        void p.unlock().then(() => {
          p.setMuted(false);
          setUnlocked(true);
          p.play('ui-click');
        });
      } else p.setMuted(true);
      save({ ...prefs, enabled: on });
    },
    [prefs],
  );

  const setKeyClicks = useCallback((on: boolean) => save({ ...prefs, keyClicks: on }), [prefs]);

  const play = useCallback(
    (id: SoundId) => {
      if (!prefs.enabled || !unlocked) return;
      if (id === 'key-click' && !prefs.keyClicks) return;
      player.current?.play(id);
    },
    [prefs, unlocked],
  );

  const api = useMemo(
    () => ({ enabled: prefs.enabled && unlocked, keyClicks: prefs.keyClicks, play, setEnabled, setKeyClicks }),
    [prefs, unlocked, play, setEnabled, setKeyClicks],
  );
  return <SoundContext.Provider value={api}>{children}</SoundContext.Provider>;
}

export const useSound = () => useContext(SoundContext);

/** Header control: sound on/off, plus an opt-in key-click switch when on. */
export function SoundToggle() {
  const { enabled, keyClicks, setEnabled, setKeyClicks } = useSound();
  return (
    <div className="flex items-center gap-2">
      {enabled && (
        <label className="g-switch hidden text-xs text-muted sm:flex">
          <input type="checkbox" checked={keyClicks} onChange={(e) => setKeyClicks(e.target.checked)} />
          Key clicks
        </label>
      )}
      <button
        type="button"
        className="g-btn g-btn--ghost !min-h-10 !px-3"
        aria-pressed={enabled}
        aria-label={enabled ? 'Mute sound' : 'Turn sound on'}
        title={enabled ? 'Mute sound' : 'Turn sound on'}
        onClick={() => setEnabled(!enabled)}
      >
        <Icon name={enabled ? 'sound' : 'mute'} />
      </button>
    </div>
  );
}
