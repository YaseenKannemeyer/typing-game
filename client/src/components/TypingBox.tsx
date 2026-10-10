import { useEffect, useMemo, useRef, useState } from 'react';
import {
  backspace,
  computeStats,
  correctPrefixLength,
  createTypingState,
  passageLength,
  typeChar,
  typedCorrectChars,
} from '@race/shared';

interface Props {
  passage: string;
  onFinish?: () => void;
}

export function TypingBox({ passage, onFinish }: Props) {
  const [state, setState] = useState(() => createTypingState(passage));
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setState(createTypingState(passage));
    setStartedAt(null);
    inputRef.current?.focus();
  }, [passage]);

  useEffect(() => {
    if (startedAt === null || state.finished) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [startedAt, state.finished]);

  useEffect(() => {
    if (state.finished) onFinish?.();
  }, [state.finished, onFinish]);

  const total = passageLength(state.words);
  const stats = useMemo(
    () =>
      computeStats(
        {
          id: 'me',
          name: 'me',
          correctChars: typedCorrectChars(state),
          keystrokes: state.keystrokes,
          errors: state.errors,
          finishedMs: state.finished && startedAt ? now - startedAt : null,
        },
        total,
        startedAt ? now - startedAt : 0,
      ),
    [state, startedAt, now, total],
  );

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!e.nativeEvent.isTrusted) return;
    if (e.key === 'Backspace') {
      e.preventDefault();
      setState(backspace);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (startedAt === null) {
        setStartedAt(Date.now());
        setNow(Date.now());
      }
      setState((s) => typeChar(s, e.key));
    }
  };

  const done = state.words.slice(0, state.wordIndex).join(' ');
  const current = state.words[state.wordIndex] ?? '';
  const rest = state.words.slice(state.wordIndex + 1).join(' ');
  const good = Math.min(correctPrefixLength(state), current.length);
  const bad = state.input.length - correctPrefixLength(state);

  return (
    <div className="space-y-4">
      <p
        className="select-none rounded-lg bg-slate-800 p-4 font-mono text-lg leading-relaxed"
        onClick={() => inputRef.current?.focus()}
      >
        <span className="text-emerald-400">{done}{done && ' '}</span>
        <span className="underline decoration-2 underline-offset-4">
          <span className="text-emerald-400">{current.slice(0, good)}</span>
          <span className="bg-rose-600/70">{current.slice(good, good + bad)}</span>
          <span>{current.slice(good + bad)}</span>
        </span>
        <span className="text-slate-400"> {rest}</span>
      </p>

      <input
        ref={inputRef}
        value={state.input}
        onChange={() => {}}
        onKeyDown={handleKey}
        onPaste={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
        disabled={state.finished}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className={`w-full rounded-lg border-2 bg-slate-900 p-3 font-mono text-lg outline-none ${
          bad > 0 ? 'border-rose-500' : 'border-slate-600 focus:border-sky-500'
        }`}
        placeholder={state.finished ? 'Finished!' : 'Start typing…'}
      />

      <div className="flex gap-6 text-sm text-slate-300">
        <span>WPM <b className="text-white">{Math.round(stats.netWpm)}</b></span>
        <span>Accuracy <b className="text-white">{stats.accuracy.toFixed(1)}%</b></span>
        <span>Mistakes <b className="text-white">{state.errors}</b></span>
        <span>Progress <b className="text-white">{Math.round(stats.progress * 100)}%</b></span>
      </div>
    </div>
  );
}
