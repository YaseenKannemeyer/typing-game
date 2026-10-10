# Countdown and race moments

Files: moments.js, moments.css.

## API / components

GridKit.gantry(phase,lit), countdownFrame(value), countdown(element,{deadline,now,onGo}), moment(kind,{name,gain}).

## Integration notes

Phases: off/red/green; lit selects how many red lamps appear. The clock needs server alignment. onGo is a presentation callback, not permission to score. Moment kinds: finish, leader, gain, photo. Photo-finish illustration does not calculate finish order. Show server timestamps/event order and never adjudicate by car pixels. Prefer brief banners to overlays while typing.

## Preview

Open the root `OPEN-ME.html` and select this kit. The root `manifest.json` lists script/style load order. These sources are framework-neutral presentation references; convert them to the existing React/TypeScript architecture. They do not replace backend rules.
