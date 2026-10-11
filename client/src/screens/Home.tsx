import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { CAR_COLORS, MAX_PLAYERS, normalizeName } from '@race/shared';
import { MODEL_GEOMETRY } from '../art/vehicleArt';
import { decorative, destinationSceneSvg, roadSurfaceSvg, type DestinationId } from '../art/worldArt';
import { Car } from '../components/Car';
import { TrustedSvg } from '../components/TrustedSvg';
import { RejoinRace } from '../components/RejoinRace';
import { Button, ErrorText, Icon, Page } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { navigate } from '../lib/router';
import { loadName, saveName } from '../lib/storage';
import { ensureSession, supabase } from '../lib/supabase';
import { SoundToggle } from '../game/sound';
import { Practice } from './Practice';

/** Showroom scenery: one layer per destination; the road follows the weather. */
const SCENE_ORDER: DestinationId[] = ['country', 'coast', 'city', 'desert', 'neon', 'rain'];
const SCENES = SCENE_ORDER.map((id) => ({
  id,
  sky: decorative(destinationSceneSvg(id)),
  road: decorative(roadSurfaceSvg({ wet: id === 'rain' })).replace('<svg ', '<svg preserveAspectRatio="none" '),
}));
/** Each car holds the stage for 5–8 s, then drives off for the next one. */
const nextDriveMs = () => 5000 + Math.random() * 3000;

const showroomCar = (index: number) => ({
  model: MODEL_GEOMETRY[index]!.id,
  primary: CAR_COLORS[index % CAR_COLORS.length],
  number: index + 1,
  stripes: true,
  accent: '#edf4df',
  effect: 'smoke' as const,
});

/** Exhaust puffs behind the rear bumper; denser while accelerating away. */
function Exhaust() {
  return (
    <span className="home-exhaust" aria-hidden="true">
      <i /><i /><i /><i />
    </span>
  );
}

function Showroom({ selected, onSelect }: { selected: number; onSelect: (index: number) => void }) {
  const reducedMotion = useReducedMotion();
  const count = MODEL_GEOMETRY.length;
  const model = MODEL_GEOMETRY[selected]!;
  const [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState<{ index: number; key: number } | null>(null);
  const [scene, setScene] = useState(0);
  const [announce, setAnnounce] = useState(false);
  const swaps = useRef(0);
  const previous = useRef(selected);

  // Whatever changes the car (timer, arrows, line-up), the old one drives off.
  useEffect(() => {
    if (previous.current === selected) return;
    if (!reducedMotion) setLeaving({ index: previous.current, key: Date.now() });
    previous.current = selected;
    // A new backdrop after every full line-up, cross-faded while the cars swap.
    swaps.current += 1;
    if (swaps.current % count === 0) setScene((s) => (s + 1) % SCENES.length);
  }, [selected, reducedMotion, count]);

  useEffect(() => {
    if (reducedMotion || paused) return;
    const t = setTimeout(() => {
      setAnnounce(false);
      onSelect((selected + 1) % count);
    }, nextDriveMs());
    return () => clearTimeout(t);
  }, [selected, paused, reducedMotion, onSelect, count]);

  const select = (direction: number) => {
    setAnnounce(true);
    onSelect((selected + direction + count) % count);
  };
  const driving = reducedMotion ? 'idle' : 'driving';

  return (
    <section
      className={`home-showcase ${paused ? 'is-paused' : ''}`}
      aria-label="Explore the car collection"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false); }}
    >
      <div className="home-showcase-world" aria-hidden="true">
        {SCENES.map((sc, i) => (
          <div key={sc.id} className={`home-scene ${i === scene ? 'is-active' : ''}`}>
            <div className="home-scene-sky"><TrustedSvg markup={sc.sky} /></div>
            <div className="home-scene-road"><TrustedSvg markup={sc.road} /></div>
          </div>
        ))}
        <div className="home-road-dashes" />
      </div>
      {leaving && (
        <div key={`leave-${leaving.key}`} className="home-showcase-car is-leaving" aria-hidden="true" onAnimationEnd={() => setLeaving(null)}>
          <div className="home-car-body"><Car vehicle={showroomCar(leaving.index)} animation={reducedMotion ? 'idle' : 'acceleration'} /></div>
          <Exhaust />
        </div>
      )}
      <div key={`car-${selected}`} className={`home-showcase-car ${leaving ? 'is-arriving' : ''}`} aria-hidden="true">
        <div className="home-car-body"><Car vehicle={showroomCar(selected)} animation={driving} /></div>
        <Exhaust />
      </div>
      <div className="home-showcase-controls">
        <div aria-live={announce ? 'polite' : 'off'} aria-atomic="true"><strong>{model.name}</strong><span>{model.tag} · {selected + 1} of {count}</span></div>
        <div className="home-car-buttons">
          <button type="button" onClick={() => select(-1)} aria-label="Previous car"><span className="home-arrow-back"><Icon name="arrow" /></span></button>
          <button type="button" onClick={() => select(1)} aria-label="Next car"><Icon name="arrow" /></button>
        </div>
      </div>
    </section>
  );
}

function CarLineup({ selected, onSelect }: { selected: number; onSelect: (index: number) => void }) {
  return (
    <section className="home-lineup" aria-labelledby="car-lineup-title">
      <div className="home-lineup-heading">
        <h2 id="car-lineup-title">One grid. {MODEL_GEOMETRY.length} personalities.</h2>
        <p>Preview your favourite. Make it yours in the room’s garage.</p>
      </div>
      <ul className="home-lineup-cars" aria-label="All cars">
        {MODEL_GEOMETRY.map((model, index) => (
          <li key={model.id}>
            <button
              type="button"
              aria-label={`Preview ${model.name}`}
              aria-pressed={index === selected}
              onClick={() => onSelect(index)}
            >
              <span className="home-lineup-art" aria-hidden="true">
                <Car vehicle={{ model: model.id, primary: CAR_COLORS[index % CAR_COLORS.length], number: index + 1, stripes: true, accent: '#edf4df' }} />
              </span>
              <span>{model.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="home-lineup-note">All cars available. All equally fast. <span>Scroll to explore the collection <Icon name="arrow" size={14} /></span></p>
    </section>
  );
}

export function Home() {
  const [selectedCar, setSelectedCar] = useState(1);
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<'name' | 'code' | null>(null);
  const valid = normalizeName(name);

  const create = async () => {
    if (!valid) { setInvalid('name'); return setError('Enter a name (2–16 characters) first.'); }
    setBusy(true);
    setError(null);
    setInvalid(null);
    try {
      await ensureSession();
      const lobby = await api.createLobby(valid);
      saveName(valid);
      navigate(`/r/${lobby.code}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  const join = () => {
    if (!valid) { setInvalid('name'); return setError('Enter a name (2–16 characters) first.'); }
    const c = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(c)) { setInvalid('code'); return setError('Room codes are 6 letters or numbers.'); }
    saveName(valid);
    navigate(`/r/${c}`);
  };

  return (
    <Page actions={<SoundToggle />} className="home-page">
      <RejoinRace />
      <div className="home-hero">
      <div className="home-story">
        <h1>Type it. <span>Race it.</span></h1>
        <p>Same text. Same clock. A little friendly rivalry.<br className="home-desktop-break" /> Race up to {MAX_PLAYERS} friends. Let your typing do the talking.</p>
        <Showroom selected={selectedCar} onSelect={setSelectedCar} />
      </div>
      <section className="home-entry" aria-labelledby="home-entry-title">
        <div className="home-entry-heading"><Icon name="flag" size={24} /><span>No account needed</span></div>
        <h2 id="home-entry-title">Your grid is waiting.</h2>
        <p>Create a private room, or jump into a friend’s race.</p>
      {supabase ? (
        <div className="home-entry-fields">
          <label className="g-field">
            Your racing name
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); setInvalid(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !busy) { e.preventDefault(); void create(); } }}
              maxLength={16}
              className="g-input"
              placeholder="e.g. Speedy"
              disabled={busy}
              autoComplete="nickname"
              aria-invalid={invalid === 'name'}
              aria-describedby={error ? 'home-entry-error' : undefined}
            />
          </label>
            <Button icon="flag" loading={busy} onClick={create}>
              Create a room
            </Button>
            <div className="home-form-divider"><span>Have an invite?</span></div>
            <form
              className="home-join-form"
              onSubmit={(e) => {
                e.preventDefault();
                join();
              }}
            >
              <label className="g-field">Room code<input
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); setInvalid(null); }}
                maxLength={6}
                className="g-input font-mono uppercase tracking-[0.3em]"
                placeholder="ABC123"
                aria-label="Room code"
                disabled={busy}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-invalid={invalid === 'code'}
                aria-describedby={error ? 'home-entry-error' : undefined}
              /></label>
              <Button type="submit" variant="secondary" icon="arrow" disabled={busy}>Join</Button>
            </form>
          <div id="home-entry-error"><ErrorText>{error}</ErrorText></div>
          <p className="home-entry-note">1–5 minute races. Highest WPM wins.</p>
        </div>
      ) : (
        <div className="home-offline"><p>Multiplayer is unavailable right now. The practice track is always open.</p><a className="g-btn g-btn--primary" href="#practice">Take a practice lap <Icon name="arrow" /></a></div>
      )}
      </section>
      </div>
      <CarLineup selected={selectedCar} onSelect={setSelectedCar} />
      <Practice />
      <footer className="home-footer"><span>Every car has the same speed. Your fingers make the difference.</span><a href="/leaderboard" onClick={(e) => { if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); navigate('/leaderboard'); } }}>Explore the hall of fame <Icon name="arrow" size={16} /></a></footer>
    </Page>
  );
}
