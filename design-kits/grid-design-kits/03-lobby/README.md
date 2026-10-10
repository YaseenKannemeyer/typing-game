# Lobby / waiting room

Files: lobby.js, lobby.css.

## API / components

GridKit.playerCard(player), roomCode(code), howTo(), lobby({players,code,host}).

## Integration notes

PlayerCard expects name, vehicle, you/host/ready/online flags. Lobby fills remaining seats to 15. Copy controls expose data-action=copy-code/copy-invite; bind them to the real room code/link. Other actions are garage and start-vote. Host is an input from authoritative membership, never client permission. Preserve ready state and broadcast confirmed cosmetics through existing APIs. Unfilled seats are not fake online players.

## Preview

Open the root `OPEN-ME.html` and select this kit. The root `manifest.json` lists script/style load order. These sources are framework-neutral presentation references; convert them to the existing React/TypeScript architecture. They do not replace backend rules.
