import { useState } from 'react';
import { CAR_COLORS, MAX_PLAYERS, normalizeName } from '@race/shared';
import { VEHICLE_MODELS } from '../art/vehicleArt';
import { Car } from '../components/Car';
import { RejoinRace } from '../components/RejoinRace';
import { Banner, Button, Card, ErrorText, Page, PageTitle } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { navigate } from '../lib/router';
import { loadName, saveName } from '../lib/storage';
import { ensureSession, supabase } from '../lib/supabase';
import { SoundToggle } from '../game/sound';
import { Practice } from './Practice';

const SHOWROOM = VEHICLE_MODELS.map((model, i) => ({ model, primary: CAR_COLORS[i], number: i + 1 }));

export function Home() {
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = normalizeName(name);

  const create = async () => {
    if (!valid) return setError('Enter a name (2–16 characters) first.');
    setBusy(true);
    setError(null);
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
    if (!valid) return setError('Enter a name (2–16 characters) first.');
    const c = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(c)) return setError('Room codes are 6 letters or numbers.');
    saveName(valid);
    navigate(`/r/${c}`);
  };

  return (
    <Page actions={<SoundToggle />}>
      <PageTitle
        title="Type it. Race it."
        lead={`Race up to ${MAX_PLAYERS} friends in real time. Same text, same clock: 1 to 5 minutes of non-stop typing. Highest WPM wins. No account needed.`}
      />
      <RejoinRace />
      <div className="garage-card showroom-strip" aria-hidden>
        {SHOWROOM.map((v) => (
          <Car key={v.model} vehicle={v} />
        ))}
      </div>

      {supabase ? (
        <Card className="g-stack">
          <label className="g-field">
            Your racing name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={16}
              className="g-input"
              placeholder="e.g. Speedy"
              aria-invalid={!!error && !valid}
            />
          </label>
          <div className="g-grid-2">
            <Button icon="flag" loading={busy} onClick={create}>
              Create a room
            </Button>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                join();
              }}
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="g-input font-mono uppercase tracking-[0.3em]"
                placeholder="CODE"
                aria-label="Room code"
              />
              <Button type="submit" variant="secondary" icon="arrow">Join</Button>
            </form>
          </div>
          <ErrorText>{error}</ErrorText>
        </Card>
      ) : (
        <Banner tone="warning">
          Multiplayer is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in client/.env.local.
        </Banner>
      )}

      <Practice />
    </Page>
  );
}
