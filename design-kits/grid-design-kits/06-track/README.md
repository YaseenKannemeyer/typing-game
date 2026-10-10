# Track and environment

Files: track.js, track.css, assets/{city,desert,neon,theatre,circuit,finish-flag}.svg.

## API / components

GridKit.track({racers,localId,scene}), updateTrack(root,updates), environment(scene), visibleRacers(ranked,localId).

## Integration notes

Pass at most four ranked racers to track(). visibleRacers selects the local player, normally two ahead and one behind, shifting at ends. updateTrack changes positions without recreating SVG; the host handles keyed reorder. Common viewBox alignment is provided, but exact front bumper anchoring across differently padded models must be checked in production. Finish flag SVG is static alone; the stylesheet animates its fabric group. Backgrounds are intentionally quiet and optional.

## Preview

Open the root `OPEN-ME.html` and select this kit. The root `manifest.json` lists script/style load order. These sources are framework-neutral presentation references; convert them to the existing React/TypeScript architecture. They do not replace backend rules.
