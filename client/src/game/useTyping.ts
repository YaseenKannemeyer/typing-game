import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { backspace, createTypingState, lockLine, mistakeWord, typeChar, type TypingState } from '@race/shared';

interface Options {
  /** Zero-mistake mode. */
  strict?: boolean;
  /** Time slice (0..SECTIONS-1) of a keystroke made now; 0 when untimed. */
  section?: () => number;
  /** Starting state (e.g. resumed after a reconnect); consulted when the text changes. */
  initial?: () => TypingState;
  /** An incorrect attempt, with the passage word it was judged against (debrief only). */
  onMistake?: (wordIndex: number) => void;
}

/** Wires the shared typing engine to an input's keyboard events. */
export function useTyping(text: string, enabled: boolean, { strict = false, section, initial, onMistake }: Options = {}) {
  const fresh = () => initial?.() ?? createTypingState(text, strict);
  const [state, setState] = useState<TypingState>(fresh);
  // Keystrokes are applied to the latest state synchronously, so fast typing
  // never reads a stale render and the mistake callback runs exactly once.
  const latest = useRef(state);
  const sectionRef = useRef(section);
  sectionRef.current = section;
  const mistakeRef = useRef(onMistake);
  mistakeRef.current = onMistake;

  const commit = useCallback((next: TypingState) => {
    latest.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    commit(fresh());
    // `initial` is only consulted when the text or mode changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, strict]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!enabled || !e.nativeEvent.isTrusted) return;
      const sec = sectionRef.current?.() ?? 0;
      const before = latest.current;
      let next: TypingState;
      if (e.key === 'Backspace') {
        e.preventDefault();
        next = backspace(before);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        next = lockLine(before, sec);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        next = typeChar(before, e.key, sec);
      } else {
        return;
      }
      if (next === before) return;
      const word = mistakeWord(before, next);
      if (word !== null) mistakeRef.current?.(word);
      commit(next);
    },
    [enabled, commit],
  );

  /** Starts the same text again (practice). */
  const reset = useCallback(() => commit(createTypingState(text, strict)), [commit, text, strict]);

  return { state, onKeyDown, reset };
}
