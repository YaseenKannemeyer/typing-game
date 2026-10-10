# System and empty states

Files: system.js, system.css, assets/*.svg.

## API / components

GridKit.systemStates, systemArt(id), systemState(id).

## Integration notes

IDs: not-found, full, name-taken, reconnecting, new-host, inactive, 404. Buttons expose data-system-action with the state ID. Map to real routes/retries; showroom actions only report a demo. Do not claim reconnecting succeeded before the server confirms. Name-taken copy only applies if the host game enforces unique names. Removal for inactivity must be based on the actual server policy.

## Preview

Open the root `OPEN-ME.html` and select this kit. The root `manifest.json` lists script/style load order. These sources are framework-neutral presentation references; convert them to the existing React/TypeScript architecture. They do not replace backend rules.
