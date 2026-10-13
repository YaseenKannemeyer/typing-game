# Race accessibility follow-up and next integration handoff

From ChatGPT (frontend) to Claude (integration). 13 October 2026. Responds to [08](08-race-integration-review.md). Local and uncommitted; nothing deployed. All work used mocked data and the isolated development fixtures. No production E2E tests, bots or real races were run.

## Completed frontend work

The three presentation findings in 08 are addressed. The submission queue remains unchanged; its delivery contract below is a proposal for the next integration batch.

| Finding | Implemented change |
| --- | --- |
| Position announcement missing | A persistent, visually hidden, polite and atomic status region says “Position 2 of 4”. Only position/total text changes affect it. WPM and clock updates leave its text untouched. Spectators receive an empty region. |
| Phone reading order | Typing now precedes the track in the DOM, matching the phone presentation. Desktop CSS still places the track above the passage. The typing subtree has one fixed slot through every phase; viewport changes only change CSS order. |
| Countdown scrolls inside its strip | The gantry now has actual compact dimensions instead of a transformed, oversized layout box. Lights, legs and phase text fit the reserved strip. The decorative eyebrow is hidden on phones; countdown/GO text and the labelled lights remain. Red/green lights use semantic error/success colors, independent of the yellow brand accent. |

Changed frontend files:

- `client/src/components/race/RaceView.tsx`
- `client/src/styles/studio.css` (rules scoped to `.pit-race`)
- `client/src/components/race/RaceView.a11y.test.tsx` (new)

The new tests check that clock/WPM updates produce no mutations in the position announcement, a changed position updates the same region, and the input precedes the track in document order. Claude's container focus and pending-results car tests are unchanged and pass. No race hooks, API calls, queue logic, vehicle behavior or model types changed in this batch.

## Verification and evidence

| Check | Result |
| --- | --- |
| `npm test` | **143/143 pass**, 18 files |
| `npm run typecheck`, `npm run build`, `git diff --check` | Pass |
| Production bundle | No development fixture route, dead-endpoint, title or sample-case markers in emitted JS/HTML |
| Race fixture sweep | **19 cases × 5 sizes = 95 layouts**: 1440×900, 1280×720, 390×844, 320×844 and 768×1024 |
| Layout / reading order | No horizontal page overflow; no internal countdown overflow; typing precedes track in all racer cases |
| Input | One input per racer case; live inputs focused; countdown/time-up inputs disabled; no input for spectators |
| Fixture isolation | Fixture CSP present on all 95 pages. The local server also used a dead backend URL. No browser error log entries in the sweep. 08 remains the evidence for the broader network-blocking probes. |
| Actual Chrome 200% zoom | Countdown checked using Chrome's real zoom control, including a native-window layout at 360 CSS px wide. No horizontal page or countdown overflow; one input retained. Zoom restored to its original 100%. |
| Comfort settings | Coding passage checked at the maximum 34px setting with high contrast and reduced motion enabled on a 390px viewport. Long code wraps; real typing advances the engine; input remains focused; no horizontal overflow. Original comfort settings restored. |

Evidence:

- [All 95 measurements and coding comfort check](verification/race-accessibility-layouts.json)
- [Mobile GO state with semantic green lights](verification/race-go-accessibility-390.jpg)
- [320px countdown](verification/race-countdown-accessibility-320.jpg)
- [Actual 200% zoom countdown](verification/race-countdown-200-percent.jpg)
- [Maximum-size coding passage](verification/race-comfort-code-390.jpg)

Vertical scrolling is expected at larger text settings and zoom. These checks establish reflow and input behavior, not a promise that every race element fits above the fold at every preference. No VoiceOver/NVDA listening session, physical phone keyboard/IME check, multiplayer check or frame-rate profiling was performed.

## Next Claude batch: client-only submission recovery

Proceed with the staged queue work proposed in 08: extract the existing behavior into `game/useSubmitQueue.ts`, add a bounded request timeout, then add bounded final-lock retries and tests. Keep the existing server finalization/grace contract. A wider server grace period or SQL migration is outside this batch.

Expose this finished value through `RaceViewModel` after the queue work is in place:

```ts
delivery: {
  status: 'synced' | 'sending' | 'retrying' | 'rejected' | 'late';
  unsentLines: number;
} | null; // null for spectators
```

`unsentLines` counts **locked lines not yet acknowledged by the server**. It is not the current partially typed line or a measure of every keystroke being saved. A missing acknowledgement also does not prove the server lost the submission; the response may have been lost. Keep wording tied to confirmation.

### Proposed presentation

ChatGPT will implement the presentation after Claude provides the model and fixture states. No delivery UI or fabricated acknowledgement currently exists in RaceView.

| Status | Display copy | Treatment |
| --- | --- | --- |
| `synced` | “Locked lines received” | Quiet, muted text. Avoid “All progress saved”, which includes the unfinished line. |
| `sending` | “Sending 1 locked line…” / “Sending 2 locked lines…” | Quiet text; no per-attempt animation or live announcement. |
| `retrying` | “2 locked lines awaiting confirmation” | Amber marker plus “Keep typing. Retrying delivery.” while racing, or “Retrying your final locked lines.” at time-up. |
| `rejected` | “Line submission rejected” | Error marker and “A locked line could not be accepted. Official results may exclude it.” No retry action without an integration callback. |
| `late` | “Race closed · 2 locked lines unconfirmed” | Warning marker and “Official results may not include these lines.” For zero unconfirmed lines, omit the count clause. |

Use correct singular/plural copy. Do not claim that confirmed lines were lost, reset the input, stop the engine based on display state, or announce a final rank. Official results remain authoritative.

Reserve a compact delivery row **after TypingPanel, inside the existing `.race-typing` wrapper**, before the existing warning. Render the row in every racer state so status changes do not move/remount the input. Keep the primary “Confirming results…” strip, engine feedback and `too_fast` warning distinct. Recheck the 720px laptop budget, reconnect banner and large-text layouts when the row is implemented; adding height requires fresh measurements.

Use a separate polite status region for meaningful delivery transitions: retrying, rejected, late and recovery. Do not announce each line count, second, sending attempt or WPM change. Ideally `retrying` remains the visible state across retry attempts until acknowledgement or a terminal outcome, avoiding 400ms status flapping. The frontend must receive this state; it must not infer acknowledgements, run retry timers or call APIs.

### Integration checks and mocks

Preserve 08's reason mapping: `out_of_sync` resynchronizes, `mismatch`/`bad_counters` become rejected, and `race_over`/`race_not_active` become late when lines remain unacknowledged. A request timeout must release the queue. Final-lock retries should remain bounded by the existing finalization window; other clients may still finalize the race.

Add mocked tests for a hung request, a network blip, final-lock failure then success inside the window, resynchronization, terminal rejection and race closure. Keep the real LobbyScreen → Race → RaceView focus test green through delivery changes. Provide isolated gallery cases for sending, retrying during a race, final retry at time-up, recovery, rejected and late states, including multiple unconfirmed lines. Update every existing fixture model and the frontend accessibility test's fixture data as needed for the model addition. No production backend is needed for these checks.

## Following milestone: waiting room and garage

The current `WaitingRoom.tsx` and `Garage.tsx` still combine network/state behavior with presentation. They were reviewed but not edited. Prepare their display contracts and safe fixtures in a separate Claude batch after queue recovery; ChatGPT can then redesign their presentation without moving behavior.

### Waiting room design

Use a compact pit-wall command strip: room code and invite access, with the host's existing start-vote action clearly visible. Below it, the roster reads like a paddock entry list: car, name, you/host identity and existing connection/vehicle-confirmation state. Keep invitation/watch links and race settings clear and separate from the roster. Mobile puts primary room controls before supporting settings and garage content.

Preserve the existing start-voting/settings behavior, optimistic settings feedback, championship controls, room links, SectionTabs and garage scroll target. A confirmed vehicle is the existing readiness meaning; do not introduce a new everyone-ready start gate or new server state.

### Garage design

Use a charcoal service bay with the selected car and large door number, followed by the active editor. Put this preview/editor **before the full 15-model collection on phones** so selecting paint or a number does not require scrolling through the collection. Keep the four station tabs, native fields and their keyboard behavior. Place saved/draft/locked/busy/error feedback near the confirm action. All existing models, saved liveries, valid numbers and color restrictions remain available; all cars stay equally fast.

Preserve server-to-draft synchronization until editing, current vehicle preview, used-color filtering, tab arrow-key focus, and confirmation behavior. Today confirmation writes the car color, then vehicle, then local/profile data with its existing best-effort behavior. Presentation extraction must not silently change that sequence or invent atomic-save guarantees.

### Extraction ownership and fixture requirements

Claude owns the state/network containers and should extract unchanged-looking `WaitingRoomView` and `GarageView` components with finished models/actions or slots. Use distinct type filenames such as `waitingRoomViewModel.ts` and `garageViewModel.ts` to avoid the Mac case-insensitive filename collision encountered in 06. ChatGPT owns the new display components and scoped presentation CSS once the extraction handoff is complete.

Keep independent behavior extractions reviewable. Where callbacks expose actions, mocks must replace them on fixture pages; do not call production APIs to preview a state.

| Screen | Required safe fixture cases |
| --- | --- |
| Waiting room | 1/2/15 racers; long names; host and guest; reconnecting; settings saving/error; vehicle confirmed/unconfirmed; existing championship state |
| Garage | All 15 models; supported number boundaries including 0/999; taken colors; unsaved draft and saved state; vehicle locked; confirmation in progress/error; existing storage-failure behavior |

Use 08's existing isolated `/__fixtures` route and CSP. Once contracts and mocks are available, ChatGPT will implement both layouts, verify desktop/laptop/mobile states and return an integration handoff. No additional cinematic bitmap belongs in the frequently updating race view.

## Ready-to-paste Claude brief

> Read `docs/design/pit-lane/09-race-accessibility-delivery-handoff.md`. ChatGPT has addressed the position live region, mobile reading order and countdown reflow findings from 08. 143 tests, typecheck and build pass; 95 race layouts plus actual 200% zoom and maximum-text coding checks passed. Preserve these frontend edits. Implement the client-only typing-submission recovery batch from 08 using the delivery contract in 09, with mocked failure/recovery fixtures and regression tests. Keep server timing/results and the fixed typing input intact. Do not change SQL grace periods, run production E2E/bots, commit or deploy. After handing back that batch, prepare the waiting-room and garage presentation extractions and isolated fixtures described in 09 as a separate batch.
