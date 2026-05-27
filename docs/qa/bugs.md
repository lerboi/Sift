# QA bug log

Running tally of bugs found across the QA sweep. Updated per tick.

## Status legend

- `open` — identified, not yet fixed
- `fixed` — code changed; awaiting user-device verification
- `verified` — user confirmed fixed on-device
- `wontfix` — out of scope (rationale in entry)
- `not-a-bug` — investigated, no defect

## Severity

- `blocker` — feature unusable
- `major` — feature works but with wrong data / wrong behaviour
- `minor` — visual or annoyance, no functional impact
- `polish` — nice-to-have

---

## Active bugs

| ID | Severity | Status | Feature | Summary |
| --- | --- | --- | --- | --- |
| BUG-001 | blocker | fixed | Watchlist | `FLAT_SPARK` undefined → crash on watchlist refresh after add |
| BUG-002 | major | fixed* | Onboarding | Welcome carousel — likely root cause `SafeAreaProvider` missing (verify on-device) |
| BUG-003 | blocker | fixed | Root layout | Missing `GestureHandlerRootView` — bottom sheets + swipeables don't work |
| BUG-004 | major | fixed | Root layout | Missing `SafeAreaProvider` — `useSafeAreaInsets()` returned zero insets across onboarding |
| BUG-005 | minor | fixed | Watchlist | Indentation typo in optimistic add object (cosmetic) |
| BUG-006 | polish | wontfix | Sign-in | Brief route flash for unonboarded user signing in (rare path) |
| BUG-007 | polish | open | Sign-in | No inline helper for password-too-short before submit |
| BUG-008 | minor | wontfix | Sign-up | "Check your email" screen ambiguous between legitimate new signup vs. already-registered email (Supabase anti-enumeration) |
| BUG-009 | minor | fixed | Ack screen | Double-tap on Continue could fire UPDATE twice + push two /notifications routes |
| BUG-010 | polish | open | Auth routing | `useAuthRouting` doesn't check `profiles.onboarded_at` — user who cold-restarts after ack but before first-tickers skips notifications + first-tickers |
| BUG-011 | minor | fixed | First-tickers | Skip button persisted tickers user had selected — counter to "Skip = discard" UX expectation |
| BUG-012 | minor | fixed | First-tickers | No double-tap protection on Continue (same pattern as BUG-009) |
| BUG-013 | major | fixed | Today | Notifications-bus pending-event splice crashed EventTimelineCard (synth rows lacked metric fields) |
| BUG-014 | minor | fixed | EventTimelineCard | fmtEPS/fmtSurprise/beatProb assumed non-null → crash on missing data |
| BUG-015 | minor | fixed | Watchlist | Rows for tickers without upcoming briefings showed "Q? 26" + "9999d" — replaced with em-dashes |
| BUG-016 | polish | open | Routing | Tapping a ticker from Today/Discover routes to `/watchlist/[ticker]` — jumps the user to the Watchlist tab |
| BUG-021 | polish | open | Realtime | useWatchedBriefingsStream over-fires on every UPDATE with new.status='ready' (REPLICA IDENTITY DEFAULT) — wasteful but idempotent |
| BUG-022 | polish | fixed | Realtime | useTickerEventsStream re-subscribed on every onChange identity change — now uses onChangeRef |
| BUG-023 | major | fixed | Push deep links | Briefing notifications routed to `sift://today/events/<briefing_id>` but event detail expects an event uuid → "Event not found"; now route to ticker detail |
| BUG-024 | minor | fixed | InlineError | `title` prop silently dropped by component; three callers (event/watchlist/ticker) expected it. Component now supports title. |
| BUG-025 | minor | fixed | Event detail | Error state had no Retry — user had to back out + re-navigate. Added refresh to useEvent + wired onRetry. |
| BUG-017 | major | fixed | Event detail | Failed events showed "0.0% In line" hero (misleading); now show "Filing couldn't be parsed" |
| BUG-018 | minor | fixed | Event detail | "View original Exhibit 99.1" rendered even when exhibitUrl null (tap did nothing); now hidden |
| BUG-019 | minor | fixed | Settings | Version row hardcoded "0.1.0" — now reads from app.json via expo-constants |
| BUG-020 | polish | open | Settings | Silent profile-load failure → user sees default toggles instead of their server state |

---

## Entries

### BUG-001 — `FLAT_SPARK` undefined → watchlist crash after add

- **Severity:** blocker
- **Status:** fixed
- **Surface:** Watchlist screen, after a successful ticker add
- **File:line:** `src/features/watchlist/use-watchlist.js:33`
- **Symptom:** Tap "+" → search → tap a result → optimistic row appears briefly → insert succeeds → `refresh()` runs → `shape()` references `FLAT_SPARK` which was deleted in B4 → `ReferenceError: FLAT_SPARK is not defined` → screen crashes / row vanishes. User perceives "ticker not added."
- **Root cause:** During B4 (sparkline migration), the FLAT_SPARK constant was removed from use-watchlist.js when sparkline ownership moved to WatchlistRow + useSparkline. One reference inside `shape()` was missed.
- **Fix:** Removed the `sparkline: FLAT_SPARK,` line from the populated-`hasNext` branch of shape(). WatchlistRow doesn't need this prop — it calls `useSparkline(symbol)` internally.
- **Verify:** Sign in → Watchlist tab → tap "+" → search "AAPL" → tap result. The row should appear and persist across a cold reload.

### BUG-002 — Welcome carousel not showing info

- **Severity:** major
- **Status:** fixed (verify on-device)
- **Surface:** Welcome screen (post-sign-in, pre-ack)
- **File:line:** likely root cause in `app/_layout.js` (missing provider, see BUG-004)
- **Symptom:** User reported "starting carousel screen not showing info"
- **Investigation:** welcome-screen.js has a valid SLIDES array of 3 entries with icons + title + body. Layout uses horizontal ScrollView pagingEnabled with width-per-slide pattern. The screen calls `useSafeAreaInsets()` for top/bottom padding. Without `SafeAreaProvider` (BUG-004), insets returned zero — the chrome might have collapsed under the status bar and obscured slide content. Most likely cause; fixed by BUG-004.
- **Fallback investigation if not fixed:** slide style has `flex: 1` + `width: width` in a horizontal ScrollView — this can collapse on some Android configs. Switch to `height: '100%'` if BUG-004's provider doesn't restore it.

### BUG-003 — Missing GestureHandlerRootView

- **Severity:** blocker
- **Status:** fixed
- **Surface:** entire app (anywhere @gorhom/bottom-sheet, ReanimatedSwipeable, or gesture-handler primitives are used)
- **File:line:** `app/_layout.js` — root component
- **Symptom:** Add-ticker sheet may not open, or opens but doesn't respond to taps. Swipe-to-remove on watchlist rows may not work. Bottom sheets in Settings (sign-out, subscription, quiet-hours) may misbehave.
- **Root cause:** `@gorhom/bottom-sheet` and `react-native-gesture-handler` require a `GestureHandlerRootView` wrapping the entire app. Phase 12 frontend work didn't add it; nor did the original onboarding scaffold.
- **Fix:** Wrapped the root layout's return value in `GestureHandlerRootView style={{ flex: 1 }}`.
- **Verify:** Watchlist tab → tap "+" → sheet should slide up from bottom. Tap outside or pan down to dismiss. Swipe a row left → trash button reveals.

### BUG-004 — Missing SafeAreaProvider

- **Severity:** major
- **Status:** fixed
- **Surface:** all onboarding screens (welcome, ack, notifications, first-tickers) + ticker detail (uses useSafeAreaInsets for sticky CTA)
- **File:line:** `app/_layout.js`
- **Symptom:** `useSafeAreaInsets()` returns zero insets without a `SafeAreaProvider`. Screens that compute top/bottom padding from insets render with no padding, causing chrome to overlap status bar / home indicator. Likely cause of BUG-002.
- **Fix:** Wrapped the root layout's return value in `SafeAreaProvider` (inside GestureHandlerRootView).
- **Verify:** Welcome screen should show full slides with the icon centered and slide dots / button visible at bottom above the home indicator.

### BUG-005 — Indentation typo in optimistic add

- **Severity:** minor
- **Status:** fixed
- **Surface:** `src/features/watchlist/use-watchlist.js:96` (object literal in `add()`)
- **Symptom:** Cosmetic only — `briefingReady: false` was over-indented. Valid JS, no functional impact.
- **Fix:** Re-aligned indentation.

### BUG-006 — Route flash on sign-in for unonboarded users

- **Severity:** polish
- **Status:** wontfix (intentional UX trade)
- **Surface:** `src/features/auth/sign-in-screen.js:39` — `router.replace('/today')` after successful signIn
- **Symptom:** Race between explicit screen-side replace and `useAuthRouting`'s onAuthStateChange-driven replace. For a user who signs in but hasn't ack'd disclaimer yet, they may briefly see /today before useAuthRouting redirects them to /welcome.
- **Why wontfix:** removing the explicit replace leaves the user with no immediate visual feedback after the sign-in button finishes. The flash is sub-frame on most devices.

### BUG-007 — No password-too-short helper text

- **Severity:** polish
- **Status:** open
- **Surface:** `src/features/auth/sign-in-screen.js` (and sign-up — same pattern)
- **Symptom:** Sign-in button silently disables when `password.length < 6`. User has no inline cue. Fix: thread `error` prop into the password TextField when password is non-empty but too short. Deferred to a later polish tick.

### BUG-013 — Notifications-bus pending splice crashed Today

- **Severity:** major
- **Status:** fixed
- **Surface:** `src/features/home/use-home-data.js` `subscribeToNotifications` callback + `promotePending`
- **Symptom:** Realtime notification arrival synthesised a minimal "event" object (state='live', no eps/surprise fields) and pushed it into pending. Tapping the "X new events" pill called `promotePending` which spliced these synth rows into the events list. EventTimelineCard's `RealizedBody` then called `epsActual.toFixed(2)` on undefined → `TypeError: Cannot read property 'toFixed' of undefined` → Today crashed for the duration between promote and the refresh re-fetch.
- **Root cause:** notifications carry kind + ticker_symbol + reference_id but no metric fields. The synthesised row was rendered as if it had complete data.
- **Fix:** changed the pending token shape to `{id, ticker, ts}` — pure pill-count fodder, not renderable. `promotePending` now just clears pending + triggers refresh; the real RPC pull populates events with full data within ~200ms.

### BUG-024 — InlineError ignored title prop

- **Severity:** minor
- **Status:** fixed
- **Surface:** `src/components/inline-error.js`; callers in event-screen, watchlist-screen, ticker-screen
- **Symptom:** InlineError signature was `{ message, code, onRetry }` — no `title`. Three callers passed `title="..."` which was silently dropped. User saw only the message, missing useful "Couldn't load X" context.
- **Fix:** added `title` prop rendered above the message in a slightly heavier weight. Re-aligned styles (icon top-aligned to handle multi-line title+message bodies). All three callers' titles now display.

### BUG-025 — Event detail error had no Retry

- **Severity:** minor
- **Status:** fixed
- **Surface:** `src/features/event/event-screen.js`
- **Symptom:** Error branch rendered `<InlineError title="Couldn't load event" message={error.message} />` — no onRetry. User had to navigate back and re-tap the row to retry.
- **Fix:** added a `refresh` function to `useEvent` (uses a refreshTick state to re-trigger the effect) and wired onRetry={refresh} into the InlineError.

### BUG-023 — Briefing push notifications route to a 404

- **Severity:** major
- **Status:** fixed
- **Surface:** `supabase/functions/notify_user_event/index.ts:72` — `buildNotification` for kind=briefing
- **Symptom:** Briefing-ready notifications constructed deep link `sift://today/events/${b.id}` where `b.id` is the briefing's uuid. Event detail (`/today/events/[event_id]`) queries `event_with_metrics_view.id` which is the EVENT uuid. They don't match — maybeSingle returns null → "Event not found" empty state.
- **Fix:** changed briefing deep link to `sift://watchlist/${ticker}` (ticker detail; the upcoming briefing card appears in its timeline). Same destination pattern as transcript notifications.
- **REVIEW for user:** **requires edge function re-deploy**: `supabase functions deploy notify_user_event`. Then trigger a briefing-ready notification — tap should open ticker detail, not "Event not found".

### BUG-021 — useWatchedBriefingsStream over-fires refresh

- **Severity:** polish
- **Status:** open
- **Surface:** `src/lib/realtime/use-watched-briefings-stream.js:35`
- **Symptom:** Postgres REPLICA IDENTITY DEFAULT means `payload.old` only contains the PK. Check `payload.old?.status !== 'ready'` evaluates as always true. Gate fires on every UPDATE with `new.status='ready'`, not only transitions. Refreshes are idempotent so it's wasteful but not incorrect.
- **Fix options:** REPLICA IDENTITY FULL (schema change + small storage cost) or client-side dedup via Set of notified ids. Deferred.

### BUG-022 — useTickerEventsStream channel churn

- **Severity:** polish
- **Status:** fixed
- **Surface:** `src/lib/realtime/use-ticker-events-stream.js`
- **Symptom:** useEffect dep was `[symbol, onChange]`. Inline lambda callers would churn the channel each parent render.
- **Fix:** held onChange in `onChangeRef`; dep is now `[symbol]`. Matches useWatchedBriefingsStream pattern.

### BUG-019 — Settings version row hardcoded

- **Severity:** minor
- **Status:** fixed
- **Surface:** `src/features/settings/settings-screen.js` ABOUT group
- **Symptom:** "Version 0.1.0" was a literal string. Would drift from package.json / app.json as the app version bumped.
- **Fix:** read from `Constants.expoConfig.version` with `'0.1.0'` fallback. Auto-updates with the next `expo-cli`/`eas` version bump.

### BUG-020 — Settings silent profile-load failure

- **Severity:** polish
- **Status:** open
- **Surface:** `src/features/settings/settings-screen.js` useEffect (line 48)
- **Symptom:** `if (cancelled || error || !data) return;` silently keeps default toggle values if the profile fetch fails. User sees their toggles default (briefings on, events on, transcripts off, quiet 22-07) even if their server state differs. Self-heals on next successful mount; tap-to-toggle writes the local state to server anyway.
- **Why open (not fixed):** the self-healing behavior makes it low-impact. Fix would be an inline error or retry button on the settings group; cosmetic addition.

### BUG-017 — Failed events show misleading "0.0% In line" hero

- **Severity:** major
- **Status:** fixed
- **Surface:** `src/features/event/event-screen.js` hero + `src/features/event/use-event.js` shape
- **Symptom:** RLS on `events` exposes both `parsed` and `failed` parse_status. For failed events, the joined `event_metrics` row is missing → all eps/surprise fields null. Shape defaulted `surprisePct` to 0 → classify(0) returned `In line` → hero displayed "━ In line · 0.0%" as if everything was fine.
- **Fix:** shape now passes `parseStatus` and preserves null surprisePct (no 0 fallback). Screen computes `isFailed = parseStatus === 'failed' || !hasMetrics`. When true, hero renders a `negative` Pill saying "Filing couldn't be parsed" + an explanation + filed_at, and skips the misleading number.

### BUG-018 — Source row "View original Exhibit 99.1" tappable when no URL

- **Severity:** minor
- **Status:** fixed
- **Surface:** `src/features/event/event-screen.js` Source section
- **Symptom:** SettingsRow rendered with `onPress={openFiling}` even when `ev.exhibitUrl` was null. openFiling guarded the no-URL case with early return, so the tap was a no-op but the row looked active.
- **Fix:** SettingsRow only renders when `ev.exhibitUrl` is truthy. Same pattern applied to Share — only renders when `hasMetrics` is true (sharing "EPS $0.00 vs $0.00" is misleading).

### BUG-016 — Ticker drill-in jumps to Watchlist tab from any source

- **Severity:** polish (architectural)
- **Status:** open
- **Surface:** `src/features/home/home-screen.js:28` (`openTicker = router.push('/watchlist/${ticker}')`), `src/features/discover/discover-screen.js:92` (same)
- **Symptom:** Today and Discover screens push `/watchlist/[ticker]` for ticker drill-in. The app router has only `app/(app)/watchlist/[ticker].js` (no `today/[ticker]` or `discover/[ticker]`), so every ticker tap jumps the user into the Watchlist tab. Event detail per tab works correctly (today/events, discover/events, watchlist/events all exist); only ticker detail is single-tab.
- **Why polish-tier:** the iteration plan's "no new features" rule means we can't add the missing per-tab ticker routes here. Fix is one-line (new route files re-exporting TickerScreen) but it's strictly additive scaffolding. Defer to a future polish tick where the rule relaxes.

### BUG-015 — Watchlist row shows "9999d" / "Q? 26" placeholders

- **Severity:** minor
- **Status:** fixed
- **Surface:** `src/features/watchlist/watchlist-row.js` (consumes `nextEarnings.daysAway` and `nextEarnings.period` from useWatchlist's `shape()`)
- **Symptom:** when a ticker has no upcoming briefing (`next_expected_at` null in view), shape() returns `daysAway: 9999` (sentinel so date-sort still works) and `period: 'Q? 26'` (fallback). WatchlistRow rendered these literally — user sees "9999d" and "Q? 26" which is ugly.
- **Fix:** WatchlistRow now derives `hasNext = daysAway < 9999`. When false, period and countdown display as `—` and the accessibility label says "no upcoming earnings scheduled" instead of "in 9999 days".

### BUG-014 — EventTimelineCard formatters/a11y crash on null fields

- **Severity:** minor
- **Status:** fixed
- **Surface:** `src/components/event-timeline-card.js` `fmtEPS`, `fmtSurprise`, `UpcomingBody`, `a11y`
- **Symptom:** `fmtEPS(null).toFixed(2)`, `Math.round(beatProb * 100)` with null beatProb, and `ticker.split('')` in a11y all crash if upstream data is missing. With seeded data this is unlikely, but defensive code is cheap.
- **Fix:** `fmtEPS` and `fmtSurprise` now return em-dash on null/NaN. Added `fmtBeatProb` with the same guard. `UpcomingBody` uses the safe wrapper + the a11y label is conditional on `beatProb != null`. `a11y` base label tolerates null ticker/period.

### BUG-011 — Skip button persists tickers on first-tickers

- **Severity:** minor
- **Status:** fixed
- **Surface:** `src/features/onboarding/first-tickers-screen.js` `skip()`
- **Symptom:** Both Continue and Skip called the same `persistAndExit` which always persisted `selected`. User taps suggested tickers, then taps Skip in the top corner → tickers added despite user's intent to exit cleanly.
- **Fix:** `persistAndExit` now takes a `{ persistTickers }` option. `finish` passes true; `skip` passes false. Only `onboarded_at` is set in both paths.

### BUG-012 — First-tickers double-tap

- **Severity:** minor
- **Status:** fixed
- **Surface:** `src/features/onboarding/first-tickers-screen.js`
- **Symptom:** Same as BUG-009 — no `submitting` guard, double-tap could fire duplicate work and a double router.replace.
- **Fix:** added `submitting` state guard at top of `persistAndExit`, threaded into the Continue button's `loading` + `disabled` props.

### BUG-009 — Ack screen double-tap race

- **Severity:** minor
- **Status:** fixed
- **Surface:** `src/features/onboarding/ack-screen.js` `confirm()` handler
- **Symptom:** Continue button stays enabled-appearance during the async UPDATE. A fast double-tap could fire two profile UPDATEs + push two /notifications screens onto the stack.
- **Fix:** added a `submitting` boolean state, gated into `canContinue` and the Button's `loading` prop. Wraps the async work in try/finally to restore the state.

### BUG-010 — useAuthRouting doesn't check onboarded_at

- **Severity:** polish
- **Status:** open
- **Surface:** `src/lib/use-auth-routing.js`
- **Symptom:** Routing decision is only based on `disclaimer_ack_at`. If a user ack's then cold-restarts before reaching first-tickers, `useAuthRouting` sends them straight to `/today` with an empty watchlist and no push token registered. They can still recover (add tickers via Watchlist tab, change push permissions in OS Settings) but skip onboarding affordances.
- **Fix idea:** add `onboarded_at` to the profile fetch and use a stricter status (e.g. `unonboarded` until both `disclaimer_ack_at` AND `onboarded_at` are set). Deferred — three-state routing is more code; current behaviour is recoverable.

### BUG-008 — Sign-up: "Check your email" screen ambiguous for existing emails

- **Severity:** minor
- **Status:** wontfix (Supabase server-side behavior)
- **Surface:** `src/features/auth/sign-up-screen.js:42-45` — `needsConfirm` state set when `data.session` is null
- **Symptom:** When a user signs up with an email that's already registered, Supabase's anti-enumeration default returns the same shape as a successful-but-needs-confirmation signup (no session, no error). The user lands on the "Check your email" screen and waits forever for an email that will never arrive because the email is already taken.
- **Why wontfix:** Supabase deliberately conflates these two cases to prevent enumeration attacks. Client-side disambiguation is impossible without weakening the security posture. Workarounds (e.g. pre-check via a Supabase function that returns "email available" without exposing whether a user exists) require trust in client-side rate-limiting.
- **Mitigations available:** add copy on the "Check your email" screen along the lines of "If you don't see an email within a minute, you may already have an account — try Sign in instead." This is a copy change and could be added in a polish tick.

---

## Resolved bugs

(see Active table — `fixed` rows above; will move to `verified` after user confirms on-device)
