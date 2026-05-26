# Backend iteration plan

Per-tick contract for the loop that builds Phase 12 (backend integration). Same shape as `docs/design/iteration-plan.md` — STATUS at top, ordered backlog below, FOCUS override when needed.

---

## What Sift is (read every tick, do not drift)

Sift is a **mobile earnings intelligence app for self-directed US-equity investors**. Educational research, not investment advice. Compliance copy is non-negotiable. The four design anchors from the frontend iteration plan still apply — see [`docs/design/iteration-plan.md` § "What Sift is"](../design/iteration-plan.md). Backend work adds these:

5. **Catalog data is shared.** Per-ticker outputs (briefings, events, transcripts) are computed once by Modal and read by all watchers. RLS protects user-owned data; catalog reads are open to authenticated users.
6. **Default-deny RLS.** Every table has RLS enabled. Any table without a SELECT policy is invisible. Any UPDATE policy missing `WITH CHECK` is a privilege escalation.
7. **Forward-only migrations.** Once a migration is pushed to a shared environment, it's immutable. New changes go in new files.
8. **Idempotency end-to-end.** Briefings unique on `(ticker, period)`; events unique on `accession_number`; notifications throttled to 3/ticker/day. Re-running any worker is safe.

---

## FOCUS

> If non-empty, the loop advances THIS thread first.

**Phase 12 — Backend integration.** Backend plan documented in [`docs/backend/`](README.md). Migrate the schema, wire every frontend mock to a real query/mutation, ship the realtime + push pipelines. Work B1 → B15 in order; defer ML/Modal worker setup (Phase 13) until B-phase is complete.

---

## Per-tick protocol

Same shape as the frontend loop:

1. **Read, in order:**
   - The "What Sift is" anchor above.
   - [`README.md`](README.md) + [`conventions.md`](conventions.md) if you haven't this session.
   - This file's FOCUS, STATUS, and Bug log.
   - For the current backlog item: [`schema.md`](schema.md) → [`rls-policies.md`](rls-policies.md) → relevant other doc (triggers / views / wiring).
2. **Pick** the next unchecked backlog item (top to bottom) unless FOCUS overrides or the Bug log has open entries.
3. **Plan** the unit of work — 1-3 sentences in your head or in the changelog entry.
4. **Build it.** For backend ticks: usually a migration file + an Edge Function deploy + a frontend wiring change. Keep the scope to one logical unit.
5. **Verify** in this order:
   - Local: `supabase db reset` if you touched migrations — confirms order-independence.
   - Local: `supabase test db` if you added or changed RLS policies / RPCs — pgTAP catches privilege bugs.
   - App: `npx expo start --no-dev --offline --port <P>`, force bundle, confirm no errors. For UI changes, eyeball if you have a device.
6. **Write a changelog entry** in [`changelog.md`](changelog.md) (sibling of this file; create on first tick): one paragraph + a "next time" note.
7. **Capture learnings** in [`learnings.md`](learnings.md) (sibling) only if durable + reusable.
8. **Check the box** in this file.
9. **Update STATUS** below.
10. **Schedule the next tick** via `ScheduleWakeup` with a delay matched to the work (max 600s per the user's cap, recorded in `feedback_loop_max_wait.md`).

### Backend-specific gotchas

- **Never commit `service_role` keys.** They live in Modal Secrets and Supabase Function env. Migrations that reference them use `current_setting('app.service_role_key')` — runtime parameter, not literal.
- **Apply RLS in the same tick as the table.** Don't leave a table with RLS disabled "for testing." A forgotten ENABLE statement on an exposed prod table is the worst class of bug.
- **Test RLS as a non-service-role user.** `supabase test db` runs as the authenticated role by default; service_role bypasses everything and hides bugs.
- **`supabase db push` is destructive in reverse.** It does NOT roll back failed migrations cleanly — a partial apply needs manual cleanup. Test locally first.

---

## STATUS

**Last tick:** none yet (Phase 12 not started).
**Next:** **B1** — schema bootstrap. Extensions + enums + profiles + auth-on-insert trigger. Closes the loop on `disclaimer_ack_at` (replaces local AsyncStorage).
**Blockers:** **user actions required before B1** — see § Pre-loop checklist below.
**Bug log:** empty.

---

## Pre-loop checklist (USER ACTION before B1 fires)

These can't be done by the loop. **Do them before starting the loop, or B1's verification step will fail.**

1. **Install Supabase CLI** locally: `brew install supabase/tap/supabase` or follow [docs](https://supabase.com/docs/guides/cli).
2. **Link to your Supabase project:** `supabase link --project-ref <your-ref>`. The ref is in your project URL.
3. **In Supabase dashboard → Authentication → Providers:**
   - Confirm **Email** provider is enabled (default).
   - Enable **Google** provider; paste Client ID + Secret from Google Cloud Console (see step 5).
4. **In Supabase dashboard → Authentication → URL Configuration:**
   - Add `sift://auth-callback` to the Redirect URLs allowlist.
5. **In Google Cloud Console** (only if using Google OAuth):
   - Create OAuth 2.0 Client ID (Web application).
   - Add authorised redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
   - Copy Client ID + Secret back to Supabase Google provider (step 3).
6. **Set runtime parameters in Supabase SQL editor** (for edge function fan-out triggers):
   ```sql
   ALTER DATABASE postgres SET app.supabase_functions_url = 'https://<project-ref>.functions.supabase.co';
   ALTER DATABASE postgres SET app.service_role_key       = '<sb_secret_...>';
   ```

When all six are done, start the loop and B1 can apply migrations against a fully-configured project.

---

## Bug log

Empty at Phase 12 start. Use the same conventions as the frontend bug log — visible bug → fix immediately; deferred → annotate with rationale.

---

## Backlog

Legend: `[ ]` to do · `[x]` done · `[~]` partially done · `[!]` blocked

### Phase 12 — Backend integration

#### Schema migrations (one per tick)

- [ ] **B1** — Schema bootstrap. Apply migrations 001 (`extensions_and_enums`) + 002 (`profiles`) + 016's profile-related triggers (`handle_new_user`, `set_updated_at_profiles`) + 013's profile-related RLS. **Frontend wiring:** `useAuthRouting` reads `disclaimer_ack_at` from `profiles` instead of AsyncStorage; `ack-screen.js` confirm UPDATEs profile. Delete `ACK_KEY` const usage. **Verify:** create test user via sign-up, confirm profile row appears, confirm `disclaimer_ack_at` is NULL, confirm `useAuthRouting` routes to `/welcome`.
- [ ] **B2** — Tickers + seed. Apply 003 (`tickers`) + 013's catalog RLS for tickers. Build `scripts/build_ticker_seed.py` to generate `seed/russell_1000.csv` from iShares + SEC CIK feed. **Frontend wiring:** `searchCatalog` in `add-ticker-sheet.js` and `discover-screen.js` swap from local `TICKER_CATALOG` to `supabase.from('tickers').select(...).ilike(...)`. Keep `getCompanyName(symbol)` as a wrapper but back it with a fetched cache (React Query / SWR).
- [ ] **B3** — Watchlists + watchlist_tickers + watchlist views. Apply 005 + 014 (`watchlist_with_meta_view`) + 013's user-table RLS for these. **Frontend wiring:** `watchlist-screen.js` reads from view; add/remove handlers write directly. First-ticker setup in `first-tickers-screen.js` writes to `watchlist_tickers` + sets `profiles.onboarded_at`. Delete `MOCK_WATCHLIST`. **Verify:** add ticker → reload → still there.
- [ ] **B4** — Ticker prices + sparkline RPC. Apply 004 + 015 (`ticker_sparkline`). Modal job to seed 30d of daily closes for Russell 1000 from Finnhub (one-off + daily cron — write in tick B11). **Frontend wiring:** Watchlist row's sparkline reads from `ticker_sparkline(symbol, 30)`. Delete `fakeSeries`. **Defer until B11:** Modal daily-close job; for B4, manually populate prices for ~10 test tickers via SQL.
- [ ] **B5** — Briefings table + Discover biggest-expected. Apply 006 + 015's `discover_biggest_expected` + 013's catalog RLS for briefings. **Frontend wiring:** Discover top rail reads from RPC. `MOCK_BIGGEST_EXPECTED` deleted. Seed a few rows manually for verification.
- [ ] **B6** — Events + event_metrics + event detail view. Apply 007 + 014 (`event_with_metrics_view`) + 013's catalog RLS. **Frontend wiring:** `event-screen.js` reads from view. `MOCK_EVENT` deleted. Manually seed a few past events for verification.
- [ ] **B7** — Home events RPC. Apply 015's `home_events_for_user`. **Frontend wiring:** `useHomeData` calls RPC; flat list flows through unchanged `groupByDay`. `MOCK_HOME_EVENTS` and `MOCK_PENDING_EVENT` deleted.
- [ ] **B8** — Transcripts + transcript_analysis + ticker_detail_timeline RPC. Apply 008 + 015's `ticker_detail_timeline` + 013's catalog RLS. **Frontend wiring:** `ticker-screen.js` reads from RPC. `getTickerMock` deleted.
- [ ] **B9** — Model versions. Apply 009. No frontend wiring this tick (model_versions is service-role + read by future Modal workers). Insert one row each of `briefing_prompt v1.0 active` and `surprise_classifier v0.1 active` as bootstrap.
- [ ] **B10** — Notifications + push_tokens + throttle + quiet-hours triggers. Apply 010 + 016's `enforce_push_throttle` + `enforce_quiet_hours` + 013's user-table RLS for notifications. **Frontend wiring:** `notifications-screen.js` (onboarding) writes push token on Allow; root layout re-registers token on every cold start.
- [ ] **B11** — Subscriptions + audit + observability + final triggers + pg_cron jobs. Apply 011, 012, 017 + the remaining triggers from 016 (`sync_profile_tier`, `notify_on_*`, `sync_briefing_prompt_version`). **Frontend wiring:** Settings PLAN row reads from `subscriptions` (placeholder "free" + `subscription_tier` from `profiles.tier`). No real subscription writes — RevenueCat lives in a later phase.

#### Edge Functions

- [ ] **B12** — `notify_user_event` Edge Function. Deploy + smoke-test by inserting a fake briefing row, confirming a notification row appears for any user with the ticker in their watchlist.
- [ ] **B13** — `cleanup_old_notifications`, `retry_skipped_pushes`, `gc_stale_push_tokens` Edge Functions + `pg_cron` schedules. Verify cron entries are scheduled via `select * from cron.job`.

#### Realtime + final wiring

- [ ] **B14** — Realtime subscriptions. Add `useNotificationsStream` (root-level), `useTickerEventsStream` (ticker detail), per-ticker briefings stream (Watchlist + Today). **Frontend wiring:** new-events pill arms when a notification arrives; ticker detail refreshes events on filing change.
- [ ] **B15** — Discover sector heat + recent surprises wiring. Apply remaining RPCs from 015 (`discover_sector_heat`, `discover_biggest_surprises`). **Frontend wiring:** middle + bottom rails of Discover. Delete `MOCK_SECTOR_HEAT` + `MOCK_BIGGEST_SURPRISES`. **Phase 12 acceptance check after this tick** (see below).

#### Bonus / queue for Phase 13

- [ ] **B16** Settings prefs wiring — `notify_*` toggles + `quiet_hours_preset` on `profiles`. Was due in B10's wiring scope but worth verifying separately.
- [ ] **B17** Discover ticker search → real `tickers` table. Replaces the catalog-backed search currently doing client-side filter.
- [ ] **B18** Materialised view `sector_heat_mv` if `discover_sector_heat()` ever exceeds 100ms. Deferred indefinitely.

---

## Phase 12 acceptance (run after B15)

- ✅ No `MOCK_*` constants remain in `src/features/*/mock.js`. The mock files can be deleted or kept as comments-only for reference.
- ✅ Sign up → onboarding → /today end-to-end against a real Supabase project. `disclaimer_ack_at`, `onboarded_at`, watchlist seed, push token all persisted.
- ✅ Manual SQL: insert a briefing with `status='ready'` for a watchlist ticker → Edge Function fires → notification row appears → push delivered to test device (if dev build available).
- ✅ Sign out → sign in on the same device → routed back to `/today` (ack survives via server-side flag).
- ✅ Watchlist add/remove persists across cold start.
- ✅ `supabase test db` passes (RLS pgTAP tests + RPC tests).
- ✅ `select tablename from pg_tables where schemaname='public' and rowsecurity=false` returns empty.

When all pass, Phase 12 closes. Phase 13 (Modal workers) opens.

---

## Phase 13 — Modal workers (preview)

Out of this iteration plan's primary scope, but listed so the path is visible:

- **M1** — Modal app skeleton + Supabase service-role client wrapper.
- **M2** — EDGAR poller (`edgar_poll` function, 60s schedule).
- **M3** — 8-K parser + LLM extraction (`parse_and_publish.spawn`).
- **M4** — Finnhub earnings-calendar fetcher (daily cron, populates upcoming `briefings` rows with `status='pending'`).
- **M5** — Briefing generator (cron */30 min — pulls features, runs surprise classifier, generates content, flips `status='ready'`).
- **M6** — Transcript fetcher + analyser (post-market cron).
- **M7** — Daily ticker_prices fetch from Finnhub.
- **M8** — LLM cost logger (writes to `llm_calls` per call).
- **M9** — Provider-health heartbeat (writes to `data_source_status`).

These ticks finish "real data flowing." Sift becomes fully functional after Phase 13.

---

## How this differs from `docs/design/iteration-plan.md`

| Aspect | Frontend plan | Backend plan (this file) |
| --- | --- | --- |
| Tick scope | One screen / primitive / polish item | One migration + its frontend wiring |
| Verification | Metro bundle | `supabase db reset` + Metro bundle + (often) pgTAP |
| Idempotency | n/a | Critical — migrations are forward-only |
| Pre-tick blockers | None | Pre-loop checklist above (Supabase + Google setup) |
| RLS audit | n/a | Every tick that touches a table includes its policies |
