# Frontend foundation handoff

From ChatGPT (frontend) to Claude (integration). Updated 12 October 2026. These are local, uncommitted changes; nothing was deployed. Read alongside `04-phase0-handoff.md`, whose behavior contracts still apply.

## Implemented

- Replaced the homepage's rotating illustrated showroom with stock-car artwork, a condensed headline, a light race-entry panel, and a selectable collection preview. Create/join handlers, labels, validation, saved-name behavior, RejoinRace, embedded Practice, and `#practice` remain in place.
- Retained all 15 vehicle models and their original renderers. The collection selection is explicitly a preview, not a saved garage choice. The photographic number 07 car is editorial artwork, not a new selectable model.
- Introduced the Pit Lane charcoal, off-white, and yellow tokens in the existing token file. Existing legacy token names alias the new values where necessary. Updated shared navigation, buttons, controls, logo color, and footer treatment.
- Bundled Barlow Condensed 700, 800, and 800 italic through Fontsource. Fonts are emitted locally by Vite, compatible with the existing self-only font CSP.
- Removed the old homepage animation and conflicting homepage rules from the existing style layers. No fourth theme stylesheet was introduced. Other screens still contain legacy component styling and need later visual migration.
- Added a mobile layout that puts the entry form before the artwork, with a smaller image source. Fixed spacing around line breaks when those breaks are hidden on mobile.

## Changed files

| Files | Purpose |
| --- | --- |
| `client/src/screens/Home.tsx` | Homepage presentation and collection preview |
| `client/src/components/ui.tsx` | Wrapper for recoloring the existing mark without changing its tested SVG geometry |
| `client/src/styles/grid/tokens.css` | App-owned Pit Lane tokens |
| `client/src/index.css` | Theme aliases and rejoin surface color |
| `client/src/styles/studio.css`, `motorsport.css` | Shared foundations, homepage, removal of competing overrides |
| `client/src/main.tsx`, `client/package.json`, `package-lock.json` | Self-hosted font dependency/imports |
| `client/public/images/pit-lane/*.webp` | Desktop and mobile hero artwork |

The two WebP images were generated for this project with OpenAI image generation, then optimized: desktop 1536×1024 (195,270 bytes), mobile 768×512 (57,948 bytes). They depict a fictional GRID stock car. Neither is a screenshot of UI; all interface text and controls are native HTML. The concept PNGs under `concepts/` remain design references only.

## Verification

| Check | Result |
| --- | --- |
| `npm test` | Pass: 137 tests, 15 files |
| `npm run typecheck` | Pass |
| `npm run build` | Pass; main CSS 142.96 kB / 30.10 kB gzip; Barlow font files emitted locally |
| `git diff --check` | Pass |
| Desktop homepage | Visually inspected in native Chrome; headline, car, entry panel, navigation, and collection heading visible |
| One-character name | Browser interaction confirmed validation message |
| Two-character room code | Browser interaction confirmed validation message |
| Isolated connection failure | Observed disabled controls during request, then “Failed to fetch” and controls enabled again |
| Collection selection | Browser interaction confirmed Formula Racer heading and pressed state update |
| Practice link | Browser interaction confirmed URL changes to `/#practice`; no lap completed |
| Exact 1440×900 / 1280×720 / 390×844 acceptance | **Open.** Native DevTools interaction was unreliable; the device preview appeared clipped/scaled. Do not claim mobile overflow or keyboard behavior is verified. Recheck at default browser/page zoom before deciding whether clipping is a layout defect. |
| Multiplayer / production E2E | Not run |

No production users, rooms, or leaderboard rows were intentionally created. Browser form checks used a Vite process with Supabase overridden to an unreachable localhost endpoint. This is only a presentation/error-state preview, not a working test backend. The real `.env.local` was not changed.

Launch the isolated preview from the repo root:

```sh
VITE_SUPABASE_URL=http://127.0.0.1:9 \
VITE_SUPABASE_PUBLISHABLE_KEY=local-design-fixture \
VITE_PUBLIC_URL=http://127.0.0.1:5174 \
npm run dev -w client -- --host 127.0.0.1 --port 5174 --strictPort
```

## Next Claude batch

Execute the first batch proposed in `04-phase0-handoff.md`:

1. Extract `Race.tsx` into a logic container, `components/race/raceView.ts` types, and a temporary `RaceView.tsx` that preserves the existing presentation and stable typing input.
2. Add the development-only fixture gallery using the real typing engine. Include race states and deterministic homepage form states. Ensure fixture interactions cannot reach production Supabase; excluding the route from production builds alone does not provide backend isolation during development.
3. Add the input identity/focus regression check across rank, WPM, race-control, and connection updates. Preserve all test hooks and server timing/results authority.
4. Run unit tests, typecheck, and build. Verify the fixture route/chunk is absent from production output. Report any checks that require a disposable backend instead of running them against production.

Preserve this frontend batch. Claude owns Race logic, the model types, fixtures, App's development route, and regression tests. The temporary RaceView is the agreed bootstrap exception; after extraction ChatGPT owns its visual redesign. Do not rewrite Home or the shared styles to reproduce the old design. If a homepage fixture adapter requires changing Home's interface, propose the smallest integration contract in the handoff before overlapping edits.

Return the implemented prop contract, fixture URLs, test results, and any unresolved issues. ChatGPT's next batch is the compact race presentation, followed by the outstanding viewport checks and shared-screen visual regression review. End-to-end multiplayer testing remains gated on an explicitly separate disposable Supabase environment.
