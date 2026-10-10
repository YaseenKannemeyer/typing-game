# Motion specification

Files: motion.json, motion.js.

## API / components

GridKit.captureLanes(root), animateLanes(root,before), motion.

## Integration notes

Capture bounds before changing keyed lane order, then animate after the new DOM layout commits. Elements must have stable data-player-id. The helper returns cancellation cleanup and respects prefers-reduced-motion. Avoid FLIP on the car progress transform itself: use separate lane and car elements. Timings do not control official race state. Any finish/unmount should cancel stale temporary vehicle animation timers.

## Preview

Open the root `OPEN-ME.html` and select this kit. The root `manifest.json` lists script/style load order. These sources are framework-neutral presentation references; convert them to the existing React/TypeScript architecture. They do not replace backend rules.
