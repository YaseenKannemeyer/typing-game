# Pit Lane: design specification

## Creative direction

GRID should feel like entering a race meeting: choose a livery, take a place on the starting grid, follow the countdown, race the clock, and see the official classification.

Use NASCAR as the primary visual influence: strong stock-car bodywork, large door numbers, painted liveries, pit boxes, catch fencing, and victory lane. Use Formula 1 as an information-design influence: stable timing columns, clear position markers, concise session states, and precise telemetry. This is an original GRID identity, not an official NASCAR/F1 skin.

The homepage is expressive; active typing is controlled. Design variance is moderate: an asymmetric illustrated entry screen and purpose-built product layouts. Motion intensity is moderate during entry/countdown and low while typing. Density is moderate on the homepage and higher in timing tables, with a deliberately quiet passage area.

The generated concepts define mood, hierarchy and material direction. They do not establish approved brand artwork, pixel-perfect dimensions or real race data. See the corrections in [README](README.md).

## Color and materials

| Role | Value | Use |
| --- | --- | --- |
| Asphalt | `#141619` | Application background |
| Panel | `#202328` | Working surfaces |
| Raised surface | `#2B3037` | Selected neutral surfaces and secondary controls |
| Divider | `#464D57` | Subtle separators; not sufficient alone for essential control boundaries |
| Control border | `#7C8591` | Inputs and boundaries that need clear non-text contrast |
| Primary text | `#F4F2EB` | Main text on dark surfaces |
| Secondary text | `#B8BDC6` | Supporting copy and labels |
| Muted text | `#9CA5B1` | Lower emphasis, still readable text |
| Signal yellow | `#FFD336` | Primary action, local-player emphasis, cursor |
| Yellow hover | `#FFE071` | Primary hover |
| Dark ink | `#141619` | Text on yellow/light surfaces |
| Ticket | `#F4F2EB` | Entry and account credential surfaces only |
| Ticket secondary text | `#505761` | Supporting text on the light ticket |
| Error | `#FF8B82` | Invalid character or failed action on dark surfaces |
| Error surface | `#3B2225` | Quiet mistake/error background |
| Ticket error | `#B42318` | Errors on light forms |
| Success | `#7DDDA3` | Confirmed, connected, green-flag state |
| Warning | `#F0B75D` | Delayed/reconnecting/low-time state |
| Ghost/info | `#8BBEFF` | Personal ghost and informational chart series |

One principal accent does not mean every racer or status is yellow. Liveries, medals, chart series and semantic states are deliberate exceptions. Do not recolor all competitors yellow. Add labels/shapes for each meaningful state.

Use fine asphalt/concrete detail inside scenic art, and flat color behind text. No carbon-fiber wallpaper across the whole interface. No glowing edges, continuous smoke behind the passage, ambient gradients over forms, or multiple checker borders. Limit checkers to one strong motif per composition.

The light entry ticket is an intentional functional object within the dark environment, not a switch to a second page theme. Test its focus/error/button states with its own contrasting colors.

## Typography

Proposed display family: **Barlow Condensed**, self-hosted, 700 and 800; use 800 italic sparingly for the hero or outcome. It is available from [Google Fonts](https://fonts.google.com/specimen/Barlow+Condensed); it is not installed in this project yet. Retain existing **Geist Variable** for controls/body and **Geist Mono Variable** for passages, codes and tabular data. Keep an upright, readable fallback until the new font is loaded.

| Role | Desktop | Phone | Rules |
| --- | --- | --- | --- |
| Homepage headline | 72–104px | 48–64px | Two lines maximum; size to fit entry, not to fill available width |
| Page title | 36–44px | 28–34px | Condensed, mostly upright |
| Section title | 22–28px | 20–24px | Neutral UI sans or restrained display |
| WPM/position/clock | 36–52px | 24–32px | Tabular numbers, fixed metric widths |
| Body | 16px / 1.5 | 16px / 1.5 | Usually under 60 characters per line |
| Control label | 14px / 1.4 | 14px / 1.4 | Sentence case except short race signs |
| Supporting label | 12–13px | 12–13px | Avoid wide tracking in paragraphs |
| Typing passage | 24–28px / 1.55 | 20–24px / 1.5 | Comfort setting can override; never use condensed type |
| Native input | 18–22px | At least 16px | Keep legibility and mobile behavior |

Uppercase belongs to a small set of race signs, not every heading and paragraph. Keep italic descenders and focus rings clear of clipping. Long driver names get bounded truncation only in compact standings; full names remain available in the expanded list and accessible label.

## Geometry and reusable primitives

- Space scale: 4, 8, 12, 16, 24, 32, 48, 64px. Use 24px main gutters on desktop, 16px on phones.
- Main content width: 1280px. Spectator presentation can expand to 1600px.
- Corners: 2px controls, 4px panels. Do not use diagonal clipping on text/input hit areas; angled decoration belongs to a pseudo-element or artwork.
- Header: 64px general navigation, 56px in active race at standard settings.
- Touch targets: at least 44×44px. Main form action: 48–52px tall. Increase height when text wraps at zoom.
- Focus: visible 2px outline, 3px offset; yellow on dark, dark ink on light. Selection and focus must be distinguishable.
- Tables: consistent numeric alignment, concise labels, local row marked with both “You” and a border/background change.
- Shadows: only for genuinely elevated menus/dialogs; no shadow around every panel.

Required primitives: page shell, session strip, entry ticket, primary/secondary/text button, labelled input, segmented control, tab list, status flag, metric cell, driver number/name cell, standings row, race-control notice, trophy tile, validation message, skeleton/empty/error block, and accessible detail dialog.

Required states: default, hover, pressed, keyboard focus, selected, disabled, loading/saving, success, failure and reconnecting where relevant. Disabled controls need an adjacent explanation when the reason is not obvious.

## Homepage composition

At 1440×900, use a 64px header and a maximum 560–600px hero below it. The entry form and primary action must be visible without scrolling at 1280×720 with default text settings.

The hero uses roughly 60% art/story and 40% entry. Title and brief description sit on controlled dark space; a large racing car occupies the lower scene. The ticket aligns with the top of the title block. One restrained set of facts covers up to 15 racers, 1–5 minutes, and WPM scoring. No fake online count, live status, sponsors or matchmaking button.

Order: navigation → headline/car plus entry → starting lineup → practice → quiet footer. The existing practice remains on the homepage, reachable directly through `#practice`; there is no required new route.

On phones: compact headline → entry ticket → car illustration/lineup → practice. Do not put a 500px picture before the name field. The art may use a small background/crop alongside the headline if text contrast survives. At 390×844, name field and Create a room should be visible in the opening view. Keep Join close by; allow natural vertical scrolling.

Copy direction:

- Headline: “Type it. Race it.”
- Supporting text: “Race up to 15 players. Same text. Highest WPM wins.”
- Entry heading: “Your grid is waiting.”
- Main action: “Create a room”. Secondary: “Join”. Solo link: “Practice solo”.
- Rules: “Type until the clock stops. Every car is equally fast.”

## Waiting room and garage

Use a compact command strip for room code/count, Open garage and Start mode vote. Below it, the occupied starting grid takes about two-thirds of the width; invitation/settings take the remainder. One availability tile replaces repeated empty bays by default. Keep all 15 occupied racers manageable through compact rows; do not hide real players to preserve an empty decorative grid.

The current source already has a command bar and mobile empty-bay summary. Extend these, do not reintroduce older screenshot layouts. Maintain host ownership, minimum player count, pending settings and failure messages.

Room-detail tabs retain Destination, Garage, How it works and Trophies. Garage consists of a selected-car stage, a horizontal model collection and a focused editor. Paint, wheels and livery stay distinct; no nested cards inside cards. Place confirmation and status near the preview, not beneath a very long model grid. At mobile sizes, the selected car and active controls precede secondary choices.

Lead art direction with a stock car. Preserve existing saved model IDs. If a new model is necessary, add it as a separately reviewed compatible feature after checking client/shared/server validation. Do not silently replace a saved Formula Racer or remove novelty vehicles.

## Active-race composition

The critical success criterion: at **1280×720 CSS pixels**, default text size and 100% browser zoom, the current typing line, native input, WPM, position and time are simultaneously visible.

Illustrative height budget, to be validated in browser:

| Region | Budget |
| --- | --- |
| Race header/session info | 56px |
| Main padding and gaps combined | 40px |
| Telemetry row | 76px |
| Track with compact standings | 190px |
| Reserved race-control strip | 32px |
| Passage context | 130px |
| Input and keyboard help | 88px |
| Total | 612px |

The spare height accommodates natural rendering differences and minor messages. These are layout budgets, not rigid clipping dimensions. At large comfort sizes or 200% zoom, permit vertical scrolling and reduce scenic content first.

Desktop order:

1. Session metadata and discreet sound/leave controls.
2. WPM, position and clock, then smaller accuracy/mistake values.
3. Compact timing list beside the four-racer track.
4. Fixed-space race-control announcement.
5. Stationary passage/current line and native input.

WPM remains words per minute. Do not show mph, gears, fuel, tyre wear, damage, lap gaps or pit stops as if they were measured gameplay. A decorative rev meter cannot replace the number or misrepresent a cap. Any position list uses existing ranking data; keep transient standings distinct from official results.

The scene is a straight section of a race venue; it does not require implementing a 3D circuit or new physics. Retain the existing visible-car selection and timed placement policy. Remove misleading unlabeled percentages. An expanded “All racers” surface must not steal focus automatically. The generated race concept's equal car positions and sample numbers are not implementation instructions.

On phones, prioritize session/clock → compact stats → current passage/input. The track collapses to a small optional strip or sits below typing; full standings open only on request. During keyboard use, reduce scenery and keep current line/input in the visual viewport. Use existing keyboard-aware behavior as the starting point, and verify on actual iOS Safari/Android Chrome rather than assuming desktop emulation is sufficient.

Race-control updates must not move the input. Countdown light visuals follow the existing authoritative clock. Finish animation begins after time-up and official winner presentation waits for confirmation. Show “Confirming results…” for pending results. Keep reconnect state visible without implying typing has been safely received when it has not.

## Other screen compositions

| Screen | Composition and retained behavior |
| --- | --- |
| Mode voting | Compact header/timer; six deliberate selectable mode tiles, two rows at desktop; 1–2 columns on phone. Mode name, sample/description, count and selected indicator. Countdown remains available while scrolling. |
| Results | Real personal outcome + compact winning car; rematch action; official classification; three featured personal awards; remaining awards and coaching below. Adapt to fewer than three eligible racers. |
| Trophies | Steel cabinet or flat gallery; category filters; icon/name/status; selected rule detail. Preserve exact trophy rules and earned counts. Locked does not mean unavailable to read. |
| Profile | Driver credential, inline career metrics, chart pair, mode bests/history, compact trophy preview and complete collection disclosure. Preserve missing data and metric definitions. |
| Hall of fame | One champion feature, optional second/third summaries, period/mode filters, timing-sheet table. Empty dataset receives an invitation to race, not fabricated winners. |
| Account | Guest credential/real progress beside a light auth ticket. Preserve verify, pending, retry, recovery, review and confirmed-preserved states. |
| First lap | Short pit briefing, interactive correction task, optional comfort controls, clear return to intended room. No mandatory account gate. |
| Practice/ghost | Passage-first layout, compact stats and optional ghost lane. Labels distinguish passage completion from multiplayer time limit. Preserve local trace matching and missing trace state. |
| Debrief | Official result remains above. Pace chart with labelled gaps, difficult words, one focused-practice action. Chart has accessible data alternative. |
| Championship | Compact round schedule, rules, current round and points table. Host actions reflect true locked/committed state. |
| Spectator | Track and complete standings can dominate because no typing is required. Featured racer and official winner treatments share race components. Keep delayed/reconnecting status and fullscreen affordance. |
| System states | Clear status title, short practical explanation, one main recovery action. Retain useful system illustrations, recolored and simplified. |

## Motion and sound

| Event | Treatment | Reduced motion |
| --- | --- | --- |
| Button/tab response | 120–160ms color/border change | Same, or instant |
| Open panel | 180–220ms opacity/short translation | Opacity or instant |
| Car selection | 180–240ms restrained transition | Immediate change |
| Reordering racers | Existing stable identity and controlled interpolation, target 180–250ms | Snap or crossfade without motion |
| Countdown | Server-timed light states | Same timing, static changes |
| Winner | One short reveal, maximum about 600ms | Immediate result |
| Trophy | One bounded reveal | Static notification |

No scroll hijacking, camera shake, perpetual page-wide motion, or animation tied to individual keystrokes. Pause offscreen decorative motion. Preserve both OS and in-app reduced-motion settings. Sound remains user-controlled, rate-limited and muted unless enabled. Any new audio cues should be evaluated separately; current kit cues are sufficient for the first release.

## Asset inventory and kit reuse

| Existing source | Keep | Rework |
| --- | --- | --- |
| `grid-design-kits` | Brand identity, component state inventory, countdown, typing semantics, result/status assets, sound cues | Palette/type/spacing/corners and mode graphic presentation |
| `vehicle-kit` | Renderer, 15 IDs, normalization, customization, viewBox/ground/finish anchors | Stock-car lead art, proportion/material refinement and default liveries |
| `trophy-kit` | All 20 trophy assets, IDs and metadata | Shelf/plinth and earned/locked presentation |
| `racing-world-kit` | Environment layering, workshop/paddock/track/finish renderer structure, fictional teams | Race-venue environments, neutral surfaces, compact dashboard and pit boards |
| `account-profile-kit` | Auth state models, chart handling, accessible data, guest preservation presentation | Credential/account layout and metric hierarchy |
| `race-experience-kit` | Spectator, coaching, comfort, ghost and championship behavior references | Compact application of the shared visual system |

Production React ports in `client/src/art` and `client/src/components` already exist. Importing an entire kit showroom or its duplicate vendor runtime would create competing sources of truth. Original kits remain reference material; the redesigned app owns its presentation.

Needed before shipping the first visual milestone:

1. One original GRID stock-car hero render with no baked-in UI text, delivered in desktop and mobile crops. Use AVIF/WebP plus fallback, responsive dimensions, explicit width/height. Target under 300KB for the primary desktop image where visual quality allows.
2. One compatible right-facing stock-car gameplay asset, with selectable body/accent/number layers and documented anchors. Determine whether it refines an existing suitable model or requires an additive model contract before implementation.
3. One compact pit-lane/oval background with neutral asphalt, barriers and fencing, separate foreground/background layers where movement is necessary.
4. Display-font files and license retained with the source; load only required weights/subsets.
5. Recolored current logo/favicon/invite artwork only after the app tokens are settled. Keep logo geometry until separately reviewed.

Next tranche: six existing destination variants, one workshop background, one pit building, one victory-lane stage, four coherent fictional livery systems. Reuse trophy assets first. The two generated concept PNGs are references and should never ship as whole-screen background screenshots.

Each production asset must record source/provenance, dimensions, intended surfaces, transparent/opaque background, color variants, and any alignment anchors. SVG gameplay art stays editable; avoid embedding raster car collages inside SVG wrappers.

## Verification targets

- Normal text contrast at least 4.5:1; large text and meaningful non-text UI at least 3:1. Test actual assembled states, including the light ticket and disabled explanations.
- Keyboard navigation, visible focus, form labels, error association, native input/IME, dialogs and reduced motion preserved.
- Desktop 1440×900 and 1280×720; tablet 768×1024; phone 390×844 and 320px width; 200% zoom and maximum comfort text.
- No unintended horizontal page scroll. Tables may use an explicitly labelled scroll container or mobile row layout.
- No toast, countdown, sticky footer or keyboard overlay obscures the current input.
- Target field Core Web Vitals of LCP ≤2.5s, INP ≤200ms, CLS ≤0.1; these are proposed goals, not measured results. Measure the baseline and redesigned build under a documented device/network profile.
- Do not preload all 15 cars and six large scenic assets just to show the homepage. Preserve route splitting and size images deliberately.
- Inspect console errors and network/image/font failure fallbacks. Gameplay must remain readable when optional artwork fails.
