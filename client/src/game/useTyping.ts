import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { backspace, createTypingState, lockLine, typeChar, type TypingState } from '@race/shared';

interface Options {
  /** Zero-mistake mode. */
  strict?: boolean;
  /** Time slice (0..SECTIONS-1) of a keystroke made now; 0 when untimed. */
  section?: () => number;
  /** Starting state (e.g. resumed after a reconnect); consulted when the text changes. */
  initial?: () => TypingState;
}

/** Wires the shared typing engine to an input's keyboard events. */
export function useTyping(text: string, enabled: boolean, { strict = false, section, initial }: Options = {}) {
  const fresh = () => initial?.() ?? createTypingState(text, strict);
  const [state, setState] = useState<TypingState>(fresh);
  const sectionRef = useRef(section);
  sectionRef.current = section;

  useEffect(() => {
    setState(fresh());
    // `initial` is only consulted when the text or mode changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, strict]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!enabled || !e.nativeEvent.isTrusted) return;
      const sec = sectionRef.current?.() ?? 0;
      if (e.key === 'Backspace') {
        e.preventDefault();
        setState(backspace);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setState((s) => lockLine(s, sec));
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setState((s) => typeChar(s, e.key, sec));
      }
    },
    [enabled],
  );

  return { state, onKeyDown };
}
