# On-device smoke checklist

After the QA loop closes, walk this checklist on a real device (Expo Go or dev build). Each `[ ]` is one user-visible behavior to verify. Fill in `[x]` as you go; anything that fails gets a new `BUG-NN` entry in `bugs.md`.

## Before you start

- [ ] Reload Metro fully (close the simulator/Expo Go, restart `npx expo start`, scan QR fresh) — picks up all QA fixes
- [ ] Re-deploy the edge function (BUG-023 fix lives in `notify_user_event/index.ts`):
  ```
  supabase functions deploy notify_user_event
  ```
- [ ] If you've ever signed up before, sign out so this run tests the cold path
- [ ] On Expo Go: SecureStore + push notifications degrade gracefully (warnings in Metro are OK)

## Auth

- [ ] Sign-in screen — email + password fields render, submit button disabled until both valid
- [ ] Sign-in with wrong password — error message appears in red below the password field, no crash
- [ ] Sign-up screen — same fields. Submit with a fresh email
- [ ] If email confirmations are ON in your Supabase dashboard: "Check your email" screen appears with the email shown
- [ ] If email confirmations are OFF (default in supabase/config.toml): you land straight on /welcome
- [ ] (Optional) Google OAuth: tap Continue with Google → browser opens → consent → returns to app at /today (or /welcome)

## Onboarding (fresh sign-up only)

- [ ] **/welcome:** three slides visible. Swipe between them. Page dots track. Next button advances. Skip jumps to /today. **No clipping under status bar.** (BUG-002 / BUG-004 fix)
- [ ] **/how-sift-works:** four bullets visible. Continue → /ack
- [ ] **/ack:** scroll the legal copy to the bottom — checkboxes become enabled. Tick both → Continue button enables. Tap Continue (just once) → brief loading state → /notifications. (BUG-009 fix)
- [ ] In SQL editor, verify: `select disclaimer_ack_at from public.profiles where id = '<your-uuid>'` returns a timestamp
- [ ] **/notifications:** tap Allow notifications — iOS/Android permission dialog → grant → advances to /first-tickers. Or tap Maybe later — also advances
- [ ] **/first-tickers:** five suggested tickers (AAPL/MSFT/NVDA/GOOG/AMZN). Tap a few → tick appears. Tap "Skip" in the top corner — **tickers NOT added** (BUG-011 fix). Or tap "Add N tickers" → those added
- [ ] Verify: `select onboarded_at from public.profiles where id = '<your-uuid>'` returns a timestamp

## Today screen

- [ ] **Fresh user (no watchlist):** EmptyState "Nothing on your radar yet" with "Add a ticker in Watchlist..." description
- [ ] **With AAPL on watchlist:** at least one card shows (upcoming briefing OR past event from seed). No crashes. No "NaN" or "9999d" anywhere.
- [ ] Pull-to-refresh triggers a re-fetch
- [ ] InlineError with Retry button appears if you airplane-mode + reload (BUG-024/025 fix)
- [ ] **Realtime test:** while app is on Today, run in SQL editor:
  ```sql
  insert into public.notifications (user_id, kind, ticker_symbol, title, body, deep_link)
  values ('<your-uuid>', 'event', 'AAPL', 'test', 'test', 'sift://today');
  ```
  Within ~1s, "1 new event" pill should appear at the top. Tap it → pill clears + Today refreshes. **No crash.** (BUG-013 fix)

## Watchlist

- [ ] **Fresh user:** EmptyState "No tickers tracked yet" + Add ticker button
- [ ] Tap Add ticker → bottom sheet slides up (GestureHandlerRootView fix). Search "AAPL" → result appears. Tap it → sheet closes + row appears in Watchlist (BUG-001 fix — was crashing post-add)
- [ ] Row shows: symbol, name, sparkline (curvy line from seeded prices), next earnings period like "Q3 26", days-away countdown, briefing-ready badge
- [ ] Add a ticker NOT in the seed (e.g. INTC) — row shows symbol + name + "—" for period and countdown (BUG-015 fix — was "Q? 26" and "9999d")
- [ ] Swipe a row left → trash button reveals → tap → row removes
- [ ] Sort dropdown — switching changes order
- [ ] Cold reload — rows persist

## Discover

- [ ] All three rails render (Biggest Expected, Sector Heat, Biggest Recent Surprises). Each shows seed data or its empty-state copy if empty
- [ ] Search any ticker — results appear in a card above the rails. Tap a result → ticker detail
- [ ] **Compliance check:** copy reads "MODEL — BIGGEST EXPECTED MOVES THIS WEEK", "Model beat X%", "±X% expected". No "buy"/"recommend"/"should"

## Ticker detail (open AAPL or NVDA from Watchlist)

- [ ] Hero shows symbol + name + sector + sparkline + "+/-X.X% 30d"
- [ ] Timeline shows: upcoming briefing card, past event card, transcript card (for AAPL Q4 25)
- [ ] Tap event card → event detail screen
- [ ] "Add to watchlist" / "On watchlist" toggle works — verify in DB
- [ ] Tap the (i) info icon next to beat probability → methodology sheet slides up

## Event detail

- [ ] Tap a past event (AAPL Q4-25 — has full data). See: hero "▲ Reported beat · +8.1%", metrics, compare bars, guidance pill, filing timeline with three steps + "within 15s target", segments (3 rows), source link, share button
- [ ] Tap "View original Exhibit 99.1" → in-app browser opens
- [ ] Tap Share → share sheet opens
- [ ] **Test the failed-event path (optional):** in SQL editor `update public.events set parse_status='failed', parsed_at=null where ticker_symbol='AAPL' limit 1` then revisit the event → hero shows "Filing couldn't be parsed" (BUG-017 fix). Revert with `parse_status='parsed', parsed_at=filed_at+'10 seconds'::interval`
- [ ] Open an invalid event URL → "Event not found" empty state (no crash)
- [ ] If you airplane mode + reload: InlineError with title + message + Retry button (BUG-024/025 fix). Tap Retry → re-fetches

## Settings

- [ ] Email row shows your address
- [ ] Plan row shows "Free" (or "Pro" if `update public.subscriptions set plan='pro_monthly', status='active' where user_id='<uuid>'`)
- [ ] Toggle each of the three notification switches — server persists (verify with `select notify_briefings, notify_events, notify_transcripts from public.profiles where id='<uuid>'`)
- [ ] Tap Quiet hours → sheet → pick a preset → row updates + DB updates (`select quiet_hours_preset from public.profiles ...`)
- [ ] Version row shows the value from `app.json` (BUG-019 fix), currently "0.1.0"
- [ ] Tap Disclaimer / Privacy / Terms — each opens with header back-button + scrollable content. Privacy + Terms show DRAFT pill
- [ ] Tap Sign out → sheet → Sign out → back to /sign-in

## Push (dev-client build only — Expo Go push is silently no-op)

- [ ] After signing in on a dev-client build, verify a row appeared:
  ```sql
  select user_id, token, platform from public.push_tokens where user_id = '<uuid>';
  ```
- [ ] In SQL editor: `update public.briefings set status='ready' where ticker_symbol='AAPL';` (AAPL must be on watchlist)
- [ ] Within ~1s: a push notification arrives on the device. Tap it → opens ticker detail (BUG-023 fix). NOT "Event not found"
- [ ] Insert a notification while quiet-hours is active (e.g. set `quiet_hours_preset='00-23'` on your profile, then trigger): notification gets `status='skipped_quiet'` instead of `sent`

## Realtime + Watchlist

- [ ] With AAPL on watchlist, `update public.briefings set status='ready' where ticker_symbol='AAPL';` — Watchlist row's briefing-ready badge should appear within ~1s. Today should re-fetch within ~1s
- [ ] Sign out → re-sign-in on same device: notification channel is torn down + recreated cleanly. No double-deliveries

## Known polish gaps (not blockers — flagged in bugs.md)

- BUG-006: sign-in route flash for unonboarded users (rare path)
- BUG-007: no inline password-length hint
- BUG-008: "Check your email" ambiguous for existing-email signup (Supabase anti-enumeration)
- BUG-010: useAuthRouting doesn't check onboarded_at (skips notifications + first-tickers if user cold-restarts mid-onboarding)
- BUG-016: ticker drill-in from Today/Discover jumps user to Watchlist tab
- BUG-020: silent profile-load failure in Settings → user sees default toggles
- BUG-021: useWatchedBriefingsStream over-fires (refreshes are idempotent so harmless)
- Watchlist initial-load flicker (~200ms)

If any unticked box fails on-device, log a new BUG-NN entry in `bugs.md` and we can do round-2 with `/loop` against the same plan.
