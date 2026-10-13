# Implementation plan and Claude handoff

This work plans a redesign; it does not authorize an unreviewed gameplay rewrite. Build on the existing React/Vite/TypeScript/Tailwind/Framer Motion application and Supabase backend. Keep current routes, game rules, saved model IDs, trophy definitions and accessibility preferences.

## Working agreement

**ChatGPT owns frontend design:** visual decisions, layout, tokens, typography, artwork direction, reusable presentation components, CSS, responsive behavior and visual acceptance.

**Claude owns integration and reliability:** existing state contracts, API adapters, authoritative timing/scoring, data persistence, reconnection, compatibility of assets with saved configurations, and meaningful regression checks.

This is a suggested division based on the requested workflow, not a claim that either tool can only do one kind of work. Claude can flag impractical designs; ChatGPT can adapt the UI around actual data. Share explicit requirements rather than asking both tools to independently redesign the same screen.

Do not run both against the same files simultaneously. Screen files often mix presentation and networking, particularly `screens/Race.tsx`; treat these as a sequential handoff. Separate branches/worktrees are useful, but each batch still needs a clear file owner and review of existing uncommitted changes. Never overwrite the other tool's work to restore an assumed baseline.

## Ordered work packages

| Order | Work package | Owner | Dependencies | Reviewable output / completion gate |
| --- | --- | --- | --- | --- |
| 0 | Capture current baseline and state map | Claude | None | Current screenshots, route/state fixture inventory, existing tests/typecheck/build results; identify current-versus-saved screenshot differences |
| 1 | Establish app-owned visual tokens and primitives | ChatGPT | 0 | Token mapping, typography, entry ticket, buttons, fields, tabs, metric/driver cells; light/dark-surface contrast and focus review |
| 2 | Prove car/venue art direction | ChatGPT; Claude checks compatibility | 1 | Hero asset, compatible gameplay car proof, compact track proof with documented anchors; no saved-ID regression |
| 3 | Build homepage and active-race presentation | ChatGPT | 1–2, fixture contracts | Responsive frontend using existing data shapes and clearly isolated fixtures; small-laptop passage/input fit verified |
| 4 | Connect and validate the core race journey | Claude | 3 | Existing create/join → lobby → vote → countdown → typing → official results flow wired without rule changes; multiplayer regression evidence |
| 5 | Redesign all 15 cars; complete lobby, garage, voting and results design | ChatGPT; Claude checks vehicle compatibility | 3–4 presentation contracts | Full editable car lineup with preserved IDs/liveries/anchors; matching pit-grid, editor, qualifying board, victory lane and standings; mobile/empty/loading/error states |
| 6 | Complete account/profile/leaderboard/trophies and experience screens | ChatGPT then Claude integration | 5 | Shared identity across all existing screens; auth, history, chart, ghost and championship contracts retained |
| 7 | Consolidate migrated CSS and optimize assets | ChatGPT, Claude reviews functional impact | 5–6 | Redundant override rules removed in bounded batches, token provenance documented, route splitting retained |
| 8 | Release verification | Claude for behavior; ChatGPT for visual review | 7 | Test/build results, final screenshots, keyboard/zoom/mobile/device checks, performance comparison and known-issues list |

Phases 1–4 are the first milestone. Do not rebuild every trophy or all six destinations before proving the homepage and active race. Estimate effort after phase 0; backend discoveries and car geometry work may dominate. An unsupported fixed completion date would not be useful.

## File map

| Area | Current files / location | Proposed work |
| --- | --- | --- |
| Global fonts/style entry | `client/src/main.tsx`, `client/src/index.css` | Add display font deliberately; map app-owned tokens to Tailwind aliases |
| Existing theme layers | `client/src/styles/grid/tokens.css`, `client/src/styles/studio.css`, `client/src/styles/motorsport.css` | Consolidate values and migrate rules; do not append a fourth competing theme |
| Shared primitives | `client/src/components/ui.tsx`, `client/src/components/AppNav.tsx` | Refine presentation while preserving props, labels, navigation and semantics |
| Homepage | `client/src/screens/Home.tsx` | Recompose story/art/ticket; deliberate default vehicle; preserve create/join handlers and practice anchor |
| Practice/tutorial | `client/src/screens/Practice.tsx`, `client/src/screens/FirstLap.tsx` | Passage-first layout; retain ghost, drills, comfort and return flow |
| Waiting room | `client/src/screens/WaitingRoom.tsx`, `client/src/components/lobby/` | Compact roster, room actions, invite/settings, destination selection |
| Garage | `client/src/components/garage/Garage.tsx`, `client/src/components/Car.tsx`, `client/src/art/vehicleArt.ts`, `client/src/game/vehicles.ts` | Improve editor and assets; integration review for model/livery compatibility |
| Voting | `client/src/screens/Voting.tsx`, `client/src/components/voting/Voting.tsx` | Compact mode board and reveal; preserve server choice |
| Race | `client/src/screens/Race.tsx`, `client/src/components/Track.tsx`, `client/src/components/race/`, `client/src/components/TypingPanel.tsx` | Recompose view without altering engine, ranking or sync loop |
| Typing logic | `client/src/game/useTyping.ts`, `shared/src/` | Claude-owned review/regressions; change only if a separately identified defect requires it |
| Results | `client/src/screens/Results.tsx`, `client/src/components/results/Results.tsx` | Outcome-first layout, official classification and award hierarchy |
| Account/profile | `client/src/screens/AccountScreen.tsx`, `client/src/screens/ProfileScreen.tsx`, `client/src/components/account/`, `client/src/components/profile/` | Credentials/forms/charts styling; integration must retain all identity states |
| Leaderboard/trophies | `client/src/screens/LeaderboardScreen.tsx`, `client/src/components/trophies/`, `client/src/components/achievements/` | Adaptive podium, timing table, readable cabinet and reserved notification region |
| Experience | `client/src/screens/SpectatorScreen.tsx`, `client/src/components/spectator/`, `client/src/components/experience/` | Broadcast consistency; preserve feed, coaching and championship semantics |
| Art adapters | `client/src/art/gridArt.ts`, `worldArt.ts`, `accountArt.ts`, `trophyArt.ts`, `loadKit.ts` | Preserve trusted render boundaries and data escaping; change appearance deliberately |
| Persistence/network | `client/src/lib/`, `client/src/game/useLobby.ts`, `supabase/`, `shared/` | Claude owns investigation and necessary integration; no speculative schema changes for a visual refresh |
| Original kits | `design-kits/` | Reference/archive; do not import showrooms or duplicate vendor runtimes into the app |

Before operating on a path, inspect its current implementation; this map describes the reviewed repository, not a guarantee that another collaborator has not moved code.

## Presentation contracts

Prefer deriving views from existing types. Do not introduce a second independent Race model merely to make the mockup convenient. If extracting `RaceView` from `Race.tsx`, Claude first defines a minimal typed adapter and fixtures; ChatGPT then owns its presentation; Claude reconnects it in a later batch.

The race view needs: session mode and duration, optional round, server-aligned remaining time, participant/spectator status, local stats, ordered racer identities with vehicle configuration and local-player marker, visible-car selection, race-control event, connection state, typing state/input ref/keyboard handler, and pending-versus-official result state.

These contracts are non-negotiable:

1. **Race rules:** multiplayer runs on a timer; official score/order comes from existing authoritative logic. Visual laps and finish lines cannot change the winner.
2. **Local typing:** retain native input, cursor/selection, IME, deletion, paste policy, strict mode and line submission. Never remount input on WPM/position updates.
3. **Vehicle compatibility:** preserve normalization and saved model/livery IDs. All vehicles remain equally fast. Maintain viewBox, ground baseline and finish anchor correctness.
4. **Readiness:** “Ride confirmed” currently derives from vehicle configuration. No separate “everyone ready” rule without an explicit feature decision.
5. **Network:** provisional standings remain provisional; reconnect/resume/finalization behavior survives style changes. Clock displays do not create their own timing authority.
6. **Accounts:** verification/preservation success needs real confirmation; keep guest context on failure. Do not infer merged ownership from matching emails.
7. **Awards/championship:** server-confirmed awards and committed official results only; no points or trophy inference from visual state.
8. **Charts/ghost:** missing data stays missing; zero stays zero; ghost uses the correct passage's recorded trace, not invented speed.

## Fixture and state checklist

Create or reuse a development-only fixture entry that is excluded from the production route/bundle. Reuse existing mock conventions where possible. Do not build a new production route just to display design fixtures.

| Family | Minimum cases |
| --- | --- |
| Entry | Empty name, invalid code, busy create, service unavailable, existing rejoin |
| Lobby | 1, 2 and 15 racers; long names; host/guest; reconnecting racer; settings saving/error |
| Garage | All 15 models; palette/accent/number extremes; preview versus saved; locked; save failure |
| Vote | No votes, selected, changed vote, near deadline, Random resolved, host/guest controls |
| Race | Countdown, local P1/middle/last, 2/4/15 racers, WPM >160, mistake/strict mode, long coding tokens, time-up, pending results, reconnect/resume |
| Results | 1/2/3+ eligible finishers, tie display, DNF/review, local winner/non-winner, zero/many awards, host/guest rematch |
| Identity | Guest, signed-in, verification pending, save pending, retry, preserve review, saved, recovery |
| History | Empty, single point, gaps, zero values, many results, long name, missing previous best |
| Experience | No ghost/recorded ghost, no debrief timeline, delayed spectator feed, presentation mode, championship setup/running/round committed/complete |
| Comfort | OS reduced motion, in-app reduced motion, high contrast, max passage size, 200% zoom, phone keyboard |

Use labelled fictional data in fixtures. No production leaderboard seeding or account creation for a visual mockup.

## Acceptance and checks

For implementation batches, run relevant checks from the repository's existing scripts:

```sh
npm test
npm run typecheck
npm run build
```

Run the existing multiplayer walkthrough only against a configured disposable test backend:

```sh
npm run e2e -- http://127.0.0.1:5173 docs/screenshots/pit-lane
```

The current E2E script creates actual test users/rooms and plays a race; it is not a read-only screenshot tool. Claude must identify the configured environment before running it. Test cleanup must target only explicitly disposable test records. Do not run `npm run bots` casually against production.

Use existing ranking/typing/stats/trophy/ghost tests and art/anchor checks. Add a test only when a change creates a real regression risk. A test asserting a new CSS color literal is not useful. New model geometry needs anchor checks; data adapters need real edge cases; input extraction needs focus/keyboard regression coverage.

Visual acceptance:

- At 1280×720, default race current line/input/clock/WPM/position fit together.
- At 390×844, homepage name/Create action appears early; keyboard use preserves passage/input visibility.
- No accidental old-green surfaces remain except intentionally preserved livery/art colors.
- No duplicate competing theme overrides remain in migrated components.
- Hero, race, lobby and results feel like the same venue without making every screen the same layout.
- Leave is secondary; current player is labelled; results never celebrate an unconfirmed winner.
- All controls work with keyboard, visible focus and error messages; rendered contrast meets targets.
- No network or timing updates cause passage jumping, focus loss, clipped names or layout collapse.
- Final screenshots include desktop/tablet/phone, large text, light-ticket errors, empty states and official/pending results.

Release gate is combined visual and behavior evidence, not just “the build passes.” This planning change itself does not require running application tests because no application source changed.

## Copy-paste Claude brief

```text
We are redesigning GRID, the existing multiplayer typing-racing app, with ChatGPT as the frontend design lead.

Read these files first:
docs/design/pit-lane/README.md
docs/design/pit-lane/01-audit.md
docs/design/pit-lane/02-design-spec.md
docs/design/pit-lane/03-implementation-plan.md
docs/design/pit-lane/tokens.json

The two concept images in docs/design/pit-lane/concepts are visual references, not implemented screens or authoritative data. Follow the written corrections and laptop layout budget.

Your first task is phase 0: inspect current code and uncommitted work, map state/data dependencies for the homepage and Race.tsx, establish baseline checks, and propose a minimal presentation interface plus development-only fixtures using existing types. Report the relevant files, contracts, existing test coverage and integration risks. Do not independently redesign the UI.

Own backend/state/data integration and meaningful regression tests. ChatGPT owns tokens, CSS, layout, artwork direction and visual QA. Agree on exact file ownership before edits. Do not edit the same screen files concurrently or revert the other collaborator's work.

Preserve routes, nav labels, typing behavior, server-authoritative timer/scoring/results, all 15 vehicle model IDs, trophy rules, account preservation, ghost trace semantics, championship commitment and accessibility preferences. The game is won by WPM at time-up, not by the artwork crossing a finish line. Ride confirmed is vehicle selection, not a new ready-check system.

Keep the current stack. Reuse the React ports and existing APIs. Do not import design-kit showrooms/vendor duplicates or invent matchmaking, vehicle performance, telemetry or backend states. Avoid speculative schema migrations.

For each integration batch, give ChatGPT the data/props contract, changed files, loading/empty/error cases and test results. Verify whether an E2E target is a disposable test backend before any tool creates users or rooms. Return a concrete first batch for review.
```

## Handoff record for each batch

Record goal, owned files, expected inputs/outputs, reference image/spec section, changed states, checks run with results, screenshots, known limits, and the next owner. Mark sample fixture data explicitly. If a design requires new server behavior, surface that as a separate feature decision before implementing it.
