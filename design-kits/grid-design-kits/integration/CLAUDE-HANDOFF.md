# Integration instruction for Claude in VS Code

The complete collection is in `design-kits/grid-design-kits/`. Read the root README, `manifest.json`, the numbered kit READMEs, source modules, and `OPEN-ME.html`.

Use the collection as the visual source of truth for the existing React/TypeScript/Supabase typing racer. Keep the source folders as reference. Integrate the existing application; do not build a second application or mount the showroom as an iframe.

Start by reading project instructions and these files:

- `client/src/components/{Car,Track,TypingPanel,StatsBar,CopyButton,ui}.tsx`
- `client/src/screens/{Home,NameGate,WaitingRoom,LobbyScreen,Voting,Race,Results,Practice}.tsx`
- `client/src/game/{useLobby,useTyping,types,modes}.ts`
- `client/src/lib/{api,clock,storage,supabase}.ts`
- `shared/src/{ranking,visibleCars,stats,trophies,typing,types}.ts` and their tests.
- Supabase RPC migrations to identify the authoritative state transitions.

## Implementation order

1. Port tokens and reusable UI primitives. Define prefixed component styles to avoid global conflicts.
2. Integrate vehicles/trophies once, with typed model and trophy IDs.
3. Apply Track + HUD + Typing to Race; connect moments to authoritative events.
4. Apply Podium + Results; feed actual finishers and server awards.
5. Apply Voting, Lobby and System states to the existing flow.
6. Apply brand assets and loading states. Set PNG Open Graph metadata on a publicly reachable URL; a local file path will not work in shared invite previews.
7. Add opt-in sounds and consistent motion. Clean up all timers/listeners/audio nodes.

## Requirements

- Preserve existing React routing, hooks, scoring and tested game semantics.
- Reuse your visible-car function; ensure at most four displayed cars and always include the local racer.
- Adapt HTML string renderers into React components or narrow trusted-SVG adapters. Never insert player-controlled HTML.
- All lobby controls and transitions remain server-authorized. Disable cosmetic edits after waiting ends.
- Use actual synchronized deadlines, progress, positions and results, not the showroom data or local timer policy.
- Random resolves to a real passage mode server-side. Die animation illustrates an already determined result.
- Trophies remain server-calculated. Unstoppable is progression; Participation may go to multiple otherwise unawarded finishers.
- Keep stable player IDs during lane reorder; use motion helper logic rather than remounting every car.
- Keep input focus across network updates; use existing `useTyping` logic for IME, corrections and scoring. Do not adopt the simple showroom typing controller as production code.
- Confirm finish anchors for every vehicle model, not just the outer SVG box.
- DNF and Under review are distinct statuses. Never invent scores or infer cheating from visual cues.
- Keep guest names and text safe, and validate cosmetic model IDs/colours/number fields.
- Mute by default; no audio before user interaction; respect reduced motion.
- Retain good phone layouts and a readable passage when the software keyboard is open.

After implementation, run the existing build/type checks/tests and browser-test create/join, voting, countdown, racer-window edges, typing focus, finish states, results and rematch. Compare assembled screens to the showroom. Report checks actually performed and unresolved server-rule decisions. Do not reset the database or rewrite applied migrations.
