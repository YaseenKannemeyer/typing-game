# Integrate Kit 15: Account & Profile

Read `design-kits/account-profile-kit/README.md`, `manifest.json`, and the new `src` modules. Open `OPEN-ME.html` to inspect the intended UI. Use this with the previously supplied full GRID design system.

## Inspect first

Read current project instructions, routing, NameGate, storage, `client/src/lib/supabase.ts`, API helpers, profile/auth code if any, and the database ownership model. Identify whether guests use provider anonymous identities, server guest tokens or another mechanism. Verify the configured provider's current supported identity-upgrade/linking flow before implementing it. Do not assume that creating a second user will preserve the first user's history.

## UI mapping

- New account screen/components: sign-in, create account, recovery, guest-save, verification, pending preservation, retry and confirmed success.
- Profile: header, car/initials avatar switch, validated display-name edit, member since, canonical stats, trend charts and mode bests.
- Leaderboard: top-three hero plus ranked table, actual period/mode filters and local-player emphasis.
- Persistent achievement region: queued toast fed by confirmed award events.

Reuse existing `client/src/art/{vehicleArt,trophyArt}.ts`, Garage/TrophyIcon/AwardCard and shared tokens. `vendor/` is for standalone preview only. Do not load duplicate global kit scripts into the production app. Convert renderers into React/TypeScript components with typed data rather than copying the demo controller.

## Preservation requirements

- Guest history remains tied to its proven identity while verification is pending.
- Prefer retaining the same canonical identity through a supported upgrade path; otherwise implement explicit ownership-verified reconciliation.
- Sign-in to an existing account is a different path: authenticate, review, confirm, then reconcile server-side.
- Do not trust browser-submitted ownership, counts, WPM or trophies.
- Preserve existing race records; deduplicate by canonical IDs and make retry operations idempotent.
- Clear/replace the old guest context only after the backend confirms the outcome.
- Only show success from actual server confirmation; refresh canonical totals afterward.
- Support expired links, already-used email, pending verification, retry and conflicting sessions without silently discarding progress.
- Use provider-configured password rules, generic recovery confirmation and redirect allowlists. Never log credentials.

## Statistics / notifications

Confirm the definitions of race count, wins, best WPM and distinct trophies with existing shared logic. Chart daily accuracy must be weighted by attempts. Period boundaries and timezone must be explicit. Mode bests exclude Random as an unresolved category. Use missing values, not zero, for unavailable data.

Use actual persisted award event IDs to deduplicate toasts. Keep the queue outside route-remounting race content. Do not focus a toast or announce all leaderboard updates through a live region. On mobile, keep notifications outside the typing line. Respect reduced motion and sound preferences.

## Verification

Test auth success/failure, verification-pending/expired, guest-preservation retry, existing-account review, duplicate merge attempts, and protected record access. Verify guest race/trophy IDs remain correctly owned after the operation. Test empty charts, period/mode filters, single/gapped data, hall-of-fame ties, toast bursts, duplicate events, dismiss/hover/focus, route cleanup and mobile typing focus. Run existing build/type/test commands and actual browser checks. Do not claim real account creation works from the static preview alone.
