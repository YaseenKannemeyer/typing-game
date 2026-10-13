# Waiting room and garage extraction handoff

From Claude (integration) to ChatGPT (frontend). 13 October 2026, branch `redesign`. Local and uncommitted; nothing was deployed. A separate batch from [10](10-submission-recovery-handoff.md), as requested in [09](09-race-accessibility-delivery-handoff.md). No SQL, no production E2E or bots. ChatGPT's files were not edited.

## Summary

Both screens are now split into a container (state, network) and a props-only view. **The rendered HTML is byte-identical to before**: twelve states were rendered in jsdom before and after the change and diffed, with React's generated ids normalized. After this handoff ChatGPT owns `WaitingRoomView.tsx` and `GarageView.tsx`, plus their scoped CSS.

| Container (Claude) | View (ChatGPT) | Types |
| --- | --- | --- |
| `screens/WaitingRoom.tsx` (same props: `state`, `refresh`; `rosterFrom` unchanged) | `components/lobby/WaitingRoomView.tsx` | `components/lobby/waitingRoomViewModel.ts` |
| `components/garage/Garage.tsx` (same props: `lobbyId`, `me`, `meIndex`, `players`, `locked`) | `components/garage/GarageView.tsx` | `components/garage/garageViewModel.ts` |

The type filenames differ from the view names by more than case, to avoid the macOS collision from 06.

## Waiting room contract

```ts
type RoomTab = 'destination' | 'garage' | 'how' | 'trophies';

interface WaitingRoomViewModel {
  room: { code: string; racerCount: number; maxRacers: number };
  isHost: boolean;
  canStart: boolean;            // racerCount >= MIN_PLAYERS_FOR_RACE
  starting: boolean;            // start-vote request in flight
  roster: RosterPlayer[];       // join order; ready = confirmed a garage build (the only readiness)
  settings: { seconds: number; zeroMistakes: boolean; destination: DestinationId | null; editable: boolean; saving: boolean }; // optimistic
  error: string | null;         // last start-vote or settings error
  tab: RoomTab;
  connection: 'live' | 'reconnecting';  // LobbyScreen still renders the banner + Retry
}
interface WaitingRoomActions {
  startVote(): void;
  changeSettings(seconds: number, zeroMistakes: boolean, destination?: DestinationId | null): void; // destination defaults to current
  openGarage(): void;           // tab → garage, scroll tabsRef into view, focus the selected tab
  selectTab(tab: RoomTab): void;
}
interface WaitingRoomSlots {
  garage: ReactNode | null;     // the Garage container; null without a seat (no garage tab)
  championship: ReactNode;      // ChampionshipHostPanel (its own actions and errors)
}
// <WaitingRoomView model actions slots tabsRef />  attach tabsRef to the room-details tab section
```

The container keeps: the optimistic settings and their rollback on error, dropping the optimistic copy once the lobby broadcast matches, start-vote error handling, the scroll and focus for "Open garage", and the championship panel's `refresh`. The view composes the static pieces it already used (`PageTitle`, `Paddock`, `RoomCode`, `InviteLink`, `WatchLink`, `RaceSettings`, `DestinationPicker`, `HowTo`, `TrophyRoom`, `SectionTabs`). Keep "Start mode vote" disabled for guests, and while fewer than 2 racers or settings are saving. Do not add a ready-check gate.

## Garage contract

```ts
type GarageFeedback = { kind: 'idle' } | { kind: 'draft' } | { kind: 'saved'; stored: boolean } | { kind: 'error'; message: string };

interface GarageViewModel {
  driverName: string;
  draft: VehicleBuild;          // the server's until the player edits, then theirs until confirmed
  primary: string;              // body (lobby) colour
  colors: { value: string; taken: boolean }[];  // all 15; taken = held by another racer
  locked: boolean;              // race on: nothing editable
  busy: boolean;                // confirmation in flight
  dirty: boolean;               // unconfirmed edits (confirm is enabled only then)
  feedback: GarageFeedback;
}
interface GarageActions { edit(patch: Partial<VehicleBuild>): void; paint(color: string): void; confirm(): void }
// <GarageView model actions initialStation? />
```

The container keeps: the draft following the server until the player edits; the taken-colour set; and **the confirm sequence, unchanged**: `setCarColor` (only if the colour changed), then `setVehicle`, then `saveBuild` (localStorage), then the session check, then the account's `setProfileGarage` (best effort). It is not atomic, as before. `stored: false` means the browser couldn't save the local copy; the lobby confirmation still succeeded.

The view keeps presentation-only state: the active station (its tabs and arrow-key focus), the "Test an animation" preview, and the workshop artwork. The copy for each feedback kind is in the view (`feedbackText`), with the original wording. `initialStation` exists for fixtures and tests.

## Fixtures

`/__fixtures?case=<id>` (gallery) or `&frame=1`. **Mock actions change local state only** (no API, no storage), with a fake 800 ms delay so in-progress states are visible. The championship slot is the real panel: its buttons can only reach the dead fixture endpoint, which the CSP isolates.

| Waiting room id | State |
| --- | --- |
| `room-host-2` | Host, 2 racers (you confirmed, the other not); actions succeed |
| `room-host-1` | Host alone; start disabled |
| `room-guest-3` | Guest; settings read-only |
| `room-15` | Full grid, long names, mixed confirmed/unconfirmed and online/offline |
| `room-reconnecting` | The LobbyScreen banner above the room |
| `room-settings-saving` | Saving (5 min, zero-mistake) |
| `room-settings-error` | Error shown; changing a setting fails and rolls back |
| `room-starting` / `room-start-error` | Start in flight / start fails when pressed |
| `room-champ-setup` / `room-champ-running` | Championship setup (host) / running with standings (guest) |
| `room-garage-tab` | Garage tab open |

| Garage id | State |
| --- | --- |
| `garage-idle` | Saved build; edit then confirm → saving → saved |
| `garage-draft`, `garage-saving`, `garage-saved` | Unsaved draft / confirming / saved |
| `garage-no-storage` | Saved for this lobby; browser storage unavailable |
| `garage-error` | Confirmation fails; the draft is kept and confirm stays enabled |
| `garage-locked` | Race on: every model and field disabled |
| `garage-taken` | 12 of 15 colours taken (paint station) |
| `garage-number-0` / `garage-number-999` | Number bounds; livery station, team, decal, 12-character lettering |
| `garage-wheels` | Wheels station |

All 15 models appear in every garage collection; `vehicles` still shows them standalone.

## Verification

| Check | Result |
| --- | --- |
| HTML parity (temporary jsdom test, deleted afterwards) | **12/12 states identical**: host destination tab, start-vote error, garage overview/paint/wheels/livery, garage draft and saved, how-it-works, settings saving, guest view, locked garage |
| `npm test` | **176/176 pass**, 22 files (158 after batch 10, plus 8 garage container, 8 waiting-room container and 2 lobby fixture tests) |
| `npm run typecheck`, `npm run build`, `git diff --check` | Pass. No fixture code or ids in production `dist`. |
| Garage container tests (view replaced by a probe) | Taken colours exclude your own; draft follows the server until the player edits; **confirm order** `setCarColor → setVehicle → saveBuild → session` (no colour call when unchanged; `setProfileGarage` for accounts); storage failure → `saved, stored:false`; error keeps the draft and dirty; busy while confirming; lock passed through |
| Waiting-room container tests (view replaced by a probe) | Host and guest facts and roster flags; no garage slot without a seat; optimistic settings and server follow-up; destination change keeps the other rules; saving while in flight; rollback and error; start-vote error; Open garage → tab, scroll, then selectTab |
| Browser sweep (23 cases × 3 viewports) | 72 layouts (the 69 real ones, plus one internal id that fell back to the first case): no page errors, CSP present, no horizontal overflow, **no off-origin requests** |
| Fixture interactions (headless Chrome) | 17/17: edit → draft copy; confirm → saving (disabled) → saved; after save confirm disabled; station arrow keys move focus and selection; error keeps confirm enabled; storage-failure copy; 12 taken colours disabled; locked disables all 15 models; start-vote error; settings optimistic then rolled back; Open garage focuses the Garage tab at 390px; guest start disabled |

## Notes for the redesign

- **Phone order:** 09 wants the preview and editor before the collection on phones. Today the collection comes first in the DOM. Reordering inside `GarageView` is yours. Keep the station tabs' arrow-key behavior and the native fields.
- **Feedback placement:** keep the feedback next to the confirm button. It is a `role="status"` paragraph today; keep it a polite status.
- **Long names:** `room-15` has 20-character names and 15 cars. Check both the paddock and the championship standings.
- **No new readiness meaning:** `roster[].ready` is "confirmed a build", nothing more.
- **Reconnect banner:** LobbyScreen places it above every phase. If the room layout should host it, ask and I will move it, as with the race.

Run `npx vitest run client/src/screens client/src/components` after each layout change. The container tests don't depend on your markup, so they should stay green through the redesign.
