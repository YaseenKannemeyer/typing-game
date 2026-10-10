# Mode voting

Files: art.js, voting.js, voting.css, assets/*.svg.

## API / components

GridKit.modeCard(mode,{count,selected,voters}), timerRing(seconds,total), watchDeadline(deadline,onTick,now), voteReveal(id,{tie}), dice(rolling).

## Integration notes

Mode descriptions are UI suggestions; confirm against actual passages. Random resolves to one of Easy/Medium/Hard/Coding/Shakespeare on the server. Voter stacks show up to three cars with a count chip giving totals. watchDeadline uses the supplied clock; return cleanup on unmount. It does not select winners or close the backend vote. Decorative die rotation must reveal a server-selected result, not use client randomness to choose one.

## Preview

Open the root `OPEN-ME.html` and select this kit. The root `manifest.json` lists script/style load order. These sources are framework-neutral presentation references; convert them to the existing React/TypeScript architecture. They do not replace backend rules.
