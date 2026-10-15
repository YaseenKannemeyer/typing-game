import { forwardRef, useId, type KeyboardEvent, type ReactNode } from 'react';
import { canLock, hasError, lineWords, typedWords, type TypingState } from '@race/shared';

export type TypingVariant = 'standard' | 'coding' | 'shakespeare';
export type TypingPanelState = 'ready' | 'waiting' | 'error' | 'finished';

interface Props {
  state: TypingState;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  variant?: TypingVariant;
  waiting?: boolean;
  /** Race cockpit: current line and one look-ahead line, without old lines. */
  compact?: boolean;
  /** Shown instead of "finished" wording when the race clock has stopped. */
  doneLabel?: string;
}

const HEAD: Record<TypingVariant, string> = {
  standard: 'THE TEXT',
  coding: 'stream.js',
  shakespeare: 'ACT I · THE STARTING LINE',
};

/** Lines shown after the current one. */
const AHEAD = 3;

/**
 * One word of a line: typed characters are right (typed) or wrong (error),
 * extra characters past the word are wrong, and untyped ones are upcoming
 * (or missed, once the player has moved past the word).
 */
function Word({ target, typed, active, past, space }: { target: string; typed: string | null; active: boolean; past: boolean; space: boolean }) {
  const out: ReactNode[] = [];
  const t = typed ?? '';
  const len = Math.max(target.length, t.length);
  for (let i = 0; i < len; i++) {
    const want = target[i];
    const got = t[i];
    let cls: string;
    if (want === undefined) cls = 'error extra';
    else if (got === undefined) cls = active && i === t.length ? 'current' : past ? 'missed' : 'upcoming';
    else cls = got === want ? 'typed' : 'error';
    out.push(
      <span key={i} className={cls}>
        {want ?? got}
      </span>,
    );
  }
  if (space) {
    const cls = past ? 'typed' : active && t.length >= target.length ? 'current' : 'upcoming';
    out.push(
      <span key="sp" className={cls}>
        {' '}
      </span>,
    );
  }
  return <>{out}</>;
}

function Line({ targets, typed, active, past }: { targets: readonly string[]; typed: readonly string[] | null; active: boolean; past: boolean }) {
  const current = active && typed ? typed.length - 1 : -1;
  return (
    <div className={`g-line ${active ? 'is-current' : past ? 'is-locked' : ''}`}>
      {targets.map((w, k) => (
        <Word
          key={k}
          target={w}
          typed={typed ? (typed[k] ?? null) : past ? w : null}
          active={k === current}
          past={past || (active && k < current)}
          space={k < targets.length - 1}
        />
      ))}
      {active && current === targets.length - 1 && <span className="g-line-enter" aria-hidden="true">⏎</span>}
    </div>
  );
}

/**
 * 09-typing panel styled by the kit, driven by the shared line engine: the
 * current line is highlighted, mistakes stay red, Space or Enter at the end locks a line in.
 */
export const TypingPanel = forwardRef<HTMLInputElement, Props>(function TypingPanel(
  { state, onKeyDown, variant = 'standard', waiting = false, doneLabel, compact = false },
  ref,
) {
  const id = useId();
  const error = hasError(state);
  const done = state.finished || !!doneLabel;
  const typed = typedWords(state);
  const targets = lineWords(state);
  const onLastWord = typed.length === targets.length;
  const lockable = canLock(state);
  const blocked = state.strict && !lockable && onLastWord && typed[typed.length - 1] !== '';
  const status: TypingPanelState = done ? 'finished' : waiting ? 'waiting' : error ? 'error' : 'ready';
  const label = {
    waiting: 'WAITING FOR GO',
    finished: doneLabel ?? 'TEXT COMPLETE',
    error: state.strict ? 'ZERO MISTAKES · FIX THIS WORD' : 'MISTAKE · KEEP GOING OR FIX IT',
    ready: state.strict ? 'ZERO-MISTAKE MODE' : 'READY TO TYPE',
  }[status];

  const first = compact ? state.lineIndex : Math.max(0, state.lineIndex - 1);
  const shown = state.lines.slice(first, state.lineIndex + 1 + (compact ? 1 : AHEAD)).map((_, j) => first + j);
  const currentText = targets.join(' ');

  let feedback = '';
  if (done) feedback = doneLabel ?? 'Finished';
  else if (waiting) feedback = 'Get ready';
  else if (blocked) feedback = 'Fix the red words to move to the next line';
  else if (onLastWord && typed[typed.length - 1] !== '') feedback = 'Space or Enter locks in this line';
  else if (error) feedback = state.strict ? 'Fix this word with Backspace to move on' : 'Wrong letters stay red. Fix them with Backspace, or carry on';

  return (
    <section className={`g-typing g-typing--${variant}`}>
      <div className="g-typing-head">
        <span>{compact && variant === 'standard' ? 'TYPE THE CURRENT LINE' : HEAD[variant]}</span>
        <span className="g-typing-state">{label}</span>
      </div>
      <div className="g-passage g-lines" aria-hidden="true">
        {shown.map((i) => (
          <Line
            key={i}
            targets={lineWords(state, i)}
            typed={i < state.lineIndex ? (state.lockedTyped[i] ?? null) : i === state.lineIndex && !done ? typed : null}
            active={i === state.lineIndex && !done}
            past={i < state.lineIndex}
          />
        ))}
      </div>
      <label className="g-sr" htmlFor={id}>Type the current line</label>
      <p className="g-sr" id={`${id}-instructions`}>
        Current line: {currentText}. Press Space or Enter at the end of the line.
      </p>
      <input
        ref={ref}
        id={id}
        className="g-input g-type-input"
        aria-describedby={`${id}-instructions`}
        aria-invalid={error}
        value={state.input}
        onChange={() => {}}
        onKeyDown={onKeyDown}
        onPaste={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
        disabled={waiting || done}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        inputMode="text"
        enterKeyHint="enter"
        placeholder={waiting ? 'Waiting for the start…' : done ? (doneLabel ?? 'You made it.') : 'Type the highlighted line. Space at the end moves on…'}
      />
      <div className="g-typing-foot">
        <span>Space: next word or line · Backspace: fix · Enter: lock the line</span>
        <span className="g-type-feedback" role="status">{feedback}</span>
      </div>
    </section>
  );
});
