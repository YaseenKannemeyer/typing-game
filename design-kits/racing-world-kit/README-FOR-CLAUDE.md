# Claude integration brief — GRID Racing World

Implement this kit into the existing typing-racing project. First inspect actual source and local project instructions. This README is an integration contract, not evidence that the existing project was inspected or modified.

## Goal and visual direction

Make the game feel like a coherent racing venue: garage → paddock → circuit → finish venue → trophy cabinet. Preserve the current dark forest/charcoal surfaces, lime accents, readable typography, rounded controls and side-profile cartoon cars. Reuse the existing vehicle and trophy artwork. Keep the typing experience the visual and interaction priority during races.

## Inspect before editing

Read root and client package scripts, client/src/index.css, App.tsx, router.ts, the current art loaders, Car.tsx, Track.tsx, TypingPanel.tsx, StatsBar.tsx, components/garage/Garage.tsx, trophy components, useVehicleAnimation.ts, game/vehicles.ts, game/types.ts, useLobby.ts and useTyping.ts. Read the existing Home, LobbyScreen, WaitingRoom, Voting, Race, Practice and Results screens. Inspect shared/src/{types,ranking,visibleCars,stats,trophies,results}.ts, their tests, and relevant Supabase migrations/functions before touching their contracts.

Use existing scripts and dependencies. Do not replace working networking, authentication, typing validation, routing or scoring to fit the showroom. Do not copy sample people or outcomes into production data.

## Files and boundaries

Kit location: `design-kits/racing-world-kit/`. Open `OPEN-ME.html` for the intended interaction and `index.html` for source-linked review. `manifest.json` specifies dependency order. JavaScript exports attach to `WorldKit`; these are portable renderer examples, not React bindings.

Port reusable UI into `client/src/components/` and scoped CSS into `client/src/styles/`. Put chosen static SVGs in the established public/assets or import pipeline. Use `client/src/art/loadKit.ts` conventions if appropriate after inspecting them. Keep React state authoritative for UI; never inject the entire showroom or its sample controller into the application. Do not add duplicate copies of VehicleKit, TrophyKit, GridKit or the sound engine from vendor/.

Suggested component boundaries: WorkshopScene, GarageStations, CircuitScene, CircuitLane, PaddockBay, DestinationBackdrop, FinishVenue, DriverBadge, WpmGauge, RaceControlBanner, TrophyCabinet, ChampionshipSchedule. These are suggestions; follow established project naming.

## 16 — Workshop garage

Place the existing Garage controls around the physical workshop scene. Use the background-only SVG and the existing Car component as independently positioned layers; the composite SVG is a visual reference. Keep actual controls as semantic HTML outside decorative artwork. Expose paint, wheels and livery stations with visible labels and keyboard focus. Preserve current customization persistence and confirmations. All 15 existing models remain available. Garage number, colours and decals never alter speed or accuracy.

## 17 — Road and circuit

Use existing official progress, rankings and shared visibleCars selection. Show up to four racers, always including the local racer; handle first, second, last, and fewer-than-four boundary cases using the existing tested selector. Do not replace ranking logic with the showroom's simplified selection helper.

Layer destination, barrier, distance ruler, road and car. Position progress within a common start-to-finish range. The example frontBounds map normalizes each model's front bumper; compare it against the actual vehicle renderer before adopting. At progress 1 the visible bumper must reach the finish stripe, including unusually shaped kart, formula and rocket models. Verify at desktop and phone widths. Keep stable player-ID React keys during changes; animate transforms, not frequent layout reflow. Reconcile only changed player snapshots. A lane transition must not imply a change to official race progress.

Do not independently scroll the background as if progress were measured differently. Texture and distant scenery remain subdued. No motion on the passage. Use a reduced-motion path for both CSS and JS, and stop animations on unmount/background tabs.

## 18 — Paddock lobby

Wrap the existing roster in fifteen bays, with empty seats, car thumbnails, names, ready, host, online and local-player markers. Ready controls, join/leave, host transitions and starting permissions use current lobby APIs. Do not treat demo button state as authorization. Keep room-code copying and invite links connected to the current room. Mobile becomes a readable two-column roster rather than shrinking fifteen bays into one row.

## 19 — Destinations

Six cosmetic destinations include separate near/far layers and a complete scene. Mode and environment are distinct fields; do not change passage difficulty based on artwork. An optional suggested pairing is Easy/countryside, Medium/city, Hard/rain, Coding/neon, Shakespeare/coast, Random/any. That mapping is a proposal, not a game rule. If the whole room should see one environment, have the host choose it through validated existing lobby settings; otherwise keep a local cosmetic preference. Do not silently create gameplay modifiers for rain or dirt.

## 20 — Finish venue

Use only official top-three finishers in the podium. Display fewer vehicles when fewer players finish. DNF and flagged players remain clearly represented in the full results list. Keep actual time/WPM/accuracy/mistakes and exact trophy-earned statistics visible. Confetti and fanfare play once per result event and respect mute and reduced motion. Preserve rematch, new vote and lobby actions.

## 21 — Driver identity and liveries

Four invented teams are visual choices, not multiplayer team competition. Add optional team ID, decal ID, and driver label only if they fit the existing cosmetic schema. Validate IDs, number range 0–99, label length and colour formats at the persistence boundary. Render user text through React escaping; never accept arbitrary SVG/HTML or CSS. Resolve stable model and team IDs with safe defaults. Check every decal against all 15 car bodies; per-model anchor adjustments may be needed. Helmets are alternate identity artwork and never replace the actual car on track.

## 22 — Dashboard

Bind WPM, accuracy, mistakes, elapsed time, rank and progress to existing stats. Units must remain WPM, percent and seconds, never mph or fictional engine power. The gauge caps its needle at its displayed scale, while the number keeps the actual value. Announce meaningful status changes rather than every live WPM update. The local position stays visible even when other cars are off-screen. Keep the existing all-player mini-map if present.

## 23 — Race control

Show a brief unobtrusive board beside/above the track for verified lead changes, position gains, final stretch, result completion and confirmed personal bests. Never cover the typing passage or steal focus. Derive events from official snapshots and stable race/event IDs. Deduplicate over the race lifecycle, including reconnects; the demo controller only suppresses immediately repeated event IDs. Clear timers and subscriptions on unmount. Use a polite live region and limit announcement frequency. No reward should be granted by clicking a banner or by client-side event detection.

## 24 — Trophy cabinet

Connect TrophyCabinet to the existing TrophyRoom, TrophyIcon and AwardCard. Use the existing catalog and authoritative award records. Locked is a visual collection state, not proof of ineligibility. Display the exact verified statistic, race and earned date in details. Count unique earned trophy types separately from total awards. Keep Unstoppable as a cross-race achievement; do not recompute its streak in this UI. Preserve the existing criteria and tie-breakers. Participation can have multiple recipients even though most race trophies have one winner. The showroom's six earned trophies are fictional examples.

## 25 — Championship

This kit introduces presentation for a possible new feature; it does not implement that feature. Keep it hidden behind a feature flag until server support exists. The demo's three rounds and points [15,12,10,9,8,7,6,5,4,3,2,1,1,1,1] are illustrative, with DNF receiving zero. Never call demoStandings to award production points. Its alphabetical sample tie sort is not an official tie-breaker.

If implementing championships, first define event membership, host permissions, locked round order/modes/destinations, points policy, ties, DNF/DQ handling, late joins, disconnects, cancellation and event completion. Freeze rules when the event starts. Persist authoritative round results and commit each round idempotently; reconnect or replay must not duplicate points. Derive standings on the server from accepted race results. Add migrations and tests through the project's normal process. Present no champion until the event is officially complete. Ordinary single races must work without this feature.

## Accessibility, responsiveness and performance

Maintain visible focus, semantic buttons, labelled inputs and accessible dialogs with focus restoration. Colours supplement text labels. Decorative SVGs should be aria-hidden; meaningful graphics need one concise accessible name. Namespace SVG IDs when reusing assets in one DOM. Respect prefers-reduced-motion, mute by default and unlock sound only after an explicit user gesture. Avoid filters or constant repaint on every car; fifteen connected players must remain smooth. Stack panels on small screens and retain readable passage text. Keep overlays, scene assets and typography from intercepting typing input.

## Implementation order

1. Integrate garage and circuit backgrounds with current cars and state.
2. Add paddock bays and six environment choices.
3. Add finish venue, dashboard and race-control events.
4. Add optional livery identity and cabinet layout.
5. Implement championship UI only when its server contract is ready.

After each stage run relevant existing typecheck/build/tests. Add targeted tests only for changed selectors, cosmetic validation, event deduplication, alignment math or new championship logic. Preserve existing shared tests and trophy/stat invariants.

## Acceptance review

Verify all 15 models in lobby, garage, race and results; first/second/middle/last visibility; correct finish alignment; two players selecting the same model; 1–15 occupants; responsive desktop/tablet/phone layouts; keyboard-only garage and dialogs; reduced motion; sound off; race focus; reconnect; missing trophy data; DNF/flagged results; stale-event deduplication. Confirm no scene customization changes race performance. Inspect a full multiplayer race in a real browser before claiming integration complete.

Report which files changed, which checks ran, and which backend features remain unimplemented. The kit's static checks are not a substitute for real-browser and multiplayer verification.
