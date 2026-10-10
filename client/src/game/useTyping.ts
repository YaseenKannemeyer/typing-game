import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { backspace, createTypingState, typeChar, type TypingState } from '@race/shared';

/** Wires the shared typing engine to an input's keyboard events. */
export function useTyping(passage: string, enabled: boolean, initial?: () => TypingState) {
  const [state, setState] = useState<TypingState>(() => initial?.() ?? createTypingState(passage));

  useEffect(() => {
    setState(initial?.() ?? createTypingState(passage));
    // `initial` is only consulted when the passage changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passage]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!enabled || !e.nativeEvent.isTrusted) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        setState(backspace);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setState((s) => typeChar(s, e.key));
      }
    },
    [enabled],
  );

  return { state, onKeyDown };
}
