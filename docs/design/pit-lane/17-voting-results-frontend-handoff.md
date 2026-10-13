# Voting and official results: frontend handoff

Written for Claude and the project owner, 13 October 2026.

Phase 5's frontend scope is implemented locally: all 15 cars, waiting room, garage, voting and official results. This batch needs Claude's integration review before treating Phase 5 as accepted. Phase 4's real multiplayer validation still requires a disposable database. Nothing in this batch was committed or deployed; no production E2E tests or bots were run.

**Owner-confirmed preference:** keep the new three-car Victory Lane panel. The owner explicitly chose it over the original illustrated, stepped podium. Preserve this presentation during integration review.

## What changed

**Voting:** a compact six-mode command board replaces the tall illustrated cards. Numbered options have native pressed buttons, lightweight circuit/symbol drawings, supplied vote counts and the voters' actual cars. Charcoal surfaces, condensed display type and a yellow selection edge match the garage/race. The server-aligned clock uses whole seconds for display; near-deadline amber is quiet, without flashing. The rule strip keeps duration, strict mode and destination values from the model.

**Closing:** `model.closing` disables all six options and the host's “End voting now” button. A polite status says “Voting closed. Confirming the server’s selection…”. No mode is chosen or inferred in the view. Clock/tally changes do not rewrite the selection announcement.

**Reveal:** `.g-vote-reveal` shows exactly `model.reveal.mode`; a tie explicitly says “TIE RESOLVED · SERVER SELECTION”. Random says the server will draw a passage mode. There is no die animation, client-side draw or invented countdown.

**Results:** Victory Lane uses HTML podium rows and the existing `Car` renderer instead of the countryside SVG venue/confetti. Only the first three supplied `finished` rows appear; their supplied positions remain intact. The podium uses place numbers, not unconfirmed trophy artwork. The cars are idle, with all saved appearance/livery support unchanged. A single finisher gets a two-column composition on larger screens; phones get compact stacked podium rows.

**Next action:** host actions sit directly under the podium. All disable while any action is busy; the active action keeps the existing spinner/`aria-busy` behavior. Errors now appear immediately beside these controls. Guests/spectators get the waiting status. Official standings retain the existing table and its hooks, with a charcoal header, local-player highlight and labelled mobile rows. Missing statistics remain missing.

**Awards:** pending personal awards show “Confirming awards…” with an explanation. No award cards or count appear until `awards.status === 'ready'`, even if the supplied arrays unexpectedly contain awards while pending. Once ready, race trophies and progression achievements stay separate. Under-review, left-early and eligible-but-no-award copy differ. Spectators have no personal haul. An empty “Everyone’s awards” section is omitted.

**Slots:** championship remains after standings; personal awards now precede the racer debrief, then other racers' awards. The container's actual slot components are preserved. Local surface/table styling aligns them with the results view; no chart, coaching, points or history logic changed. The personal-best board is a compact strip instead of a large green panel.

## Files and ownership

| File | Change |
| --- | --- |
| `client/src/components/voting/VotingView.tsx` | Vote options, clock, instructions, closing and reveal presentation |
| `client/src/components/results/ResultsView.tsx` | Native-car podium, actions/error placement, standings/awards/slot hierarchy |
| `client/src/styles/race-outcomes.css` | Styles scoped to these two views; no new global theme or token values |
| `client/src/main.tsx` | Imports that stylesheet after the existing layers |
| `client/src/components/voting/VotingView.test.tsx` | Five presentation contract tests |
| `client/src/components/results/ResultsView.test.tsx` | Seven presentation contract tests |
| This handoff, README, verification files | Review evidence and next brief |

Claude's containers, model types, fixture data/actions, existing helper components, all car/art/anchor files, SQL and e2e scripts were not edited. The existing `FinishVenue`, `ModeCard`, `TimerRing`, `VoteReveal` and `Confetti` helpers remain in source; these two views no longer use them. Removing unused helpers belongs to a later bounded cleanup after consumers are checked.

The stylesheet is a presentation module for two screens, not another global theme. Phase 7 still needs to consolidate the migrated rules and remove the corresponding legacy overrides. Keep its import order until that cleanup is verified.

## Contract and test hooks

- Both views still accept exactly the props defined in handoff 16. They have no timers, networking, sounds, local winner/point calculation or award requests.
- Voting uses `model.closing` as the authoritative closing state; it does not derive a new deadline from the displayed clock.
- `.g-mode`, `.g-vote-reveal`, “Pick your kind of fast.” and “End voting now” remain.
- “Every finish has a story.”, `.w-podium-list b`, `.g-results-table tbody tr`, `.g-award` and “Back to lobby” remain. Podium `<b>` text is still the rounded WPM value with `WPM`, or `—` when unavailable.
- Supplied row order and positions survive ties. Flagged and DNF rows get no table place badge and no podium slot; an empty eligible set has an explicit empty state.
- Podium cars use `Car` rather than nested `podiumVenueSvg`. The old nested-SVG artwork and its geometry tests are unchanged; please check this new consumer in the integration review.

## Verification

| Check | Result |
| --- | --- |
| `npm test` | **258/258**, 30 files; includes the existing isolated Chrome geometry test |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| `git diff --check` | Pass |
| Production bundle scan | 17 JS/HTML files, no `__fixtures`, dead fixture endpoint, fixture case IDs or fixture gallery markers |
| Browser layouts | **125**: all 11 vote + 14 results cases at 320×844, 390×844, 768×1024, 1280×720, 1440×900 |
| Layout/error checks | No page-level horizontal overflow or console errors; fixture CSP present in every case; measured vote/host buttons at least 44px high |
| Laptop fit | Voting controls end at **704px**; results-winner host controls end at **657px**, including the personal-best strip, at 1280×720 |
| Native interactions | Keyboard changed Hard → Coding, tally stayed 5/6, focus remained on the mode button; mock host close revealed Coding; all three result actions locked while busy, then recovered with their specific inline error |

The 12 new tests cover native mode selection/order, closing locks, server reveal despite a different vote leader, announcement stability through clock/tally updates, guest/error states, pending awards with populated arrays, official tied order, flagged/DNF filtering with supplied places, missing WPM, no finishers, spectator restrictions, busy/error recovery and under-review copy.

All browser interaction was on the isolated development fixtures. Their existing network isolation remains unchanged. The real debrief's previous-best lookup reports unavailable against the dead local endpoint, as designed. This does not certify real database writes, real multiplayer transitions, physical phone keyboards, screen-reader behavior or actual 200% browser zoom; those remain acceptance work for the safe test environment and release phase.

## Actual screenshots and raw evidence

- [Laptop voting](verification/voting-redesigned-1280.jpg)
- [Laptop official results](verification/results-redesigned-1280.jpg)
- [15-racer results and long names](verification/results-15-redesigned-1440.jpg)
- [Mobile voting](verification/vote-selected-redesigned-390.jpg)
- [Mobile closing](verification/vote-closing-redesigned-390.jpg)
- [Mobile winner and earned awards](verification/results-winner-redesigned-390.jpg)
- [Mobile second place and pending awards](verification/results-2-redesigned-390.jpg)
- [Mobile server tie reveal](verification/vote-reveal-tie-redesigned-390.jpg)
- [125 layout measurements](verification/voting-results-layout-checks.json)
- [Native interaction checks](verification/voting-results-interaction-checks.json)
- [Laptop fit measurements](verification/voting-results-laptop-fit.json)

The existing fixture URLs are unchanged: `/__fixtures?case=vote-selected&frame=1`, `/__fixtures?case=results-winner&frame=1`, or gallery URLs with `vp=390`, `1280` or `1440`. They exist only in local development.

## Ready-to-paste Claude brief

> Read `docs/design/pit-lane/17-voting-results-frontend-handoff.md`, then review the new voting/results presentation against handoff 16 and your containers. Keep the new Victory Lane panel: the owner explicitly confirmed that preference. Do not overwrite ChatGPT's frontend files or other uncommitted work. Check actual container → view transitions, deadline closing/late vote responses, server-selected reveal/ties/Random, authoritative row order and flagged/DNF eligibility, the new Car-based podium, pending → confirmed awards, racer/spectator slots, host action failures and existing e2e hooks. Use mock tests and isolated DEV fixtures only. No production E2E, bots, actual account/email actions, SQL changes, commits or deployment. Baseline is 258 tests, typecheck and build passing. Fix only your integration files if needed and document any frontend issue for ChatGPT.
>
> After that review, prepare the first bounded Phase 6 extraction: account/profile presentation contracts with unchanged-looking initial views and isolated fixtures, following the existing container/view pattern. You own `AccountScreen.tsx`, `ProfileScreen.tsx`, their new model contracts, mock fixtures and meaningful integration tests. Keep authentication, verification, recovery, guest preservation/ownership review, profile adoption, persistence, history requests and edit-name behavior in their current owners. Keep existing form behavior through controlled props or slots; do not reimplement auth. Provide guest, signed-in, loading, verification/preserve/retry/error states; profile empty/single/many/gapped/zero/unavailable data and name-edit busy/error states. Keep fixture isolation and production exclusion. If that scope needs splitting, deliver account first and list profile next. Write the next numbered handoff and link it in the README; leave ChatGPT's presentation modules/art/styles untouched.

Phase 6 then continues through leaderboard/trophies and practice, first-lap, spectator and remaining experience screens. Phase 7 is CSS/asset cleanup; Phase 8 is release verification. The disposable-database decision still gates real multiplayer acceptance.
