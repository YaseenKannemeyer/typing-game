# Delivery, waiting room and garage frontend handoff

From ChatGPT (frontend) to Claude (integration). 13 October 2026. Responds to [10](10-submission-recovery-handoff.md) and [11](11-waiting-room-garage-extraction-handoff.md). Local and uncommitted; nothing deployed. Fixtures and mocks only. No SQL, production E2E, bots or real races.

## Implemented

### Race delivery feedback

`DeliveryStatus.tsx` renders the supplied delivery model after TypingPanel, inside the fixed `.race-typing` slot. It distinguishes received, sending, retrying, rejected and late states. Counts use singular/plural wording and mean unacknowledged lines, not proof that the server lost them. A rejected provisional submission with zero locked lines says “Typing submission rejected”.

The row reserves space below the input. Failures and recovery have a separate polite announcement; count changes, clock ticks, normal sends and retry attempts remain quiet. Its effect only updates announcement text in response to props. It has no timer, API call, queue operation or inferred acknowledgement. At time-up, retry copy changes to “Retrying your final locked lines.” The primary strip continues to say “Confirming results…” until official results arrive.

The reconnect banner initially pushed delivery text below a 720px laptop screen. A scoped layout at widths ≥768px and heights ≤800px now trims supporting spacing, hides the decorative kicker and uses shorter track lanes. Passage font size and the 48px input remain. At 1280×720, the default input ends at **590px**, or **646px with reconnect controls**. Delivery text ends at **651px / 707px** respectively. The reserved row's empty lower space can extend below the viewport; its visible text fits. Large text preferences may require vertical scrolling.

### Waiting room

`WaitingRoomView` uses a charcoal command strip with one room-code/copy control in the waiting-room content, the existing start-vote action and Open garage. The header/nav retains its room context. Guests, fewer than two racers, settings saving and start in progress keep their existing start restrictions. No ready-check gate was added.

The paddock is now an ordered list of actual entrants, with compact cars, names, You/Host markers and the existing connection/build-confirmation meaning. Entry numbers show join order, not race position. All 15 racers remain visible, including long names. One open-seat summary replaces repeated decorative empty bays. The shared legacy Paddock component was not changed.

Invite and spectator-copy actions, race settings, championship slot and Destination/Garage/How it works/Trophies tabs remain. The tabs section still owns `tabsRef`; Open garage still selects, scrolls and focuses the Garage tab. The Open garage button is omitted when there is no garage slot/seat.

### Garage

`GarageView` puts the selected-car service bay and native editor before the model collection in both DOM and visual order. Desktop places preview and editor beside each other; phones stack them. The selected number and model are readable outside the SVG. Current/draft/locked information accompanies the preview; confirmation and polite feedback stay next to the controls.

All four stations retain native fields and arrow-key focus. Paint targets are 44px, taken colors remain disabled, all 15 model choices remain, and locked editing remains disabled. The existing animation demonstration remains available as before; it does not change a saved build. Saved, unsaved, saving, error and browser-storage-unavailable messages retain their integration meanings.

**The car drawings themselves are unchanged.** This batch redesigns their presentation and editor. The full 15-car artwork redesign is explicitly scheduled below, within Phase 5.

## Files owned by ChatGPT in this batch

- `client/src/components/race/DeliveryStatus.tsx` (new)
- `client/src/components/race/RaceView.tsx`
- `client/src/components/race/RaceView.a11y.test.tsx`
- `client/src/components/lobby/WaitingRoomView.tsx`
- `client/src/components/garage/GarageView.tsx`
- `client/src/components/garage/GarageView.test.tsx` (new)
- `client/src/styles/studio.css` (scoped race/waiting/garage rules)
- This handoff, README, and the plan's explicit vehicle-art milestone.

No container, queue, API, server, database or fixture behavior changed. Garage confirmation ordering, optimistic room settings, state rollback and local/profile persistence remain in Claude's containers. Vehicle IDs, geometry, livery layers, normalization and animation rules are unchanged.

## Verification

| Check | Result |
| --- | --- |
| `npm test` | **181/181 pass**, 23 files (176 baseline plus 5 frontend contract tests) |
| Targeted screen/component tests after layout changes | **26/26 pass**, including input focus and pending-results car guards |
| `npm run typecheck`, `npm run build`, `git diff --check` | Pass |
| Production JS/HTML | No fixture route, dead endpoint, development title or sampled room/garage/delivery fixture IDs |
| New states | 23 room/garage + 8 delivery cases at 1440×900, 1280×720, 390×844, 320×844 and 768×1024: **155 layouts** |
| Existing race states | All 19 at 1440×900, 1280×720 and 390×844: **57 layouts** |
| Combined layout sweep | **212 layouts across 50 states**: no horizontal overflow, fixture CSP present throughout; live race inputs focused; one racer input, no spectator input; all garage collections have 15 models and the editor precedes the collection |
| Laptop delivery text | All 27 race/delivery cases at 1280×720 fit the delivery text within the viewport after the compact-layout change |
| Browser interactions | Model edit → draft → saving → saved; failed confirmation restores the enabled action; station keyboard focus; native numbers 0/999; optimistic setting then rollback; Open garage selection/focus; visible start-vote error; real typing and focus preserved through scripted delivery recovery |
| Comfort | At 390px with maximum 34px passage text, high contrast and reduced motion, coding text reflows with no horizontal overflow and the input remains focused. Original 22px/default contrast/default motion preferences restored. |
| Browser errors | None recorded |

The new tests check delivery announcement stability across changing counts and recovery, priority of official-result confirmation during final retry, rejected provisional-progress wording, garage confirmation-before-collection order, keyboard station selection/focus, taken-color and locked-edit restrictions. Existing container/queue tests remain green.

Evidence:

- [Measurements, seven interaction records and comfort check](verification/pit-room-garage-layouts.json)
- [Waiting room at 1280×720](verification/waiting-room-1280.jpg) and [390×844](verification/waiting-room-390.jpg)
- [Garage at 1280×720](verification/garage-1280.jpg) and [phone livery state](verification/garage-livery-390.jpg)
- [Delivery retry at 1280×720](verification/race-delivery-1280.jpg)
- [Reconnect controls with visible delivery feedback](verification/race-delivery-reconnecting-1280.jpg)
- [Maximum-size coding passage](verification/race-delivery-comfort-390.jpg)

The E2E hooks remain: `.w-parking-bay` contains each racer's name and the real car SVG/text; “The paddock”, “Open garage”, “Start mode vote”, “Confirm vehicle”, station labels, native field labels and race typing/countdown hooks remain. The production E2E script was not run.

## Current phase and next car-art batch

**Phase 5 frontend work has started.** Waiting-room and garage presentation are implemented. Phase 4's real multiplayer acceptance still needs a disposable test database. Phase 5 still includes all 15 car drawings, voting and results.

The next frontend art batch should cover the entire existing lineup, not just a hero image or one new model:

- Refine `classic` into the leading stock-car silhouette; retain the other 14 identities as racing versions of their existing vehicles.
- Give the lineup coherent proportions, sharper body panels, stronger door numbers, neutral glass/metal and more convincing wheels. Keep the models distinct, including the novelty vehicles.
- Preserve all 15 IDs and saved builds, number range 0–999, paint/accent, wheel/effect choices, teams, decals and driver lettering. Every vehicle remains equally fast.
- Keep gameplay artwork editable as SVG layers. Do not replace customizable models with flat bitmap cutouts or introduce a sixteenth model/API contract.
- Preserve or explicitly document the viewBox, ground, wheel, livery and finish anchors. Inspect the art at small track sizes as well as in the garage.

Before that frontend batch, Claude should provide a **read-only compatibility map** for `art/vehicleArt.ts`, `art/worldArt.ts`, `components/Car.tsx`, `game/vehicles.ts` and their tests. Identify model/wheel/ground/livery anchors, animation/data attributes, escaping/normalization rules, saved-build boundaries and byte-parity assertions against the legacy kit. The original kits remain archival references; replacing app artwork will intentionally require a documented update to art-specific parity expectations, not removal of compatibility/security coverage.

ChatGPT will own the new app artwork. Claude should flag integration constraints and check compatibility, without independently redesigning the cars. This is part of Phase 5 before it is marked complete.

## Remaining acceptance work

- No disposable backend exists yet, so queue recovery and the full room → vote → race → official results path still need real multiplayer testing.
- A combined reconnecting + delivery-retrying fixture would strengthen the next integration sweep; current fixtures exercise those states separately.
- Physical phone keyboards, screen-reader listening, fresh 200% zoom for these new views and performance profiling remain open. 09's actual-zoom evidence is historical evidence for the earlier race follow-up.
- Voting/results layouts and the full vehicle artwork still need implementation. Existing destination/championship artwork is retained.

## Ready-to-paste Claude brief

> Read `docs/design/pit-lane/12-delivery-waiting-room-garage-frontend-handoff.md`. ChatGPT has implemented delivery feedback plus WaitingRoomView/GarageView presentation. 181 tests, typecheck/build and 212 fixture layouts pass; original comfort settings are restored. Preserve the frontend files. Review the changes against your contracts in 10/11, especially focus, host restrictions, optimistic rollback, confirmation ordering, all 15 models and native fields. Add a combined reconnecting + delivery-retrying fixture if useful. Then produce the read-only vehicle-renderer compatibility/anchor map described in 12 so ChatGPT can redesign all 15 cars next. Do not redesign the art, change SQL, run production E2E/bots, commit or deploy.
