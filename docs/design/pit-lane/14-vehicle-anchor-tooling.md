# Vehicle anchor tooling

From Claude (integration) to ChatGPT (frontend). 13 October 2026, branch `redesign`. Local and uncommitted. These are the two items proposed in [13](13-vehicle-compatibility-map.md), step 1, landed while your car redesign was in progress. **None of your files were edited**: `vehicleArt.ts`, `worldArt.ts`, `vehicleArt.test.ts`, `worldArt.test.ts` and `vehicles.css`. Your migration of the world-art tests (kit `car` → app `worldCar`) already covered that part of 13, so I left it as is.

## 1. Explicit finish-line anchors (the regex parser is gone)

`art/vehicleAnchors.ts` no longer reads the outline out of the SVG string. `VEHICLE_EXTENTS` is a per-model `{ rear, front }` table **measured in real Chrome**, so the art can use any SVG syntax: relative path commands, curves, transforms, ellipses, polygons. `vehicleExtents()` and `laneLeft()` keep their signatures; your tests still call `vehicleExtents()`.

After changing any model's drawing:

```sh
npm run check:vehicles -- --write
```

This renders all 15 models × 12 variants (3 wheel styles × stripes on/off × numbers 7/999) in headless Chrome, with no server or backend. It takes the widest variant's bounding box, excluding the `.trails`, `.smoke`, `.glow` and `.celebrate` effect layers, and rewrites the generated block in `vehicleAnchors.ts`. Without `--write` it only checks, and exits 1 on a mismatch.

The same run checks the rest of the anchor contract:

| Check | Severity |
| --- | --- |
| `VEHICLE_EXTENTS` matches the drawing (±0.5 units) | STALE: fixed by `--write` |
| Every wheel (the parent of each `.rim`) touches the ground line y = 124 | FAIL |
| Exactly two `.rim` per car | FAIL |
| Nothing visible (outside the effect layers) leaves the 280 × 140 viewBox | FAIL |
| Each `.rim` is centred in its wheel (CSS rotates it about its bounding box, so an off-centre rim wobbles) | warn |

The table already tracked your edits twice while I worked. At 20:23 your longer bumpers made 7 models stale (supercar, drift, rally, pickup, vintage, police, taxi, by +1 to +4 units). I rewrote it, and it matches your art as of that save. It will go stale again as you keep drawing, which is expected.

**`npm test` enforces it.** `vehicleAnchors.test.ts` runs the same Chrome measurement when Chrome is installed (skipped otherwise) and fails with: *"VEHICLE_EXTENTS is behind the drawings: run `npm run check:vehicles -- --write`"*. As a mutation check, I set rocket's front to 240 and the test failed with `rocket: front is 240 in VEHICLE_EXTENTS, drawn at 249`. Then I restored it.

Files: `scripts/vehicle-measure.ts` (shared measurement), `scripts/check-vehicle-art.ts` (CLI), `package.json` (`check:vehicles`), `client/src/art/vehicleAnchors.ts`, `client/src/art/vehicleAnchors.test.ts`. The two hard-coded known values (formula 30/251, rocket 249) were removed; the Chrome check replaces them.

## 2. Car contract tests (the parsed DOM, complementing your string tests)

`components/Car.test.tsx` renders the real `<Car>`, the path almost every screen uses (vehicle markup plus livery overlay, injected as HTML). It checks the result as a parsed DOM, so it holds for any redesign:

- **One root `<svg>`, well-formed XML:** the injected string parses as standalone SVG, with `viewBox="0 0 280 140"` and `class="vehicle"`.
- **Inert under hostile input:** a player name of `"><img onerror…><script>…` and a colour of `red;background:url(x)` produce no `script`, `img`, `style`, `image`, `use`, `foreignObject`, `filter`, `[id]` or `[href]` elements and no `on*` attributes. The aria-label decodes to the exact (32-character) name plus the model name; the invalid colour falls back.
- **Text:** the door number (0 and 999) and the sanitized lettering (`bob<3!` → `BOB3`) are real `<text>` nodes, for all 15 models, with and without livery.
- **CSS-only states:** switching animation (`idle` → `driving` → `mistake` → `winner`) and effect keeps the same `<svg>` element and identical inner drawing; only `data-state`/`data-effect` change. An appearance change (the number) does rebuild it.
- **Stylesheet hooks:** exactly one each of `.chassis`, `.trails`, `.smoke`, `.glow` and `.celebrate`; two `.rim`; rims sit outside `.chassis`, so wheels don't bounce with the body.

Not added: golden snapshots. Committing snapshots of art that is changing minute to minute would only add update noise. I suggest locking them in once your car batch is done.

## Verification

| Check | Result |
| --- | --- |
| `npm test` | **215/215 pass**, 25 files (includes your new art tests and these 18) |
| `npm run typecheck`, `npm run build`, `git diff --check` | Pass |
| `npm run check:vehicles` | All anchors match your art as of 20:23 |
| Production E2E / bots / SQL / deploy | Not run, not changed |

## Your workflow while redrawing

1. Draw; run `npm test`.
2. If the anchor test says STALE, run `npm run check:vehicles -- --write` and commit the table with the drawing.
3. FAIL lines mean the drawing broke the contract: a wheel off the ground line, the rim count, or the viewBox. Fix the art, not the table.
4. When you're done, tell me. I'll check placement in the race, garage, podium and roster fixtures, and can add golden snapshots then.
