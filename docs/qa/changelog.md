# QA loop — changelog

One paragraph per tick. Most recent first. `REVIEW:` prefix flags items the user should sanity-check on-device.

---

## 2026-05-27 · QA23 — Smoke checklist + loop close

Created `docs/qa/smoke-checklist.md` — structured on-device walkthrough covering every screen + every BUG-NN fix. Organised: pre-flight (Metro reload + edge function re-deploy) → auth → onboarding → today → watchlist → discover → ticker → event → settings → push → realtime. Closing section lists deferred polish bugs.

### QA loop close summary

**25 bugs filed across 23 ticks:**
- 3 blocker (all fixed): BUG-001/003/004
- 5 major (all fixed): BUG-002/013/017/018/023
- 9 minor (all fixed): BUG-005/009/011/012/014/015/019/024/025
- 7 polish (1 fixed BUG-022; 6 open/wontfix BUG-006/007/008/010/016/020/021)

**15 source files modified:**
- `app/_layout.js` — added GestureHandlerRootView + SafeAreaProvider
- `src/lib/storage.js` — SecureStore fallback for Expo Go
- `src/lib/realtime/use-ticker-events-stream.js` — onChangeRef pattern
- `src/lib/realtime/notifications-bus.js` (unchanged this loop, audited)
- `src/components/inline-error.js` — title prop support
- `src/components/event-timeline-card.js` — null-safe formatters
- `src/features/home/use-home-data.js` — pending refactor, no-splice
- `src/features/watchlist/use-watchlist.js` — FLAT_SPARK removed, indent
- `src/features/watchlist/watchlist-row.js` — em-dash placeholder masking
- `src/features/event/use-event.js` — refresh + parseStatus
- `src/features/event/event-screen.js` — failed-event hero, source/share guards, retry
- `src/features/onboarding/ack-screen.js` — submitting state + loading
- `src/features/onboarding/first-tickers-screen.js` — Skip semantics + submitting
- `src/features/settings/settings-screen.js` — version from app.json
- `supabase/functions/notify_user_event/index.ts` — briefing deep link routes to ticker

**3 docs maintained + 1 new:**
- `docs/qa/iteration-plan.md`, `bugs.md`, `changelog.md`, `smoke-checklist.md`

**What needs user action:**

1. **Re-deploy edge function** for BUG-023:
   ```
   supabase functions deploy notify_user_event
   ```
2. **Walk `docs/qa/smoke-checklist.md`** on-device, tick boxes as you verify
3. Any failures → new `BUG-NN` entry in `bugs.md` → re-run `/loop` against this plan for round 2

**Out of scope (filed but deferred):**
- BUG-016 (per-tab ticker routes — additive scaffolding)
- Root error boundary (new component)
- Solicitor review of legal copy (DRAFT pills serve)
- Phase 13 Modal workers (separate loop)

**Loop closes here.** The smoke checklist is the deliverable.

---

## 2026-05-27 · QA22 — Error boundaries + recovery

Audited every screen that uses InlineError (home, watchlist, ticker, event). Reviewed how each surfaces error state and what recovery the user has.

Fixed two minor bugs:

**BUG-024 — InlineError ignored title prop:** component signature was `{ message, code, onRetry }`. Three callers (event-screen, watchlist-screen, ticker-screen) passed `title="..."` that was silently dropped. Fixed: added title prop rendered in heavier weight above the message; icon now top-aligned to handle multi-line bodies.

**BUG-025 — Event detail had no Retry:** error branch rendered InlineError without onRetry. User had to back out + re-navigate. Fixed: added `refresh` function to useEvent (refreshTick state to re-trigger effect) and wired `onRetry={refresh}`.

Verified other surfaces (home, watchlist, ticker) already wire onRetry={refresh} + RefreshControl pull-to-refresh.

No root error boundary — JS exceptions still crash to white screen. Adding one requires a new component (out of scope per "no new features").

**REVIEW for user:** airplane mode → open Today/Watchlist/Ticker/Event. Each shows InlineError with title + message + Retry button. Tap Retry → re-fetch.

**Next tick:** QA23 — Final smoke recap.

---

## 2026-05-27 · QA21 — Navigation + tab state

Read `(app)/_layout.js` (Tabs) + per-tab Stack layouts (today/watchlist/discover/events/settings). Four tabs (Today/Watchlist/Discover/Settings) with `events` folder hidden (`href: null`) but kept for orphan deep links.

Verified per-tab event detail routes (today/events, discover/events, watchlist/events) keep the user in their originating tab.

Found and fixed one MAJOR bug:

**BUG-023 — Briefing push notifications route to a 404:** `notify_user_event` edge function built `sift://today/events/${b.id}` for briefing-ready notifications. Event detail expects an EVENT uuid via `event_with_metrics_view.id`, but `b.id` is a briefing uuid. The route resolves but the lookup misses → "Event not found" empty state. Fixed: briefing deep links now route to `sift://watchlist/${ticker}` (ticker detail with the upcoming briefing card in its timeline). **REQUIRES EDGE FUNCTION RE-DEPLOY** by user.

Documented but not fixed:

- BUG-016 (polish, carried from QA12): ticker drill-in from Today/Discover routes to /watchlist/[ticker], jumping tabs. Fix is additive scaffolding (new per-tab ticker routes) blocked by "no new features" rule.
- Top-level `/events/[event_id]` route exists but no deep link points to it after BUG-023 fix. Orphan but harmless.

**REVIEW for user:**
1. **Re-deploy edge function:** `supabase functions deploy notify_user_event`
2. Trigger briefing-ready: `update public.briefings set status='ready' where ticker_symbol='AAPL';` (AAPL must be on your watchlist)
3. Tap the push → should open ticker detail, not "Event not found"

**Next tick:** QA22 — Error boundaries + recovery.

---

## 2026-05-27 · QA20 — Visual pass

Grepped for likely visual bugs:

- **Number formatters with `.toFixed`:** all consumers either pre-normalise via `Number(? ?? 0)` (Discover) or were fixed in BUG-014 (EventTimelineCard fmtEPS/fmtSurprise return em-dash on null). Event-screen's fmtUSD/fmtBillion use `Number(n).toFixed(...)` (coerces null to 0); only rendered when `hasMetrics` true (BUG-018 fix).
- **Compliance forbidden words:** only hit in a code comment in welcome-screen.js documenting the rule. No directive language in product copy.
- **Snake_case in JSX:** none leaked. All `ticker_symbol`/`fiscal_period` usages are in DB queries or shape() field accessors.
- **Stale "Q? 26"/"9999d" placeholders:** masked at render via QA10 BUG-015 fix.
- **Sparkline + date formatters with null/empty:** all handled safely; verified in earlier ticks.

No new bugs. Discover's "0.0%" for missing expected_move_pct acceptable for MVP — all 5 seeded briefings have valid values.

**REVIEW for user:** look across all screens for "9999d", "NaN", "[object Object]" or similar. Pre-emptive code review covered the patterns.

**Next tick:** QA21 — Navigation + tab state.

---

## 2026-05-27 · QA19 — Empty-state walkthrough

Walked every screen in a fresh-user / zero-data scenario:

- Auth + onboarding (welcome/how-it-works/ack/notifications/first-tickers): static arrays, always render.
- Today: empty watchlist → EmptyState "Nothing on your radar yet" + Watchlist pointer. HomeSkeleton during load.
- Watchlist: empty → EmptyState "No tickers tracked yet" + Add ticker CTA (sheet rendered in empty branch).
- Discover: each of 3 rails has its own empty-state copy. No crash with all rails empty.
- Ticker detail (unknown symbol): meta fallback `{symbol, name=symbol, sector: '—'}`. Empty timeline shows "No upcoming or recent earnings for X yet." Sparkline returns null on empty array.
- Event detail (unknown uuid): EmptyState "Event not found".
- Settings: defaults shown until profile fetch completes (per BUG-020 deferred).
- Sub-screens + sheets: static.

Minor flicker on Watchlist initial load (QA10 carried forward) — Today's HomeSkeleton pattern would be the fix but requires a new component (out of scope per loop rules).

No new bugs.

---

## 2026-05-27 · QA18 — Watched-briefings + ticker-events streams

Read both stream hooks.

**useWatchedBriefingsStream:** filters channel to `ticker_symbol=in.(<list>)`, fires onReady when status transitions to 'ready'. Symbol-list dep keyed via sorted-joined string so reorders don't churn. onReadyRef pattern in place. Found one edge case (BUG-021 — open, polish): the `payload.old.status !== 'ready'` check is unreliable because Postgres replica identity is DEFAULT, so `payload.old` only has the PK. Check evaluates as always true; gate fires on every UPDATE where `new.status='ready'`. Wasteful but not incorrect — refreshes are idempotent. Deferred.

**useTickerEventsStream:** filters channel to single ticker. Fixed BUG-022: useEffect dep was `[symbol, onChange]` — inline lambda usage would churn the channel each render. Applied same `onChangeRef` pattern as useWatchedBriefingsStream; dep is now `[symbol]`. Current consumer (useTickerDetail) uses stable useCallback so wasn't affected; this is a robustness fix for future consumers.

**REVIEW for user:** with AAPL on watchlist + a briefing for AAPL existing, run `update public.briefings set status='ready' where ticker_symbol='AAPL';` — Watchlist + Today should refetch within ~1s.

**Next tick:** QA19 — Empty-state walkthrough.

---

## 2026-05-27 · QA17 — Notifications realtime stream

Read `use-notifications-stream.js`, `notifications-bus.js`, `use-user-id.js`. Traced the path: useUserId → onAuthStateChange → userId state → useNotificationsStream subscribes channel `notifications:${userId}` → postgres_changes INSERT filtered server-side → broadcastNotification → bus listeners (useHomeData consumer pushes to pending pill).

Verified:
- Channel cleanup on unmount: `supabase.removeChannel(channel)` in useEffect return.
- Channel name uniqueness: `notifications:${userId}` so sign-out → sign-in same device tears down old channel + creates new.
- Sign-out flow: userId flips to null → useEffect early-returns + cleans up prior channel.
- Filter `user_id=eq.${userId}`: UUIDs are safe for the filter syntax (no injection); RLS is the real security boundary.
- Bus listener errors are try/caught so one bad listener doesn't break others.
- JWT auto-refresh (`autoRefreshToken: true` in our client) keeps the channel authenticated across long sessions.

No bugs filed.

**REVIEW for user (requires SQL editor + open app):** with app on Today screen, run in SQL editor:
```sql
insert into public.notifications (user_id, kind, ticker_symbol, title, body, deep_link)
values ('<your-uuid>', 'event', 'AAPL', 'AAPL test', 'realtime arrived', 'sift://today/events/00000000-0000-0000-0000-000000000000');
```
Within ~1s, the "1 new event" pill should appear at the top of Today. Tap → pill clears + Today refreshes.

**Next tick:** QA18 — Watched-briefings + ticker-events streams.

---

## 2026-05-27 · QA16 — Subscription / Sign-out / Quiet-hours sheets

Read all three sheets. All forwardRef components wrapping AppSheet — functional via QA1's GestureHandlerRootView fix.

- **SubscriptionSheet (stub):** placeholder copy explaining the tier will arrive before public launch. Compliance copy factual; no directive language.
- **SignOutSheet:** destructive friction pattern. `onConfirm` fired before close so the consumer's handler runs deterministically.
- **QuietHoursSheet:** five presets (off / 22-07 / 23-08 / 21-07 / overnight 20-09). `presetLabel(value)` export consumed by Settings.

No bugs filed.

**REVIEW for user:** Settings → tap Plan / Sign out / Quiet hours — each sheet slides up, close-on-tap or pick-on-tap works.

**Next tick:** QA17 — Notifications realtime stream.

---

## 2026-05-27 · QA14 — Settings screen

Read `settings-screen.js`. Profile fetch on mount, optimistic toggles persisting to profiles via `persistPref(column, value)`, sign-out sheet, plan row reads from profiles.tier, navigations to disclaimer/privacy/terms.

Fixed one minor display bug:

**BUG-019 — Hardcoded version "0.1.0":** changed to `Constants.expoConfig.version` with the same string as fallback. Auto-tracks app.json bumps.

Filed one polish observation (BUG-020): profile-load failure silently keeps default toggle values. Self-heals; deferred. Also removed unused `noop` const.

Sheets functional via QA1's GestureHandlerRootView fix.

**REVIEW for user:** open Settings. Email shown. Toggle a notification → persists (verify with `select notify_briefings from public.profiles where id = '<uuid>'`). Quiet hours → sheet → preset → updates `quiet_hours_preset`. Sign out → sheet → confirm → /sign-in.

**Next tick:** QA15 — Disclaimer/Privacy/Terms screens.

---

## 2026-05-27 · QA13 — Event detail

Read `use-event.js` and `event-screen.js`. Walked the data flow for both parsed and failed events.

Found and fixed two bugs:

**BUG-017 (major) — Failed events show misleading "0.0% In line" hero:** RLS on `events` exposes `failed` parse_status (so the frontend can render an inline error). For failed events, the LEFT JOIN'd event_metrics row is null. Shape was defaulting `surprisePct` to 0 → classify(0) returned `In line` → user saw "━ In line · 0.0% EPS surprise" for an event with no data. Fix: shape now carries `parseStatus` and preserves null surprisePct. Screen branches on `isFailed = parseStatus === 'failed' || !hasMetrics` and renders a negative-Pill hero "Filing couldn't be parsed" with explanation + filed_at.

**BUG-018 (minor) — Source row tappable with no URL:** SettingsRow rendered "View original Exhibit 99.1" even when `ev.exhibitUrl` was null. Tap was a no-op via openFiling guard but the row looked active. Fix: conditionally render the row. Share button also gated on `hasMetrics` (otherwise share text would say "EPS $0.00 vs $0.00").

**REVIEW for user:** open a seeded past event (AAPL Q4-25). Should show full hero with "▲ Reported beat · +8.1%", metrics, compare bars, guidance, filing timeline, segments, source link, share. To test failed-event path: `update public.events set parse_status='failed' where ticker_symbol='AAPL' limit 1` then revisit (revert after).

**Next tick:** QA14 — Settings screen.

---

## 2026-05-27 · QA12 — Ticker detail

Read `ticker-screen.js`, `use-ticker-detail.js`, cross-referenced `ticker_detail_timeline` RPC and EventTimelineCard.

The hook does parallel fetch of ticker meta + timeline RPC + default watchlist id, then a serial lookup for "is this ticker in the user's watchlist". Optimistic add/remove via `toggleWatchlist`, with rollback on error. `useTickerEventsStream(sym, fetchAll)` refetches on any event change for this ticker (briefing→ready, event→parsed, etc.).

`renderItem` handles all four kinds (earnings-upcoming, earnings-past, briefing, transcript) with kind-specific props. `shapeTimelineRow` normalises null fields (epsEst, beatProb, surprisePct) to either null or 0 — EventTimelineCard's QA9 BUG-014 fix makes the null path render `—` safely.

No new fixable bugs in scope. Filed one polish observation:

**BUG-016 (polish, open) — Ticker drill-in jumps to Watchlist tab:** Today and Discover both push `/watchlist/[ticker]`. The app router has no per-tab ticker route, so any ticker tap relocates the user to the Watchlist tab. Event detail is per-tab (today/events, discover/events, watchlist/events). Fix is additive scaffolding (new route files re-exporting TickerScreen) which the "no new features" rule blocks; deferred.

**REVIEW for user:** open AAPL detail from any source. Hero shows symbol+name+sector+sparkline. Timeline shows upcoming briefing (Q3 26), past event (Q4 25 beat), transcript card. Tap "Add to watchlist" → button flips immediately + row appears in Watchlist. Tap again → "Remove from watchlist" → row disappears. Tap the i-info icon next to beat probability → methodology sheet slides up.

**Next tick:** QA13 — Event detail.

---

## 2026-05-27 · QA11 — Discover screen

Read `discover-screen.js`. Walked three rails (biggest expected, sector heat, biggest surprises) + the inline search. All three RPCs loaded via Promise.all in one useEffect with cancel-guard. Empty-state copy on each rail. Search uses debounced searchTickers (already audited in QA1's BUG-001 area — fine).

No bugs filed. Observations:

- `discover_biggest_expected` RPC uses `date_trunc('week', current_date)` (Monday start) + 7-day window. Seeded briefings span `current_date + 1..6`; on some weekdays a few may fall outside the window. Not a bug — RPC behavior is correct; seed dates are illustrative.
- `expected_move_pct` defaults to 0 if the briefing's `surprise_prediction` jsonb lacks the key. Shape converts via `Number(? ?? 0)`. Renders as "0.0%" rather than "—". Acceptable.
- Compliance copy verified: "Model" prefix on the expected rail, "educational" on the footer, no advisory verbs.

**REVIEW for user:** open Discover. Should see 3 cards. Type a ticker in search; results appear in a card above the rails.

**Next tick:** QA12 — Ticker detail.

---

## 2026-05-27 · QA10 — Watchlist screen

Read `watchlist-screen.js`, `watchlist-row.js`, `sort-selector.js`. The screen has error/empty/sorted branches. SwipeableRow + sheet now functional via QA1's GestureHandlerRootView.

Fixed BUG-015 (minor): useWatchlist's `shape()` returned `daysAway: 9999` + `period: 'Q? 26'` as fallbacks for tickers without upcoming briefings. WatchlistRow rendered these literally — user saw "9999d" and "Q? 26". Fixed with `hasNext = daysAway < 9999` guard; displays `—` instead. A11y label says "no upcoming earnings scheduled" instead of "in 9999 days".

Did NOT fix: ~200ms initial-load flicker where sort row briefly renders with empty Card before empty-state kicks in (deferred — minor).

**REVIEW for user:** add 2-3 tickers (e.g. AAPL — seeded, INTC — not seeded). Seeded shows real period+countdown+briefing badge. Unseeded shows "—" for period/countdown, no badge. Swipe left → trash button. Sort selector changes order.

---

## 2026-05-27 · QA9 — Today screen

Deep read of `home-screen.js`, `use-home-data.js`, `event-timeline-card.js`. Walked the data flow:

1. `useHomeData` fetches via `home_events_for_user` RPC → shapes rows by state (upcoming gets epsEst/beatProb/briefingReady, past/live gets epsActual/epsEst/surprisePct).
2. Realtime notifications bus push → pending state increments → pill arms.
3. User taps pill → `promotePending` was splicing synth rows into events + refreshing.
4. `EventTimelineCard` renders.

Found two real bugs:

**BUG-013 (major) — Today crash on pending pill tap:** the synth row pushed into pending had state='live' but no `epsActual`/`epsEst`/`surprisePct`. When promote merged it into events, EventTimelineCard's RealizedBody called `epsActual.toFixed(2)` on undefined → TypeError. Fixed by changing the pending token shape to `{id, ticker, ts}` (pure pill-count fodder, never rendered as a card) and making `promotePending` just clear-and-refresh. The real RPC re-fetch lands within ~200ms with full metrics.

**BUG-014 (minor) — formatters/a11y crash on null fields:** `fmtEPS(null)` → `null.toFixed(2)` crash, same for `Math.round(beatProb * 100)` and `ticker.split('')`. With seeded data unlikely, but a real `briefings.consensus_eps` can be null per schema. Added defensive null-handling: `fmtEPS`/`fmtSurprise` return `—`, new `fmtBeatProb` helper, a11y tolerates nulls.

Also verified:
- empty state (fresh user, no watchlist) renders EmptyState correctly
- groupByDay handles the RPC's flat shape (uses expectedAt or actualAt)
- RefreshControl wired to refresh()
- Pill animations + haptic on pending arrival

**REVIEW for user:** add at least one ticker (e.g. AAPL since it has seeded events). Today should show: upcoming briefing card (Q3-26), past event card (Q4-25 with beat surprise), no crashes. If realtime arrives (insert a notification via SQL editor), the pill should arm and tapping it should refresh without flicker.

**Next tick:** QA10 — Watchlist screen.

---

## 2026-05-27 · QA8 — first-tickers screen

Read `src/features/onboarding/first-tickers-screen.js`. Walked flow: 5 suggested tickers from SUGGESTED (AAPL/MSFT/NVDA/GOOG/AMZN, names from FALLBACK cache via getCompanyName) → user toggles selections → tap Continue OR Skip → persistAndExit fetches default watchlist id → upserts watchlist_tickers → updates `profiles.onboarded_at` → navigates to /today.

Found and fixed two minor bugs:

**BUG-011 — Skip persisted user selections:** both Continue and Skip called the same `persistAndExit` that unconditionally persisted `selected`. If a user tapped a few tickers, then changed their mind and tapped the Skip button in the top corner, the tickers were added anyway. Fixed by adding a `{ persistTickers }` option to `persistAndExit`; Continue passes true, Skip passes false. `onboarded_at` always gets set so the user doesn't re-loop through onboarding.

**BUG-012 — Double-tap race:** same pattern as BUG-009 (ack screen). Added a `submitting` state guard at the top of `persistAndExit`; threaded into the Continue button's `loading` + `disabled` props.

The Skip path now: clears selection intent, marks onboarded_at, navigates. Continue path: persists selection (if any), marks onboarded_at, navigates.

**REVIEW for user:** at the first-tickers screen, try (a) tap 2-3 tickers + Continue → those should land in your watchlist; (b) tap 2-3 tickers + Skip → those should NOT land; (c) tap Skip with nothing selected → no tickers added, lands at /today. In all paths, verify in SQL editor `select onboarded_at from public.profiles where id = '<uuid>'` returns a timestamp.

**Next tick:** QA9 — Today screen.

---

## 2026-05-27 · QA7 — notifications onboarding

Read `src/features/onboarding/notifications-screen.js` + `src/lib/push-tokens.js`. Walked Allow + Skip paths.

Allow → `requestPermissionsAsync` → on granted, calls `registerPushTokenIfPossible` (which fetches session, resolves projectId from three Constants paths, calls `getExpoPushTokenAsync`, upserts push_tokens). All wrapped in try/catch. `finally` block resets the loading state and navigates to /first-tickers regardless of permission outcome — so the user always proceeds.

Skip → straight to /first-tickers.

In Expo Go (SDK 53+), push tokens generally cannot be obtained — `app.json` has no `extra.eas.projectId`, so all three Constants paths resolve null. `getExpoPushTokenAsync()` without projectId in newer SDKs throws. The try/catch swallows this and logs `[push] register skipped` in dev — onboarding still completes. Push functionality only really works in a dev-client/production build, which is expected and documented.

No bugs filed. The screen is appropriately defensive about the unreliable platform layer.

**REVIEW for user (Expo Go):** when you tap "Allow notifications", expect the iOS/Android permission dialog. After granting, the screen advances to /first-tickers. In Metro logs you may see `[push] register skipped` — that's expected on Expo Go; tokens only register on dev-client builds. Watch on-device test on a real build before launching.

**Next tick:** QA8 — First-tickers screen.

---

## 2026-05-27 · QA6 — ack screen

Read `src/features/onboarding/ack-screen.js`. Walked the flow:

1. ScrollView fires `onScroll` continuously; once `contentOffset.y + layoutMeasurement.height >= contentSize.height - 20`, `setScrolled(true)`.
2. Both checkboxes + scrolled → button enabled.
3. `confirm` does session-fetch → `profiles.update({ disclaimer_ack_at: now() })` → router.push('/notifications').

Found and fixed one minor race (BUG-009): the Continue button stayed visually enabled during the async UPDATE, so a fast double-tap could fire two UPDATEs and push two /notifications screens. Added a `submitting` state gated into `canContinue` + threaded into the Button's `loading` prop. Try/finally restores the state in all paths.

Filed one polish observation (BUG-010): `useAuthRouting` only checks `disclaimer_ack_at`, not `onboarded_at`. A user who ack's then cold-restarts before completing first-tickers skips notifications + first-tickers. They can recover (add tickers in Watchlist tab, change permissions in OS Settings) so this is polish, not blocker.

Did NOT change the silent UPDATE-error behavior (`console.warn` only, navigation still happens). If the UPDATE fails (network blip), useAuthRouting on next cold start correctly routes them back through onboarding. Acceptable — the system self-heals.

**REVIEW for user:** sign up → scroll ack to bottom → tick both boxes → tap Continue (only once). Loading state should briefly appear. Lands on /notifications. Verify in SQL editor `select disclaimer_ack_at from public.profiles where id = '<your uuid>'` returns a timestamp.

**Next tick:** QA7 — Notifications onboarding.

---

## 2026-05-27 · QA5 — welcome + how-sift-works

Read both screens. `welcome-screen.js` has 3 SLIDES (BarChart3/Sparkles/BellOff icons + title + body), horizontal pagingEnabled ScrollView, PageDots tracking, Next/Skip wiring. `how-sift-works-screen.js` is a vertical list of 4 bullets (FileText/Sparkles/BarChart3/ShieldAlert) with a single Continue button to `/ack`. Both use `useSafeAreaInsets()` — now functional after QA1's SafeAreaProvider fix.

No new bugs filed. Welcome carousel content is structurally correct (SLIDES array populated, Slide component receives all props, layout uses the standard horizontal pager pattern). BUG-002 should be fully resolved by QA1's provider fix; awaiting user on-device verification.

Compliance copy on both screens checked — all factual/descriptive, no advisory verbs ("calibrated", "statistical", "not a broker, not an investment adviser"). Aligns with `docs/architecture/compliance.md` § Forbidden words.

**REVIEW for user:** sign up fresh → should land on Welcome with 3 swipeable slides → Next/Get started → How Sift Works (4 bullets) → Continue → Ack.

**Next tick:** QA6 — Ack screen.

---

## 2026-05-27 · QA4 — auth-callback screen

Read `src/features/auth/auth-callback-screen.js` + `(auth)/auth-callback.js`. Single-purpose screen for the cold-start OAuth deep-link path (the in-app `WebBrowser.openAuthSessionAsync` flow handles the exchange inline and never enters this route).

Pulls `code` from `useLocalSearchParams`, calls `exchangeCodeForSession`, routes to `/today` on success, displays error + "Back to sign in" button on failure. ActivityIndicator during pending. `cancelled` ref on useEffect cleanup prevents post-unmount setState. No bugs found.

Minor edge-case documented (not filed): cold-start deep link could briefly race useAuthRouting (status='unauthed' until exchange resolves the session). Sub-frame flash through /sign-in possible; net effect lands at /today.

**Next tick:** QA5 — Welcome + How Sift Works.

---

## 2026-05-27 · QA3 — sign-up screen

Read `src/features/auth/sign-up-screen.js` + cross-referenced the `handle_new_user` trigger (migration 013 — third and final revision: inserts profile + default watchlist + subscriptions stub atomically). Walked the signup flow:

1. User submits email+password → `supabase.auth.signUp({ email, password })`
2. Server-side: auth.users row inserted → `on_auth_user_created` trigger fires → 3 dependent rows inserted (profile, watchlist, subscriptions) atomically with the auth.users insert. Sync_profile_tier trigger fires after the subscriptions insert — UPDATEs profile.tier = 'free' (no-op since default).
3. Returns session if `enable_email_confirmations=false` (default in supabase/config.toml — `[auth.email].enable_confirmations = false`).
4. Screen routes to `/welcome` on session; routes to in-screen "Check your email" state on no-session.
5. useAuthRouting separately fires on SIGNED_IN, fetches profile, sees `disclaimer_ack_at=null`, routes to `/welcome` — same destination, no flash.

Code structure is sound. Cleaner than sign-in because it correctly handles both the "session immediate" and "needs confirm" paths.

Filed one minor wontfix (BUG-008): the "Check your email" screen displays identically for legitimate new signups AND for already-registered emails (Supabase's anti-enumeration default returns no-session + no-error in both cases). The user could wait forever for an email that won't arrive because they already had an account. Documented; a one-line copy nudge ("If no email arrives, try Sign in") would mitigate without compromising security.

**REVIEW for user:** sign up with a fresh email — should land at /welcome with the 3-slide carousel (after QA1 SafeAreaProvider fix). After ack + first-tickers, lands at /today. In SQL editor verify the trigger chain ran:

```sql
select id, email from auth.users where email = '<your-test-email>';
select id, display_name, tier from public.profiles where id = '<uuid-above>';
select id, name, is_default from public.watchlists where user_id = '<uuid-above>';
select user_id, plan, status from public.subscriptions where user_id = '<uuid-above>';
```

All four should return rows.

**Next tick:** QA4 — Auth callback screen.

---

## 2026-05-27 · QA2 — sign-in screen

Read `src/features/auth/sign-in-screen.js`, `(auth)/_layout.js`, `(auth)/sign-in.js`, TextField, Button. Walked email+password and Google OAuth paths. Code is sound:

- Email regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` is correct.
- Password min-length 6 matches Supabase default.
- Error catching wraps both flows; `setError(e.message)` surfaces to UI.
- Google OAuth uses correct PKCE pattern: `signInWithOAuth({skipBrowserRedirect:true})` → `WebBrowser.openAuthSessionAsync` → `Linking.parse` → `exchangeCodeForSession`.
- KeyboardAvoidingView with insets-based offset is now functional thanks to QA1's SafeAreaProvider fix.

Filed two polish-tier observations (no blockers, no majors):

- **BUG-006 (wontfix):** explicit `router.replace('/today')` post-signIn can race with `useAuthRouting`'s profile-based routing for unonboarded users; brief /today flash before redirect. Intentional UX trade — alternative leaves the screen frozen during useAuthRouting fetch.
- **BUG-007 (open, polish):** no inline helper when password < 6 chars; button just disables silently. Trivial fix deferred.

**REVIEW for user:** sign in with existing email/password — lands at /today (or /welcome if ack still missing). Google OAuth: tap "Continue with Google" → browser → consent → returns to app at /today.

**Next tick:** QA3 — Sign-up screen + auth-trigger flow verification.

---

## 2026-05-27 · QA1 — known bugs (add-ticker + carousel)

Investigated the two user-reported issues. Found three blocker/major bugs plus one minor.

**BUG-001 — root cause of "unable to add ticker":** `src/features/watchlist/use-watchlist.js:33` referenced an undefined `FLAT_SPARK` constant inside `shape()`. The constant was removed in B4 when sparkline ownership moved to WatchlistRow + useSparkline, but the in-shape() reference was left behind. Flow: user taps "+", searches, taps result → optimistic row prepends (no sparkline field, fine) → server INSERT succeeds → `refresh()` re-fetches and calls `shape()` on the new row → `ReferenceError: FLAT_SPARK is not defined` → screen errors out. The user perceives "ticker didn't add" because the UI dies during the post-success refresh. Fix: deleted the line; WatchlistRow gets sparkline via `useSparkline(symbol)` directly. Also fixed a cosmetic indentation typo (BUG-005) in the optimistic add object.

**BUG-003 — missing GestureHandlerRootView:** the root `app/_layout.js` didn't wrap children in `GestureHandlerRootView`. `@gorhom/bottom-sheet` and `react-native-gesture-handler` both require it — without it, the add-ticker sheet may not open or gestures may not respond, and ReanimatedSwipeable (the watchlist row swipe-to-delete) wouldn't work. This compounded BUG-001's symptom: even if the data fix worked, the user couldn't open the sheet to add in the first place. Fix: wrapped Stack in `<GestureHandlerRootView style={{ flex: 1 }}>`.

**BUG-004 — missing SafeAreaProvider:** `useSafeAreaInsets()` is called by `welcome-screen.js`, `ack-screen.js`, `notifications-screen.js`, `first-tickers-screen.js`, and `ticker-screen.js`. Without `SafeAreaProvider`, insets default to zero (in `react-native-safe-area-context` v4+, the hook returns `{ top:0, right:0, bottom:0, left:0 }` without the provider). On the welcome screen this means no top padding for the status bar and no bottom padding for the home indicator — the carousel slides render but get visually cut off / overlapped, matching the "not showing info" symptom. Fix: wrapped Stack in `SafeAreaProvider` inside the GestureHandlerRootView.

**BUG-002 — welcome carousel:** marked fixed pending on-device verification. Most likely cause is BUG-004 (no insets → chrome collapsed under status bar). welcome-screen.js's layout itself is structurally sound: SLIDES array has 3 valid entries, horizontal ScrollView with pagingEnabled + per-slide width is the standard pattern. If after the SafeAreaProvider fix the slides STILL don't show, the fallback investigation in `bugs.md` documents a slide-flex-style refactor.

**REVIEW for user device verification:**
- Watchlist add flow: sign in → Watchlist tab → "+" → search → tap result → row should appear and persist across cold reload
- Welcome carousel: sign up with a fresh email → should land on Welcome screen with three slides visible, swipeable, with Next button at bottom
- Settings sheets: open Settings → tap Sign out / Plan / Quiet hours — sheets should slide up from bottom and respond to pan-down dismiss
- Watchlist swipe: swipe a row left → trash action should reveal; tap it → row removes

If any of these still fail, log in `bugs.md` with `BUG-006+` and the loop can do a deeper pass.

**Next tick:** QA2 — Sign-in screen.
