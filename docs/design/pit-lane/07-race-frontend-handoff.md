# Race frontend handoff

From ChatGPT (frontend) to Claude (integration). 13 October 2026. Local, uncommitted, and not deployed. Read this after [the extraction handoff](06-race-extraction-handoff.md); the behavior contracts in [phase 0](04-phase0-handoff.md) still apply.

## Outcome

The homepage and active-race presentation now implement the Pit Lane direction: asphalt, off-white text, signal yellow, condensed motorsport headings, a stock-car homepage, and compact race timing. This completes the presentation work for the first milestone. Live multiplayer acceptance and the remaining app screens are separate work packages.

The race uses numeric timing instead of the large speedometer. At 1280×720, passage, input, time, WPM and position fit together. On phones, passage/input precede the track. All racers remain available through a native disclosure below the typing area.

## This batch's files

| File | Change |
| --- | --- |
| `client/src/components/race/RaceView.tsx` | Props-only session header, numeric telemetry, compact lanes, reserved announcements, stable typing slot, full-grid disclosure and spectator presentation |
| `client/src/components/Track.tsx` | Optional `compact` presentation, defaulting to false; skips destination scenery in that mode; compact lanes describe position/WPM and suppress provisional winner/finish celebrations |
| `client/src/styles/studio.css` | Scoped race styles and responsive ordering; replaces the previous race overrides within the existing stylesheet |
| `docs/design/pit-lane/verification/` | Actual implementation screenshots and measurements from the 66 fixture layouts |

The earlier homepage/foundation changes are documented in [05](05-frontend-foundation-handoff.md). This batch does not change Race's container logic, the view-model contract, TypingPanel, the typing engine, submission/finalization, saved vehicle models/liveries, or Claude's fixture/test implementation. No fourth stylesheet was added.

## Contracts and presentation decisions

- **One input:** TypingPanel appears once in a fixed sibling slot. Countdown, race-control events, reconnecting and confirming results change the announcement slot. No breakpoint branches or changing keys wrap the input. Mobile ordering uses CSS and stays the same through every phase.
- **Server-owned values:** All timing, ranking and stats come from the model. There are no API calls, timers, local winner calculations or CSS countdown clocks in RaceView. Time is first in the telemetry row; WPM remains WPM.
- **Pending results:** The view says “Confirming results…” and “Waiting for the official results.” A compact Track also uses idle artwork when `car.finished` is true: the former P1 star celebration implied an official winner too early. The noncompact Track behavior is preserved for existing consumers.
- **Spectating:** No racer dashboard or typing input; a clock and next-grid explanation replace the personal stats. Announcement copy says to follow the live order.
- **Cars:** Existing vehicle rendering, front-bumper anchors, player keys, springs, reduced-motion behavior and progress placement are preserved. All 15 models still render. The homepage photo is editorial artwork, not a replacement for saved cars.
- **Passage:** The current engine line wraps naturally. Completed lines are hidden, and one upcoming line supplies context. Long current coding tokens are not clipped. Shakespeare keeps its serif passage style on the neutral surface. Native input attributes and typing handlers are unchanged.
- **Race-control space:** Reserved height is 42px on desktop and 60px on mobile, with overflow available for unusually long messages. Countdown and boards use this same slot so they do not push the input down.
- **Reconnect ownership:** LobbyScreen still places ConnectionBanner and owns Retry. RaceView's announcement points to those controls; it does not create a second Retry. CSS compacts the existing banner wrapper immediately before `.pit-race`, without changing ConnectionBanner's markup or behavior.
- **Full grid:** A native `details` disclosure appears when overflow exists. Opening it is a user action; no effect moves focus there. Fifteen focusable markers remain available. “TRACK END” describes the artwork endpoint; it is not a time limit or a completion target.
- **Selectors:** The typing label, `.g-type-input`, `.g-line.is-current`, `.g-countdown-frame`, and existing app/test hooks are retained. `.w-dashboard` remains on the numeric telemetry for the focus regression test. Unrelated screen hooks remain untouched.

## Verification

| Check | Result |
| --- | --- |
| `npm test` | 141/141 pass across 17 files, including Claude's two input identity/focus regression tests |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| `git diff --check` | Pass |
| Production fixture code | No fixture chunk or matches for the fixture route, gallery messages or fixture ids in production `dist` |
| Rendered fixture layouts | All 22 cases at 1440×900, 1280×720 and 390×844: no horizontal overflow |
| Race input state | All 18 racer cases have exactly one input at each size; live inputs are focused; countdown/time-up inputs are disabled; the spectator case has neither input nor personal telemetry |
| Laptop fit | Input bottom is 645px normally and 709px with reconnecting, within the 720px viewport |
| Phone fit | Input bottom is 564px normally, 566px in strict mode and 690px with reconnecting, within the 844px viewport; no initial page scroll in these race cases |
| Real typing | At 390px, trusted keystrokes advance `export function ` to the long next coding line; it wraps, focus remains on the input, and no sideways overflow appears |
| Expanded grid | At 1280px, disclosure opens, all 15 markers render, input count stays one, no horizontal overflow, neutral panel background |
| Homepage forms | At 390px, empty-name validation and invalid room-code feedback work; code feedback sets `aria-invalid`; a failed Create against the dead endpoint shows “Failed to fetch” and restores enabled controls |
| Browser error log | No error entries reported at the end of the fixture layout sweep |
| Production-connected E2E / bots | Not run |

The layout sweep used Chrome's browser connection with explicit viewport overrides and read-only measurements of the rendered DOM. It is distinct from Claude's earlier sweep of the old presentation. The dev server used a dead local Supabase address and an empty `VITE_TURNSTILE_SITE_KEY`; no production race was played. The tests cover dynamic input identity; frozen fixture layouts do not measure multiplayer cadence or performance.

Evidence:

- [Laptop race](verification/race-1280.jpg), [phone race](verification/race-390.jpg)
- [Desktop homepage](verification/home-1440.jpg), [phone homepage](verification/home-390.jpg)
- [Long coding line](verification/race-code-390.jpg), [Shakespeare](verification/race-shakespeare-390.jpg), [expanded full grid](verification/race-full-grid-1280.jpg)
- [66 layout measurements](verification/fixture-layouts.json)

## Remaining work

1. **Claude: integration review.** Review the container/view boundary and existing E2E selectors. Keep the input identity regression test. Add coverage for the pending race's car animation if appropriate: the existing no-winner wording assertion does not detect decorative winner stars.
2. **Claude: fixture polish.** The dev route currently gets the title “Page not found · GRID.” The gallery's long note can make its toolbar tall on a narrow browser window. These are dev-chrome issues; the direct frame layouts pass. Also account for CAPTCHA in isolation: `getCaptchaToken()` can insert an external Turnstile script, which the fetch/WebSocket guard does not intercept. This QA process explicitly disabled it; do not infer complete external-request isolation from those two guards alone.
3. **Shared acceptance:** Actual iOS/Android virtual keyboards, IME, comfort text/200% zoom, 320px and tablet stress checks, and a 10Hz performance profile remain open. The compact scene reduces decoration; no FPS improvement has been measured.
4. **Claude: multiplayer reliability.** Failed typing submissions still need a clear state and recovery behavior. The frontend warning slot can display a model warning, but the redesign does not repair the queue or delivery guarantees.
5. **Disposable backend:** Production-connected E2E, bots and real race flows remain gated on a throwaway Supabase environment. Do not use the production project for acceptance testing.
6. **ChatGPT: next frontend batch.** Waiting room, garage, voting, official results, standalone spectator view, practice, accounts and leaderboard need their planned presentation migration. The complete site has not yet been visually migrated; some existing surfaces still contain the old green styles.

## Ready-to-paste Claude brief

> Read `docs/design/pit-lane/07-race-frontend-handoff.md` and review the new RaceView/compact Track against your extraction contract. The homepage and race presentation are implemented locally; all 141 tests, typecheck and build pass, and all 66 fixture layouts have no horizontal overflow. Preserve ChatGPT's frontend files and the stable typing input. Review the pending-results car-animation guard and test hooks, fix fixture title/CAPTCHA-isolation issues in your owned files, and report integration risks plus the next typing-submission recovery batch. Use mocks/fixtures only. Do not run E2E or bots against production, commit, or deploy.
