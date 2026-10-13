// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTypingState, typeChar, type TypingState } from '@race/shared';
import type { SubmitResult } from '../lib/api';

/*
 * The race's submission queue against a mocked API (no network): timeouts,
 * blips, final-lock retries inside the finalization window, resync and the
 * terminal outcomes, as reported through the delivery state.
 */

vi.mock('../lib/supabase', () => ({ supabase: null, requireSupabase: () => { throw new Error('no backend in tests'); } }));
vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  api: { submitTyping: vi.fn() },
}));

const { api } = await import('../lib/api');
const { FINAL_RETRY_MS, SUBMIT_TIMEOUT_MS, useSubmitQueue } = await import('./useSubmitQueue');
const submit = vi.mocked(api.submitTyping);

const TEXT = Array.from({ length: 40 }, () => 'steady hands win long races on the grid').join(' ');
const LINES = createTypingState(TEXT).lines;
/** Word index where line `n` starts (= words done once `n` lines are locked). */
const at = (n: number) => LINES[n]!.start;

/** The real engine with `n` lines locked (Space at the end of a line locks it), then `extra` typed. */
function typed(n: number, extra = ''): TypingState {
  let s = createTypingState(TEXT);
  for (const ch of TEXT.split(' ').slice(0, at(n)).join(' ') + (n > 0 ? ' ' : '') + extra) s = typeChar(s, ch);
  expect(s.lineIndex).toBe(n);
  return s;
}

const ok = (wordsDone: number): SubmitResult => ({ ok: true, words_done: wordsDone });
const no = (reason: SubmitResult['reason'], wordsDone: number): SubmitResult => ({ ok: false, reason, words_done: wordsDone });
const never = () => new Promise<SubmitResult>(() => {});
/** A held response: resolve it when the test is ready. */
function held() {
  let resolve!: (r: SubmitResult) => void;
  const promise = new Promise<SubmitResult>((r) => (resolve = r));
  return { promise, resolve };
}

/** Behaves like submit_typing's position check: locks advance words_done, anything else must start there. */
function fakeServer(start = 0) {
  let done = start;
  return async (_race: string, from: number, words: string[], lock: boolean) => {
    if (from !== done) return no('out_of_sync', done);
    if (lock) done = from + words.length;
    return ok(done);
  };
}
const blip = () => Promise.reject(new TypeError('Failed to fetch'));

type Props = Parameters<typeof useSubmitQueue>[0];
let result: ReturnType<typeof useSubmitQueue>;
let props: Props;
/** Every status rendered, in order (to catch flapping between renders). */
let history: string[] = [];
function Harness(p: Props) {
  result = useSubmitQueue(p);
  if (history.at(-1) !== result.delivery.status) history.push(result.delivery.status);
  return null;
}

let root: Root;
const render = (patch: Partial<Props> = {}) => {
  props = { ...props, ...patch };
  return act(() => root.render(<Harness {...props} />));
};
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const flush = () => act(() => vi.advanceTimersByTimeAsync(0));
const status = () => result.delivery;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  submit.mockReset();
  history = [];
  root = createRoot(document.createElement('div'));
  props = { raceId: 'race', typing: typed(0), wordsDone: 0, active: true, final: false, deadline: Date.now() + 60_000, onTooFast: vi.fn() };
});

afterEach(async () => {
  await act(() => root.unmount());
  vi.useRealTimers();
});

describe('submission queue', () => {
  it('sends a locked line at once and reports sending, then synced', async () => {
    let answer!: (r: SubmitResult) => void;
    submit.mockImplementationOnce(() => new Promise((r) => (answer = r)));
    await render({ typing: typed(1, 'stea') });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]!.slice(1, 4)).toEqual([0, TEXT.split(' ').slice(0, at(1)), true]);
    expect(status()).toEqual({ status: 'sending', unsentLines: 1 });
    await act(async () => answer(ok(at(1))));
    expect(status()).toEqual({ status: 'synced', unsentLines: 0 });
  });

  it('abandons a hung request after the timeout, aborts it, and retries', async () => {
    let signal: AbortSignal | undefined;
    const second = held();
    submit.mockImplementationOnce((...args) => {
      signal = args[5];
      return never();
    });
    submit.mockImplementationOnce(() => second.promise);
    submit.mockImplementation(fakeServer(at(1)));
    await render({ typing: typed(1) });
    await advance(1_000); // a tick while the request hangs: skipped, not queued behind it
    expect(submit).toHaveBeenCalledTimes(1);
    expect(status().status).toBe('sending');

    await advance(SUBMIT_TIMEOUT_MS - 1_000); // timed out; the same tick sends again
    expect(signal?.aborted).toBe(true);
    expect(submit).toHaveBeenCalledTimes(2);
    expect(status()).toEqual({ status: 'retrying', unsentLines: 1 });

    await act(async () => second.resolve(ok(at(1))));
    expect(status()).toEqual({ status: 'synced', unsentLines: 0 });
  });

  it('stays "retrying" across repeated failures (no flapping), then recovers', async () => {
    submit.mockImplementationOnce(blip).mockImplementationOnce(blip).mockImplementation(fakeServer());
    await render({ typing: typed(2) });
    await flush();
    expect(status()).toEqual({ status: 'retrying', unsentLines: 2 });
    const seen: string[] = [];
    for (let i = 0; i < 2; i++) {
      await advance(1_000);
      seen.push(status().status);
    }
    expect(seen).toEqual(['retrying', 'synced']);
  });

  it('stays "retrying" through partial acknowledgements until every line is confirmed', async () => {
    // Two lines outstanding; the first attempt fails, the next tick confirms them one at a time.
    // Each answer arrives after 50 ms, in its own task, as over a network: one render per answer.
    const server = fakeServer();
    submit.mockImplementationOnce(blip).mockImplementation((race, from, words, lock) => new Promise((r) => setTimeout(() => r(server(race, from, words, lock)), 50)));
    await render({ typing: typed(2) });
    await flush();
    await advance(1_000); // the tick sends line 1
    await advance(50); // line 1 confirmed, line 2 sent
    expect(status()).toEqual({ status: 'retrying', unsentLines: 1 });
    await advance(50); // line 2 confirmed
    expect(status()).toEqual({ status: 'synced', unsentLines: 0 });
    expect(history).toEqual(['sending', 'retrying', 'synced']);
  });

  it('resends from the server position on out_of_sync, in the same pass', async () => {
    // The server already has line 1 (an earlier response was lost); send line 2 from there.
    submit.mockImplementation(fakeServer(at(1)));
    await render({ typing: typed(2) });
    await flush();
    expect(submit.mock.calls.slice(0, 2).map((c) => c[1])).toEqual([0, at(1)]);
    expect(status()).toEqual({ status: 'synced', unsentLines: 0 });
  });

  it('marks a refused line as rejected, and keeps it', async () => {
    submit.mockResolvedValueOnce(no('mismatch', 0)).mockResolvedValue(ok(at(1)));
    await render({ typing: typed(1) });
    await flush();
    expect(status()).toEqual({ status: 'rejected', unsentLines: 1 });
    await advance(3_000);
    expect(status().status).toBe('rejected');
  });

  it('reports too_fast through the warning callback, not as a rejection', async () => {
    submit.mockResolvedValue(no('too_fast', 0));
    await render({ typing: typed(1) });
    await flush();
    expect(props.onTooFast).toHaveBeenCalled();
    expect(status()).toEqual({ status: 'retrying', unsentLines: 1 });
  });

  it('marks lines as late when the race has closed', async () => {
    submit.mockResolvedValue(no('race_not_active', 0));
    await render({ typing: typed(1) });
    await flush();
    expect(status()).toEqual({ status: 'late', unsentLines: 1 });
  });
});

describe('final lock at time-up', () => {
  const finalProps = (deadlineIn = 2_500): Partial<Props> => ({
    typing: typed(2, 'steady hands'),
    wordsDone: at(2),
    active: false,
    final: true,
    deadline: Date.now() + deadlineIn,
  });

  it('retries a failed final lock and confirms it inside the window', async () => {
    submit.mockImplementationOnce(blip).mockResolvedValue(ok(at(2) + 2));
    await render(finalProps());
    expect(result.pending).toBe(true);
    await flush();
    expect(status()).toEqual({ status: 'retrying', unsentLines: 1 });

    await advance(FINAL_RETRY_MS);
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]!.slice(1, 4)).toEqual([at(2), ['steady', 'hands'], true]);
    expect(status()).toEqual({ status: 'synced', unsentLines: 0 });
    expect(result.pending).toBe(false);
    await advance(5_000);
    expect(submit).toHaveBeenCalledTimes(2); // no retries once confirmed
  });

  it('stops at the finalization window and reports the line as late', async () => {
    submit.mockImplementation(blip);
    await render(finalProps(2_500));
    await advance(2_500 + FINAL_RETRY_MS);
    expect(status()).toEqual({ status: 'late', unsentLines: 1 });
    const calls = submit.mock.calls.length;
    expect(calls).toBeLessThanOrEqual(1 + Math.ceil(2_500 / FINAL_RETRY_MS));
    await advance(10_000);
    expect(submit).toHaveBeenCalledTimes(calls); // bounded: nothing after the window
  });

  it('sends unconfirmed locked lines before the final line', async () => {
    const first = held();
    submit.mockImplementationOnce(() => first.promise).mockImplementation(fakeServer(at(2)));
    await render({ ...finalProps(), wordsDone: at(1) });
    expect(status()).toEqual({ status: 'sending', unsentLines: 2 });
    await act(async () => first.resolve(ok(at(2))));
    await flush();
    expect(submit.mock.calls.map((c) => [c[1], c[3]])).toEqual([[at(1), true], [at(2), true]]);
    expect(status()).toEqual({ status: 'synced', unsentLines: 0 });
  });

  it('treats out_of_sync past the final line as already confirmed (a lost response)', async () => {
    submit.mockResolvedValue(no('out_of_sync', at(2) + 2));
    await render(finalProps());
    await flush();
    expect(status()).toEqual({ status: 'synced', unsentLines: 0 });
    await advance(3_000);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('has nothing to confirm when the current line is empty', async () => {
    submit.mockResolvedValue(ok(at(2)));
    await render({ ...finalProps(), typing: typed(2) });
    await flush();
    expect(status()).toEqual({ status: 'synced', unsentLines: 0 });
    expect(result.pending).toBe(false);
  });
});
