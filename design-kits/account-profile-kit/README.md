# GRID / Account & Profile Kit

Kit 15 extends the existing GRID design collection with five coordinated experiences:

1. Sign-in, create-account, password-recovery, and **save your guest progress** screens.
2. Profile header with garage car or generated initials avatar, member-since label, best WPM, races, wins and trophies.
3. WPM and accuracy charts, per-mode best bars, period filters, accessible data tables, empty and error states.
4. Top-three hall of fame, filtered leaderboard, and a highlighted local-player row.
5. Mid-session achievement toast with queuing, duplicate-event suppression, pause-on-hover/focus and reduced-motion support.

## Open and place

Extract to `design-kits/account-profile-kit/`, alongside the other kit folders. Open `OPEN-ME.html` in a browser. No server, installation, network request or API key is needed. `index.html` is the multi-file equivalent.

The preview simulates authentication and history preservation. **It does not create an account, send email, sign in, or write to Supabase.** Use sample credentials. Passwords are transient input only; the kit does not save, log or transmit them. Refresh resets the demo. Profile/race data and leaderboard records are illustrative, fixed as of 10 October 2026.

Start in the Account tab. Submit a valid sample email and an 8-character sample password to see verification, simulated confirmation and preservation. Buttons below the form expose alternate states. The existing-account action leads through sign-in to a review before the simulated link is confirmed. The kit never pretends that client UI alone can transfer history.

## Files

- `src/account.js`: account layouts, guest-history summary, preservation status and existing-account review.
- `src/profile.js`: profile header, hall of fame, leaderboard, notification renderer and `AchievementQueue`.
- `src/charts.js`: dependency-free SVG charts and per-mode bars.
- `src/account-profile.css`: full desktop/mobile styling.
- `src/chart-tokens.json`: chart colour/stroke/axis tokens.
- `src/demo.js`: showroom-only interaction controller.
- `assets/`: original history-preservation illustration, initials-avatar example and chart SVG specimens.
- `vendor/`: copies of the existing GRID tokens/brand/vehicle/trophy renderer, solely to keep this preview standalone. Reuse your app's existing integrations in production.
- `integration/CLAUDE-HANDOFF.md`: mapping to the current React/Supabase project.
- `integration/types.d.ts`: reference data shapes.
- `account-profile-overview.png`: designed overview, not a browser screenshot.
- `tools/build.cjs`: regenerate standalone preview and exported SVGs with Node.
- `tools/test.cjs`: generation/logic checks.
- `tools/render.cjs`: regenerate PNG overview; requires sharp, unless using the provided runtime.

## Account / guest preservation states

| State | UI behaviour | Authoritative condition |
| --- | --- | --- |
| Guest invitation | Show verified history/garage and a keep-playing option | Existing guest identity still valid |
| Create account | Validate fields; show submission state | Auth request accepted by configured provider |
| Verify email | Show pending verification; keep guest session | Email/identity confirmation incomplete |
| Preserving | Avoid claiming ownership has changed | Server link/reconciliation pending |
| Saved | Show confirmed success | Server confirms ownership and returns canonical account data |
| Retry | Retain guest context; offer retry | Preservation failed or confirmation unknown |
| Existing account | Sign in, review, explicitly confirm | Both identities proven; merge/link supported by backend |

These are presentation states. Inspect how your application currently represents a guest: provider anonymous identity, server guest token, or something else. The backend implementation must be chosen accordingly. Keep ownership stable where the provider supports an in-place upgrade; otherwise use a verified, transactional, idempotent reconciliation process. Do not clear guest state when only the auth form succeeds. Do not accept a browser-supplied user ID as proof of ownership. Never combine histories automatically because email strings match.

An existing-account review does not simply add two totals: duplicate races and award events must be reconciled, and canonical totals fetched again. This kit deliberately avoids showing a fabricated combined count.

## Profile and metrics contract

`AccountKit.profileHeader(profile, {avatar})` renders a linked-account profile. Only use the linked badge after identity confirmation. Supply the public display name/handle and a formatted member-since date; never expose email in a public leaderboard. Best WPM means highest completed-race average WPM, not a rolling peak. Races count completed eligible races; wins count official first-place finishes. The sample trophy total means distinct earned trophy types, while repeat awards remain in race history. If your product chooses different totals, update the labels and backend contract consistently.

The kit supplies an initials-avatar alternative rather than profile-photo upload. The garage car reuses your existing vehicle renderer. Name editing is local in the demo and requires the existing validated profile API in production.

## Charts

`lineChart({data:[{date,value}], metric:'wpm'|'accuracy', title, compact})` accepts preaggregated daily points. It sorts by timestamp, rejects invalid dates and nonnumeric values, and preserves missing/null values as gaps. One valid point renders as a point. Zero is a real value, not an empty state. WPM uses a zero baseline and a rounded maximum. Accuracy uses 90–100% only if all valid data fits that range, otherwise 0–100%; the range is explicitly labeled. Accuracy above 100 is treated as missing. X positions use elapsed date spacing, not category spacing. Duplicate dates should be aggregated upstream.

Each chart includes a title, units, focusable data points, native value tooltips and an expandable HTML data table. Values are not smoothed. No fabricated points or placeholders are plotted. Empty/error UI is separate from the data.

The example daily WPM is the arithmetic mean of eligible race-average WPM for the day; accuracy should be computed from the day's summed correct/all attempts, not an unweighted average of percentages. Sample days have one race each. Decide and document the production aggregation on the server. Use the actual reporting timezone in labels; this preview uses UTC. The period controls operate against the fixed sample date, not today's clock. Per-mode bars are zero-based, share one maximum, and distinguish missing results from zero.

## Hall of fame

The hero uses existing podium trophies and vehicle art. Input rows must already be ranked by the authoritative leaderboard definition. The demo filters eight illustrative racers by period/mode. Rankings use best race WPM, with display accuracy from that best race; ties in the demo are stable but are not a proposed production policy. Random is not a separate bests category: attribute the race to its resolved mode. Handle fewer than three eligible racers by displaying only available slots.

## Achievement notifications

Create `new AccountKit.AchievementQueue(region)` on a persistent notification region with `role=status`, `aria-live=polite`, and `aria-atomic=true`. Push `{eventId,trophyId,recipient,statistic}` only after server confirmation that the award was persisted. The “Saved to your collection” copy relies on that contract.

- One active toast; later events queue.
- Same event ID displays once per queue instance. Repeatable awards use distinct event IDs.
- 6.5-second display, paused on hover, keyboard focus or hidden document.
- Never automatically focuses or steals typing focus.
- Dismiss button; trophy remains available in the collection after timeout.
- No forced sound. Wire existing optional award sound only under user preferences.
- Reduced-motion stylesheet removes movement.
- `destroy()` clears timers/listeners and DOM; call on unmount.

Dedupe across reloads must be supplied by your existing event history/cursor if needed. An in-memory Set is not durable deduplication. During a race, position the region in reserved chrome outside the passage; the demo's top-right position is a reference. On a small phone it must not obscure the current typing line.

## Validation and limits

Passed: source syntax, four auth-form renders, five preservation states, escaped dynamic labels, empty/single/constant/missing/invalid chart cases, chart-gap preservation, notification queue deduplication and cleanup, all main showroom renderers, SVG XML and rasterization. Overview artwork was visually inspected.

Not tested in a live browser: layout, form focus and validation UX, native dialogs, mobile behaviour, notification focus interactions, assistive technology, or actual authentication/history preservation. The environment had no working Chromium installation. These checks remain for the integrated application. This kit contains no Supabase migration, provider SDK implementation, real identity linking, or account creation.
