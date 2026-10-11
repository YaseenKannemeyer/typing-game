import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildGhostTrace,
  computeStats,
  GHOST_RULES_VERSION,
  ghostAt,
  passageLength,
  typedCorrectChars,
  validGhost,
  type GhostPoint,
} from '@race/shared';
import { Car } from '../components/Car';
import { Dashboard } from '../components/race/Dashboard';
import { TypingPanel } from '../components/TypingPanel';
import { Button, SectionTitle } from '../components/ui';
import { api } from '../lib/api';
import { loadBuild, takeDrill } from '../lib/storage';
import { ensureSession, requireSupabase } from '../lib/supabase';
import { PRACTICE_PASSAGES } from '../game/practicePassages';
import { useSound } from '../game/sound';
import { useTyping } from '../game/useTyping';

/* Practice lap with a personal ghost (kit 29). The ghost is your fastest
   completed lap of this exact text, replayed from its saved checkpoints on
   the same clock as your attempt: both start at your first keystroke and the
   clock keeps running if you switch tabs. Practice never affects race stats
   or trophies. */

const DRILLS = [
  { id: 'precision', label: 'Precision lap', hint: 'Tricky letter patterns', text: 'rhythm acceleration precision necessary rhythm acceleration precision' },
  { id: 'punctuation', label: 'Punctuation pit stop', hint: 'Commas, brackets and full stops', text: 'Wait, focus, then type (carefully). Stop; check; go: fast, but clean.' },
  { id: 'steady', label: 'Steady pace', hint: 'A short repeatable sentence', text: 'Keep a steady pace from start to finish, one clean word at a time.' },
] as const;

type Source = { kind: 'passage'; index: number } | { kind: 'drill'; id: string; label: string; text: string };

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

type GhostState =
  | { kind: 'loading' }
  | { kind: 'none'; reason: 'no-lap' | 'signed-out' | 'error' }
  | { kind: 'ready'; trace: GhostPoint[]; durationMs: number };

export function Practice() {
  const [source, setSource] = useState<Source>({ kind: 'passage', index: 0 });
  const passage = source.kind === 'passage' ? PRACTICE_PASSAGES[source.index]! : source.text;
  const { state, onKeyDown, reset } = useTyping(passage, true);
  const { play } = useSound();
  const inputRef = useRef<HTMLInputElement>(null);

  // A drill handed over from the race debrief: shown for editing, never forced.
  const [offered, setOffered] = useState<string | null>(null);
  useEffect(() => setOffered(takeDrill()), []);

  // Lap clock: monotonic, from the first keystroke to completion.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedMs, setFinishedMs] = useState<number | null>(null);
  const [now, setNow] = useState(() => performance.now());
  const raw = useRef<GhostPoint[]>([]);
  const total = passageLength(state.words) + 1;
  const correct = typedCorrectChars(state);

  useEffect(() => {
    setStartedAt(null);
    setFinishedMs(null);
    raw.current = [];
  }, [passage]);
  useEffect(() => {
    if (startedAt === null && state.keystrokes > 0) setStartedAt(performance.now());
  }, [state.keystrokes, startedAt]);
  useEffect(() => {
    if (startedAt === null || finishedMs !== null) return;
    const t = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(t);
  }, [startedAt, finishedMs]);
  // Checkpoint on every change of correct progress.
  useEffect(() => {
    if (startedAt === null) return;
    const t = performance.now() - startedAt;
    raw.current.push([t, Math.min(1, correct / total)]);
    if (state.finished && finishedMs === null) setFinishedMs(t);
  }, [correct, total, startedAt, state.finished, finishedMs]);

  const elapsed = finishedMs ?? (startedAt === null ? 0 : Math.max(0, now - startedAt));
  const stats = computeStats(
    { id: 'me', name: 'me', correctChars: correct, keystrokes: state.keystrokes, errors: state.errors, finishedMs },
    total,
    elapsed,
  );

  // Ghost for this exact text and rules version.
  const [hash, setHash] = useState<string | null>(null);
  const [ghost, setGhost] = useState<GhostState>({ kind: 'loading' });
  const [ghostReload, setGhostReload] = useState(0);
  useEffect(() => {
    let live = true;
    setHash(null);
    setGhost({ kind: 'loading' });
    void (async () => {
      const h = await sha256(passage).catch(() => null);
      if (!live) return;
      if (!h) return setGhost({ kind: 'none', reason: 'error' });
      setHash(h);
      // Only look up laps for an existing session; practice alone never creates an account.
      const { data } = await requireSupabase().auth.getSession();
      if (!live) return;
      if (!data.session) return setGhost({ kind: 'none', reason: 'signed-out' });
      try {
        const row = await api.loadPracticeGhost(h, GHOST_RULES_VERSION);
        if (!live) return;
        setGhost(row && validGhost(row.trace) ? { kind: 'ready', trace: row.trace, durationMs: row.duration_ms } : { kind: 'none', reason: 'no-lap' });
      } catch {
        if (live) setGhost({ kind: 'none', reason: 'error' });
      }
    })();
    return () => {
      live = false;
    };
  }, [passage, ghostReload]);

  // Save the finished lap (the server keeps it only if it is your fastest).
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const savedFor = useRef<string | null>(null);
  useEffect(() => {
    if (finishedMs === null || !hash || savedFor.current === `${hash}:${finishedMs}`) return;
    savedFor.current = `${hash}:${finishedMs}`;
    const duration = Math.round(finishedMs);
    const trace = buildGhostTrace(raw.current, duration);
    if (!trace) return;
    void (async () => {
      try {
        await ensureSession();
        const res = await api.savePracticeGhost(hash, GHOST_RULES_VERSION, duration, trace);
        setSaveNote(res.saved ? 'New best lap saved as your ghost.' : `Your ghost is still faster (${(res.best_ms / 1000).toFixed(1)}s).`);
      } catch {
        setSaveNote("This lap couldn't be saved as a ghost. Your practice still counts.");
      }
    })();
  }, [finishedMs, hash]);

  const restart = useCallback(() => {
    reset();
    setStartedAt(null);
    setFinishedMs(null);
    setSaveNote(null);
    raw.current = [];
    // Reload the ghost: the lap just finished may be the new one.
    setGhostReload((n) => n + 1);
    inputRef.current?.focus();
  }, [reset]);

  const you = Math.min(1, correct / total);
  const ghostProgress = ghost.kind === 'ready' ? (ghostAt(ghost.trace, elapsed) ?? 0) : null;
  const milestone = you >= 1 || finishedMs !== null ? 'Finish' : you >= 0.5 ? 'Halfway' : startedAt !== null ? 'Start' : null;
  const vehicle = useMemo(() => {
    const saved = loadBuild();
    return saved ? { ...saved.build, primary: saved.primary } : { model: 'supercar' as const, primary: '#b9f46a' };
  }, []);

  return (
    <section className="practice-section" id="practice" aria-label="Practice lap">
      <div className="practice-heading">
        <SectionTitle
          eyebrow={source.kind === 'drill' ? 'FOCUSED DRILL' : 'PERSONAL GHOST / SOLO PRACTICE'}
          title={source.kind === 'drill' ? source.label : 'Practice lap'}
          aside={
            <div className="g-row">
              <Button variant="ghost" icon="refresh" onClick={restart}>Restart lap</Button>
              <Button
                variant="secondary"
                icon="arrow"
                onClick={() => setSource((s) => ({ kind: 'passage', index: s.kind === 'passage' ? (s.index + 1) % PRACTICE_PASSAGES.length : 0 }))}
              >
                {source.kind === 'drill' ? 'Back to passages' : 'New passage'}
              </Button>
            </div>
          }
        />
        <p className="g-muted">
          Race your own best lap. The blue car is your fastest finish of this exact text, replayed from its saved timings, not a fixed speed.
        </p>
      </div>

      {offered !== null && (
        <form
          className="g-panel x-panel x-drill-offer"
          onSubmit={(e) => {
            e.preventDefault();
            const text = offered.trim();
            if (text) setSource({ kind: 'drill', id: 'debrief', label: 'Your problem words', text });
            setOffered(null);
          }}
        >
          <span className="g-eyebrow">FROM YOUR LAST RACE</span>
          <label className="x-field">
            Drill text (edit it if you like)
            <input className="g-input" value={offered} maxLength={300} onChange={(e) => setOffered(e.target.value)} />
          </label>
          <div className="g-row">
            <Button type="submit" icon="arrow">Start drill</Button>
            <Button type="button" variant="ghost" onClick={() => setOffered(null)}>Skip</Button>
          </div>
        </form>
      )}

      <div className="x-ghost-track" aria-label="Your lap against your ghost">
        <GhostLane label={source.kind === 'drill' ? 'YOU / DRILL' : 'YOU / LIVE PRACTICE'} progress={you} vehicle={vehicle} />
        {ghost.kind === 'ready' ? (
          <GhostLane label={`YOUR BEST LAP / ${(ghost.durationMs / 1000).toFixed(1)}s`} progress={ghostProgress ?? 0} vehicle={{ ...vehicle, primary: '#9fcaff' }} ghost />
        ) : (
          <div className="x-ghost-empty" role="note">
            {ghost.kind === 'loading'
              ? 'Looking for your saved lap…'
              : ghost.reason === 'error'
                ? "Couldn't load your saved lap. You can still practise."
                : 'No ghost for this text yet. Finish it once and your lap becomes the car to beat.'}
          </div>
        )}
      </div>

      <div className="practice-workspace">
        <Dashboard
          wpm={stats.netWpm}
          accuracy={stats.accuracy}
          mistakes={state.errors}
          timeLabel="TIME"
          timeMs={elapsed}
          progress={stats.progress}
          progressLabel="Passage complete"
          running={startedAt !== null && finishedMs === null}
        />
        <TypingPanel
          ref={inputRef}
          state={state}
          onKeyDown={(e) => {
            if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) play('key-click');
            onKeyDown(e);
          }}
        />
      </div>

      <div className="x-practice-foot">
        <div className="x-milestones" role="status" aria-label="Lap milestones">
          {(['Start', 'Halfway', 'Finish'] as const).map((m) => (
            <span key={m} className={milestone && ['Start', 'Halfway', 'Finish'].indexOf(m) <= ['Start', 'Halfway', 'Finish'].indexOf(milestone) ? 'is-done' : ''}>
              {m}
            </span>
          ))}
          {finishedMs !== null && (
            <strong>
              Lap {(finishedMs / 1000).toFixed(1)}s
              {ghost.kind === 'ready' &&
                (finishedMs < ghost.durationMs
                  ? ` · ${((ghost.durationMs - finishedMs) / 1000).toFixed(1)}s ahead of your ghost`
                  : ` · ${((finishedMs - ghost.durationMs) / 1000).toFixed(1)}s behind your ghost`)}
              {saveNote && ` · ${saveNote}`}
            </strong>
          )}
        </div>
        <div className="x-drills">
          <span className="g-eyebrow">FOCUSED PRACTICE</span>
          {DRILLS.map((d, i) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={source.kind === 'drill' && source.id === d.id}
              onClick={() => setSource({ kind: 'drill', id: d.id, label: d.label, text: d.text })}
            >
              <span>{String(i + 1).padStart(2, '0')}</span>
              <div>
                <strong>{d.label}</strong>
                <small>{d.hint}</small>
              </div>
            </button>
          ))}
          <p className="x-caption">Milestones are practice feedback only; they never award race trophies.</p>
          {ghost.kind === 'ready' && hash && (
            <button
              type="button"
              className="x-link"
              onClick={() =>
                void api
                  .deletePracticeGhost(hash, GHOST_RULES_VERSION)
                  .then(() => setGhost({ kind: 'none', reason: 'no-lap' }))
                  .catch(() => {})
              }
            >
              Delete saved lap for this text
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function GhostLane({ label, progress, vehicle, ghost = false }: { label: string; progress: number; vehicle: Parameters<typeof Car>[0]['vehicle']; ghost?: boolean }) {
  const p = Math.min(1, Math.max(0, progress));
  return (
    <div className={`x-ghost-lane ${ghost ? 'is-ghost' : ''}`}>
      <span>{label}</span>
      <div className="x-ghost-road" aria-label={`${ghost ? 'Ghost' : 'You'}: ${Math.round(p * 100)} percent`}>
        <div className="x-ghost-car" style={{ left: `${p * 100}%`, transform: `translateX(-${p * 100}%)` }}>
          <Car vehicle={vehicle} animation={p > 0 && p < 1 ? 'driving' : 'idle'} />
        </div>
        <div className="x-finish-line" />
      </div>
    </div>
  );
}
