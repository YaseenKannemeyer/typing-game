# Claude integration brief — GRID Race Experience Expansion

Integrate this presentation kit into the existing multiplayer typing-racing project. It adds Kits 26–29 and extends Kit 25; it does not replace the previous design system, vehicles, trophies or race logic. First inspect the actual repository and its local instructions. This kit was authored against the supplied folder structure, not a checked-out copy of the game.

## Start with the working project

Read the root and client package scripts, App.tsx, router.ts, index.css, components/{Car,Track,TypingPanel,StatsBar}.tsx, game/{types,useLobby,useTyping,useVehicleAnimation}.ts, art/{loadKit,vehicleArt,trophyArt}.ts, screens/{Race,Practice,Results,WaitingRoom,Voting}.tsx, and shared/src/{types,stats,typing,ranking,results,trophies,visibleCars}.ts plus their tests. Inspect existing account/profile code and Supabase migrations/functions wherever relevant.

Open `design-kits/race-experience-kit/OPEN-ME.html` to review the interaction design. The source-linked `index.html`, manifest and individual modules expose implementation details. Follow existing component conventions and routing. Avoid rewriting working networking, authentication, scoring or typing code for the showroom.

## Files and architecture

The browser-global `ExperienceKit` modules return SVG/HTML strings to keep this preview framework-neutral. Port the presentation into React components with typed props; do not mount the entire showroom as your app. Use ordinary escaped React text for player names and passages. Never inject arbitrary user-provided HTML or SVG.

`shared/experience.css` includes showroom-wide body and layout styles. Extract or scope the relevant component classes under an experience root rather than importing global resets over the production app. Reuse existing CSS tokens, vehicle renderer, motion hook and buttons. `vendor/` is an offline-preview dependency copy, not a second runtime to add to production.

`integration/contracts.d.ts` contains proposed view models. Adapt them to current shared types instead of creating competing definitions. These are design contracts, not implemented APIs. The sample JSON and showroom state are never authoritative.

Suggested production components: SpectatorScreen, BroadcastStandings, FeaturedRacer, WinnerReveal, RaceDebrief, RaceTimeline, DifficultWords, FirstRaceTutorial, TypingComfortPanel, GhostPractice, PracticeChallenges, ChampionshipHostPanel. Keep data adapters separate from rendering.

## Kit 26 — Spectator & Presentation

### UX

The broadcast displays four race lanes and all fifteen standings. A selected racer gets a featured card; selection does not change rankings. Unlike the racing player's existing four-car selector, a spectator does not require a local player. Establish a deliberate spectator lane policy (top four, or a featured-racer window) and test it independently. Preserve shared visibleCars behavior for actual racers.

Provide a presentation layout that hides navigation and increases key text. Fullscreen is optional and requires a user click; failure must leave the layout usable. Escape exits presentation layout. Scale to common projector/meeting resolutions, including 1280×720 and 1920×1080. On phones, stack the standings below the lanes. Include a keyboard-accessible way to choose the featured racer.

### Data and authority

Subscribe to a read-only server snapshot with race ID, monotonically increasing sequence, phase, official progress and official ranks. Use the existing synchronized clock; never show browser time as an official finish time. Drop out-of-order updates, retain the last snapshot during reconnect, and clearly mark delayed data. Interpolate only for display between accepted snapshots, and never extrapolate into an official finish or podium result.

Only show the winner reveal once an authoritative result names an eligible finisher. Do not infer the winner from animation positions or average WPM. Handle waiting, countdown, racing, cancelled, no finishers, DNF and flagged results. The static winner in the demo is fictional.

Spectators should not consume one of the fifteen racer seats unless that is an intentional existing rule. Joining a spectator route must not create a racing participant. Apply the project's visibility/authentication policy to private rooms. Stream only needed public race fields, not private account data or raw typing attempts.

### Performance

Use stable player IDs and update changed values. The showroom redraws a local sample snapshot periodically for clarity; production should reconcile React components without replacing a focused standings button. Keep connection status announcements sparse. Do not put every progress update in an aria-live region. Unsubscribe and cancel interpolation on unmount.

## Kit 27 — Race Debrief & Coaching

### Data required

Final verified average WPM, accuracy, mistakes and duration come from the existing result record. Timelines require stored interval statistics or reliable attempt events. Do not invent a smooth curve from only a final average. A missing timeline must retain the result summary and show the included empty state.

Keep the existing definition of a standard word (five correct characters including spaces/punctuation), attempts, incorrect attempts, active time and elapsed time. Windowed WPM is not interchangeable with whole-passage average WPM. Record window duration and timestamps explicitly. The example chart uses ten illustrative points; it is not a mathematical reconstruction of the example result.

Accuracy is correct attempts / all character attempts, including mistakes corrected later. Empty windows should have null values or a clearly labelled gap, not fabricated zero or perfect accuracy. Label units, scales and sample/window sizes. The demo accuracy axis is 90–100%; production should choose a sensible scale that includes all data and show its bounds. Do not silently clip low accuracy.

### Difficult words and comparison

Derive difficult words from passage offsets and incorrect attempts, not browser guesses or slow typing alone. Repeated words must retain distinct offsets before intentional aggregation. For Coding mode, consider tokens or spans rather than assuming space-separated words; preserve punctuation, case and indentation rules.

A personal-best comparison must use a documented comparable scope and the same scoring rules. Ideally compare the same passage/version for precise lap comparisons. If comparing same-mode bests across different passages, label that scope explicitly. A first race has no prior best; show a baseline message. Avoid claims about skill improvement from one sample alone.

The practice action should construct a drill from the verified difficult-word list and route to the existing Practice screen. Give it a clear label and allow the player to edit/skip it. Do not push users into another race automatically.

### Chart accessibility

Keep equivalent numeric data in a table or accessible summary. Use shape/labels as well as colour. Provide separate WPM and accuracy scales rather than overlaying ambiguous axes. Do not announce the full curve live during a race; coaching belongs after the result. Avoid heavy chart dependencies if the existing SVG pattern suffices.

## Kit 28 — First Race & Typing Comfort

Use the existing typing reducer and correction policy in production. The kit's local tutorial demonstrates strict correction: an incorrect character is visible, Backspace removes it, and the incorrect attempt remains counted. It does not define or change multiplayer typing rules. Backspace is an edit action, not a character attempt; clean-run eligibility still depends on the actual game rules.

Teach three small steps: focus the input, type/correct, then join the lobby. Let returning players skip the tutorial. Never require tutorial performance to unlock racing. Give a concise explanation of how mistakes are counted, using the same terms as live stats.

Keep a real, labelled input/textarea so mobile keyboards and assistive tools work. Do not implement typing solely with global keydown listeners. Check beforeinput, composition events, selection edits, backspace/delete, hardware and software keyboards. Avoid double-counting composition commits. The local ASCII tutorial is a demonstration; reuse the production Unicode/text unit policy and input tests.

Disable automatic capitalization, spelling suggestions and autocorrection where the platform permits. Do not claim those settings prevent all mobile text substitutions. Manage paste according to the existing policy; the showroom blocks paste only in practice inputs. Do not interfere with browser shortcuts or password managers elsewhere.

The passage remains readable when the keyboard opens. Use available viewport space without constant page jumps. Keep the active input visible and avoid stealing focus on live rerenders. The demo uses a visualViewport heuristic; test real iOS and Android devices before shipping. Preserve correct focus when the tutorial completes and when users close dialogs.

Persist font size, high contrast and reduced motion as local preferences, optionally sync to an account later. Respect OS reduced motion even when the local switch is off. These settings affect appearance only. Provide clear focus styles, readable contrast and non-colour mistake indicators. Never make a player prove speed or accuracy before using an accessibility preference.

## Kit 29 — Personal Ghost & Practice Challenges

### Recordings

A compatible ghost needs an owner ID, exact passage ID/hash/version, mode, scoring rules version, elapsed-time basis, duration and a validated progress trace. Compare only recordings with the same passage and rule set. Never substitute a different passage simply because average WPM is close. The demo JSON uses seconds; proposed production contracts use milliseconds. Convert explicitly and test the conversion.

A complete recording starts at zero elapsed/zero progress, has strictly increasing timestamps and nondecreasing correct progress within [0,1], and ends at completion. Reject malformed, incomplete, stale-version or incompatible traces. Store checkpoints compactly, bounded by server-defined limits. A ghost should not require retaining every raw keystroke.

Replay by interpolating saved progress checkpoints on the same elapsed-time basis as the practice attempt. Keep the ghost visually distinct and labelled. Do not replace its trace with a constant-speed car. Changing tabs, pausing, reconnecting or resuming must have defined clock behavior; never silently pause one competitor while the other continues. The showroom uses first input to completion and a monotonic local clock, including inactive elapsed time.

Recorded ghost performance is private to its owner by default. Enforce ownership at the database/API layer. Provide an appropriate deletion/retention path. If anonymous progress is converted into an account, preserve ownership through the project's existing migration flow. Do not make localStorage evidence for official scores.

### Practice

The local input shows progress only up to the first mismatch. Production must use the actual typing engine and count mistakes consistently. Challenges can focus on precision, punctuation or steady completion. Clearly state whether a target is completion, speed or accuracy. Example start/halfway/finish milestones are feedback, not multiplayer trophies.

When there is no ghost, provide a normal solo drill and a path to record a compatible lap. Do not block useful practice. Missing/invalid recordings have an explicit empty state. After a drill changes the passage, unload the old ghost. Never compare unrelated texts.

## Kit 25 extension — Championship Host

Extend the existing championship presentation instead of creating a second event model. The preview state reducer demonstrates setup → ready → racing → review → between → complete. It is not a trusted event controller.

Before enabling this feature, define and implement server-authorized transitions, revision checks, locked round order, resolved random modes, points policy, host replacement, disconnect/late-join rules, DNF/DQ treatment, cancellations, corrections and ties. The showroom uses a clearly illustrative points schedule; adopt an agreed policy in one canonical place. Tied preview scores remain tied, and no alphabetic sort may decide a real champion.

Only an authorized host can change setup. Freeze the configuration when the event starts. Show locked values during later rounds. Disable invalid actions in the UI and reject them on the server too. A lost connection should retain participant identity and the event state; reconnect must not create a new seat or re-award points. Provide a documented host decision for racers who do not return.

Commit a round using an official race ID and result, with an idempotency key and expected event revision. Enforce a unique committed race/round relationship in the database. Duplicate requests, repeated broadcasts, refreshed tabs or retries must return the existing commit, not add points again. Do not trust any points sent by the browser. Derive standings from accepted official results.

Revisions and outcomes should be auditable. A cancelled/invalid race must not produce a normal points commit. Do not advance to the next round just because a client animation finished. Announce the event winner only after the server finalizes all required rounds and applies the chosen tie policy.

The showroom shows four illustrative standings rows while the room capacity is fifteen. Production renders all participants and handles zero/one finisher and departures. The sample disconnect button is a local preview, not a real participant removal feature.

## Delivery order

1. Add the read-only spectator route and presentation layout, reusing live race subscriptions.
2. Add debrief summaries/charts only for data actually available; ship empty states for missing telemetry.
3. Add the first-race tutorial and local comfort preferences with the existing typing engine.
4. Add ghost storage/replay after data compatibility, ownership and recording rules are implemented.
5. Enable host transitions only after server event lifecycle and idempotent commits are verified.

Keep existing single races operational throughout. Gate unfinished backend-dependent features rather than displaying fictional official results.

## Acceptance checks

- Build/typecheck with current scripts; keep shared typing, ranking, stats and trophy tests passing.
- Spectator: 0–15 racers, no local racer, long names, featured off-screen racer, out-of-order updates, reconnect, cancellation and no eligible winner.
- Presentation: readable at 1280×720/1920×1080, fullscreen fallback, keyboard feature selection and no trapped focus.
- Debrief: missing/empty windows, zero attempts, repeated words, Coding tokens, no prior best, null timeline and correctly labelled scales.
- Tutorial: errors remain counted after correction; backspace/delete; composition; paste policy; mobile keyboard; reduced motion; storage unavailable.
- Ghost: sample interpolation boundaries, invalid/nonmonotonic traces, passage mismatch, version mismatch, owner access, elapsed units, reset and unmount cleanup.
- Host: unauthorized calls, stale revision, duplicate commits, reconnect, host departure, cancellation, tied standings and exactly one round advance.

Inspect the actual integrated application in a browser and complete a multiplayer race before declaring it finished. Report changed files, validation run, and any data/backend work that remains.
