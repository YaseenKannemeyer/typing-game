import { useEffect, useRef, useState } from 'react';
import { accuracy } from '@race/shared';
import { Car } from '../components/Car';
import { TypingPanel } from '../components/TypingPanel';
import { Button, Page, PageTitle } from '../components/ui';
import { PASSAGE_PX, useComfort } from '../lib/comfort';
import { navigate } from '../lib/router';
import { markFirstLapDone } from '../lib/storage';
import { useTyping } from '../game/useTyping';

/* Kit 28: first race tutorial and typing comfort. The lap runs on the real
   typing engine, so mistakes are counted exactly as in a race. Nothing here
   is saved as a result, and none of it is required to race. */

const SENTENCE = 'Find your rhythm, then race.';

/** Where to go when done: a room the player was invited to, or home. */
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && /^\/r\/[A-Za-z0-9]{6}$/.test(next) ? next : '/';
}

export function FirstLap() {
  const { state, onKeyDown, reset } = useTyping(SENTENCE, true);
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const next = nextPath();
  const room = next === '/' ? null : next.slice(3);

  const step = state.finished ? 3 : state.keystrokes > 0 || focused ? 2 : 1;
  useEffect(() => {
    if (state.finished) markFirstLapDone();
  }, [state.finished]);

  const go = () => {
    markFirstLapDone();
    navigate(next);
  };
  const correct = Math.max(0, state.keystrokes - state.errors);

  return (
    <Page>
      <div className="x-first-lap g-stack">
        <div className="x-intro">
          <PageTitle
            eyebrow="YOUR FIRST LAP"
            title={
              <>
                Small steps. <span className="text-lime">Fast starts.</span>
              </>
            }
            lead="Type the sentence exactly. If a letter turns red, press Backspace and fix it. Fixed mistakes still count in your accuracy, just like in a race."
          />
          <div className="x-intro-car" aria-hidden="true">
            <Car vehicle={{ model: 'classic', primary: '#b9f46a', number: 1 }} animation={state.finished ? 'winner' : step === 2 ? 'driving' : 'idle'} />
          </div>
        </div>

        <div className="x-two-col">
          <section className="g-panel x-panel" aria-labelledby="lap-title">
            <h2 className="sr-only" id="lap-title">Tutorial lap</h2>
            <ol className="x-steps">
              <li className={step === 1 ? 'is-current' : step > 1 ? 'is-done' : ''}>
                <b>1</b>Click the typing box
              </li>
              <li className={step === 2 ? 'is-current' : step > 2 ? 'is-done' : ''}>
                <b>2</b>Type and correct
              </li>
              <li className={step === 3 ? 'is-current' : ''}>
                <b>3</b>Join a race
              </li>
            </ol>
            <div onFocus={() => setFocused(true)}>
              <TypingPanel ref={inputRef} state={state} onKeyDown={onKeyDown} doneLabel={state.finished ? 'LAP COMPLETE' : undefined} />
            </div>
            <div className="x-stats" aria-live="polite">
              <div className="x-stat">
                <span>Correct attempts</span>
                <strong>{correct}</strong>
              </div>
              <div className="x-stat">
                <span>Mistakes</span>
                <strong>{state.errors}</strong>
                <small>Counted even after you fix them</small>
              </div>
              <div className="x-stat">
                <span>Accuracy</span>
                <strong>{state.keystrokes ? `${accuracy(state.keystrokes, state.errors).toFixed(1)}%` : '—'}</strong>
              </div>
            </div>
            <p className="g-small g-muted" role="status">
              {state.finished
                ? 'Lap complete. You are ready to race. Nothing from this lap is saved.'
                : 'No timer and nothing saved. Space or Enter at the end of a line locks it in, just like a race.'}
            </p>
            <div className="g-row">
              <Button icon="arrow" onClick={go}>{room ? `Join room ${room}` : state.finished ? 'Find a race' : 'Skip to racing'}</Button>
              <Button
                variant="secondary"
                icon="refresh"
                onClick={() => {
                  reset();
                  inputRef.current?.focus();
                }}
              >
                Try again
              </Button>
            </div>
          </section>

          <ComfortPanel />
        </div>
      </div>
    </Page>
  );
}

/** Typing comfort settings: appearance only, saved on this device. */
export function ComfortPanel() {
  const [prefs, save] = useComfort();
  const [stored, setStored] = useState(true);
  const set = (patch: Partial<typeof prefs>) => setStored(save({ ...prefs, ...patch }));
  const size = prefs.passagePx ?? PASSAGE_PX.default;
  return (
    <aside className="g-panel x-panel x-comfort" aria-labelledby="comfort-title">
      <span className="g-eyebrow">YOUR COMFORT</span>
      <h2 className="g-heading" id="comfort-title">A setup that fits.</h2>
      <label className="x-field">
        <span className="g-between">
          Passage text size <output>{prefs.passagePx === null ? 'Default' : `${size}px`}</output>
        </span>
        <input
          type="range"
          min={PASSAGE_PX.min}
          max={PASSAGE_PX.max}
          value={size}
          onChange={(e) => set({ passagePx: Number(e.target.value) })}
        />
      </label>
      {prefs.passagePx !== null && (
        <button type="button" className="x-link" onClick={() => set({ passagePx: null })}>Reset to the default size</button>
      )}
      <label className="x-toggle">
        <span>
          <strong>High contrast</strong>
          <small>Brighter text and firmer outlines</small>
        </span>
        <input type="checkbox" checked={prefs.highContrast} onChange={(e) => set({ highContrast: e.target.checked })} />
      </label>
      <label className="x-toggle">
        <span>
          <strong>Reduce motion</strong>
          <small>Cars and transitions stay still. Your device setting is always respected too.</small>
        </span>
        <input type="checkbox" checked={prefs.reduceMotion} onChange={(e) => set({ reduceMotion: e.target.checked })} />
      </label>
      <div className="x-tip">
        <strong>On your phone?</strong>
        <p>The typing box stays under the text. Autocorrect and auto-capitals are switched off where your browser allows, but some keyboards may still substitute words.</p>
      </div>
      <p className="x-caption">
        {stored ? 'Saved on this device.' : "Your browser blocked storage, so these apply until you close the tab."} These settings never change scoring.
      </p>
    </aside>
  );
}
