import { forwardRef, useId, useMemo, type KeyboardEvent } from 'react';
import { correctPrefixLength, hasError, typedCorrectChars, type TypingState } from '@race/shared';

export type TypingVariant = 'standard' | 'coding' | 'shakespeare';
export type TypingPanelState = 'ready' | 'waiting' | 'error' | 'finished';

interface Props {
  state: TypingState;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  variant?: TypingVariant;
  waiting?: boolean;
}

const HEAD: Record<TypingVariant, string> = {
  standard: 'THE PASSAGE',
  coding: 'passage.js',
  shakespeare: 'ACT I · THE STARTING LINE',
};

/**
 * 09-typing panel styled by the kit, driven by the shared typing engine
 * (useTyping stays authoritative for corrections, counting and scoring).
 */
export const TypingPanel = forwardRef<HTMLInputElement, Props>(function TypingPanel(
  { state, onKeyDown, variant = 'standard', waiting = false },
  ref,
) {
  const id = useId();
  const passage = useMemo(() => state.words.join(' '), [state.words]);
  const chars = useMemo(() => Array.from(passage), [passage]);
  const error = hasError(state);
  const index = state.finished ? chars.length : typedCorrectChars(state);
  const status: TypingPanelState = state.finished ? 'finished' : waiting ? 'waiting' : error ? 'error' : 'ready';
  const label = {
    waiting: 'WAITING FOR GO',
    finished: 'PASSAGE COMPLETE',
    error: 'TRY THAT CHARACTER AGAIN',
    ready: 'READY TO TYPE',
  }[status];
  const wrong = state.input.length - correctPrefixLength(state);

  return (
    <section className={`g-typing g-typing--${variant}`}>
      <div className="g-typing-head">
        <span>{HEAD[variant]}</span>
        <span className="g-typing-state">{label}</span>
      </div>
      <div className="g-passage" aria-hidden="true">
        {chars.map((c, i) => (
          <span key={i} className={i < index ? 'typed' : i === index ? (error ? 'current error' : 'current') : 'upcoming'}>
            {c}
          </span>
        ))}
      </div>
      <label className="g-sr" htmlFor={id}>Type the passage</label>
      <p className="g-sr" id={`${id}-instructions`}>{passage}</p>
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
        disabled={waiting || state.finished}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        inputMode="text"
        placeholder={waiting ? 'Waiting for the start…' : state.finished ? 'You made it.' : 'Click here and start typing…'}
      />
      <div className="g-typing-foot">
        <span>Accuracy first. Speed follows.</span>
        <span className="g-type-feedback" role="status">
          {state.finished ? 'Finished' : error ? `Fix ${wrong === 1 ? 'the wrong character' : `${wrong} wrong characters`} with Backspace` : waiting ? 'Get ready' : ''}
        </span>
      </div>
    </section>
  );
});
