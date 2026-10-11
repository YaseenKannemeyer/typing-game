# Validation and remaining checks

## Performed

- All five kit modules and six showroom page functions load/render in Node without exceptions, undefined output or NaN markup.
- Spectator renders fifteen standings and four race lanes; empty-racer rendering checked.
- Tutorial reducer retains incorrect attempts after Backspace and gives 3 correct / 4 total attempts for the tested corrected sentence. Completed input does not change its result.
- Ghost validation rejects incomplete, duplicate-timestamp and backwards-progress traces. Interpolation, boundaries, invalid time and completion are checked.
- Host reducer rejects invalid commits, prevents a round starting with an unresolved disconnect, accepts reconnect, progresses through all three rounds and ignores repeated commit actions.
- Missing chart and recording views render.
- SVG assets parse as XML and rasterize successfully. The component artwork overview was visually inspected.
- JavaScript syntax checks and self-contained entry-page build passed.

Run `node tools/test.cjs` for these source checks. `node tools/build.cjs` regenerates the distributable entry pages and exported assets.

## Not performed

A Chromium installation was attempted but its download was invalid, so real-browser interaction and layout checks could not run here. The overview image is authored component artwork, not a browser screenshot.

Check the actual showroom and integrated app at desktop/projector/tablet/phone sizes, including 1280×720 and 1920×1080. Test focus, fullscreen, mobile keyboard visibility, input/composition behavior, OS reduced motion and screen-reader announcements in real browsers. CSS breakpoint rules are included but not browser-measured here.

No production repository was available: React build, authenticated subscriptions, database ownership rules, telemetry recording, personal-best queries, ghost persistence and real championship RPCs are not implemented or tested in this package. Follow README-FOR-CLAUDE.md for these integrations.

`tools/render-preview.cjs` is optional. It requires sharp, resolved from CODEX_PRIMARY_RUNTIME_NODE_MODULES in the authoring environment. Neither it nor sharp is required to use the showroom or execute source tests.
