import { useState } from 'react';
import { MAX_PLAYERS } from '@race/shared';
import { TypingBox } from './components/TypingBox';
import { PRACTICE_PASSAGES } from './lib/practicePassages';
import { supabase } from './lib/supabase';

export default function App() {
  const [practice, setPractice] = useState(0);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-10">
        <header>
          <h1 className="text-3xl font-bold">Type Racer</h1>
          <p className="text-slate-400">Race up to {MAX_PLAYERS} players in real time.</p>
        </header>

        <section className="rounded-xl border border-slate-800 p-6">
          <h2 className="mb-2 text-xl font-semibold">Multiplayer</h2>
          <p className="text-slate-400">
            {supabase
              ? 'Backend connected. Lobbies arrive in Phase 1.'
              : 'Backend not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in client/.env.local.'}
          </p>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Practice</h2>
            <button
              className="rounded-md bg-sky-600 px-3 py-1 text-sm hover:bg-sky-500"
              onClick={() => setPractice((p) => (p + 1) % PRACTICE_PASSAGES.length)}
            >
              New passage
            </button>
          </div>
          <TypingBox key={practice} passage={PRACTICE_PASSAGES[practice]!} />
        </section>
      </div>
    </main>
  );
}
