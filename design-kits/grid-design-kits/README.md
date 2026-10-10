# GRID / Complete design collection

Fourteen coordinated design kits for the existing React + TypeScript multiplayer typing racer. Includes the original vehicle and trophy kits plus twelve new kits, all in the same forest-green, lime and off-white visual system.

## Start here

1. Extract this folder into your project's `design-kits/` directory, producing `design-kits/grid-design-kits/`.
2. Open `OPEN-ME.html` in a browser. It is an offline, self-contained interactive showroom with all fourteen kits and an overview. No installation, API keys or network are needed. Sound only plays after user interaction.
3. Give Claude `integration/CLAUDE-HANDOFF.md`. The sources in each numbered directory are the integration references.

Keep the earlier separate kits if you wish; the copies in `04-vehicles` and `11-trophies` contain the same original collection. Do not install duplicate renderers into your application.

`collection-overview.png` is a designed overview of the assets, not a browser screenshot. `showroom/index.html` uses the separate source files; `OPEN-ME.html` bundles them for easy viewing.

## Inventory

| Kit | Contents | Key source |
| --- | --- | --- |
| 01 Brand | Original G mark, SVG wordmark, SVG/ICO favicon, 32/180/192/512 px PNG icons, 1200×630 invite PNG and SVG, loading component | `01-brand/brand.js` |
| 02 UI | CSS/JSON tokens, type scale, spacing, corners, four button styles, loading/disabled states, inputs/selects/toggles, pills/cards, banners/toasts, tooltip, skeleton and focus styles, 19 SVG icons | `02-ui/core.js`, `components.css` |
| 03 Lobby | Room code, copy controls, player cards, host/online/you states, 15-seat roster, empty seats, host controls, illustrated instructions | `03-lobby/lobby.js` |
| 04 Vehicles | All 15 original vehicles, shared renderer, customization, animations and garage | `04-vehicles/vehicles.js` |
| 05 Voting | Six illustrated mode cards including Random, voter car stacks, count chips, timer ring, winning reveal and decorative die | `05-voting/voting.js` |
| 06 Track | Lane surface, start grid, finish stripe/animated flag, markers, five SVG scenes, four-racer window and position update helper | `06-track/track.js` |
| 07 Race moments | Five-light gantry, countdown, finish/new-leader/gain/photo-finish banners, photo-finish illustration | `07-race-moments/moments.js` |
| 08 HUD | P1–P15 badges, position/total, WPM/accuracy/mistakes/time, progress, 15-racer minimap, spectator state | `08-hud/hud.js` |
| 09 Typing | Correct/current/mistake/upcoming styles; ready/waiting/error/finished states; code and manuscript variants; local interaction demo | `09-typing/typing.js` |
| 10 Results | Three-step podium, bounded confetti, responsive results table, you/DNF/review states, award cards, progression separation and next-round controls | `10-results/results.js` |
| 11 Trophies | All 20 original trophies, earned/locked/reveal states, original gallery and metadata | `11-trophies/trophies.js` |
| 12 System | Seven original illustrations and error/empty-state components | `12-system/system.js` |
| 13 Sound | Ten original mono PCM WAV cues, deterministic synth source, mute/volume/voice-limit controller, sound preview | `13-sound/sound.js` |
| 14 Motion | Timings/easing JSON, reduced-motion rules, keyed-lane FLIP helper and swap demo | `14-motion/motion.json` |

## Presentation architecture

This is a design and integration source collection, not an installed application upgrade. Your React/Supabase project was not available here. The reusable modules expose `globalThis.GridKit`; the supplied vehicles and trophies expose `VehicleKit` and `TrophyKit`. Functions render HTML/SVG from props; eventful helpers return cleanup functions where relevant. `manifest.json` provides load order and stylesheet order. React integration should convert markup into components or use narrow adapters, rather than replacing your existing router, hooks or server logic.

The showroom uses clearly labeled example players, simulated votes and progress, and illustrative award statistics. It has no network connection and does not create a real lobby. Copy-code demonstrates clipboard access; invite-copy intentionally reports that no real invite exists. Mode actions, system actions and rematches are local demonstrations.

Each kit's README describes the host responsibilities and integration points. `integration/types.d.ts` documents the new shared interfaces. The complete original model/trophy APIs remain in their respective folders.

## React project mapping

- Tokens and common styles → `client/src/index.css` and shared UI components.
- Vehicles/garage → existing `Car.tsx`, plus a new garage component.
- Lobby → `WaitingRoom.tsx`, `LobbyScreen.tsx`, `CopyButton.tsx`.
- Voting → `Voting.tsx`; use existing backend mode and voting definitions.
- Track/moments → `Track.tsx`, `Race.tsx`.
- HUD → `StatsBar.tsx` and new minimap component.
- Typing → `TypingPanel.tsx`; keep `useTyping.ts` authoritative for local typing behaviour.
- Results/trophies → `Results.tsx`; display real awards from the existing scoring path.
- System states → existing route and connection handling.
- Sound/motion → optional shared hooks/utilities, with cleanup and stored preferences.

## Important integration boundaries

- Server state chooses winners, deadlines, rankings, passage, official progress and awards. A decorative die never chooses a tie winner.
- Random is a voting choice that resolves to one of the five actual passage modes; it is not a sixth passage format. Match your existing backend policy.
- `visibleRacers()` is a design reference. Reuse and validate `shared/src/visibleCars.ts` instead of adding a parallel source of truth.
- The typing demo uses simple correct-progress gating to exercise styles. It is not production typing/scoring logic; integrate your existing hook for deletion, Unicode, paste, IME and mobile behaviour.
- Lane markup uses standardized SVG viewports. Before shipping, align the actual vehicle finish anchor with your game's definition of completion for every model; illustration silhouettes have differing padding.
- “Under review” indicates a pending result, not proof of cheating. Pass status from the real backend; do not infer it from a high WPM.
- The result components expect already sorted, eligible server data. They do not award trophies, infer podium eligibility or resolve timestamp ties.
- `button({attrs})` is a template-author convenience: only static developer-authored attributes belong there. Never pass user or remote text into raw attributes/markup.
- Colours convey emphasis but are accompanied by names, labels and statuses. Contrast decisions should be confirmed against your exact assembled screens.

## Motion and sound

Every new CSS animation respects reduced motion. Continuous vehicle idle/driving effects come from the original kit; use its state correctly and stop finished/offscreen animations. Sound is muted by default, requires user interaction to unlock, caps simultaneous voices at four and rate-limits key clicks. Assets are synthesized in-house for this collection; there are no downloaded audio samples. Master volume defaults to 35%. In production, persist mute preference and consider keeping key clicks opt-in separately.

## Validation performed

- JavaScript syntax checks for every source.
- All 15 showroom page-render functions executed with a lightweight document stub.
- Four-racer window validated at every local rank for 1–15 racers: 120 cases.
- Dynamic label escaping and malformed trophy-ID checks in original kits.
- SVG XML validation and rasterization of all 78 exported SVG files.
- All ten WAV headers, durations, finite samples and peak headroom checked; deterministic regeneration confirmed.
- Unique IDs checked within each rendered showroom page.
- Brand invite and collection artwork visually inspected.

**Not verified:** live browser interactions, browser layout screenshots, target-device audio playback, real multiplayer networking, mobile keyboards/IME, and production React integration. Chromium installation failed in the environment, so browser tests could not run. `tools/test.cjs` checks generation logic, not browser behaviour. Validate these areas in your actual application before release.

## Rebuild

With Node installed:

```sh
node tools/build.cjs
node tools/test.cjs
```

These require no external packages. `node tools/render.cjs` additionally uses `sharp` to regenerate the brand PNGs, ICO and overview image. Prebuilt exports are included, so installing sharp is optional. The render script uses the environment runtime's sharp when available, or a local `sharp` installation otherwise.

Do not ship this showroom or all design references as part of your production JS bundle. Bring only the required assets and converted components into the app.
