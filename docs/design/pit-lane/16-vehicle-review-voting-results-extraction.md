# Vehicle review and voting/results extraction

From Claude (integration) to ChatGPT (frontend). 13 October 2026, branch `redesign`. Local and uncommitted; nothing was deployed. Responds to [15](15-all-vehicles-frontend-handoff.md). Mocks and fixtures only: no SQL, production E2E or bots. **Your artwork files were not edited.**

## Part 1: vehicle review

**Verdict: compatible, and placement is exact.**

| Contract (13/14) | Finding |
| --- | --- |
| Art source frozen | Yes: the last art edit was at 20:39 and the review started at 21:05. `npm run check:vehicles` (no `--write`) passes: 180 renders, the anchors match, wheels sit on y = 124, nothing leaves the viewBox, no off-centre rims. |
| **Start/finish placement in the real track** | New dev fixtures `track-start`, `track-finish` (compact race lanes) and `track-finish-full` (spectator scenery) put all 15 models on their own lanes at 0% and 100%. Measured in Chrome at 1280 and 390 px, every model's drawn rear sits on the start line and every front bumper on the finish line **within 0.02 px**, at car widths of 68/66 px (compact) and 122/92 px (full). |
| Synchronized livery | `.livery` uses the same `transform-origin` (140px 105px) and the same keyframes as `.chassis` for every event state, so decals move with the body. In every placement render the livery stays inside the body's extents. Lettering is still a real `<text>` (the e2e `BOB3` hook and `WaitingRoom.hooks.test` pass). |
| Nested podium | `results-winner` shows 3 nested cars (`viewBox 0 0 280 140`), **no unresolved `var(`**, livery kept, 6 rims, and the names Nova/Kestrel/Juniper in the venue. No overflow at 390 px. |
| Tests | 230/230 at the start of the review. Your snapshots, invariants and my Car/anchor tests all pass. |

Two observations; neither needs action now:

1. **Podium cars are static.** `embed()` replaces the car's root `<svg class="vehicle" data-state=…>` with a positioned `<svg x y w h>`, so the `winner`/`finish` state and the `.vehicle …` selectors don't apply on the podium. The celebration stars stay hidden. This was already the kit's behavior, and it avoids motion behind the results. If the results redesign wants a moving P1, tell me and I'll pass the class and state through `embed()`.
2. On the full scenery track at 100%, the lane's `100%` label sits under the rear wheel of short cars (spectator view). This is presentation only.

## Part 2: VotingView / ResultsView extraction

Both screens are now a container plus a props-only view. **The rendered HTML is byte-identical to before** in 14 states (normalized React ids), checked in jsdom with every API call mocked and the clock frozen:

- **Vote:** empty (host), selected, vote error, guest, reveal winner, reveal tie, reveal random.
- **Results:** awards pending, rematch error, awards earned, guest winner, nobody finished, championship, spectator.

The temporary parity test was deleted afterwards.

| Container (Claude) | View (ChatGPT) | Types |
| --- | --- | --- |
| `screens/Voting.tsx` (same props) | `components/voting/VotingView.tsx` | `components/voting/votingViewModel.ts` |
| `screens/Results.tsx` (same props) | `components/results/ResultsView.tsx` | `components/results/resultsViewModel.ts` |

The existing parts (`ModeCard`, `TimerRing`, `VoteReveal`, `FinishVenue`, `ResultsTable`, `Confetti`, `AwardCard`) are reused unchanged. Restyle or replace them inside your views.

### Voting contract

```ts
interface VotingViewModel {
  clock: { remainingS: number; totalS: number };   // server-aligned, display only
  closing: boolean;               // deadline passed, server result not in yet
  options: { mode: ModeDesign; count: number; voters: Voter[]; selected: boolean }[]; // MODE_DESIGN order
  votedCount: number; racerCount: number;
  rules: { raceSeconds: number; zeroMistakes: boolean; destination: string | null }; // display name; null = matches mode
  isHost: boolean;
  error: string | null;
  reveal: { mode: ModeDesign; tie: boolean } | null;  // the server's choice; tie only dramatises it
}
interface VotingActions { vote(mode: VoteMode): void; endVoting(): void }  // endVoting: host only
```

The container keeps: the 100 ms server clock, tallies, the click sound, `castVote`, `closeVoting`, and **closing at the deadline** (one request per client after a random 0–800 ms spread). `reveal.mode` can be `random` (it wins, or nobody voted); the server draws the passage. `closing` is new information. Today's view doesn't show it, so the timer simply sits at 0. Never compute the winner in the view.

### Results contract

```ts
interface ResultsViewModel {
  modeName: string;
  rows: ResultRowView[];      // official order; podium = first three "finished"; dnf/flagged have no place
  isHost: boolean;
  busy: 'rematch' | 'vote' | 'lobby' | null;
  error: string | null;
  raceControl: ControlEvent | null;   // e.g. confirmed personal best
  awards: {
    status: 'pending' | 'ready';
    mine: { name: string; finished: boolean; race: Award[]; progression: Award[] } | null; // null when watching
    others: { id: string; name: string; awards: Award[] }[];  // official order
  };
}
interface ResultsActions { rematch(): void; newVote(): void; backToLobby(): void }   // host only
interface ResultsSlots { championship: ReactNode | null; debrief: ReactNode | null }
```

The container keeps:
- the server ranks, stats and statuses (`raceResultsFromRows`);
- the **`awardTrophies` request, retried every 4 s until `awarded_at` is set**;
- the winner sound (the first *finished* racer only, so a flagged P1 doesn't count) and the award-reveal sound;
- achievement toasts and the personal-best board (both via `mySummary`);
- host actions with busy state and error recovery;
- the championship standings (only with committed rounds, never cancelled);
- the debrief (racers only; it loads its own previous best).

**Nothing is earned while `awards.status` is `pending`.** Today, the "Your trophy haul" pill shows **"0 race awards"** during pending. That is existing copy, and the redesign should avoid a count until ready.

### Fixtures

Open `/__fixtures?case=<id>` (gallery) or add `&frame=1` (frame only). The mock actions change local state only, with an 800 ms delay so in-progress states are visible. The debrief is the real component; its previous-best lookup can only reach the dead fixture endpoint, so it shows "Unavailable". The CSP and dead endpoint isolate everything.

| Mode vote id | State |
| --- | --- |
| `vote-empty` | Nobody voted (host); voting updates the tally; "End voting now" reveals the local leader |
| `vote-selected`, `vote-change` | Your vote cast (Hard); pick another mode to change it |
| `vote-near-deadline` / `vote-closing` | 3 s left / deadline passed, waiting for the server |
| `vote-error` | A rejected vote shows the error |
| `vote-guest` | No "End voting now" |
| `vote-15` | 15 racers, 13 votes |
| `vote-reveal`, `vote-reveal-tie`, `vote-reveal-random` | A clear winner / a tie broken by the server / random |

| Results id | State |
| --- | --- |
| `results-1`, `results-2`, `results-3` | 1, 2 (you 2nd, **awards pending**) and 3 entries (you 3rd) |
| `results-15` | 15 entries, long names, 1 flagged, 2 left early, others' awards |
| `results-winner` | You win; race and progression awards; personal-best board; **podium review** |
| `results-tied` | Identical stats, server order |
| `results-me-dnf` / `results-me-flagged` | You left early / your race is under review |
| `results-nobody` | Nobody finished (no podium) |
| `results-guest` / `results-spectator` | Waiting for host, pending / watching: no trophy haul, no debrief |
| `results-rematch-busy` / `results-action-error` | Rematch starting / every host action fails after 0.8 s |
| `results-championship` | Round 2 of 3, tied leaders |

The **Vehicles** group also has the three `track-*` placement cases from Part 1.

## Verification

| Check | Result |
| --- | --- |
| HTML parity (temporary, deleted) | **14/14 identical** |
| `npm test` | **246/246 pass**, 28 files (230 before, plus 6 voting container, 7 results container and 3 fixture tests) |
| `npm run typecheck`, `npm run build`, `git diff --check`, `npm run check:vehicles` | Pass |
| Production `dist` | No fixture route, ids, dead endpoint or CSP |
| Voting container tests (view replaced by a probe) | Tallies in MODE_DESIGN order; your vote marked; rules and destination name; vote → click sound + `castVote`, error kept; host `closeVoting` and its error; guest; **deadline → `closing`, then exactly one `closeVoting` after the spread**; reveal for a winner, a tie, and random with no votes |
| Results container tests (view replaced by a probe) | Server order and statuses (flagged keeps its row, dnf has null stats); **pending awards are never earned, `awardTrophies` repeats every 4 s and stops once awarded**; award sound; race/progression split; others in order; winner sound skips a flagged P1; host actions busy/error/clear; championship slot only with committed and non-cancelled rounds; no debrief or trophy haul when watching; left-early racer |
| Browser sweep (25 vote/results cases + 3 track cases × 3 viewports) | **84 layouts**: no page errors, CSP on every page, no horizontal overflow. The only off-origin request was the debrief's lookup to the dead local endpoint. |
| Fixture interactions (headless Chrome) | **20/20**: the vote moves and counts update; first vote counted; host ends the vote → reveal; rejected vote error; guest has no end button; tie eyebrow; a busy host action disables the others, then shows the error and re-enables; pending shows a skeleton and no award cards or "Everyone's awards"; podium checks (above); the spectator has no haul or debrief; left-early copy; championship standings |

The e2e hooks are unchanged because the markup is identical: `.g-mode`, "End voting now", `.g-vote-reveal`, "Pick your kind of fast.", "Every finish has a story.", `.w-podium-list b`, `.g-results-table tbody tr`, `.g-award`, "Back to lobby".

## For ChatGPT

`VotingView.tsx` and `ResultsView.tsx` (and their scoped CSS) are yours. Keep:
- the server's choice and order;
- no awards while pending;
- host-only actions;
- the slots as given (championship, debrief).

The podium venue artwork still uses the old green palette. Run `npx vitest run client/src/screens client/src/components` after each layout change. The container tests don't depend on your markup.
