import { useState } from 'react';
import { CAR_COLORS, MAX_PLAYERS, normalizeName } from '@race/shared';
import { MODEL_GEOMETRY } from '../art/vehicleArt';
import { Car } from '../components/Car';
import { RejoinRace } from '../components/RejoinRace';
import { Button, ErrorText, Icon, Page } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { navigate } from '../lib/router';
import { loadName, saveName } from '../lib/storage';
import { ensureSession, supabase } from '../lib/supabase';
import { SoundToggle } from '../game/sound';
import { Practice } from './Practice';

function CarLineup({ selected, onSelect }: { selected: number; onSelect: (index: number) => void }) {
  return (
    <section className="home-lineup" aria-labelledby="car-lineup-title">
      <div className="home-lineup-heading">
        <h2 id="car-lineup-title">The starting lineup.</h2>
        <p>{MODEL_GEOMETRY.length} cars. All equally fast. Make yours in the garage.</p>
      </div>
      <div className="home-selected-car" aria-live="polite" aria-atomic="true">
        <div className="home-selected-art" aria-hidden="true"><Car vehicle={{ model: MODEL_GEOMETRY[selected]!.id, primary: CAR_COLORS[selected % CAR_COLORS.length], number: selected + 1, stripes: true, accent: '#f4f2eb' }} /></div>
        <div><span className="home-collection-label">Collection preview</span><h3>{MODEL_GEOMETRY[selected]!.name}</h3><p>{MODEL_GEOMETRY[selected]!.tag}</p></div>
        <span className="home-model-count">{String(selected + 1).padStart(2, '0')} / {MODEL_GEOMETRY.length}</span>
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
                <Car vehicle={{ model: model.id, primary: CAR_COLORS[index % CAR_COLORS.length], number: index + 1, stripes: true, accent: '#f4f2eb' }} />
              </span>
              <span>{model.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="home-lineup-note">Your typing sets the pace. <span>Preview here. Save your choice in the room’s garage.</span></p>
    </section>
  );
}

export function Home() {
  const [selectedCar, setSelectedCar] = useState(2);
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
        <div className="home-story-copy">
          <h1>Type it.<br /><span>Race it.</span></h1>
          <p>Same text. <br />Same clock. <br />Your race.</p>
        </div>
        <picture className="home-hero-art">
          <source media="(max-width: 700px)" srcSet="/images/pit-lane/stock-car-hero-768.webp" />
          <img src="/images/pit-lane/stock-car-hero.webp" width="1536" height="1024" fetchPriority="high" alt="A yellow and charcoal GRID stock car, number 07, on the pit lane." />
        </picture>
        <div className="home-race-format" aria-label="Race format">
          <span><strong>{MAX_PLAYERS}</strong> racers</span>
          <span><strong>1–5</strong> minutes</span>
          <span><Icon name="flag" size={16} /> Highest WPM wins</span>
        </div>
      </div>
      <section className="home-entry" aria-labelledby="home-entry-title">
        <div className="home-entry-heading"><span className="home-entry-label"><Icon name="flag" size={18} /> Race entry</span><span>No account needed</span></div>
        <h2 id="home-entry-title">Your grid <br />is waiting.</h2>
        <p>Create a private room or join your crew.</p>
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
          <div className="home-entry-links">
            <a href="#practice">Practice solo <Icon name="arrow" size={16} /></a>
            <a href="/first-lap" onClick={(e) => { if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); navigate('/first-lap'); } }}>First lap &amp; typing comfort</a>
          </div>
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
