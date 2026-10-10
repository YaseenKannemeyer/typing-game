# GRID — Racing World Expansion

Ten coordinated presentation kits, numbered 16–25 to follow the existing GRID kits. Original SVG environments, reusable JavaScript renderers, responsive CSS, and an interactive offline showroom.

## Start here

1. Open `OPEN-ME.html` in a browser. Everything is embedded; no install or network is required.
2. Explore the garage controls, road animation, ready bays, six destinations, liveries, WPM gauge, pit-board messages, trophy details, and example championship.
3. Extract this entire folder into `design-kits/racing-world-kit/` in your project.
4. Give Claude `README-FOR-CLAUDE.md`. Your existing vehicle, trophy, UI, and account kits remain separate.

| Folder | Contents |
|---|---|
| 16-workshop | Physical workshop, paint station, tyre rack, livery station, configurable car preview |
| 17-circuit | Asphalt and wet asphalt, kerbs, start grid, finish stripe, flag, progress-positioned lanes |
| 18-paddock | Pit building, fifteen parking bays, ready/host/you treatments |
| 19-destinations | City, desert, rainy night, coast, neon and countryside; separate near/far SVG layers |
| 20-finish-venue | Grandstands, finish arch, podium and vehicle placement |
| 21-driver-livery | Four fictional teams, helmets, number plates, three decal styles |
| 22-dashboard | WPM gauge, position, time, accuracy, mistakes and progress |
| 23-race-control | Short pit-board announcements and dismiss timer |
| 24-clubhouse | Trophy cabinet, earned/locked display and award detail dialog |
| 25-championship | Event poster, three-round schedule, sample standings and champion treatment |

`showroom/` contains the shared scene helpers, layout styles and demo controller. `vendor/` contains copies of the previous kit runtimes solely to make the preview self-contained. Do not install duplicate vendor runtimes into your app. `manifest.json` records load order. There are 50 exported SVG assets, plus HTML/CSS components.

## Scope

This is a design and interaction kit, not a connected multiplayer application. All names, scores, earned trophies, events and ready states in the showroom are examples. The championship points schedule is illustrative. No authentication, database migrations, authoritative scoring or persistence is implemented here. Existing server rules must remain authoritative.

Cars stay side-on and face right. Decorative environments never change performance. The typing passage stays stationary. The shared stylesheet includes reduced-motion support inherited from the UI kit; production integration must also disable JavaScript movement when reduced motion is requested.

## Rebuild and verify

Run `node tools/build.cjs` to regenerate exported SVGs and the two showroom entry pages. Run `node tools/test.cjs` for source/rendering checks. The source modules use browser globals intentionally for easy offline review; port their presentation into your existing React components rather than mounting the entire demo inside your app.

See `VALIDATION.md` for the checks performed and remaining browser checks.
