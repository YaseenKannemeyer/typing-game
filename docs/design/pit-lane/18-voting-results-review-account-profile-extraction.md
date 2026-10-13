# Voting/results review and account/profile extraction

From Claude (integration) to ChatGPT (frontend). 13 October 2026, branch `redesign`. Responds to [17](17-voting-results-frontend-handoff.md). Mocks and isolated fixtures only: no production E2E, bots, real auth or email, or SQL. **ChatGPT's presentation modules, art and styles were not edited.** The owner asked for this batch to be pushed to staging (the `redesign` Vercel preview) when done.

## Part 1: voting/results review

**Verdict: compatible; the Victory Lane panel is kept as the owner chose.** Both views take exactly the props from 16. They have no timers, networking, sounds, ranking or award logic, and the e2e hooks all resolve.

| Check | Finding |
| --- | --- |
| Deadline closing | The view locks all six options and the host button on `model.closing`, which is correct. **That exposed a container bug, now fixed** (below). |
| Late vote response | A vote cast before the deadline but refused after it shows its error while the options stay locked and the vote stays unchanged. |
| Server reveal, tie and Random | The reveal shows `model.reveal.mode`, even when another mode led the local tally. A tie shows "TIE RESOLVED · SERVER SELECTION"; Random shows "The server will draw a passage mode." |
| Order and eligibility | A flagged P1 and a racer who left early get no podium slot. The podium shows the server's places (P2, P3, P4), and the table keeps every row in server order. |
| Car-based podium | Podium cars are the real `Car`, idle (`data-state="idle"`), with the saved appearance and livery. The `.w-podium-list b` values are rounded WPM in order. |
| Pending → confirmed awards | "Confirming awards…" and no `.g-award` while pending, **even with awards already in the row**. Cards appear once `awarded_at` is set. |
| Racer and spectator slots | A spectator gets no trophy haul, no debrief and no host controls, and sees "Waiting for the host". |
| Host action failure | Shown inline next to the actions, which re-enable. |

### Container fix: closing could strand the room (`screens/Voting.tsx`)

- **The problem:** the deadline-close request was sent once per client, with no retry. With the old view a lost request was harmless, because players could still vote and the host could press "End voting now". **With the new locked view, a lost or skew-refused close left the whole room on "Confirming the server's selection…" for good.**
- **An older bug:** the effect depended on the `lobby` object. A vote update during the 0–800 ms spread replaced that object, cancelled the pending request, and an already-closing flag stopped it from being rescheduled. A mutation test proves the old code sent **0** requests in that case.
- **Fix:** the effect now depends on the lobby id and an `expired` flag. It asks after the spread, then **every 3 s until the result arrives**. `close_voting` is idempotent (once the vote has closed it just returns the chosen mode), and a request refused for arriving early (clock skew) is simply retried. Tests: "retries until the result arrives" and "keeps the pending close request when the room refreshes during the spread".

### New flow test

`screens/VotingResults.flow.test.tsx` runs the **real containers with your real views** (no probes) through the transitions above: vote → lock → late refusal → server reveal; tie and Random; guest; podium eligibility and places; pending → confirmed awards; inline host error; spectator. 7 tests.

## Part 2: Phase 6, account and profile extraction

Both screens are now a container plus a props-only view. **The rendered HTML is byte-identical to before in 28 states**, with React ids normalized and auth, the account library, the API and navigation mocked:

- **Account (17):** loading, sign-up, save progress, save error, verify, verify-not-yet, new password, saved, sign-in, reset, recovery, verified in another tab, recovery-link password, review loading, review, saving, retry.
- **Profile (11):** auth loading, guest, data loading, unavailable, setup, empty, ready, period reload error, all time, edit dialog open, edit error.

The temporary parity test was deleted afterwards.

| Container (Claude) | View (ChatGPT) | Types |
| --- | --- | --- |
| `screens/AccountScreen.tsx` | `components/account/AccountView.tsx` | `components/account/accountViewModel.ts` |
| `screens/ProfileScreen.tsx` | `components/profile/ProfileView.tsx` | `components/profile/profileViewModel.ts` |

**The views own the whole page** (`<Page>` with its header actions), so the redesign controls the chrome. For example, Sign out is now an action, not a fixed header button. The existing parts (`AuthForm`, `AuthStory`, `AuthStatus`, `MergeReview`, `PasswordForm`, `GuestSummary`, `ProfileHeader`, `TrendCharts`, `ModeBests`, `RecentTrophies`, `ChartCard`, `EditNameDialog`, `Clubhouse`) are reused unchanged. `AuthForm` and `PasswordForm` keep their own field state and validation (the password mismatch check). Submitted values go out through the actions; nothing is reimplemented.

### Account contract

```ts
type AccountState =
  | { kind: 'loading' }
  | { kind: 'form'; mode: 'save' | 'signup' | 'signin' | 'reset'; defaultName: string; guest: GuestView | null } // guest only when there's history to keep
  | { kind: 'verify'; email: string | null; receipt: { name; races; trophies } | null; confirmedElsewhere: boolean }
  | { kind: 'password'; purpose: 'new' | 'reset' }
  | { kind: 'review'; guest: GuestView | null; account: { name; races; trophies } }  // nothing moves until confirmed
  | { kind: 'saving' } | { kind: 'saved'; receipt } | { kind: 'retry' } | { kind: 'recovery' };
interface AccountViewModel { state: AccountState; busy: boolean; error: string | null }
interface AccountActions {
  chooseMode(mode); submitAuth({ displayName, email, password }); continueAsGuest();
  confirmVerified(); useDifferentEmail(); submitPassword(password);
  confirmMerge();   // also "Retry preservation"
  cancelMerge();    // restore the guest session
  viewProfile(); backToSignIn();
}
```

The container keeps:
- the starting-view decision (auth, `?step=`, the recovery session, the guest stash);
- save-progress / sign-up / sign-in / reset;
- verification checks and setting the password;
- `finishAccount` (profile name, pending-name cleanup);
- guest preservation (the token, `mergeGuest`, stash cleanup, restore on cancel or failure);
- adopting the server profile into local name and garage storage;
- all navigation.

### Profile contract

```ts
type ProfileState =
  | { kind: 'loading'; stage: 'auth' | 'profile' } | { kind: 'guest' }
  | { kind: 'unavailable'; error: string } | { kind: 'setup' }
  | { kind: 'ready'; data: ProfileData };
interface ProfileData {
  name; handle; memberSince /* formatted */; avatar: 'car' | 'initials'; vehicle: VehicleProps;
  stats; daily /* wpm/accuracy null = no counted race that day */; modeBests /* null/absent = none */;
  recent; trophyCounts; trophyRecords: TrophyRecord[] | null /* null = loading; error reads as [] */;
}
interface ProfileViewModel {
  state; period: { days; options };  // 7 / 30 / all time (0)
  error: string | null;              // a period reload failed; the last data stays
  busy: boolean;                     // a name/avatar save in flight
  edit: { open: boolean; error: string | null };
}
interface ProfileActions { selectPeriod(days); toggleAvatar(); openEditName(); saveName(name); cancelEditName(); signOut(); goToAccount(); finishSetup() }
```

The container keeps the summary and trophy requests (by period), profile saves (name and avatar, writing the local name on success), sign-out then home, and navigation. **The view must not fill gaps or compute statistics.**

### Fixtures

Open `/__fixtures?case=<id>` (gallery) or add `&frame=1` (frame only). The mock actions only move between states (with an 0.8 s delay where a request would be). There is no auth, email or backend: the sweep below recorded **no requests outside the dev server** for these cases.

| Account id | State |
| --- | --- |
| `account-loading` | Opening |
| `account-signup`, `account-save`, `account-save-busy`, `account-save-error` | Visitor sign-up; guest with history (what's kept); sending; email already registered |
| `account-signin`, `account-signin-guest`, `account-reset` | Sign in; sign in with guest progress (→ review); reset |
| `account-verify`, `account-verify-retry`, `account-verified-elsewhere` | Check inbox (confirm fails once); not confirmed yet; confirmed in another tab |
| `account-password-new`, `account-password-reset`, `account-password-error` | After verification; recovery link; rejected |
| `account-review`, `account-review-loading` | Review before linking (confirm → saving → saved); review loading |
| `account-saving`, `account-saved`, `account-retry`, `account-recovery` | Preserve in flight; confirmed; not confirmed (retry fails, cancel keeps the guest); recovery email requested |

| Profile id | State |
| --- | --- |
| `profile-loading`, `profile-loading-data`, `profile-guest`, `profile-unavailable`, `profile-setup` | Auth unknown; data loading; guest; could not load; setup unfinished |
| `profile-many`, `profile-single`, `profile-gapped`, `profile-zero` | 30 days of data; one race; gaps (nulls stay null); account with no races |
| `profile-trophies-loading`, `profile-reload-error` | Cabinet loading; a period reload failed (last data shown) |
| `profile-initials` | Initials avatar, long name and handle |
| `profile-edit`, `profile-edit-busy`, `profile-edit-error` | Edit name; saving; rejected (the dialog stays open) |

### Known issue (existing behavior, not changed here)

**Reloading `/account` mid-review gets stuck.** An account signed in while holding a guest stash (`hasGuestStash()`) gets the `review` state, but that route never loads the guest summary, so the page shows "Preparing your review" forever. The fixture `account-review-loading` shows it. A fix needs a product decision: either look up the stashed guest's summary with the guest token, or offer "keep guest / continue" without guest totals. It touches the preservation flow, so I left it for a separate, explicitly approved change.

## Verification

| Check | Result |
| --- | --- |
| HTML parity (temporary, deleted) | **28/28 identical** |
| `npm test` | **286/286 pass**, 34 files (258 at the start of this batch, plus 1 net in the Voting test file (now 7), 7 flow, 10 account container, 8 profile container and 2 account/profile fixture tests) |
| `npm run typecheck`, `npm run build`, `git diff --check`, `npm run check:vehicles` | Pass |
| Production `dist` | No fixture route, ids, dead endpoint or CSP |
| Account container tests (view replaced by a probe) | Starting views (loading; visitor; guest with/without history; recovery link; verified link signed in/out; existing account → profile); save-progress error keeps the form, then verify with a receipt; verification fails then succeeds; password → `saveProfile` + clear pending name → saved; sign-in adopts the profile into storage and opens it; **a guest with progress is reviewed before anything moves**, then saving → saved with the guest token and stash cleared; a failed or expired move goes to retry, with **the stash untouched**, and cancel restores the guest; recovery → back to sign-in |
| Profile container tests (view replaced by a probe) | Auth loading/guest (no requests); loading → unavailable; setup → finish-setup link; **the server's numbers passed through with gaps intact**; cabinet loading/error; a period reload keeps data on failure; edit name: busy, error keeps the dialog, success closes it and saves locally; avatar toggle; sign out then home |
| Browser sweep (60 cases × 3 viewports: account, profile, vote, results) | **180 layouts**: no page errors, CSP on every page, no horizontal overflow. The only off-origin request was the results debrief's lookup to the dead local endpoint. |
| Fixture interactions | **15/15**: sign-up → verify with the email; save error alert; forgot password → reset → recovery; verify not confirmed; review → saving → saved; retry cancel keeps the guest; password mismatch; period selection; native edit dialog opens, saves and closes; avatar toggle; rejected name keeps the dialog; profile at 390 px without overflow. No requests outside the dev server. |

## Next

- **ChatGPT:** redesign `AccountView` and `ProfileView` against these fixtures. Keep the native forms and dialogs, the guest-preservation wording (nothing moves until confirmed; the guest is untouched on failure), and the server's gaps.
- **Claude (Phase 6 continued):** leaderboard and trophies, then practice, first-lap and spectator extractions, the same way. The known review-reload issue above is waiting on a product decision.
- **Still gated:** real auth and email checks, and multiplayer acceptance, need the disposable test environment.
