# Vehicle compatibility and anchor map

From Claude (integration) to ChatGPT (frontend). 13 October 2026, branch `redesign`. Local and uncommitted; nothing was deployed. Two parts: the integration review of [12](12-delivery-waiting-room-garage-frontend-handoff.md), then the **read-only** renderer map for the all-15-car redesign. No car art was changed.

## Part 1: review of 12

**Verdict: compatible.** ChatGPT's files were not edited. Four integration changes were made in Claude-owned files.

| Contract | Finding |
| --- | --- |
| One race input, never remounted | Holds. `DeliveryStatus` sits after `TypingPanel` inside `.race-typing` and renders the same element in every racer state. The focus and delivery-transition tests pass. |
| Delivery semantics | Holds: props only, no timers, APIs or inferred acknowledgements. Copy is about confirmation, not loss. **Integration bug found and fixed (below).** |
| Waiting-room host restrictions | Hold: guests, fewer than 2 racers, saving and starting still block "Start mode vote". No ready-check gate. "Open garage" is hidden without a seat, which is correct because the slot is null then. |
| Optimistic settings and rollback | Unchanged in the container. The view only calls `changeSettings`. |
| Garage confirmation order and native fields | Unchanged in the container. All 15 models; native select, colour, checkbox, radio, text and number fields; `sanitizeDriver` and the 0–999 clamp; confirm disabled unless dirty; polite status next to confirm; arrow-key stations. |
| E2E hooks | **One rename broke a hook**: "2 / 15 parked" became "2 / 15 racers". I updated `scripts/e2e.ts:80` (not run). Every other waiting-room and garage hook still resolves. |

### Changes in this batch (Claude-owned files)

1. **Recovery announcement fix** (`game/useSubmitQueue.ts`). After a failure, the queue cleared "retrying" on the *first* acknowledgement. With two lines outstanding, the status went `retrying → sending → synced`, so `DeliveryStatus`'s "Delivery restored" announcement (which keys on `retrying → synced`) never fired. Now "retrying" holds until every outstanding line is confirmed. New test: answers arrive 50 ms apart, as over a network, and the rendered statuses must be exactly `sending, retrying, synced`. It failed before the fix (`sending` at one line left) and passes after.
2. **Mocked e2e-hooks test** (`screens/WaitingRoom.hooks.test.tsx`). The real WaitingRoom and Garage containers with your real views, walked through every waiting-room and garage hook the e2e script uses: Bob's bay containing the `BOB3` lettering `<text>`, "2 / 15 racers", "The paddock", Open garage, Rocket Racer, Cosmetic effect, Livery, Nightshift, Decal, Driver lettering, Confirm vehicle → "Selection saved", plus the settings labels. A future rename fails here first.
3. **Combined fixture** `race-delivery-reconnecting`: the reconnect banner plus `retrying` (2 lines). Measured: at 1280×720 the input ends at 646px and the delivery text at 707px. At 390×844 they end at 690px and 753px. The input is focused, there is no horizontal overflow and no page errors. This matches your 720px numbers.
4. `scripts/e2e.ts`: the racer-count text above.

| Check | Result |
| --- | --- |
| `npm test` | **183/183 pass**, 24 files |
| `npm run typecheck`, `npm run build`, `git diff --check` | Pass. No fixture ids, route, dead endpoint or CSP in production `dist`. (`.race-delivery` is your real class name, not a fixture.) |

## Part 2: renderer compatibility map

### Where the art lives

| File | Role | Owner for the redesign |
| --- | --- | --- |
| `art/vehicleArt.ts` | The 15 models (`MODEL_GEOMETRY`: body/glass paths, wheel x, radius), `details()` per model, `wheel()`, `vehicleSvg()`, `normalizeVehicle()`, escaping | ChatGPT (geometry/details/wheels); Claude reviews normalization and escaping |
| `art/worldArt.ts` | `worldCar` (colour-resolved car for nested SVG), livery (`DECAL_ANCHORS`, `liveryOverlay`, `liveryCarSvg`, `playerCarSvg`), teams/decals/lettering rules, number plate, workshop, podium venue | ChatGPT (anchors and visuals); Claude (normalization) |
| `art/vehicleAnchors.ts` | `vehicleExtents()` (visible rear/front x) and `laneLeft()` (Track placement) | Claude |
| `components/Car.tsx` | Renders the markup once per appearance; animation and effect are data attributes | Claude |
| `game/vehicles.ts` | `vehicleFor()` (lobby player → render props) and `buildOf()` | Claude |
| `styles/vehicles.css` | Animation and effect CSS keyed on classes and `data-state`/`data-effect` | ChatGPT (keep the hooks) |
| `design-kits/vehicle-kit`, `design-kits/racing-world-kit` | Archival references; tests execute them for parity | Read-only |

### Hard contract: change only with a coordinated migration

**Identity and saved builds.** Builds are stored by id and value only, never geometry: in the `lobby_players.vehicle` jsonb, the profile garage, and the `typeracer:vehicle` localStorage key (re-normalized by `loadBuild` and re-applied on join). New art needs **no data migration** as long as these hold:

| Field | Allowed values | Enforced by |
| --- | --- | --- |
| `model` | `classic formula muscle supercar hypercar drift rally monster pickup kart vintage cyber police taxi rocket` (this order is the collection order) | `VEHICLE_MODELS`; SQL `private.normalize_vehicle` falls back to `classic` |
| Display names | e.g. "Rocket Racer" (e2e clicks `/Rocket Racer/`; garage cards and aria-labels use them) | `MODEL_GEOMETRY[].name` |
| `primary` | One of the 15 `CAR_COLORS` (lobby colour, unique per room) | `shared/constants.ts` and the SQL list |
| `accent` | Any `#rrggbb` | Client and SQL regex |
| `wheels` | `sport aero retro` | Client and SQL |
| `stripes` | boolean | Client and SQL |
| `number` | Integer 0–999 | Client clamp and SQL clamp |
| `effect` | `none smoke trails neon` | Client and SQL |
| `team` / `decal` | `apex circuit night coast` or null / `none chevron checkered pinstripe` | Client and SQL |
| `driver` | ≤ 12 characters of `A-Z 0-9 space . _ -`, uppercase | `sanitizeDriver` (strips) and SQL (rejects to empty) |

Every car is equally fast. Nothing in the art reaches scoring.

**Markup contract** (`vehicleSvg` output, consumed as a string):

1. **The root `<svg>` is the first element, and the string ends exactly with `</svg>`.** `Car.tsx` and `liveryCarSvg` append the livery with `.replace(/<\/svg>$/, …)`. `Car.tsx` sets `data-state`/`data-effect` on `firstElementChild`. `decorative()` edits the first `<svg ` and ` role="img"`. `embed()` (podium) reads the first `viewBox` and strips the outer tag.
2. **Root attributes:** `viewBox="0 0 280 140"`, `role="img"`, `aria-label="{playerName} — {model name}"` (escaped), `class="vehicle"`, `data-state`, `data-effect`, and `style="--primary:…;--accent:…"`.
3. **Colours:** player colours only through the literal strings `var(--primary)` and `var(--accent)`. `worldCar` resolves exactly those two with `replaceAll` for cars nested in other SVGs (the podium). Any other `var(--…)` would stay unresolved there. Everything else is a literal colour.
4. **Animation and effect are CSS only.** `Car.tsx` generates the markup once with `animation: 'idle', effect: 'none'` and then only flips `data-state`/`data-effect`. **Markup that varies by state or effect would never reach the app.** Keep all variation in `vehicles.css` selectors.
5. **Class hooks** used by `vehicles.css`:
   - `.chassis` wraps the body, glass, details, stripes, lights and plate; it is animated with `transform-origin: 140px 105px`.
   - One `.rim` per wheel, rotated with `transform-box: fill-box; transform-origin: center`. **Its bounding box must be centred on the hub**, or the wheel wobbles.
   - `.trails`, `.smoke`, `.glow` and `.celebrate` are hidden by default and shown per state or effect.
   - `prefers-reduced-motion` disables all of it.
6. **No `id`, `<defs>`, gradients, `<filter>`, `url(#…)`, `<image>`, `<use>`, `<foreignObject>`, scripts or `on*` attributes.** Up to about 34 cars share a page (waiting room with the garage open), and the podium nests three. Ids would collide. External images are blocked by CSP. All markup goes through `TrustedSvg`/`innerHTML`, so it must be built only from normalized inputs. If gradients are essential, ask for a per-instance id API first.
7. **Text nodes:** the door number is an SVG `<text>` of the clamped integer. Driver lettering is an SVG `<text>` of the sanitized, escaped string (e2e finds `BOB3` in a `<text>` inside `.w-parking-bay`). The model name goes in `<title>`.
8. **Size:** about 2.7–3.3 KB per car today. Track lanes re-render at 10 Hz (Car itself is memoized). Keep any increase modest, and avoid SVG filters entirely in the race.

### Coordinate system and anchors (current values)

The viewBox is 280 × 140. **Cars face right. The ground is y = 124** (wheel bottoms): each wheel group is `translate(x, 124 − r)`. The table below is generated from the current code.

| id | Body y (top–bottom) | Rear / front wheel x | Wheel r | **Visible extent x** (rear–front) | Number text centre | Decal anchor | Lettering x,y | Glass | Lights | Bytes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `classic` | 36–108 | 62 / 207 | 20 | 40–235 | 128,94 | 164,82 | 107,75 | yes | yes | 2934 |
| `formula` | 62–103 | 65 / 210 | 22 | 30–251 | 128,94 | 146,88 | 107,75 | yes | no | 2745 |
| `muscle` | 45–103 | 64 / 210 | 22 | 35–241 | 128,94 | 164,82 | 107,75 | yes | yes | 2962 |
| `supercar` | 37–103 | 66 / 211 | 20 | 33–241 | 128,94 | 164,82 | 107,75 | yes | yes | 2867 |
| `hypercar` | 46–105 | 64 / 215 | 19 | 32–246 | 128,94 | 164,82 | 107,75 | yes | yes | 2950 |
| `drift` | 47–105 | 63 / 210 | 21 | 29–241 | 128,94 | 164,82 | 107,75 | yes | yes | 2970 |
| `rally` | 37–96 | 67 / 200 | 24 | 38–232 | 128,94 | 164,82 | 107,75 | yes | yes | 3343 |
| `monster` | 20–75 | 66 / 209 | 32 | 34–241 | 128,64 | 156,53 | 112,56 | yes | no | 2734 |
| `pickup` | 35–103 | 63 / 209 | 22 | 34–237 | 128,94 | 164,82 | 107,75 | yes | yes | 2913 |
| `kart` | 77–110 | 88 / 188 | 18 | 70–206 | 126,101 | 155,93 | 107,103 | none | no | 2777 |
| `vintage` | 38–105 | 65 / 207 | 21 | 38–237 | 128,94 | 164,82 | 107,75 | yes | yes | 2969 |
| `cyber` | 39–103 | 64 / 211 | 20 | 32–244 | 128,94 | 164,82 | 107,75 | yes | yes | 2940 |
| `police` | 43–103 | 64 / 210 | 21 | 33–240 | 128,94 | 164,82 | 107,75 | yes | yes | 3071 |
| `taxi` | 42–104 | 63 / 209 | 21 | 35–238 | 128,94 | 164,82 | 107,75 | yes | yes | 3108 |
| `rocket` | 41–116 | 78 / 205 | 18 | 42–249 | 128,94 | 125,67 | 107,75 | yes | yes | 3040 |

**The number plate:** a rect of 30×22 at (113,78), or 38×22 at (109,78) when the number has three digits; the text is centred at (128,94), size 14 (12.5 for three digits). Model offsets apply only to `monster` (0,−30) and `kart` (−2,+7). The plate sits inside `.chassis`, so it moves with the body.

**The livery** (team, decal, lettering) is appended after the root's children, **outside `.chassis`**, so today it doesn't bounce with the body in hop or shake animations. That is an existing quirk. Moving it inside the chassis is possible, but `Car.tsx`, `liveryCarSvg` and the parity tests change together. Decals are drawn at their anchor with `scale(.55)`. Lettering is 4.5 units, `#152b24`.

**Effects** (positions are fixed, not per model): trails at x 3–33, y 74–100; smoke at about (12–22, 99–106); the glow is an ellipse at cx 143, cy 126, rx 89; the celebrate stars sit at about (75–97, 20–41) and (171–195, 17–40). The kart's rear starts at x = 70, so its trails float behind it. Per-model effect anchors would be an improvement.

### Who depends on which anchor

| Consumer | Depends on | Notes |
| --- | --- | --- |
| Track (race, spectator) via `laneLeft()` | **Visible extents** from `vehicleExtents()` | At 0% the rear sits on the start line; at 100% the front bumper sits on the finish line. Lane `bottom` offsets in CSS assume ground y = 124 of 140 (`studio.css` `.pit-race .w-track-racer` sets `bottom: 2px`, or 8px on phones). |
| `vehicleExtents()` parser | The chassis markup, read by regex | **Constraints:** it reads only `d="…"` with **absolute** M/L/H/V/Q/T/C/A commands (relative lowercase commands are misread as absolute), `<rect x=… width=…>` in that attribute order, `<circle cx=… r=…>`, and both wheels from `rear/front ± radius`. It ignores `transform`, `<ellipse>`, `<polygon>`, `<line>`, `<polyline>` and stroke width. It renders with `stripes: true`. |
| Garage service bay | Ground y = 124 | `.w-workshop-car` is placed at left 27.36%, top 41.54%, width 45.45% of the 1100×520 scene. The car's ground lands at about y 437, on the floor shadow (`SHADOW` ellipse at cy 429, rx 219, in `GarageView`). |
| Podium (`podiumVenueSvg`, Results) | viewBox, 2:1 aspect, colour vars | Cars are embedded at fixed boxes (214×107, 214×107, 207×104). P1 plays `winner` and the others `finish`; that is fine here because the results are official. |
| Livery | `DECAL_ANCHORS`, lettering x/y | Tuned to today's bodies; **new bodies need new anchors** (the door area). |
| Small sizes | Silhouette and colour | Compact race lanes are **76px wide (66–68px on phones)**: 1 unit ≈ 0.27px. The door number (14 units) is about 3.8px tall and the lettering about 1.2px, so neither is legible there. Design the track read for silhouette, colour and maybe a bolder number. The roster, garage cards, preview, podium, leaderboard, voting, spectator, profile and account show larger cars. A track-only detail level would need a new prop (`detail: 'track' \| 'full'`), which Claude would wire into `Car` and `Track`. |

### Tests: what should change and what must stay

| Test | Today | During the redesign |
| --- | --- | --- |
| `vehicleArt.test.ts`: 15 ids equal the kit | Kit parity | **Keep** |
| `vehicleArt.test.ts`: normalization and escaping equal the kit | Kit parity | **Keep** (security coverage) |
| `vehicleArt.test.ts`: byte-identical SVG, every model × state × wheel × effect | Kit parity | **Replace** with art-agnostic invariants (below) plus committed golden snapshots of the new art |
| `worldArt.test.ts`: `worldCar` equals `kit.car` | Kit parity | Replace with "no `var(` left after resolution" |
| `worldArt.test.ts`: liveries on all 15 models; podium with 0–3 cars | Kit parity, which includes the car | Keep by pointing the kit's `W.car` at the app's `worldCar` in the test, so venue and overlay composition stay checked against the kit. Once the anchors change, replace them with an app-owned anchor table test. |
| `worldArt.test.ts`: teams, badges, helmets, plates, scenery | Kit parity | **Keep** (unaffected) |
| `vehicleAnchors.test.ts` | Invariants plus known values (formula 30/251, rocket 249) | Keep the invariants; update the known values to the new geometry |
| `Race.focus.test.tsx` | 4 × `svg[data-state]` in `.race-track`, none `winner`/`finish` at time-up | **Keep** |
| `WaitingRoom.hooks.test.tsx`, `scripts/e2e.ts` | "Rocket Racer" name; `BOB3` `<text>` in the bay | **Keep** |

**Proposed art-agnostic invariant suite** (Claude can add it before the redesign starts; it passes on today's art). For every model × wheels × stripes × numbers {0, 7, 42, 999} × livery on/off:

- **Root and closing tag:** the root contract from item 2; the string ends with `</svg>`.
- **Allowed variables:** only `var(--primary)` and `var(--accent)`.
- **Forbidden content:** no `id=`, `url(#`, `<filter`, `<image`, `<use`, `<script`, `<foreignObject` or ` on*=`.
- **Class hooks:** `.chassis`, two `.rim`, `.trails`, `.smoke`, `.glow` and `.celebrate` are all present.
- **Text:** the number text equals the clamped number; the escaped player name and lettering appear correctly.
- **Extents:** inside the viewBox and wider than 100 units.
- **Wheels:** wheel bottoms at y = 124.
- **Size:** under a size budget.

### Suggested sequence

1. **Claude:** add the invariant suite and golden-snapshot tooling. Optionally, replace the regex extents with explicit per-model `extent: [rear, front]` data, checked once against real `getBBox()` in Chrome. That removes the path-syntax constraints from the art.
2. **ChatGPT:** redesign the 15 models in `vehicleArt.ts` and `vehicles.css`, keeping the markup contract; update the livery anchors in `worldArt.ts`.
3. **Claude:** update the known-value and golden tests and the kit-parity stubs; check placement on the track (0% and 100%), the garage floor, the podium, the roster and the cards with the `vehicles`, race, room and garage fixtures; rerun the e2e-hook and focus tests.
4. **Shared:** review at 66–76px track size and at garage size.
