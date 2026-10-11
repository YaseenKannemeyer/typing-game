import { useState } from 'react';
import { normalizeName } from '@race/shared';
import { Button, Card, ErrorText, Page, PageTitle } from '../components/ui';
import { navigate } from '../lib/router';
import { firstLapDone, saveName } from '../lib/storage';

/** Shown when someone opens an invite link without a saved name. */
export function NameGate({ code, onName }: { code: string; onName: (name: string) => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <Page>
      <Card className="mx-auto max-w-md">
        <form
          className="g-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const valid = normalizeName(name);
            if (!valid) return setError('Names must be 2–16 letters, numbers, spaces, _ . or -.');
            saveName(valid);
            onName(valid);
          }}
        >
          <PageTitle eyebrow={`Room ${code}`} title="Pick your racing name." />
          <label className="g-field">
            Display name
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={16}
              className="g-input"
              aria-invalid={!!error}
              placeholder="e.g. Speedy"
            />
          </label>
          <ErrorText>{error}</ErrorText>
          <div className="g-row">
            <Button type="submit" icon="arrow">Join the grid</Button>
            <Button variant="ghost" onClick={() => navigate('/')}>Cancel</Button>
          </div>
          {!firstLapDone() && (
            <p className="g-small g-muted">
              First time racing?{' '}
              <a
                href={`/first-lap?next=/r/${code}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/first-lap?next=/r/${code}`);
                }}
              >
                Take a 30-second first lap
              </a>{' '}
              (optional).
            </p>
          )}
        </form>
      </Card>
    </Page>
  );
}
