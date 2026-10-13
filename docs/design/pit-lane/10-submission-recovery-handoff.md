# Typing-submission recovery handoff

From Claude (integration) to ChatGPT (frontend). 13 October 2026, branch `redesign`. Local and uncommitted; nothing was deployed. Implements the queue work proposed in [08](08-race-integration-review.md), using the delivery contract in [09](09-race-accessibility-delivery-handoff.md). Client only: no SQL, no server grace change, no production E2E or bots. ChatGPT's frontend files were not edited.

## What changed

| File | Change |
| --- | --- |
| `game/useSubmitQueue.ts` (new) | The submission queue, moved out of `Race.tsx`. Same order: locked lines first, then provisional progress; the same 1 s cadence and send-on-lock; the same payload dedupe. New: a request timeout, bounded final-lock retries, the reason mapping and the delivery state. |
| `game/delivery.ts` (new) | Pure types and functions: `Delivery`, `DeliveryStatus`, `DeliveryAck`, `unsentLines()`, `deliveryOf()`. No network imports, so fixtures and types can use it. |
| `lib/api.ts` | `submitTyping(..., signal?)`: an optional `AbortSignal`, passed to the RPC's `.abortSignal()`. Other calls are unchanged. |
| `screens/Race.tsx` | Uses the hook. Its own `finalizeRace` call waits while the final lines are in flight, capped at one request timeout. Fills `model.delivery`. |
| `components/race/raceViewModel.ts` | `delivery: Delivery \| null` (null for spectators), with the semantics documented on the field. |
| `dev/fixtures/race.ts`, `dev/Fixtures.tsx` | A delivery value on every racer fixture (default `synced`), 8 new delivery cases, and a scripted recovery sequence. |

### Behavior

- **Timeout:** each submit is abandoned after `SUBMIT_TIMEOUT_MS = 4000` and the request is aborted, so a hung call frees the queue. A late answer to an abandoned request is ignored. The next attempt starts from the server's position, and `out_of_sync` resyncs it.
- **Final lock:** at time-up the current line is locked in, retried every `FINAL_RETRY_MS = 400` until it is acknowledged, the server gives a final answer, or the local finalization deadline passes (`end_at + RACE_END_GRACE_MS`, as before). After the deadline with lines still unconfirmed, the state becomes `late`. Retries are bounded: about 7 attempts in 2.5 s.
- **Reasons:**
  - `out_of_sync`: resend from the server's position in the same pass. If the server is already past the final line (a lost response), that counts as confirmed.
  - `mismatch` / `bad_counters`: `rejected` (sticky).
  - `race_over` / `race_not_active`: `late` when lines remain unconfirmed.
  - `too_fast`: the existing warning, unchanged; delivery shows `retrying`, because the server keeps accepting later submissions.
  - `not_started` and network errors: `retrying`.
- **No flapping:** `retrying` stays from the first failure until an acknowledgement or a final outcome. Individual attempts never switch it back to `sending`.
- **Unchanged:** server timing and results authority, the typing engine and input, the 1 s cadence, the order of submissions, and finalization by any client.

## Contract delivered (as specified in 09)

```ts
// game/delivery.ts, exposed as RaceViewModel.delivery
export type DeliveryStatus = 'synced' | 'sending' | 'retrying' | 'rejected' | 'late';
export interface Delivery { status: DeliveryStatus; unsentLines: number }
// RaceViewModel: delivery: Delivery | null   (null for spectators)
```

`unsentLines` = locked lines without an acknowledgement, **plus the final line once time is up** while it awaits confirmation. It never counts the line being typed during the race. `synced` always has 0. `late` always has at least 1 (it is only reached with lines outstanding). `rejected` may have 0 if a provisional submission was the one refused. Use 09's copy, keyed on `status` and `unsentLines`. The view must not run retry timers, call APIs or infer acknowledgements. Announce only transitions (into retrying, rejected or late, and back to synced from retrying), not counts.

## Fixture cases

`/__fixtures?case=<id>` (gallery) or `&frame=1` (single frame). Line counts come from the real `deliveryOf()` and the real typing engine.

| id | State |
| --- | --- |
| `race-delivery-sending-1` / `-sending-2` | `sending`, 1 / 2 lines (singular/plural) |
| `race-delivery-retrying` | `retrying`, 2 lines, mid-race |
| `race-delivery-recovery` | Cycles `retrying` (3) → `synced` every 3 s. The timer runs in the fixture frame, never in RaceView. Use it to check the recovery announcement. |
| `race-delivery-final-retry` | Time-up, `retrying`, 2 (one locked line plus the final line) |
| `race-delivery-rejected` | `rejected`, 1 |
| `race-delivery-late` / `-late-1` | Time-up, `late`, 3 / 1 |

All other racer fixtures report `{ status: 'synced', unsentLines: 0 }`. Spectating reports `null`.

## Verification

| Check | Result |
| --- | --- |
| `npm test` | **158/158 pass**, 19 files (143 before, plus 12 queue, 2 delivery fixture and 1 delivery/input tests) |
| `npm run typecheck`, `npm run build`, `git diff --check` | Pass |
| Queue tests (`game/useSubmitQueue.test.tsx`, fake timers, mocked API, a fake server enforcing `submit_typing`'s position check) | Locked line sending → synced; **hung request** aborted at 4 s, queue released, next tick resends; **repeated network blips** stay `retrying`, then recover; `out_of_sync` resync in one pass; `mismatch` → `rejected` (sticky); `too_fast` → warning callback and `retrying`; `race_not_active` → `late`; **final lock fails then succeeds** inside the window (no retries after); final lock **never confirmed** → `late` at the deadline with bounded attempts and nothing afterwards; unconfirmed locked lines sent before the final line; `out_of_sync` past the final line counts as confirmed; empty final line → `synced` |
| Mutation checks | Removing the timeout fails the hung-request test. Removing final retries fails both final-window tests. Restored byte-identical. |
| Focus tests | The real LobbyScreen → Race → RaceView container tests still pass. New: RaceView keeps the same, focused input through every racing delivery state. This guards your future delivery row. |
| Your accessibility tests | Pass unchanged (the fixtures now carry `delivery`) |
| Browser sweep, delivery cases + `race-p1` × 3 viewports | 27 layouts: CSP present, one input, live inputs focused, the engine responds, no overflow, **no off-origin requests** |
| Production E2E / bots / SQL | Not run, not changed |

## Known limits

- **The deadline is local.** It uses the race clock offset, as before. Another client finalizing early, or skewed clocks, end retries via `race_not_active` → `late`.
- **A lost response looks like a lost request** until the next answer arrives. The wording must stay about confirmation, as 09 says.
- **`rejected` has no recovery action.** There is no callback, by design.
- **Never exercised against a real backend.** A disposable Supabase environment is still needed for an end-to-end check.

## For ChatGPT

Add the delivery row described in 09, inside `.race-typing` after `TypingPanel`, using the fixtures above. Then recheck the 720px budget, the reconnect banner and large text. Run `npx vitest run client/src/screens client/src/components` after each change.
