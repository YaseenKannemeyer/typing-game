import { useState } from 'react';
import { CAR_COLORS, MAX_PLAYERS, normalizeName } from '@race/shared';
import { MODEL_GEOMETRY } from '../art/vehicleArt';
import { decorative, destinationSceneSvg } from '../art/worldArt';
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

const SCENERY = decorative(destinationSceneSvg('country'));

function Showroom({ selected, onSelect }: { selected: number; onSelect: (index: number) => void }) {
  const model = MODEL_GEOMETRY[selected]!;
  const select = (direction: number) => onSelect((selected + direction + MODEL_GEOMETRY.length) % MODEL_GEOMETRY.length);
  return (
    <section className="home-showcase" aria-label="Explore the car collection">
      <div className="home-showcase-scene" aria-hidden="true"><TrustedSvg markup={SCENERY} /></div>
      <div className="home-showcase-road" aria-hidden="true" />
      <div className="home-showcase-car" aria-hidden="true">
        <Car vehicle={{ model: model.id, primary: CAR_COLORS[selected % CAR_COLORS.length], number: selected + 1, stripes: true, accent: '#edf4df' }} />
      </div>
      <div className="home-showcase-controls">
        <div aria-live="polite" aria-atomic="true"><strong>{model.name}</strong><span>{model.tag} · {selected + 1} of {MODEL_GEOMETRY.length}</span></div>
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
