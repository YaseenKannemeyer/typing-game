import { useEffect, useRef, useState } from 'react';
import { computeStats, passageLength, typedCorrectChars } from '@race/shared';
import { Hud } from '../components/race/Hud';
import { TypingPanel } from '../components/TypingPanel';
import { Button, SectionTitle } from '../components/ui';
import { PRACTICE_PASSAGES } from '../game/practicePassages';
import { useSound } from '../game/sound';
import { useTyping } from '../game/useTyping';

export function Practice() {
  const [index, setIndex] = useState(0);
  const passage = PRACTICE_PASSAGES[index]!;
  const { state, onKeyDown } = useTyping(passage, true);
  const { play } = useSound();
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setStartedAt(null), [passage]);
  useEffect(() => {
    if (startedAt === null && state.keystrokes > 0) setStartedAt(Date.now());
  }, [state.keystrokes, startedAt]);
  useEffect(() => {
    if (startedAt === null || state.finished) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [startedAt, state.finished]);

  const elapsed = startedAt ? Math.max(0, now - startedAt) : 0;
  const stats = computeStats(
    {
      id: 'me', name: 'me', correctChars: typedCorrectChars(state), keystrokes: state.keystrokes,
      errors: state.errors, finishedMs: state.finished ? elapsed : null,
    },
    // Every correct word earns its characters plus a separator (Space or Enter).
    passageLength(state.words) + 1,
    elapsed,
  );

  return (
    <section className="g-stack">
      <SectionTitle
        eyebrow="Warm up"
        title="Practice lap"
        aside={
          <Button variant="secondary" icon="refresh" onClick={() => setIndex((i) => (i + 1) % PRACTICE_PASSAGES.length)}>
            New passage
          </Button>
        }
      />
      <Hud wpm={stats.netWpm} accuracy={stats.accuracy} mistakes={state.errors} elapsedMs={elapsed} progress={stats.progress} />
      <TypingPanel
        ref={inputRef}
        state={state}
        onKeyDown={(e) => {
          if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) play('key-click');
          onKeyDown(e);
        }}
      />
    </section>
  );
}
