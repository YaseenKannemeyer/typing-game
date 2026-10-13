# All 15 vehicles: frontend artwork handoff

From ChatGPT (frontend) to Claude (integration). 13 October 2026. Responds to [13](13-vehicle-compatibility-map.md) and uses the tooling delivered in [14](14-vehicle-anchor-tooling.md). Local and uncommitted; nothing deployed. No SQL, production E2E, bots or real races.

## Completed artwork

**All 15 existing models have new app-owned SVG artwork.** The lineup keeps its identities and collection order; Classic Racer is the leading stock-car design. Cars face right and retain the 280×140 viewBox and y=124 wheel-ground line.

The visual changes replace the rounded bodies, large toy wheels, pale glass and rounded number badges with lower racing profiles, dark glass, roll-cage/window details, carbon sills, body-panel shading and metallic wheel designs. Door numbers are larger painted italic numerals with an outline; their light/dark treatment responds to the normalized body color. Three-digit numbers remain supported. Formula, kart, truck and novelty silhouettes stay distinct.

| Model | Artwork direction |
| --- | --- |
| Classic Racer | Stock-car body, low roof, rear spoiler, cage details, large door number |
| Formula Racer | Open wheels, halo/cockpit, sidepod, low front and rear wings |
| Muscle Car | Long hood, intake scoop, broad coupe, carbon sill |
| Supercar | Low GT body, dark canopy and side intake |
| Hypercar | Prototype wedge, wide aero surfaces and deep intake |
| Drift Car | Track coupe, tall rear wing and accent sill |
| Rally Car | Squared hatch, roof intake, cage and mudflaps |
| Monster Truck | Raised truck body, exposed cross-braced chassis, large dark tires |
| Pickup Truck | Racing pickup, bed rail, cab and low side skirt |
| Go-Kart | Compact sidepod, helmeted driver, exposed steering and small wheels |
| Vintage Racer | Rounded heritage roof/fenders with restrained metal trim |
| Cyberpunk Racer | Angular wedge, thin accent line and dark glass |
| Police Interceptor | Touring sedan, compact lightbar and contrast stripe |
| Taxi Racer | Racing sedan, smaller roof sign and checker belt |
| Rocket Racer | Land-speed-inspired streamliner, rear fin and pointed nose |

All three wheel choices were redrawn: five-spoke sport, vented aero disc and fine retro spokes. A centred enclosing rim circle keeps rotation centred. Smoke/trail/glow positions now follow wheelbase/model geometry more closely, including the kart.

Parked/idle cars remain still. Existing start, driving, acceleration, mistake, overtake, finish, winner and effect hooks/timings remain. The appended team decal and lettering are now wrapped in `.livery`, whose body-event animation matches `.chassis`; this fixes the floating-sticker quirk noted in 13 without changing Car.tsx or where it appends the markup. Reduced-motion overrides cover both groups.

## Compatibility retained

- The 15 IDs, display names and collection order are unchanged. No sixteenth model or migration.
- `normalizeVehicle`, escaping, DEFAULT_BUILD, saved-build fields and their allowed values are unchanged.
- Body/accent, number 0–999, all wheel/effect choices, stripes, teams, decals and sanitized driver lettering still work. Every car is equally fast; no scoring/state code was changed.
- Root SVG attributes, first-element/closing-tag conventions, `.chassis`, two `.rim` elements and all effect groups remain.
- Only `var(--primary)` and `var(--accent)` are used. Nested `worldCar` output resolves them. No ids, filters, gradients, images, external references or scripts were added.
- New door-number/decal/lettering coordinates live together in `VEHICLE_MARKINGS`. The livery uses the same registry and preserves a safe Classic fallback for an unknown direct-helper model value.
- Race time-up still renders no winner/finish celebration. Official podium composition retains its result-state behavior.

## Files and test migration

ChatGPT's changes:

- `client/src/art/vehicleArt.ts`: all geometry, details, wheels, number contrast, markings and model-relative effects.
- `client/src/art/worldArt.ts`: shared markings and animated livery wrapper; scenery/team/normalization code unchanged.
- `client/src/styles/vehicles.css`: stationary idle cars and synchronized livery motion; existing gameplay/effect hooks retained.
- `client/src/art/vehicleArt.test.ts`: identity/security checks retained; obsolete whole-art kit parity replaced with model invariants and approved-appearance snapshots.
- `client/src/art/worldArt.test.ts`: resolved-color checks and app-owned markings; independent kit scenery/venue composition retained with `kit.car = worldCar`.
- `client/src/art/__snapshots__/vehicleArt.test.ts.snap`: 15 snapshots, each containing the new base and decorated livery SVG (30 drawings).
- The **generated block only** in `client/src/art/vehicleAnchors.ts`, refreshed with Claude's `npm run check:vehicles -- --write` after the drawings stopped changing.

Claude's new checker, anchor lookup implementation, Car DOM tests, queues, containers, API adapters, fixtures and original design kits were preserved. The old kit artwork is archival; new artwork is intentionally not byte-identical to it. Normalization and escaping coverage were not removed.

The invariant matrix covers 15 models × 3 wheel styles × stripes on/off × numbers 0/7/42/999 × livery on/off: **720 combinations**. It checks root/closing tags, required hooks, variables, inert markup, real number/lettering text, two wheels on y=124, extents and a 6.5KB UTF-8 budget. A separate check covers all animation/effect attributes without changes to the inner drawing.

## Verification

| Check | Result |
| --- | --- |
| `npm test` | **230/230 pass**, 25 files, with the Chrome anchor test enabled |
| Targeted art/Car/focus/E2E-hook tests after final livery change | **65/65 pass** |
| `npm run typecheck`, `npm run build`, `git diff --check` | Pass |
| `npm run check:vehicles -- --write` | **180 variants measured in real Chrome**; generated anchors updated; no ground/viewBox/rim failures or off-centre-rim warnings |
| Production JS/HTML | No development fixture, dead endpoint or sampled test markers |
| Browser layout sweep | **18 cases × 5 sizes = 90 layouts**: 1440×900, 1280×720, 390×844, 320×844 and 768×1024 |
| Cases | Standalone all-model gallery, garage/customization/lock states, roster/garage tab, 2/15-racer races, GO, time-up, spectating and combined reconnect+delivery retry |
| Layout/isolation | No horizontal overflow, fixture CSP throughout, no browser errors; live inputs focused; no winner/finish car states in time-up cases |
| Full room + garage | 15 entrants + selected preview + 15 model cards = **31 cars**, no horizontal overflow |
| Native interactions | `bob<3!` sanitizes to `BOB3` next to number 999; aero wheels selectable; neon glow displays; preview winner has matching body/livery `hop`; phone typing advances correctly and stays focused |
| Markup size | Default undecorated cars **3,004–3,520 bytes**; largest sampled decorated variant **4,959 bytes**, including retro wheels, stripes, 999 and 12-character lettering |

Chrome measurement is a static-SVG check with no app server/backend. Browser interactions used the isolated fixture route and mock actions. The markup-size and bundling checks are not a frame-rate certification.

Evidence:

- [Implemented full lineup at 1440px](verification/vehicles-redesigned-1440.jpg)
- [Phone lineup](verification/vehicles-redesigned-390.jpg)
- [Stock-car preview in the garage](verification/vehicles-stock-car-garage-1280.jpg)
- [Three-digit number and livery](verification/vehicles-livery-999-1280.jpg)
- [Race at 1280×720](verification/vehicles-race-1280.jpg) and [390px](verification/vehicles-race-390.jpg)
- [Roster using the new art](verification/vehicles-roster-1280.jpg)
- [90 layout measurements and interaction records](verification/vehicle-art-verification.json)

## Current phase and next batch

The full car-art task in **Phase 5 is now implemented**. Waiting room and garage presentation are also implemented. Voting/results presentation remains in Phase 5; Phase 4's live multiplayer acceptance still needs a disposable database.

Claude should review the finished art against 13/14, especially start/finish placement, all customizations, nested podium cars, the shared anchors and the new `.livery` motion. The source is frozen for this handoff; future drawing changes must remeasure anchors and deliberately update snapshots.

For the next presentation batch, extract props-only `VotingView` and `ResultsView` with unchanged-looking placeholders and safe mock fixtures, following the Race/WaitingRoom/Garage approach. Keep timers, API calls, sounds, ranking, awards and championship commitment in the existing containers. `Results.tsx` currently requests/retries trophy awarding when mounted: do not mount it against production to make screenshots.

Minimum fixtures: voting empty/selected/change-vote/near-deadline/closing/error/tie/random reveal and host/guest states; official results with 1/2/3/15 entries, local winner/non-winner, tied stats, DNF/flagged, awards pending/earned, rematch busy/error, championship state and debrief slots. Preserve existing hooks and server authority. Presentation must not invent a winner or trophy while data is pending.

Performance profiling, physical phone keyboards, screen-reader listening and the real multiplayer journey remain acceptance work. Podium nesting/composition is tested in the art suite; its new full-screen fixture/browser review is part of the results batch.

## Ready-to-paste Claude brief

> Read `docs/design/pit-lane/15-all-vehicles-frontend-handoff.md`. All 15 cars are redesigned; 230 tests, typecheck/build, 180 measured geometry variants and 90 fixture layouts pass. The generated anchor table and base/livery snapshots are updated. Preserve ChatGPT's artwork files. Review compatibility and placement against 13/14, including nested podiums and synchronized livery motion. Then extract VotingView/ResultsView and isolated mock fixtures as described in 15, preserving timers, APIs, official rankings/awards, sounds, rematch and championship behavior in your containers. No SQL, production E2E/bots, commits or deployment.
