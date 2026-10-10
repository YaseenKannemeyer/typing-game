# Race HUD

Files: hud.js, hud.css.

## API / components

GridKit.positionBadge(n), hud(props), minimap(racers,localId), spectating(name).

## Integration notes

Pass verified position/total and formatted elapsed time. HUD renders optional numeric stats; progress is clamped 0–1. Minimap displays each racer in one of three vertical rows to reduce collisions; markers expose names/rank to pointer hover and keyboard focus. The minimap is a display, not a timing or ranking engine. Move spectator focus only on explicit player choice.

## Preview

Open the root `OPEN-ME.html` and select this kit. The root `manifest.json` lists script/style load order. These sources are framework-neutral presentation references; convert them to the existing React/TypeScript architecture. They do not replace backend rules.
