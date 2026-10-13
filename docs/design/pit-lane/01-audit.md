# Element-by-element design audit

Evidence key: **Live** = current homepage rendered in Chrome; **Source** = current source or kit documentation; **Saved** = existing screenshot, potentially older than current code. This is a comprehensive review of the identified UI families, not a claim that every runtime state was exercised.

Priority: **P0** = defines identity or affects core typing usability; **P1** = needed for a coherent release; **P2** = polish after the core direction works.

## Overall diagnosis

The site already has a recognizable palette, a real car collection, a coherent race flow, server-aware results, and useful comfort settings. The issue is the chosen visual language and the distribution of attention. The result currently reads as a playful club interface with motorsport decoration. The desired identity requires changes to car art, environment, typography, surfaces, and screen hierarchy together.

The design-taste skill is useful for the homepage; its marketing-page patterns should not govern a realtime typing screen. A large hero, generous section spacing, and scroll animation would make gameplay worse. The product screens need their own compact layout rules.

## Shared identity and components

| Element | Assessment | Decision | Priority / evidence |
| --- | --- | --- | --- |
| GRID name | Short, memorable, and appropriate to both typing and racing. | Keep. No naming project needed. | P1 / Live |
| Existing G mark | Distinct enough to reuse; the rounded lime enclosure feels softer than the target. | Keep geometry initially, recolor through tokens. Review enclosure only as a separate brand refinement. | P1 / Live |
| Wordmark | Current italic treatment contributes some pace. | Keep readable and compact; do not increase skew across every word. Generated concepts do not replace the logo. | P1 / Live |
| Overall palette | Forest, sage, olive, and lime dominate both UI and environment. The result feels pastoral and friendly. | Neutral asphalt/steel foundations and signal yellow. Keep color in liveries and meaningful statuses. | P0 / Live + Source |
| Surface hierarchy | Repeated dark-green panels have similar emphasis; light entry ticket stands out effectively. | Preserve the entry-ticket contrast; use flat dark surfaces and separator rules elsewhere. | P0 / Live + Saved |
| Borders and corners | Rounded, bordered panels accumulate through screens. | 2px controls, 4px panels, fewer enclosing boxes. Group through spacing first. | P0 / Live + Source |
| Headings | Heavy italic capitals now appear widely through `motorsport.css`. They communicate speed but flatten hierarchy when used everywhere. | Condensed display only for hero, screen title, and major result. Neutral mixed-case section titles and body copy. | P0 / Source |
| UI/body type | Self-hosted Geist is a strong existing foundation. | Retain. Add one display family instead of replacing the entire font system. | P1 / Source |
| Numbers | Monospace telemetry is appropriate. | Retain tabular alignment, strengthen WPM/position/time hierarchy, reduce label noise. | P0 / Saved + Source |
| Tiny uppercase labels | Many 9–11px labels, letterspaced captions, and eyebrows add visual chatter. | Meaningful labels generally 12–14px; remove ornamental labels. Keep uppercase for race signs and compact statuses. | P1 / Source |
| Icons | Existing kit provides a consistent reusable set. | Reuse and recolor; replace only visibly unsuitable motifs. Avoid adding a second generic icon library. | P2 / Source |
| Buttons | Clear labels and loading/disabled variants already exist. Rounded styling is softer than desired. | Yellow primary, steel secondary, quiet text action; maintain busy width and 44px minimum interaction target. | P1 / Live + Source |
| Inputs | Labels and explicit join code make entry understandable. | Retain labels, sharpen shape, use 16px input type and clear error/focus treatment. | P1 / Live |
| Pills and tabs | Repeated pills make race information resemble dashboard filters. | Flat status flags and segmented controls. Preserve tab semantics and selected-state text. | P1 / Saved + Source |
| Navigation | Three principal links keep the app understandable; auth-dependent Profile/Save progress is useful. | Keep routes and names. Underline current destination instead of a large filled tile. Reduce race chrome height. | P1 / Live + Source |
| Sound control | Visible mute control and user-driven sound are good. | Keep global preference and accessible label. No auto-revving hero. | P1 / Live + Source |
| Header checker strip | Racing association is clear, but the checker is decorative on every page. | Use sparingly at entry or final results; do not surround all UI with checks. | P2 / Live |
| Footer | Motor-club identity is consistent, but competes with a cleaner race-day direction. | Quiet GRID signature and useful links; remove duplicate slogans where redundant. | P2 / Live |
| Focus/skip link | Skip link, focus styling, and motion preferences exist. | Preserve and test; recoloring must not erase focus on the light ticket. | P1 / Source |

## Homepage and entry

| Element | Assessment | Redesign decision | Evidence |
| --- | --- | --- | --- |
| Hero headline | “Type it. Race it.” is concise and relevant. Current large italic type helps. | Keep copy, tighten display character, coordinate it with car art rather than increasing size again. | Live |
| Hero supporting copy | Friendly-rivalry language suits the game but is longer than necessary near entry. | “Race up to 15 players. Same text. Highest WPM wins.” Keep the timed-race rule near the form. | Live |
| Race-format strip | Useful facts, repeated again under the form. | One compact facts row; avoid a duplicate full-width band from the generated concept. | Live |
| Car showcase | The largest art is framed like a separate widget. Pastoral backgrounds and toy-like silhouettes overpower the racing headline. | Integrate one strong stock car into a pit-lane scene with barriers, catch fencing, and grandstand depth. | Live |
| Automatic car rotation | Existing pause-on-hover/focus and reduced-motion handling are useful; rotation can switch the brand's lead image to a taxi or rocket. | Make the default hero a fixed stock-car-led composition. Keep explicit browsing in the lineup. | Source + Live |
| Decorative race number | A big number is appropriate, but it currently tracks carousel index rather than durable driver identity. | In marketing artwork use a clearly fictional livery number. In game bind it to vehicle configuration. | Live + Source |
| Showcase arrows | Discoverable and labelled, but compete with the primary entry task. | Move collection browsing controls into the lineup. Retain 44px targets. | Live |
| Race-entry ticket | The light panel is the strongest structural idea in the current homepage. | Keep, sharpen corners, reduce top padding, simplify divisions, make Create a room yellow with dark text. | Live |
| Racing-name input | Correctly precedes both create and join. | Retain shared name dependency, nickname autocomplete, normalization and validation. | Source |
| Create action | Correct primary task and clear wording. | Keep label and existing handler; do not introduce “Quick race” implying unimplemented matchmaking. | Live + Source |
| Join action | Room code is understandable; secondary hierarchy is right. | Keep six-character code, uppercase normalization and form submission behavior. | Live + Source |
| First-lap link | Useful but visually buried in a small explanatory sentence. | Dedicated clear text link near Practice solo; keep tutorial optional. | Live |
| Offline entry | Offline practice fallback already exists. | Preserve; use a compact availability message and prominent practice action. | Source |
| Car lineup | Collection is genuine content; novelty vehicles dilute the lead identity when given equal marketing prominence. | Lead visually with racing silhouettes; preserve all 15 choices in collection/garage. Do not remove existing models. | Live + Source |
| Equal-performance note | Essential to prevent customization being mistaken for a speed advantage. | Keep near lineup and garage: “Every car is equally fast. Your typing decides.” | Live |
| Embedded practice | Valuable immediate demonstration, but ghost, track, gauge, drills, and passage make the homepage very long. | Provide direct Practice solo anchor; start with compact passage + three stats. Keep ghost and drills available in disclosed sections. | Source + Live tree |
| Practice versus timed race | Solo practice completes a passage; multiplayer runs until the clock stops. | Keep labels distinct: Passage complete versus Time left. Never imply the same end condition. | Source |
| Invite/name gate | Short form and optional tutorial are already appropriate. | Reuse the entry-ticket visual; retain room context, Cancel and validation. Associate error text with input. | Source |

## Lobby, garage, destinations, and voting

| Element | Assessment | Redesign decision | Evidence |
| --- | --- | --- | --- |
| Waiting-room title | Long conversational headline uses valuable space. | Short title “The starting grid”; retain useful instruction beneath. | Source + Saved |
| Room command bar | Current source already elevates room code, garage and Start mode vote. Older screenshots do not show this improvement. | Keep this structure, flatten styling, keep the host action visible. Do not re-solve the older missing-action layout. | Source |
| Room/invite code | Code and copy actions appear in multiple regions. | Make one primary invite block; secondary header room label stays compact. Keep distinct player and spectator links. | Source |
| Paddock building | Useful setting, but resembles a flat green storage building. | Reduce height and redraw as pit garages with neutral concrete, number plates, and livery flashes. | Saved + Source |
| Occupied bays | Cars and explicit Host/You/status labels are valuable. | Compact pit-box rows/cards with larger driver numbers and visible car silhouettes. | Saved + Source |
| Empty bays | Desktop still renders every open seat, so a two-player room looks mostly empty. Mobile already summarizes empty bays. | Use one “13 places available” invitation tile on desktop too, with optional full-grid view. Keep capacity truthful. | Source |
| Ready indication | Source derives “Ride confirmed” from vehicle selection. This is not a separate all-player race-ready system. | Keep wording “Ride confirmed.” Do not invent ready toggles or gate starts on a nonexistent readiness contract. | Source |
| Race settings | Duration and zero-mistake rule are clear, but sit inside repeated cards. | Compact pit-board form with segmented duration and explicit correction-rule text. Keep host-only controls and save state. | Saved + Source |
| Garage access | Current handler changes tab, scrolls, and focuses it. This is better than a dead decorative link. | Keep functional behavior; shorten the distance by reducing roster height. | Source |
| Workshop stage | Physical garage metaphor is a good match. Green tint and small toy car weaken it. | Neutral workshop, larger selected vehicle, less prop detail, clear paint/livery controls. | Saved |
| Model picker | Broad collection is a strength; tiny thumbnail cards reduce differentiation. | Larger silhouettes on a flat selectable strip; visible selected name and check. Preserve model IDs. | Saved + Source |
| Paint | Useful customization without gameplay advantage. | Label colors and provide selection check, not color alone; preview must match saved selection. | Source |
| Wheels/effects | Offers expression, but neon/smoke can dominate the target style. | Keep existing choices; default to restrained wheels and no continuous effect in race. | Source + kit |
| Livery/team/number | The best existing foundation for stock-car identity. | Larger door numbers, coherent fictional team palettes, race decals, limited lettering. Preserve validation and saved data. | Source + kit |
| Preview animation control | Reads like a design showroom/debug control in production. | Remove from the default player flow or tuck under preview options; keep essential selection feedback. | Saved |
| Confirm vehicle | Important distinction between preview and saved choice. | Stable visible action plus Saving/Saved/Retry status near the preview. Preserve lock state during voting/race. | Source |
| Destination thumbnails | Pleasant travel postcards; road/country/neon variety does not evoke an organized race venue. | Redraw the same destination IDs as circuits: coast circuit, desert speedway, city circuit, wet circuit, night circuit, rural oval. | Saved + kit |
| Destination semantics | Existing selection is cosmetic. | Keep “Scenery only”; do not add grip, weather penalties or handling statistics. | Source |
| Room-detail tabs | Good progressive disclosure. | Keep tab names and behavior; sharpen active underline. Ensure Garage tab remains reachable at mobile zoom. | Source |
| Vote heading/timer | Clear task and visible countdown. | Compact race-control header with numeric countdown, rather than a large ornamental ring. | Saved + Source |
| Six mode choices | Meaningful set; oversized generic illustrations take too much space. | Compact two-row qualifying board, mode name first, one short explanation, small thematic image, vote count and selected check. | Saved |
| Mode artwork | Mountain, quill, die, code window are readable but styled like a general learning app. | Reframe as printed challenge labels on race signage. Do not make literary/coding modes unrecognizable. | Saved |
| Vote markers | Voter cars add personality. | Keep within a bounded strip with accessible count and “Your vote.” | Saved |
| Winning reveal | Useful event transition. | Short full-width mode announcement; exact result comes from server. Retain Random-to-resolved-mode clarity. | Source + kit |
| End voting | Host control is real functionality. | Secondary action with clear disabled/loading state; no visual competition with voting choices. | Saved + Source |

## Countdown, race, and typing

| Element | Assessment | Redesign decision | Priority / evidence |
| --- | --- | --- | --- |
| Race composition | Dashboard, control card, four-lane scene and text are stacked. The saved desktop frame puts passage below 900px. Current CSS still reserves substantial track and gauge height. | Budget the entire standard race around 1280×720; treat passage/input visibility as the layout constraint. Current viewport behavior needs fresh verification. | P0 / Saved + Source |
| Race metadata | Mode, duration, player count, room, and optional round are useful but split across lines. | One compact session strip, with wrapping only at narrow widths. | P1 / Source |
| Speedometer | Strong driving metaphor but consumes a large area. Fixed 160 dial with uncapped numeric WPM can peg while values rise. | Large numeric WPM in race; optional small rev-style decoration, never cap the value. Retain full dial only in an optional practice view. | P0 / Source |
| Position | Important performance signal, currently one of several equal stats. | P03 / 15 as a distinct metric; label local player consistently. | P0 / Saved |
| Time left | Determines outcome in this timed game. | Prominent stable-width clock, alongside WPM. Warning at a defined threshold without blinking or shaking. | P0 / Source |
| Accuracy/mistakes | Useful, lower priority than reading and timing. | Secondary numbers with labels. Mistake color should be restrained, not a huge alarm. | P1 / Saved |
| Race-time bar | Honest label in current source, but visually another progress bar. | Optional thin clock rail; never label as distance or laps remaining. | P1 / Source |
| Race-control panel | Large static “Green flag” card takes prime space. | Single reserved-height event strip. Keep detailed event text out of the typing surface. | P0 / Saved + Source |
| Track environment | Existing SVG worlds are cohesive but look like roads in a casual illustration. | Tarmac, white lane paint, compact pit barrier and catch fence. Scenery remains subordinate. | P0 / Saved |
| Cars | Silhouettes vary dramatically in style and seriousness. | Establish stock-car hero art and consistent race rendering. Maintain existing 15 models until compatible refinements are ready. | P0 / Live + Saved |
| Lane labels | Name/position/WPM are useful but repeat HUD data and occupy horizontal width. | Compact name + number; reveal extra data in standings. Preserve local-player label. | P1 / Saved |
| Empty lanes | Make small races look unfinished. | Quiet unoccupied lanes or reduced scenic emphasis; any lane-count behavior change must preserve the visible-car contract. | P1 / Saved |
| Progress numbers | Existing car percentages are relative to leader; car location also follows race time. “100%” beside a car far from finish is easy to misread. | Remove bare percentage labels or explicitly name “relative to leader.” Do not rewrite scoring to match road art. | P0 / Source + Saved |
| Finish stripe | Suggests first-across-line racing while winner is highest WPM at the timer. | Treat as finish moment at time-up; explain timed rule. No premature winner animation. | P0 / Source |
| Standings/minimap | Current minimap only appears when racers exceed visible cars; full standings exist in spectator UI. | Optional compact timing list on desktop, shared visual language with spectator. Local player always identifiable; expose full list without stealing typing focus. | P1 / Source |
| Start lights | Authentic and already supplied by kit. | Keep accurate countdown and restrained lights. Timing must follow server clock; animations do not determine start. | P1 / Source |
| Correct/current/wrong/upcoming text | Strong existing semantics and correction behavior. | Preserve engine, use readable contrast, underline/block cursor and mistake marker in addition to color. | P0 / Source |
| Typing input | Native input with keyboard handling and visible focus is valuable. | Keep native input, stable DOM node, focus and IME behavior. UI movement cannot remount it. | P0 / Source |
| Passage density | Five visible lines in saved race screenshots expand the page considerably. | Target previous/current/next context where semantics permit; allow internal passage scrolling. Preserve larger comfort sizes rather than clipping. | P0 / Saved |
| Mode-specific typing | Coding and Shakespeare have distinct presentation. | Keep content semantics and useful code formatting; reduce dramatic surface changes during gameplay. | P1 / Source |
| Help text | Space/Backspace/Enter instruction is practical. | Keep short and readable, not 9px decorative metadata. | P1 / Saved |
| Time-up state | Already communicates finalization. | Freeze input and show “Confirming results…” in reserved space. No celebration until authoritative result arrives. | P0 / Source |
| Rejoin/network warning | Recovery is existing product value. | Compact legible warning with retained typing context. No page-covering visual effect during recoverable loss. | P1 / Source |

## Results, trophies, account, profile, and supporting screens

| Element | Assessment | Redesign decision | Evidence |
| --- | --- | --- | --- |
| Results headline | “Every finish has a story” is generic relative to the actual outcome. | Lead with real outcome: “P03. 84 WPM.” Winner treatment: “Victory lane.” | Saved |
| Finish venue/podium | Useful scene, but a large empty stage and several nested frames dilute the result. | Compact victory-lane stage with winning car; top-three summaries adjacent. Only show eligible finishers. | Saved |
| Rematch actions | Already visible before long award content. | Preserve Race again as primary; group mode vote and lobby as secondary. Host/guest states remain explicit. | Saved + Source |
| Official standings | The strongest source of truth on this page. | Move closer to outcome; flat timing-sheet table with aligned WPM and status labels. Preserve DNF/review handling. | Saved + kit |
| Race awards | Colorful assets are a strong reusable collection, but a long grid makes all awards equally prominent. | Feature up to three personal highlights, then an expandable complete list. Never hide access to earned awards. | Saved |
| Everyone's awards | Useful socially, expensive in vertical space. | Group by racer in collapsible sections below personal result. | Saved |
| Trophy artwork | Coherent, already contains gold/silver/bronze and category differentiation. | Reuse first; sharpen plinth/lighting treatment later. Do not regenerate 20 assets before fixing core screens. | Saved + kit |
| Trophy catalog | Helpful descriptions, but current full grid repeats long copy. | Icon/name/earned state first; rule detail on selection. Keep all 20 IDs and exact award rules. | Saved |
| Cabinet/shelves | The physical metaphor works, but olive shelves and dense descriptions look heavy. | Neutral steel shelf, stronger earned artifacts, quieter locked silhouettes with readable labels. | Saved |
| Achievement toast | Existing queue/focus behavior is valuable; saved result toast overlays table content. | Reserved notification region or place below primary outcome; suppress/defer nonessential race-time celebration. | Saved + kit |
| Account story | Personalized guest summary has a clear reason to sign up. | Pit-pass treatment with real driver/car summary. Retain concise ownership/verification explanation. | Saved + Source |
| Auth form | Existing flows include verification, recovery and preservation, not just a sign-in box. | Restyle using the entry-ticket primitives; keep every flow and guest continuation. | Source |
| Merge/preserve review | High consequence for progress; clear current confirm/cancel copy matters. | Make the two identities and pending/saved states explicit; avoid decorative language implying success early. | Source |
| Profile identity | Large car plus name fits the game. | Driver credential with number/livery and simpler inline metrics. Keep public identity separate from email. | Saved mock + kit |
| Profile stats | Best WPM, races, wins and trophies are meaningful. | Distinguish distinct trophy types from total awards; preserve metric definitions. | Saved mock + kit |
| Trend charts | Existing data gaps, units and table alternatives are good. | Retain semantics; increase tick readability and use yellow WPM / blue accuracy with direct labels. | Saved mock + kit |
| Best-by-mode | Useful compact comparison. | Keep scales meaningful; label missing versus zero. Flat rows instead of another heavily bordered panel. | Saved mock |
| Hall of fame hero | Existing podium identity works but empty second/third slots dominate a small dataset. | Adapt to 0/1/2/3 available leaders; show real champion prominently, no fake podium occupants. | Saved |
| Leaderboard filters/table | Needs quick comparison more than promotional copy. | Filter bar directly above aligned rank/driver/WPM/accuracy table; preserve period/mode and actual sort rules. | Source + kit |
| Spectator view | Existing standings, featured racer and delayed/reconnecting states are an excellent broadcast foundation. | Allocate more space to race/standings than player view, because there is no typing task. Keep feed freshness visible. | Source + kit |
| Spectator winner copy | Source says “First across the line,” which conflicts with highest-WPM-at-time-up rule. | Use “Highest WPM at the finish.” | Source |
| First lap/tutorial | Actual correction practice and comfort controls are useful onboarding. | Compact pit briefing; current task, passage and next action first; optional comfort setup alongside. | Source |
| Comfort settings | Font size, high contrast and reduced motion already exist. | Preserve settings across screens and first paint. Large text overrides the one-screen fit target. | Source |
| Personal ghost | Trace-based personal comparison is better than a fake opponent. | Keep distinct blue/outlined car and explicit Ghost label; distinguish missing trace and different passage. | Source + kit |
| Debrief | Charts and difficult-word coaching are meaningful. | Put after official standings, with one clear practice action and accessible chart/table. Separate coaching from official score. | Source |
| Championship | Real host flow needs to remain understandable through rounds. | Compact round schedule and points table. Clearly show current round, lock state and committed results. | Source |
| Loading | Existing branded/loading components are available. | Reserve final layout space; no auto-playing race scene as a blocking loader. | Source |
| Errors/empty states/404 | Existing system art and recovery components should be reused. | One plain explanation and relevant action; pit-board styling in neutral colors. Distinguish missing room, full room, lost connection and empty history. | Source + kit |

## Styling and integration observations

`main.tsx` loads `index.css`, `studio.css`, `spectator.css`, and `experience.css`. `studio.css` imports `motorsport.css`. `index.css` also loads multiple grid/world styles, defines Tailwind colors, and applies base styling. `motorsport.css` relies on many `body .app-shell ...` selectors and hard-coded greens. The token file still describes itself as a copy of a design-kit reference.

This means a single accent-variable change cannot complete the redesign. Create an explicit app-owned token source, map legacy aliases during migration, and update component styles in place. Do not add another large override stylesheet. Record any move away from the kit's “edit and re-copy” instruction so future synchronization cannot revert the design.

The saved screenshots are useful historical evidence, but do not mistake them for current screenshots. In particular, the current homepage has a split hero/ticket and the current waiting room has a command bar that the older captures lack.
