# GRID — Race Experience Expansion

Five presentation and interaction kits for the existing GRID typing-racing game. Numbered 26–29, plus a host extension to Kit 25. This package complements the previous vehicle, trophy, account/profile and racing-world kits.

## Open and explore

Open `OPEN-ME.html` directly in your browser. No installation, account, CDN, build step or network is needed. `index.html` is the same showroom with separate source files. Both use fictional race data and local-only interactions.

| Kit | What you can try |
|---|---|
| 26 — Spectator & Presentation | Fifteen standings, four lanes, featured racer, sample replay/pause, delayed feed, presentation layout, browser fullscreen, winner reveal |
| 27 — Race Debrief & Coaching | WPM/accuracy chart switch, accessible data tables, previous-best comparison, difficult words, missing timeline and practice action |
| 28 — First Race & Typing Comfort | Interactive correction tutorial, retained mistake counts, font size, contrast, reduced motion and keyboard-aware mobile layout |
| 29 — Personal Ghost & Practice | Real typing against an example recorded trace, interpolation, local milestones, three drills and missing recording state |
| 25+ — Championship Host | Edit modes, lock rules, progress through three rounds, disconnect/reconnect and commit example results without double-counting |

## Where it goes

Extract to `design-kits/race-experience-kit/` in your existing repository. Keep the earlier kits in place. Give Claude `README-FOR-CLAUDE.md` and ask it to inspect your source before integrating. Do not replace your app with this showroom.

## Files

- Each numbered folder contains a reusable JavaScript presentation module and a short README.
- `shared/core.js` provides common rendering helpers and labelled sample data.
- `shared/experience.css` provides responsive styles; vendor tokens preserve the existing GRID palette.
- `showroom/app.js` connects the local demonstrations. It is not production game logic.
- `assets/` contains ten vector chart/icon assets. Charts are illustrative, and runtime charts should use real data.
- `integration/contracts.d.ts` proposes view models for Claude to adapt to your existing types.
- `integration/sample-ghost.json` contains a fictional progress recording for the demo passage.
- `vendor/` includes the prior vehicle renderer and tokens for offline portability. Reuse your existing imports in the real app.

## Source checks

Run `node tools/build.cjs` to regenerate the two entry pages, manifest and SVG exports. Run `node tools/test.cjs` to check renderers, tutorial correction, ghost interpolation and host transitions. These commands need only Node.js. See `VALIDATION.md` for actual checks and remaining browser/device work.

## Design intent

Dark forest surfaces, lime highlights, blue ghost identity, clear race typography and familiar illustrated cars. Presentation mode gives the race more screen space; practice keeps the passage still and uncluttered. The demo starts silent and has no sound dependency.

These kits do not implement authenticated spectators, recorded server telemetry, personal-best queries, ghost storage or championship RPCs. Their integration requirements are explicitly documented. All live rankings, statistics, awards and event points remain server-authoritative.
