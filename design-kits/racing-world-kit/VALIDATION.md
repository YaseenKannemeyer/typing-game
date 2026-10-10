# Validation

Performed on the delivered sources:

- Node syntax checks for JavaScript sources.
- Eleven showroom page functions render without exceptions, undefined output or NaN values.
- All 120 local-player positions across 1–15 racers retain the local racer and show at most four cars.
- All fifteen front-bumper anchors are present; physical alignment still needs browser verification against the production renderer.
- Gauge edge values, escaped driver labels, adjacent duplicate event suppression and event cleanup checked.
- Example championship totals checked: 40, 36, 34, 28; zero before any round.
- All 50 SVG exports parsed and rasterized successfully. Collection artwork visually inspected.
- Self-contained entry page regenerated from the final source files.

Not performed: real-browser interaction, screen-reader review, layout measurement across viewports, production React build, authenticated persistence, live multiplayer and server integration. No actual application repository was available. Complete these checks after integrating, using README-FOR-CLAUDE.md.

The optional tools/render.cjs artwork contact-sheet generator requires sharp, resolved from CODEX_PRIMARY_RUNTIME_NODE_MODULES in this environment. It is not required to open the kit or run the source checks.
