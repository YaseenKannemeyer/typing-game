# GRID / Trophy collection

Twenty original SVG trophies designed to match the GRID vehicle kit's clean cartoon geometry, dark outlines and restrained colour palette. No emoji, icon-font or external asset dependencies.

## Preview
Open `trophy-room-standalone.html` directly in a browser. Filter the categories, select a trophy to read its criterion and illustrative winning statistic, and replay its award reveal. `trophy-collection.png` is a labeled overview of all twenty designs. Individual transparent SVG files are in `assets/`.

## Design system
All assets use a 200 × 200 viewBox and a common pedestal baseline. Podium uses gold/silver/bronze cups; Speed uses orange winged badges; Accuracy uses mint shields; Funny uses purple rosettes; Special uses blue star badges. Distinct emblems communicate each award without relying only on colour. Prefer 64–160 px in cards; at 32 px use the icon with an adjacent accessible text label. For tiny displays, detail readability varies and should be checked in the target interface.

`renderTrophy(id, {size, state, label})` returns safe SVG markup. States: earned (default), locked (muted palette), reveal (one-shot entrance via CSS). Unknown IDs throw. The optional accessible label is escaped. No SVG definition IDs are used, so duplicates can appear safely in results for several players.

## Integration
Load `trophies.js` and `trophies.css`. The framework-neutral script exposes window.TrophyKit. It does not calculate eligibility or trust browser-reported metrics.

```js
const {renderTrophy, mountAward} = window.TrophyKit;
// Small trophy in a player's profile:
document.querySelector('#badge').innerHTML = renderTrophy('code-warrior', {size:64});
// Award data must originate from your authoritative server:
mountAward(document.querySelector('#award'), {
  trophyId: 'speed-demon',
  recipient: 'Yaseen',
  statistic: '112.4 average WPM'
});
```

The card safely inserts recipient and statistic as text, supports multiple trophies per player, and includes scope, trophy name, recipient and statistic. The award reveal is a short opacity/transform animation with reduced-motion support; no animation loop or runtime dependency. `catalog.json` supplies stable IDs, names, categories, summary criteria, example statistics and scope. Examples are illustrative, not real race results. Full calculations and tiebreak policies belong in the server implementation.

## Criteria decisions to resolve before scoring
The designs preserve your trophy list. No scoring engine is included, because these details need explicit decisions:

1. Participation must be an exception to one-winner-per-trophy: every otherwise unawarded finisher receives it.
2. Unstoppable is a separate progression achievement. Recommend awarding it to every player completing a three-race block, not one player per race. A player may receive Participation for their race and Unstoppable for progression simultaneously. This is a recommendation, not an implemented rule.
3. Perfectionist and Clean Run currently follow the single-winner rule. Decide whether to keep that or grant them to every qualifying finisher. If keeping it, use server completion time and then server event order to break perfect ties.
4. Define elapsed time consistently. Recommended average WPM is (passage characters / 5) / minutes from server GO to server finish, including pauses. Your references to “active typing time” would produce different winners if pauses or reaction time are removed. First-20% timing needs the same decision.
5. Define rolling-window sampling cadence, minimum full window length and idle handling. Recommended: full 5-second and 10-second windows sampled every server second; zero-progress windows included. Decide whether three overlapping windows suffice or whether you require 30 seconds of independent evidence.
6. Steady Hands needs deterministic section boundaries (for example floor(index × 10 / passage length)), mistake attribution to the expected character position, and a population versus sample deviation choice. Very short passages need all ten sections nonempty.
7. Comeback Kid needs a deterministic snapshot ranking of unfinished players (correct progress, then server event order), including a rule for ties and disconnects. At present it can reward apparent gains caused by other racers abandoning; decide whether that is intended.
8. Define character units (Unicode code points or grapheme clusters), correct retyping after deletion, paste handling and which keystrokes count as attempts. Define shared race-end/timeout rules before granting last-place awards.
9. General ties should end with server completion event order when timestamps match, rather than device clocks. Preserve the explicitly specified accuracy and mistake tiebreakers before this fallback.
10. A server can validate passage progression and calculate statistics from received input events. That alone does not establish that a human typed them; it should not be described as proof against automated clients.

No original rules are silently changed by the presentation module. All catalogue criteria are short display summaries of the supplied criteria, not a substitute for the full server rules. Cancelled/invalid races and missing metrics must be filtered by the server before rendering any cards.

## Files and validation
- `trophies.js`: shared geometry, palette, catalog and award-card renderer.
- `trophies.css`: reusable card and entrance animation styles.
- `gallery.html`: editable multi-file gallery.
- `trophy-room-standalone.html`: bundled offline gallery.
- `catalog.json`: display metadata.
- `assets/`: twenty standalone transparent SVGs.
- `trophy-collection.png`: labeled overview.
- `export.cjs`: regenerate assets/catalog/standalone gallery with Node.

Run `node export.cjs` after source changes. Syntax, catalogue completeness, SVG XML validity and all 20 asset rasterizations were checked; the overview was visually inspected. Live browser interactions and animation behavior have not been browser-tested in this environment.
