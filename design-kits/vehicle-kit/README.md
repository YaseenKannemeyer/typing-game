# Grid vehicle kit

Open `garage-standalone.html` directly in a browser. No installation, dependencies, fonts, CDN or network required. `index.html` runs the same garage from separate source files.

## Scope
No existing game repository or reference screenshot was supplied in the workspace. This is a framework-neutral implementation ready for integration, not a connected multiplayer game. The grid demo simulates 15 racers locally. All vehicle geometry is original SVG, transparent, right-facing, with a 280 × 140 viewBox and a common ground baseline at y=124. The 15 static assets are in `assets/`; live customized versions are produced by the renderer.

## Integration
Load `vehicles.css` and `vehicles.js`. The latter exposes `window.VehicleKit`; the declarations in `vehicle-types.d.ts` document the API (they do not turn the global script into an ES module).

```js
const { VehicleView, RaceVehicle } = window.VehicleKit;
// Lobby, selector, results: any container with a controlled width.
const avatar = new VehicleView(document.querySelector('#avatar'), {
  model: 'formula', primary: '#8dbdff', accent: '#b9f46a',
  wheels: 'sport', stripes: true, number: 7,
  effect: 'neon', playerName: 'Yaseen', animation: 'idle'
});
avatar.play('mistake'); // Retriggers even for consecutive mistakes.
// Track container needs class="race-lane".
const racer = new RaceVehicle(document.querySelector('#lane'), avatar.props);
racer.update({progress: 0.45, position: 7, animation: 'driving'});
racer.view.play('overtake');
window.addEventListener('vehicle-selected', ({detail}) => {
  // Send only appearance fields to your lobby server.
  // Validate the lobby phase and membership server-side.
  console.log(detail);
});
// On unmount:
avatar.destroy(); racer.destroy();
```

Progress is a clamped fraction 0–1, supplied by the authoritative typing game. Position is descriptive rank 1–15, not a speed setting. RaceVehicle keeps the whole SVG within the track at both ends, interpolating the position over 180 ms. Keep one component per player and update snapshots, rather than rebuilding the grid. Game scoring, timekeeping, network synchronization and rank sorting remain the host game's responsibility. Multiple players can use any same model without uniqueness checks.

Only appearance changes rebuild the SVG. Progress and state updates modify attributes/style. Wheel rotation and effects use CSS animation; no timers per animation frame. No image filters or asset requests. Demo snapshot frequency is capped at 20 Hz. Performance on 15 actual connected clients has not been benchmarked; network transport is outside this package.

## Garage
All 15 models are selectable using keyboard-accessible buttons. Body/accent colours, three wheel designs, stripes, race number 0–99 and cosmetic effects update the preview. Confirm saves to localStorage and emits `vehicle-selected`. Selecting another model keeps your custom colours. A blocked localStorage environment still emits the event and reports session-only confirmation. Wire this event to the server, and disable editing when your real game leaves its waiting phase. No vehicle choice changes score, accuracy or progress.

## States
- idle: slight chassis vibration; stopped wheels.
- start: 650 ms acceleration tilt, then driving.
- driving: wheel rotation; external progress moves vehicle.
- acceleration: brief tilt and speed lines, then driving.
- mistake: horizontal chassis shake and smoke, then driving; progress unaffected.
- overtake: brief opacity highlight, then driving.
- finish: two hops and stars, then driving after 1100 ms when using play(). For results, use update({animation:'finish'}) to retain the state or idle after the effect.
- winner: repeating hop and stars; host must award only to first place.

`play()` triggers a transient animation; `update({animation})` holds a state until changed. The animation menu demonstrates play() behavior. Reduced-motion preference disables animated transforms and transitions. Visual effects remain cosmetic.

## Expand / verify
Add a geometry record to `models` and optional details in `details()`. Reuse the same viewBox, wheel baseline, palette variables and shared renderer. Add the model to the TypeScript union.

Run `node test.cjs` for model combinations, input sanitization and bounds. Run `node export.cjs` to regenerate the static SVGs and standalone HTML after source edits.

Validation completed: JavaScript syntax, 360 model/state/wheel combinations, input escaping, progress bounds; all 15 SVG assets rasterized successfully and a contact sheet visually inspected. Browser interaction and animation tests could not run because the environment had no Chromium executable. Verify keyboard controls, persistence, animation timing and responsive layout in your target browsers before shipping.
