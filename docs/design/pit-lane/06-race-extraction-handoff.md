# Race extraction handoff

From Claude (integration) to ChatGPT (frontend). 12 October 2026, branch `redesign`, local and uncommitted on top of the frontend foundation batch. Nothing was deployed. The contracts in `04-phase0-handoff.md` still apply.

## Summary

- `screens/Race.tsx` is now a **container**. Every hook and side effect is unchanged: submit queue, final lock, finalize, saveActiveRace, mistake log, sounds, focus at GO, ranking cadence. It builds a `RaceViewModel` and renders `<RaceView model typing />`.
- `components/race/RaceView.tsx` is new. It reproduces the previous markup 1:1: same classes, same test hooks, same TypingPanel position. **ChatGPT owns it from now on.**
- Types live in `components/race/raceViewModel.ts`. The handoff proposed `raceView.ts`, but on macOS's case-insensitive file system `raceView.ts` and `RaceView.tsx` resolve to the same module, so TypeScript refuses both.
- `components/ConnectionBanner.tsx` holds LobbyScreen's reconnect banner, extracted verbatim so fixtures can show it. LobbyScreen still places it.
- There is a dev-only fixture gallery at `/__fixtures`, built with the real typing engine and isolated from every backend.
- There is an input identity/focus regression test, and a mutation check confirmed it catches a remount.
- ChatGPT's frontend batch is untouched. I did not edit Home, ui.tsx, main.tsx, index.css, styles/**, images or the client package.

## Prop contract

```ts
// client/src/components/race/raceViewModel.ts
export type RacePhase = 'countdown' | 'go' | 'racing' | 'time-up';
export type CountdownValue = 'READY' | '3' | '2' | '1' | 'GO!';

export interface RaceViewModel {
  session: {
    modeName: string;        // modeDesign(race.mode).name
    viaRandom: boolean;      // lobby voted "random"
    variant: TypingVariant;  // 'standard' | 'coding' | 'shakespeare'
    durationMs: number;
    strict: boolean;         // zero-mistake mode
    round: { n: number; of: number } | null;  // running championship only
    destination: DestinationId;
    racerCount: number;      // spectators excluded
  };
  clock: {
    phase: RacePhase;        // go = first 900 ms after start; time-up = end_at passed, results not official
    countdown: CountdownValue | null;  // start overlay value; null once GO has gone
    msLeft: number;          // server-aligned; > durationMs during the countdown
    usedFraction: number;    // 0..1
  };
  role: 'racer' | 'spectating';
  me: { position: number; total: number; wpm: number; accuracy: number; mistakes: number } | null;
  cars: TrackCar[];          // ≤ VISIBLE_CARS lanes, leader-most first, local car always included
  overflow: MinimapRacer[] | null;  // every racer, only when racers > lanes
  raceControl: ControlEvent | null; // current board (already deduplicated and rate-limited)
  results: 'provisional' | 'confirming';  // never final in the race view
  warning: string | null;    // e.g. "rejected as impossibly fast"
  connection: 'live' | 'reconnecting';    // LobbyScreen still renders the banner + Retry
}

export interface RaceTypingSlot {   // null for spectators
  state: TypingState;
  inputRef: RefObject<HTMLInputElement | null>;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  waiting: boolean;          // countdown
  doneLabel?: string;        // "TIME'S UP"
}

export interface RaceViewProps { model: RaceViewModel; typing: RaceTypingSlot | null }
```

Rules for RaceView: props only. No `Date.now()`, timers, API calls or CSS-duration countdowns. Render `TypingPanel` once, at a stable tree position, with `ref={typing.inputRef}`. It must never sit inside phase, board or connection branches, or under changing keys. `connection` is provided but not yet used. If the race layout takes over the reconnect banner, tell me and I will move it out of LobbyScreen so it is not shown twice.

## Fixture URLs

Start the dev server as usual (`npm run dev`). The real `.env.local` is fine because isolation does not depend on it.

| URL | What |
| --- | --- |
| `/__fixtures` | Gallery: case list, viewport switcher (1440×900, 1280×720, 390×844). Each case renders in a real-size iframe, so media queries apply. Scaled to fit when the window is smaller. |
| `/__fixtures?case=<id>&vp=<1440\|1280\|390>` | Gallery with the case and viewport preselected (the URL updates as you click) |
| `/__fixtures?case=<id>&frame=1` | The case alone, in the real page chrome |

Race cases (`case=`): `race-countdown-ready`, `race-countdown-3`, `race-go`, `race-p1`, `race-middle` (with a gain board), `race-last`, `race-2-racers`, `race-15-racers` (overflow minimap, local P8), `race-165-wpm`, `race-mistake`, `race-strict-blocked`, `race-coding` (long tokens), `race-shakespeare`, `race-final-stretch`, `race-time-up` (confirming), `race-reconnecting`, `race-warning`, `race-championship` (round 2/3, random), `race-spectating`.
Other cases: `home` (interactive, dead backend), `home-offline` (add `&backend=none` when opening the frame directly; the gallery does this for you), `vehicles` (all 15 models, numbers 0–999).

In racing and GO cases the input is live. It is focused on load and the real engine responds to keys, so you can type into any snapshot. Countdown and time-up cases have the input disabled, as in a real race. Snapshots are frozen: the clock does not run.

**Backend isolation.** On `/__fixtures` pages, `lib/supabase.ts` replaces the configured project with `http://127.0.0.1:9`, which refuses connections at once, or with no client when `backend=none`. On top of that, the gallery patches `fetch` and `WebSocket` to refuse any other cross-origin request. Both are behind `import.meta.env.DEV`. Verified: a browser sweep of every case at all three viewports, with real `.env.local` loaded, made **zero requests to supabase.co**. The only backend request was the homepage Create, which went to `127.0.0.1:9` and showed "Failed to fetch".

## Verification

| Check | Result |
| --- | --- |
| `npm test` | **141/141 pass**, 17 files (137 existing + 2 fixture sanity + 2 focus regression) |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| Fixture code in production `dist` | **Absent.** No fixture chunk; grep for `__fixtures`, `127.0.0.1:9`, `fixture-no-backend`, the gallery strings and fixture ids returns nothing |
| `git diff --check` | Pass |
| Focus regression (`screens/Race.focus.test.tsx`, jsdom) | Mounts the **real** LobbyScreen → Race → RaceView, with useLobby, api and supabase mocked. The input stays the same element and keeps focus through: a rival taking the lead, a reshuffle, a race-control board appearing, refreshed server rows, connection lost and restored (banner in/out), and clock ticks. A second test keeps the same element from countdown → GO (enabled and focused) → time-up (disabled, "official results", no winner wording). |
| Mutation check | Adding `key={model.connection}` to the typing wrapper makes the test fail ("input remounted after the connection drops"). Reverted. |
| Browser sweep (headless Chrome, dev server) | 22 cases × 3 viewports: no page errors, exactly one typing input on racer cases, focused on live cases, the engine responds to keystrokes, **no horizontal overflow at any viewport**. |
| Production-connected E2E / bots | **Not run**, as instructed. |

## Also fixed

- `screens/Practice.tsx`: with no backend configured (offline mode), the ghost lookup called `requireSupabase()` and threw an unhandled error, leaving the ghost panel stuck on loading. It now reports "signed out" like a guest. Production always has a backend, so live users were not affected. The fixtures found it.

## Unresolved

1. **Deterministic homepage states.** Home owns its form state, so the fixtures can only vary the backend. Busy, invalid and errors are reachable by interaction in `case=home`. Exact snapshots, and **Rejoin present** (which needs a real session), are not. Smallest proposed contract, if you want them: split Home into a container and `HomeEntry({ name, code, busy, error, invalid, available, onName, onCode, onCreate, onJoin, rejoin: ActiveRace | null, onRejoin })`, with Home keeping storage, `ensureSession` and navigation. I have not changed Home. It is your file, so tell me if you want this.
2. **Things fixtures can't show:** the running clock and car spring motion (frozen snapshots), sounds, and real keyboard behavior on phones (R10).
3. **The focus test can't type.** jsdom keystrokes are untrusted and `useTyping` ignores them by design. Typing behavior is covered by the browser sweep and the shared engine tests, not by the jsdom test.
4. **Dev dependency:** `jsdom` was added at the repo root for the focus test, and `vitest.config.ts` now includes `*.test.tsx`.
5. **E2E stays gated** on a separate disposable Supabase environment (R1). `scripts/e2e.ts` selectors are unchanged.

## Next

ChatGPT: the compact race presentation in `RaceView.tsx` (and the race components, Track, TypingPanel markup) against the fixtures, then the outstanding viewport checks. Run `npx vitest run client/src/screens` after each layout change. It fails if the input remounts.
