# Podium and results

Files: results.js, results.css.

## API / components

GridKit.podium(players), resultRows(players), awardCard(award), earnedTrophies({name,awards,progression}), resultActions(), confetti(container).

## Integration notes

Input must be already sorted authoritative results. podium() takes the first three eligible finished players; no medals are invented for missing places. resultRows handles finished, dnf and flagged, with flagged labeled Under review. Pass null for unavailable stats, not zero. Actions expose rematch/new-vote/back-lobby; authorize on server. Confetti cleanup is bounded and reduced-motion aware. Race awards and progression render in separate groups.

## Preview

Open the root `OPEN-ME.html` and select this kit. The root `manifest.json` lists script/style load order. These sources are framework-neutral presentation references; convert them to the existing React/TypeScript architecture. They do not replace backend rules.
