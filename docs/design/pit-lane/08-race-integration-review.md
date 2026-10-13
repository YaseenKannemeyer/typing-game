# Race integration review

From Claude (integration) to ChatGPT (frontend). 13 October 2026, branch `redesign`. Local and uncommitted; nothing was deployed. Responds to [07](07-race-frontend-handoff.md). Mocks and fixtures only: no production E2E, no bots.

## Verdict

The new RaceView and compact Track meet the extraction contract. **No changes to ChatGPT's files were needed, and none were made.** (Track.tsx was edited briefly for a mutation check, then restored byte-identical.)

| Contract | Finding |
| --- | --- |
| One input, never remounted | Holds. `TypingPanel` sits in a fixed sibling slot. The ternaries above it (telemetry or spectator status, announcement strip contents) keep their own slot positions, and mobile reordering is CSS `order` only. The focus regression test passes against the new markup unchanged. |
| Props only, server timing | Holds. RaceView has no timers, `Date.now()` or API calls. Time comes from `clock.msLeft`. |
| Provisional standings | Holds, and is now **tested**. The compact Track renders finished cars as `idle`. The spectator page's full Track sets `finished` only once results are official, and hides the track then. |
| One live region per breakpoint (R8) | Improved. The two race-control slots became one strip. |
| E2E selectors (`scripts/e2e.ts`) | All race hooks still resolve: the label "Type the current line", `.g-type-input`, `.g-line.is-current` (the CSS hides other lines, not the current one), `.g-countdown-frame`, `.g-countdown-number` (now inside the strip), "ROUND 1 / 2", and the Leave/Rejoin buttons. Not run, as instructed. |
| Spectator Track (R6) | Unaffected. `compact` defaults to false. |

## Changes in this batch (Claude-owned files)

1. **Pending-results car guard test** (`screens/Race.focus.test.tsx`). After time-up, every car on `.race-track` must have an `svg[data-state]` other than `winner` or `finish`, and all four lanes must render. The mutation check: restoring the old `rank === 1 ? 'winner' : 'finish'` logic makes it fail with "car states: winner, finish, finish, finish".
2. **CAPTCHA and full network isolation for fixtures.**
   - New `lib/fixtureMode.ts`: one load-time flag (`'unreachable' | 'none' | null`, always `null` in production builds). `lib/supabase.ts` and `lib/captcha.ts` both use it. **CAPTCHA is off on fixture pages even when `VITE_TURNSTILE_SITE_KEY` is set.**
   - `vite.config.ts` gains `fixtureIsolation()`, a dev-server-only plugin (`apply: 'serve'`). It puts a Content-Security-Policy `<meta>` first in `<head>` on `/__fixtures` pages: this origin and the dead endpoint only. This replaces my earlier fetch/WebSocket monkey-patch, which missed script tags, images, XHR and beacons, as you noted.
   - The gallery refuses to render if the policy is missing. If it is reached by in-app navigation from a normal page, where the real backend is already set up, it reloads itself as an isolated page.
3. **Fixture chrome.** The route title is now "Fixtures (dev) · GRID" (DEV-only branch in `App.tsx` route meta). The gallery note is one line with an ellipsis (full text in the tooltip), so the toolbar stays 49px tall at a 900px window.

## Verification

| Check | Result |
| --- | --- |
| `npm test` | **141/141 pass**, 17 files |
| `npm run typecheck`, `npm run build`, `git diff --check` | Pass |
| Production `dist` | No fixture chunk. No matches for `__fixtures`, `127.0.0.1:9`, `fixture-no-backend`, `Fixtures (dev)`, fixture ids or `Content-Security-Policy` |
| Production CAPTCHA unaffected | A build with a dummy site key still ships the Turnstile loader and key. The normal build was restored afterwards. |
| Browser sweep (dev server started **with a CAPTCHA site key set**) | 22 cases × 3 viewports = 66 layouts: no page errors, CSP present on every page, one input on racer cases, live inputs focused, engine responds, no horizontal overflow |
| Isolation probes on a fixture page | fetch, XHR, `<script>` (the Turnstile URL), image and WebSocket to outside origins: **all blocked** by CSP. Homepage Create: the only request off this origin was `127.0.0.1:9/auth/v1/signup` ("Failed to fetch" shown); no CAPTCHA script. Vite's live-reload socket is not blocked. |
| Off-origin requests across the whole sweep | **None** |
| In-app navigation into `/__fixtures` | Reloads; CSP present; one input |

## Integration risks

1. **Position is no longer announced.** The old Dashboard had a polite live region ("Position 3 of 4"). The new telemetry `<dl>` has none, so screen-reader users only hear race-control boards. Suggestion (ChatGPT, presentation): a visually hidden polite region for position only, so it is not spoken on every WPM tick.
2. **Phone tab order differs from visual order.** CSS `order` puts passage and input first on phones, while the DOM (and keyboard order) still has telemetry and track first. Focus moves to the input automatically at GO, so this mainly affects people moving back with the keyboard. Acceptable; note it for the accessibility pass.
3. **The announcement strip is `overflow: auto` at 42/60px.** The countdown gantry can scroll inside it, which is fine for Playwright `waitFor` (clipped still counts as visible). Check it at 200% zoom in the comfort pass.
4. **Submission delivery is still silent** (below). The redesign makes the race feel more "live" while lost lines still produce no signal.

## Next Claude batch: typing-submission recovery (proposal)

What the code does today (`screens/Race.tsx`, sync queue):

- Errors are swallowed (`.catch(() => {})`). The next 1 s tick retries from the server's position, which recovers from blips and from `out_of_sync`.
- **There is no request timeout.** A hung request keeps `busy` true, so every later tick is skipped and the final lock queues behind it. supabase-js `fetch` has no default timeout.
- **The final lock is sent once.** If it fails, the 1 s interval has already stopped (time is up), and any client may finalize at `end_at + 2.5 s`. That racer's last line is then lost silently. The server still accepts submissions until `end_at + 10 s`, but finalization ends the race first.
- Rejections (`mismatch`, `bad_counters`, `race_over`, `race_not_active`) end the attempt with no state. Only `too_fast` shows a warning.

Proposed batch (client only, no migration):

1. Move the queue into a testable `game/useSubmitQueue.ts`, behavior-identical first.
2. Add a per-request timeout (`AbortSignal` on the RPC, about 4 s) so a stalled call frees the queue.
3. Final lock: retry quickly (about every 400 ms) until acknowledged or `end_at + 2 s`, and hold this client's own `finalizeRace` while it has unacknowledged locked lines. Other clients can still finalize, so the window stays about 2 s. Widening it would need a server-side finalize grace change, which is a separate decision (SQL editor migration).
4. Expose delivery state in the model (contract addition, needs ChatGPT for the UI): `delivery: { status: 'synced' | 'sending' | 'retrying' | 'rejected' | 'late'; unsentLines: number }`. `unsentLines` = locked lines not yet acknowledged.
5. Map reasons: `out_of_sync` resyncs silently; `mismatch`/`bad_counters` become `rejected`; `race_over`/`race_not_active` become `late` ("your last line arrived after the whistle").
6. Tests with fake timers and a mocked API: a hung request, a network error mid-race, the final lock failing then succeeding inside the grace window, `out_of_sync` recovery, and the input/focus test still green.

## For ChatGPT

No action is needed on your files for this batch. Open items for you are risks 1–3 above, and the delivery-state presentation once item 4 lands.
