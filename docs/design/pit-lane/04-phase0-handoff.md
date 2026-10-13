# Phase 0 handoff: baseline, state map, contracts

From Claude (integration/reliability) to ChatGPT (frontend design lead). 11 October 2026, branch `redesign` at `ac08168`. No application source was changed in phase 0.

## 1. Baseline

| Check | Result |
| --- | --- |
| Uncommitted work | Only `docs/design/` (these plan files). Working tree otherwise clean. |
| `npm test` | 15 files, **137/137 pass** (all pure unit tests: shared engine plus art/anchor checks; no network) |
| `npm run typecheck` | Pass |
| `npm run build` | Pass. Main CSS 147 kB (31 kB gz); route-split chunks intact (Lobby 60 kB, Car 48 kB, motion 127 kB, supabase 214 kB, react 219 kB) |
| `npm run e2e` / `npm run bots` | **Not run. No disposable backend exists** (see risk R1) |

## 2. Relevant files

**Homepage**: `client/src/screens/Home.tsx` (Showroom, CarLineup, entry form), `components/RejoinRace.tsx`, `screens/Practice.tsx` (embedded at `#practice`), `lib/storage.ts` (name), `lib/supabase.ts` (`supabase` null = offline mode), `art/vehicleArt.ts` (`MODEL_GEOMETRY`, 15 models).

**Active race**: `screens/LobbyScreen.tsx` (router for `waiting → voting → racing → finished`, renders the **reconnect banner and Retry**), `screens/Race.tsx` (state, sync loop and layout all in one file), `components/TypingPanel.tsx` (the only typing input), `components/Track.tsx` (shared with the spectator view), `components/race/{Dashboard,RaceControl,Hud,Moments}.tsx`, `game/useTyping.ts`, `game/useLobby.ts`, `lib/clock.ts`, `lib/api.ts`, `shared/src/` (engine, ranking, stats, visible cars).

## 3. State map

**Homepage** has almost no remote data. It reads the saved name (localStorage `typeracer:name`), `supabase` availability, and a saved active race (localStorage `typeracer:active-race` plus a matching auth session) for Rejoin. Its actions are `create()`, which calls `ensureSession`, then `api.createLobby`, then navigates to `/r/CODE`, and `join()`, which validates and navigates without a network call. The showroom car choice is **cosmetic only and is not saved**. The garage build (`typeracer:vehicle`) is set in the lobby garage. A homepage that "picks your car" would be a new feature.

**Race** takes everything from `LobbyState` (`useLobby`):

```
lobby, players[] (vehicle builds), race (start_at/end_at/duration_s/zero_mistakes/mode/status),
passage (text), racePlayers[] (server rows), live{} (others' relayed progress),
online Set (presence), connected, clockOffset, championship, userId
```

Race.tsx derives: `now` (server-aligned, re-renders **every 100 ms**), `started/racing/timeUp`, the local `TypingState` (useTyping), the ranked order (re-ranked every 250 ms), `cars` (`getVisibleCars` → `TrackCar[]`), `myStats`, the race-control event, and the countdown value. Side effects that must keep running untouched: the submit queue (`api.submitTyping` every `PROGRESS_SUBMIT_MS`, on line lock, and a final lock at time-up), `saveActiveRace`, mistake logging, `api.finalizeRace` after `end_at + grace`, sounds, and focusing the input at GO.

Official results are not shown in Race. When the server sets `race.status = 'finished'`, LobbyScreen swaps to Results. In Race, the window between `timeUp` and that swap is the "pending / confirming" state.

## 4. Contracts the frontend must preserve

1. **One typing input, never remounted.** `TypingPanel` must stay at a stable position in the tree for the whole race. Do not render it inside JS-chosen breakpoint branches, keys that change, or wrappers that mount/unmount with countdown, race control, or connection state. Focus is only re-applied when `started/isRacer/timeUp` change, so a remount mid-race loses focus without recovery.
2. **Input semantics.** The input is controlled (`value=state.input`, `onChange` no-op). `useTyping` handles keydown and ignores untrusted events. Paste and drop are blocked. Keep `autoComplete/autoCorrect/autoCapitalize/spellCheck` off, the `enterKeyHint`, the `aria-describedby` instructions, and the visually hidden label **"Type the current line"**.
3. **Timing authority.** Every clock display uses `useServerNow(clockOffset)` / `msLeft` passed in. Components must not start their own `Date.now()` countdowns or CSS-duration timers that stand in for the clock.
4. **Standings are provisional.** No winner, podium, or "P1 wins" treatment in Race. Use "Confirming results…" between time-up and `status = finished`.
5. **Vehicles.** Render cars only through `vehicleFor()` / `<Car>` / `Track`. Keep the 15 model IDs, `normalizeVehicle`/`normalizeLivery`, numbers 0–999, the viewBox/ground/finish anchors (`vehicleAnchors.test.ts`), and equal speed. Car position comes from the clock (the leader reaches 90% at time-up), not from the finish line.
6. **Data that does not exist:** lap gaps, mph, sectors, live accuracy of *other* racers, pit stops. Available per racer: name, rank, net WPM (derived), progress share, mistakes (animation only), vehicle/door number, and online presence.
7. **Role/readiness.** Spectators (`!isRacer`) get no dashboard or input. "Ride confirmed" comes from the vehicle configuration; there is no ready-check.
8. **Selectors used by `scripts/e2e.ts`** (rename only together with me): label "Type the current line", `.g-type-input`, `.g-line.is-current`, `.g-countdown-frame`, `.app-topbar`, placeholder "e.g. Speedy", "Rejoin race" button, "Zero-mistake mode" label, `.g-vote-reveal`, "RULES LOCKED", "ROUND 1 / 2", plus results/spectator/experience classes (`.g-award`, `.sp-*`, `.x-*`, `.w-podium-list`, `.lb-hall`, `.a-achievement-toast`).

## 5. Proposed presentation interface (types only, derived from existing types)

Claude extracts these from Race.tsx. Race.tsx keeps every hook and side effect and passes plain props down. ChatGPT owns the `RaceView` presentation.

```ts
// client/src/components/race/raceView.ts (Claude-owned types)
import type { RefObject, KeyboardEvent } from 'react';
import type { TypingState } from '@race/shared';
import type { TrackCar } from '../Track';
import type { MinimapRacer } from './Hud';
import type { ControlEvent } from './RaceControl';
import type { TypingVariant } from '../TypingPanel';
import type { DestinationId } from '../../art/worldArt';

export interface RaceViewModel {
  session: {
    modeName: string;            // modeDesign(race.mode).name
    viaRandom: boolean;          // lobby.mode === 'random'
    variant: TypingVariant;
    durationMs: number;
    strict: boolean;
    round: { n: number; of: number } | null;   // running championship only
    destination: DestinationId;
    racerCount: number;
  };
  clock: {
    phase: 'countdown' | 'go' | 'racing' | 'time-up';
    countdown: 'READY' | '3' | '2' | '1' | 'GO!' | null;
    msLeft: number;              // server-aligned; display only
    usedFraction: number;        // 0..1
  };
  role: 'racer' | 'spectating';
  me: { position: number; total: number; wpm: number; accuracy: number; mistakes: number } | null;
  cars: TrackCar[];              // visible lanes, local car always included
  overflow: MinimapRacer[] | null; // only when racers > lanes
  raceControl: ControlEvent | null;
  results: 'provisional' | 'confirming';
  warning: string | null;        // e.g. input rejected as impossibly fast
}

export interface RaceTypingSlot {
  state: TypingState;
  inputRef: RefObject<HTMLInputElement | null>;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  waiting: boolean;
  doneLabel?: string;
}
// <RaceView model={...} typing={...} />
```

Connection state stays in LobbyScreen (it wraps every phase). If the race layout needs to place it, I will add `connection: 'live' | 'reconnecting'` and an `onRetry` to the model.

**Homepage** needs no adapter. Its contract is the existing handler set: `name, code, busy, error, invalid: 'name'|'code'|null, available (supabase != null), onCreate, onJoin`, plus `<RejoinRace/>` and `<Practice/>` mounted as they are. ChatGPT can recompose Home.tsx directly as long as those handlers and the `#practice` anchor are kept.

## 6. Development-only fixtures

- `client/src/dev/fixtures/race.ts`: `RaceViewModel` + `RaceTypingSlot` cases built with the **real engine** (`createTypingState` / `resumeTypingState` from `@race/shared`) and `vehicleFor()` with labelled fictional players. Cases: countdown READY/3/GO, local P1/middle/last, 2/4/15 racers (overflow minimap), WPM 165, mistake + strict-blocked, coding passage with long tokens, time-up confirming, reconnecting, spectating, and all 15 models.
- `client/src/dev/fixtures/home.ts`: empty name, invalid code, busy create, offline (`available: false`), rejoin present.
- `client/src/dev/Fixtures.tsx`: a gallery with a viewport switcher (1440×900, 1280×720, 390×844). The typing slot is live, so the real engine responds to keys in the fixture.
- Route: in `App.tsx`, `if (import.meta.env.DEV && path === '/__fixtures')` → `lazy(() => import('./dev/Fixtures'))`. Vite folds `DEV` to `false` in production builds, so the chunk is dropped. I will verify that with a build grep. **Consequence: fixtures are not on the Vercel preview** (it is a production build). If you want them there for review, that needs a separate decision (e.g. a `VITE_FIXTURES` flag set only on the preview).

## 7. Integration risks

| # | Risk | Mitigation |
| --- | --- | --- |
| R1 | **Local `.env.local` and the `redesign` Vercel preview both point at the production Supabase project.** Any e2e/bots run, and any race played on the preview, writes real users, rooms and leaderboard rows. | The user decides: a Supabase branch or a separate free project for testing. Until then, use fixtures only. No E2E. |
| R2 | Input remount / focus loss from layout restructuring. | Contract 1. I will add a regression check (input element identity and focus survive rank/WPM/race-control/connection updates). |
| R3 | Race re-renders 10×/s. Heavy SVG, filters or Framer layout animations in the race view will cost frames on laptops and phones. | Memoize scenery/Track layers. Animate with transforms only. Compare before/after in the profiler. |
| R4 | **CSP is `font-src 'self' data:`**. A Google Fonts `<link>` for Barlow Condensed works in dev and **silently fails in production**. | Self-host via `@fontsource/barlow-condensed`, like Geist. |
| R5 | Three existing theme layers (`styles/grid/tokens.css` via index.css, `studio.css` → `motorsport.css`, plus `spectator.css`/`experience.css`). Import order decides which rules win. | Consolidate, as the plan says. Do not add a fourth layer. |
| R6 | `Track` is shared with `/r/CODE/watch` (spectator). | Restyling Track also changes the spectator view. Check both. |
| R7 | Renamed classes or labels break `scripts/e2e.ts`. | Contract 8. I update e2e in the same batch. |
| R8 | Race-control renders in two slots (desktop and below the text on phones), both `aria-live`. | Keep exactly one live region visible per breakpoint. It must never shift the input. |
| R9 | Sync failures are swallowed silently, and there is no "unsent lines" signal today. | If the design wants a "saved/unsent" indicator, I can expose queue state from Race.tsx (client-only, no backend). This is a feature decision. |
| R10 | Keyboard-aware mobile layout cannot be verified on desktop emulation. | Real iOS Safari/Android Chrome check in phase 8. |

## 8. Proposed file ownership (first milestone)

| Owner | Files |
| --- | --- |
| **Claude** | `screens/Race.tsx` (logic; becomes container only), `components/race/raceView.ts` (types), `client/src/dev/**` (fixtures + gallery), `App.tsx` (dev route only), `game/*`, `lib/*`, `shared/*`, `supabase/*`, `scripts/*`, tests |
| **ChatGPT** | `components/race/RaceView.tsx` (new), `components/race/{Dashboard,RaceControl,Hud,Moments}.tsx` presentation, `components/Track.tsx` presentation, `components/TypingPanel.tsx` **markup/classes only** (keep the input element and its attributes), `screens/Home.tsx`, `components/ui.tsx`, `AppNav.tsx`, `index.css`, `styles/**`, `art/*` appearance (anchor tests must pass), `main.tsx` font imports |
| Sequential handoff | `screens/LobbyScreen.tsx` (connection banner placement): ChatGPT styles, Claude rewires if the banner moves into RaceView |

**Proposed first batch (Claude):** add `raceView.ts`, split Race.tsx into a container plus a temporary `RaceView` that reproduces today's markup 1:1, add the dev fixture route and cases, and add the input-identity/focus regression test. Gate: test, typecheck and build stay green, the fixture chunk is absent from `dist`, and the live race behaves identically. ChatGPT then owns `RaceView.tsx` for the redesign.
