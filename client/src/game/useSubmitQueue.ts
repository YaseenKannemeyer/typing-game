import { useCallback, useEffect, useRef, useState } from 'react';
import { lineWords, lockedWords, PROGRESS_SUBMIT_MS, type TypingState } from '@race/shared';
import { api, lineSubmission, type SubmitResult } from '../lib/api';
import { deliveryOf, unsentLines, type DeliveryAck } from './delivery';

/** A submit that has not answered by now is abandoned (and aborted), so it can't hold the queue. */
export const SUBMIT_TIMEOUT_MS = 4_000;
/** Pause between attempts to lock in the final line once time is up. */
export const FINAL_RETRY_MS = 400;

function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ctrl.abort();
      reject(new Error('submit_timeout'));
    }, ms);
  });
  return Promise.race([run(ctrl.signal), timeout]).finally(() => clearTimeout(timer));
}

interface Options {
  raceId: string | undefined;
  /** The latest local typing state. */
  typing: TypingState;
  /** The server's words_done when the race screen opened (a rejoined race resumes there). */
  wordsDone: number;
  /** Racing: send on a cadence and as soon as a line locks. */
  active: boolean;
  /** Time is up: lock in the current line, retrying until `deadline`. */
  final: boolean;
  /** Local Date.now() after which final retries stop: other clients may finalize the race from then on. */
  deadline: number;
  /** The server refused a submission as impossibly fast. */
  onTooFast: () => void;
}

/**
 * The race's submission queue. Locked lines go first, in order; then the
 * current line's finished words are sent as provisional progress (re-scored
 * next time). When time runs out, everything typed on the current line is
 * locked in, with quick retries until the finalization window closes.
 */
export function useSubmitQueue({ raceId, typing, wordsDone, active, final, deadline, onTooFast }: Options) {
  const tsRef = useRef(typing);
  tsRef.current = typing;
  const deadlineRef = useRef(deadline);
  deadlineRef.current = deadline;
  const tooFastRef = useRef(onTooFast);
  tooFastRef.current = onTooFast;

  const serverDone = useRef(wordsDone);
  const lastSent = useRef('');
  const queue = useRef<Promise<void>>(Promise.resolve());
  const busy = useRef(false);
  const [ack, setAck] = useState<DeliveryAck>({ serverDone: wordsDone, failed: false, terminal: null, finalPending: false });
  const ackRef = useRef(ack);
  const update = useCallback((patch: Partial<DeliveryAck>) => {
    ackRef.current = { ...ackRef.current, ...patch };
    setAck(ackRef.current);
  }, []);

  const sync = useCallback(
    (isFinal: boolean) => {
      if (!raceId || (busy.current && !isFinal)) return queue.current;
      busy.current = true;
      queue.current = queue.current
        .then(async () => {
          for (let guard = 0; guard < 50; guard++) {
            const s = tsRef.current;
            let from: number;
            let words: string[];
            let lock: boolean;
            if (serverDone.current < lockedWords(s)) {
              const idx = s.lines.findIndex((l) => l.start === serverDone.current);
              const typed = idx >= 0 ? s.lockedTyped[idx] : null;
              if (!typed) return;
              from = serverDone.current;
              words = typed.slice(0, lineWords(s, idx).length);
              lock = true;
            } else {
              ({ from, words } = lineSubmission(s, isFinal));
              lock = isFinal && words.length > 0;
            }
            const key = `${from}|${lock}|${words.join(' ')}|${s.keystrokes}|${s.errors}|${s.deletions}`;
            if (key === lastSent.current) return;
            let res: SubmitResult;
            try {
              res = await withTimeout((signal) => api.submitTyping(raceId, from, words, lock, s, signal), SUBMIT_TIMEOUT_MS);
            } catch {
              // Network error or timeout: the next attempt resends from the server's position.
              update({ failed: true });
              return;
            }
            lastSent.current = key;
            serverDone.current = res.words_done;
            const finalLine = isFinal && lock && from === lockedWords(s);
            if (res.ok) {
              // After a failure, "retrying" holds until every outstanding line is confirmed,
              // so recovery is one transition (retrying → synced), not retrying → sending → synced.
              const finalPending = finalLine ? false : ackRef.current.finalPending;
              const caughtUp = unsentLines(tsRef.current, res.words_done, finalPending) === 0;
              update({ serverDone: res.words_done, finalPending, failed: ackRef.current.failed && !caughtUp });
              if (from === lockedWords(s)) return; // caught up: that was the current line
              continue;
            }
            update({ serverDone: res.words_done });
            switch (res.reason) {
              case 'out_of_sync':
                // Resend locked lines from where the server is; or the final line already arrived.
                if (serverDone.current < lockedWords(s)) continue;
                if (finalLine && serverDone.current >= from + words.length) update({ finalPending: false, failed: false });
                return;
              case 'mismatch':
              case 'bad_counters':
                update({ terminal: 'rejected' });
                return;
              case 'race_over':
              case 'race_not_active':
                if (unsentLines(s, res.words_done, ackRef.current.finalPending) > 0) update({ terminal: 'late' });
                return;
              case 'too_fast':
                tooFastRef.current();
                update({ failed: true });
                return;
              default:
                update({ failed: true });
                return;
            }
          }
        })
        .catch(() => {
          // Anything unexpected: keep the queue usable; the next attempt starts from the server's position.
          update({ failed: true });
        })
        .finally(() => {
          busy.current = false;
        });
      return queue.current;
    },
    [raceId, update],
  );

  // Racing: a steady cadence, plus an immediate send when a line locks (Enter / Space at the end).
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => void sync(false), PROGRESS_SUBMIT_MS);
    return () => clearInterval(t);
  }, [active, sync]);
  const locked = lockedWords(typing);
  useEffect(() => {
    if (active && locked > 0) void sync(false);
  }, [locked, active, sync]);

  // The final whistle: lock in the current line, retrying until it is confirmed,
  // the server gives a final answer, or the finalization window closes.
  const finalStarted = useRef<string | null>(null);
  useEffect(() => {
    if (!raceId || !final) return;
    if (finalStarted.current !== raceId) {
      finalStarted.current = raceId;
      update({ finalPending: lineSubmission(tsRef.current, true).words.length > 0 });
    }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = () => {
      if (stopped) return;
      void sync(true).then(() => {
        const a = ackRef.current;
        if (stopped || a.terminal || unsentLines(tsRef.current, a.serverDone, a.finalPending) === 0) return;
        if (Date.now() >= deadlineRef.current) {
          update({ terminal: 'late' });
          return;
        }
        // A retry with the same payload would be skipped as a duplicate: clear it.
        lastSent.current = '';
        timer = setTimeout(attempt, FINAL_RETRY_MS);
      });
    };
    attempt();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [raceId, final, sync, update]);

  const delivery = deliveryOf(typing, ack);
  return {
    delivery,
    /** Hold this client's own finalize call while its final lines are still in flight. */
    pending: final && (delivery.status === 'sending' || delivery.status === 'retrying'),
  };
}
