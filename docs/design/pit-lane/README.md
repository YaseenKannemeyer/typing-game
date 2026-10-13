# GRID: Pit Lane design plan

Status: **Phase 5 frontend implemented locally, awaiting Claude's integration review.** Homepage, shared foundations, race accessibility/delivery feedback, waiting room, garage, all 15 car models, voting and official results are redesigned. Created 11 October 2026; implementation status updated 13 October 2026. 258 tests, typecheck and build pass. The latest batch checks 125 voting/results layouts and native mock interactions. Phase 4's real multiplayer validation still needs a disposable database. Phase 6's remaining screens, physical phone keyboards and broader accessibility/performance acceptance remain open. See [latest frontend handoff](17-voting-results-frontend-handoff.md) for scope, evidence and Claude's review/Phase 6 brief.

**Direction: a NASCAR-led typing racer, with the clarity of a motorsport timing screen.** Asphalt, strong car silhouettes, large door numbers, yellow race-entry controls, restrained pit-lane graphics, and a quiet, highly readable typing surface.

The existing project has substantial functionality and useful artwork infrastructure. Its identity feels like a friendly illustrated driving club because its forest-green surfaces, soft vehicle geometry, countryside scenes, rounded containers, and repeated card layouts all reinforce that impression. Italic headings and checker strips cannot overcome those stronger signals.

## Read in this order

1. [Element-by-element audit](01-audit.md): evidence, strengths, problems, and decisions for the existing screens and components.
2. [Design specification](02-design-spec.md): visual system, layouts, responsive behavior, motion, asset requirements, and exact priorities.
3. [Implementation and Claude handoff](03-implementation-plan.md): ordered work packages, file ownership, integration contracts, acceptance checks, and a ready-to-paste Claude brief.
4. [Proposed tokens](tokens.json): machine-readable design values, not imported into the app.
5. [Claude's phase 0 handoff](04-phase0-handoff.md): preserved behavior, backend isolation, presentation contracts, and file ownership.
6. [Frontend foundation handoff](05-frontend-foundation-handoff.md): implemented changes, verification results, remaining checks, and the next Claude brief.
7. [Race extraction handoff](06-race-extraction-handoff.md): Race container / RaceView prop contract, dev fixture gallery URLs, and the input-focus regression test.
8. [Race frontend handoff](07-race-frontend-handoff.md): implemented race presentation, actual screenshots, 66 fixture layout checks, remaining acceptance work and the next Claude brief.
9. [Race integration review](08-race-integration-review.md): contract review of the new race view, pending-results car test, full fixture isolation (CSP, captcha), integration risks and the proposed typing-submission recovery batch.
10. [Race accessibility and next delivery handoff](09-race-accessibility-delivery-handoff.md): implemented accessibility fixes, 95 layout checks, actual zoom/comfort evidence, proposed delivery UI contract and waiting-room/garage extraction brief.
11. [Typing-submission recovery handoff](10-submission-recovery-handoff.md): useSubmitQueue (timeout, bounded final-lock retries, reason mapping), the delivery model field, delivery fixtures and queue regression tests.
12. [Waiting room and garage extraction handoff](11-waiting-room-garage-extraction-handoff.md): container/view split with byte-identical HTML, view-model contracts, mock-action fixtures and container tests.
13. [Delivery, waiting room and garage frontend handoff](12-delivery-waiting-room-garage-frontend-handoff.md): implemented presentation, 212 layout checks, laptop reconnect fit, preserved contracts and the next all-15-car artwork brief.
14. [Vehicle compatibility and anchor map](13-vehicle-compatibility-map.md): review of 12 (recovery-announcement fix, e2e-hook test, combined reconnect+retry fixture), then the read-only renderer contract, per-model anchors, consumers and test migration plan for the all-15-car redesign.
15. [Vehicle anchor tooling](14-vehicle-anchor-tooling.md): Chrome-measured VEHICLE_EXTENTS with `npm run check:vehicles -- --write`, the npm-test staleness check, and DOM-level Car contract tests.
16. [All-15-vehicle frontend handoff](15-all-vehicles-frontend-handoff.md): completed artwork, shared door/livery coordinates, synchronized motion, snapshots, geometry/browser verification and the voting/results extraction brief.
17. [Vehicle review and voting/results extraction](16-vehicle-review-voting-results-extraction.md): exact start/finish placement for all 15 cars, podium and livery review, VotingView/ResultsView contracts with byte-identical HTML, mock fixtures and container tests.
18. [Voting/results frontend handoff](17-voting-results-frontend-handoff.md): completed voting/closing/reveal, native-car Victory Lane, standings/awards/actions, 125 layout checks, preserved contracts and Claude's Phase 6 extraction brief.
19. [Voting/results review and account/profile extraction](18-voting-results-review-account-profile-extraction.md): vote-closing retry fix, real container→view flow tests, AccountView/ProfileView contracts with byte-identical HTML, mock fixtures, container tests and a known review-reload issue.

## Implemented previews

- [Redesigned voting at 1280×720](verification/voting-redesigned-1280.jpg)
- [Redesigned official results at 1280×720](verification/results-redesigned-1280.jpg)
- [Mobile winner and earned awards](verification/results-winner-redesigned-390.jpg)
- [Redesigned 15-car lineup](verification/vehicles-redesigned-1440.jpg)
- [Stock-car garage preview](verification/vehicles-stock-car-garage-1280.jpg)
- [Homepage at 1440×900](verification/home-1440.jpg)
- [Race at 1280×720](verification/race-1280.jpg)
- [Race at 390×844](verification/race-390.jpg)
- [Updated mobile GO state](verification/race-go-accessibility-390.jpg)
- [Countdown at 320px](verification/race-countdown-accessibility-320.jpg)
- [Waiting room at 1280×720](verification/waiting-room-1280.jpg)
- [Garage at 1280×720](verification/garage-1280.jpg)
- [Delivery retry at 1280×720](verification/race-delivery-1280.jpg)

These are screenshots of the current local implementation. The development fixture gallery is available at `/__fixtures`; it is excluded from production builds.

## Visual concepts

- [Homepage concept](concepts/home-concept.png)
- [Active-race concept](concepts/race-concept.png)

These are generated art-direction references using sample data. They are not screenshots of implemented work and are not final production assets. The written specification takes precedence over generated text, logos, measurements, and behavior.

Specific corrections before implementation:

- Retain GRID's existing mark and wordmark initially. The generated lettering is exploratory, not an approved logo replacement.
- Do not extract UI text, buttons, or inputs from these images. Build accessible HTML controls.
- The race concept makes Leave yellow; the implementation must make it a quiet secondary action. Yellow belongs to the local player and the principal action.
- The race concept is too tall to serve as a literal laptop layout and makes some supporting text too dim. Follow the 720px viewport budget and contrast requirements in the specification.
- Car positions, labels, WPM, accuracy, door numbers, and timing in the images are illustrative. Bind them to actual state; do not copy the apparent equal car positions or mismatched sample values.
- The cinematic homepage car establishes the desired silhouette and material quality. Gameplay needs lightweight, customizable, side-on artwork with consistent anchors, not a cropped photo of that car.
- The homepage's separate facts band repeats information. The final composition should state those facts once near entry.

## Decisions

| Topic | Proposed decision |
| --- | --- |
| Identity | NASCAR stock-car presence leads; timing and standings borrow motorsport broadcast discipline |
| Brand | Keep GRID and existing route/navigation names |
| Palette | Charcoal, off-white, signal yellow; semantic colors reserved for actual states |
| Typography | Barlow Condensed for display; existing Geist for UI and Geist Mono for passages/data |
| Cars | Lead with a convincing stock-car silhouette; preserve all existing models and cosmetic choices |
| Homepage | Integrated pit-lane illustration plus a clear race-entry ticket |
| Active race | Compact telemetry, small track, prominent stationary passage and input |
| Kits | Reuse renderers, behaviors, IDs, and assets selectively; consolidate presentation styling |
| ChatGPT | Design direction, frontend components, CSS, artwork direction, responsive and visual QA |
| Claude | State/data integration, backend contracts, multiplayer reliability, regression coverage |
| First implementation milestone | Homepage and active race at 1440×900, 1280×720, and 390×844 |

## Evidence and limits

The current homepage was inspected live at `http://127.0.0.1:5173/`, including its rendered appearance and accessibility tree. Current React/CSS source and the six local design-kit families were reviewed. Existing screenshots in `docs/screenshots/after/` were inspected for waiting room, garage, voting, race, results, account, profile, leaderboard, and trophies. Some of those screenshots predate the current source; the audit explicitly distinguishes those observations. The profile screenshots are named as mocked fixtures and are treated as such.

No fresh multiplayer session, account creation, production-data mutation, or end-to-end test was run for this design-only task. Mobile keyboard behavior, current authenticated screens, every transient state, and browser performance remain implementation verification items. Existing accessibility provisions were identified in source, not certified through an accessibility audit.

## External references

The original design synthesis here is informed by race information patterns, not a copy of another product's interface. NASCAR documents Race Center leaderboards, timelines, and driver comparison in its [official feature guide](https://support.nascar.com/724196-Navigation-Use-and-Features). Formula 1 describes live leaderboards, driver tracking, and race data on its [Live Timing page](https://www.formula1.com/en/timing/f1-live). These support the information priorities; the proposed colors, layouts, and art direction are our design decisions. Display-font reference: [Barlow Condensed](https://fonts.google.com/specimen/Barlow+Condensed).
