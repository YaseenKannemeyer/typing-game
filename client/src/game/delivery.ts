import type { TypingState } from '@race/shared';

/* Delivery state for the race's submission queue (game/useSubmitQueue.ts). Pure, no network. */

export type DeliveryStatus = 'synced' | 'sending' | 'retrying' | 'rejected' | 'late';

/**
 * Whether the server has confirmed this racer's locked lines. "Unsent" means not
 * acknowledged: a lost response looks the same as a lost request.
 */
export interface Delivery {
  status: DeliveryStatus;
  /** Locked lines (and, once time is up, the final line) the server has not acknowledged. */
  unsentLines: number;
}

/** What the queue knows about the server's acknowledgements. */
export interface DeliveryAck {
  /** The server's words_done, as last reported. */
  serverDone: number;
  /** An attempt failed since the last acknowledgement (stays set across retries: no flapping). */
  failed: boolean;
  /** Final outcomes: the server refused a line, or the race closed with lines unconfirmed. */
  terminal: 'rejected' | 'late' | null;
  /** Time is up and the current line's words still need locking in. */
  finalPending: boolean;
}

/** Locked lines the server hasn't acknowledged, plus the final line while it is pending. */
export function unsentLines(s: TypingState, serverDone: number, finalPending: boolean): number {
  let n = 0;
  for (let i = 0; i < s.lineIndex; i++) if (s.lines[i]!.end > serverDone) n++;
  return n + (finalPending ? 1 : 0);
}

export function deliveryOf(s: TypingState, ack: DeliveryAck): Delivery {
  const unsent = unsentLines(s, ack.serverDone, ack.finalPending);
  if (ack.terminal) return { status: ack.terminal, unsentLines: unsent };
  if (unsent === 0) return { status: 'synced', unsentLines: 0 };
  return { status: ack.failed ? 'retrying' : 'sending', unsentLines: unsent };
}
