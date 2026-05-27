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

**Last tick:** B15 — Discover sector_heat + biggest_surprises RPCs + final mock removal (migration 017). **Phase 12 closed.**
**Next:** **PHASE 13** (Modal workers) — out of this loop's scope per the autonomous-loop authorizations memory. User-supervised; halt point for this loop run.
**Mode:** loop stopped after B15. All 17 migrations + 4 edge functions + 12 pgTAP tests shipped to `supabase/` as files only. Apply via `supabase db push` + `supabase functions deploy --all` after user review.
**Mode:** authoring-only (no `supabase db push`). Migrations sit in `supabase/migrations/`; user reviews + applies on wake.
**Blockers:** none. Pre-loop checklist closed.
**Bug log:** empty. See `changelog.md` for `REVIEW:` flags surfaced this tick.

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

- [x] **B1** — Schema bootstrap. Applied migrations 001 (`extensions_and_enums`) + 002 (`profiles` table + RLS + `set_updated_at_profiles` + minimal `handle_new_user`) + 003 (`app_config_secret` Vault helper). **Frontend wiring:** `useAuthRouting` reads `disclaimer_ack_at` from `profiles`; `ack-screen.js` UPDATEs profile; settings sign-out no longer touches AsyncStorage. `ACK_KEY` const removed. **Verify:** deferred to first push — see changelog REVIEW flags.
- [x] **B2** — Tickers + seed. Authored migration 004 (`tickers` table + RLS + `set_updated_at_tickers` trigger + 20-row bootstrap insert with real CIKs). Built `scripts/build_ticker_seed.py` (downloads iShares IWB + SEC company_tickers.json, merges, writes `supabase/seed/russell_1000.csv`). Wrote `supabase/seed.sql` to bulk-load on db reset via `\copy` + ON CONFLICT upsert. Wrote `supabase/tests/rls_tickers.test.sql`. **Frontend:** `ticker-catalog.js` now async-backed (`searchTickers`, `prefetchCompanyNames`); `getCompanyName` sync against module Map cache with FALLBACK list; `add-ticker-sheet.js` and `discover-screen.js` use `searchTickers` (debounced 140ms / 120ms); `watchlist-screen.js` `add()` uses `getCompanyName` instead of `TICKER_CATALOG.find`. Defensive: on supabase error, search falls back to FALLBACK list.
- [x] **B3** — Watchlists + watchlist_tickers + view + handle_new_user extension. Migration 005 creates both tables, all RLS policies (own watchlists + parent-checked watchlist_tickers), partial unique index for one default per user, ticker_symbol index for fanout. View `watchlist_with_meta_view` created with null placeholders for next_* (briefings not yet exists; B5 will CREATE OR REPLACE). `handle_new_user` now also inserts default watchlist. **Frontend:** `useWatchlist` hook (load + add + remove + optimistic UI); `watchlist-screen.js` uses hook with InlineError + EmptyState branches; `first-tickers-screen.js` writes selected tickers to watchlist_tickers via upsert + sets `profiles.onboarded_at`; `MOCK_WATCHLIST` + `fakeSeries` deleted from `mock.js` (groupByWeek kept). Sparkline placeholder until B4.
- [x] **B4** — Ticker prices + sparkline RPC. Migration 006: `ticker_prices` table with composite PK (ticker_symbol, trade_date), `trade_date desc` index, all-auth-read RLS, and `public.ticker_sparkline(p_symbol, p_days)` RPC (STABLE, SECURITY INVOKER). Seeded 10 tickers × 30 days via sine-walk SQL (visually distinct curves, no random — deterministic). pgTAP test covers seed count + RLS read + RPC return shape + lowercase normalisation. **Frontend:** `useSparkline(symbol, days=30)` hook with module-level Map cache + pending-promise dedupe. `WatchlistRow` now calls the hook directly (sparkline prop optional). `fakeSeries` was already removed in B3 with MOCK_WATCHLIST. **Defer until Phase 13:** Modal daily-close cron from Finnhub.
- [x] **B5** — Briefings + discover_biggest_expected + view replace. Migration 007: `briefings` table mirroring schema.md (unique on (ticker_symbol, fiscal_period), beat_probability range CHECK, partial index on non-ready status, RLS filtering to status='ready'), `discover_biggest_expected(p_limit, p_week_start)` RPC (extracts `expected_move_pct` from `surprise_prediction` jsonb, sorts DESC), `CREATE OR REPLACE VIEW watchlist_with_meta_view` to populate next_* via LATERAL join to briefings. Seeded 5 ready briefings (NVDA/AAPL/MSFT/GOOG/TSLA) with realistic-ish consensus + surprise_prediction jsonb + ready content_md including the educational disclaimer. **Frontend:** `discover-screen.js` top rail now reads via `supabase.rpc('discover_biggest_expected', { p_limit: 4 })`; added `formatFiscalPeriod` util (`Q1-2026` → `Q1 26`) + `shapeExpected` row mapper. Empty-state copy if RPC returns no rows. `MOCK_BIGGEST_EXPECTED` deleted from mock.js. pgTAP RLS test verifies pending rows hidden + RPC sort + p_limit.
- [x] **B6** — Events + event_metrics + view + event-screen wiring. Migration 008: `events` table (accession_number unique for EDGAR idempotency, indexes for ticker-history + filed_at + parse_status partial + ticker/period), `event_metrics` with `GENERATED ALWAYS AS ... STORED` for eps_surprise_pct + revenue_surprise_pct (divide-by-zero guarded with CASE), partial index on eps_surprise_pct for B15's biggest-surprises rail, `event_with_metrics_view` joining events + tickers + LEFT JOIN event_metrics filtered to parsed/failed. RLS: pending events hidden; metrics parent-checked. Seeded 3 past parsed events (AAPL Q4-25 beat, NVDA Q4-25 beat, TSLA Q1-26 miss) with full metrics + segments jsonb + guidance + sub-15s detected/pushed deltas (matching schema doc's latency budget). pgTAP test verifies generated columns + RLS filtering + view shape. **Frontend:** `useEvent(eventId)` hook; `event-screen.js` rewritten with loading / error / not-found branches, `formatFiscalPeriod` util reused from B5, scaled revenue from server dollars to displayed billions, derived filed→detected→pushed deltas from timestamps. `mock.js` reduced to a tombstone comment.
- [x] **B7** — home_events_for_user RPC + Today wiring. Migration 009: single RPC, union of upcoming briefings (status=ready, [-6h, +30d] window) and parsed events (last 30d, live=<15min) for the user's watched tickers. STABLE SECURITY INVOKER so RLS on watchlists/briefings/events still gates. **Frontend:** `useHomeData` rewritten to call `supabase.rpc('home_events_for_user', { p_user_id: uid })` + shape rows for the EventTimelineCard. `home-screen.js` now navigates to event detail by uuid (referenceId) for past/live, by ticker for upcoming. MOCK_HOME_EVENTS + MOCK_PENDING_EVENT deleted; mock.js tombstoned. Pending arrival API (`pushPending`) wired but unused until B14's realtime stream.
- [x] **B8** — Transcripts + segments + analysis + ticker_detail_timeline RPC + ticker-screen. Migration 010: `transcripts` (unique per ticker/period), `transcript_segments` (vector(1536) + HNSW cosine index on embedding), `transcript_analysis` (1:1 with transcripts, jsonb novel_topics + guidance_changes). All catalog-read RLS. `ticker_detail_timeline(p_symbol)` RPC unions upcoming briefings + past events with metrics + past briefings + transcripts into (item_id, kind, occurred_at, payload jsonb) — kind-typed payload so the screen renders without recomputing. Seeded 1 AAPL Q4-2025 transcript + analysis matching the AAPL event from B6. **Frontend:** `useTickerDetail(symbol)` hook (parallel fetch of ticker meta + timeline RPC + default watchlist id + on-watchlist check; optimistic add/remove via toggleWatchlist); `ticker-screen.js` rewritten — sparkline via `useSparkline`, timeline via hook, watchlist toggle wired to supabase, methodology sheet still works. `getTickerMock` removed. Empty-state copy when timeline returns zero rows. Error branch with retry.
- [x] **B9** — model_versions registry + deferred FK additions. Migration 011: `model_versions` table mirroring schema.md (unique on (kind, version); partial unique on (kind) where status='active' for exactly-one-active enforcement; RLS exposes only active to authenticated). Bootstrap 4 active rows (briefing_prompt 1.0, surprise_classifier 0.1, extraction_prompt 1.0, transcript_summary 1.0). Added the previously-deferred FK constraints on `briefings.model_version_id`, `event_metrics.extracted_by_model_id`, `transcript_analysis.model_version_id`. Backfilled the seeded AAPL+others briefings to point at the active briefing_prompt and the AAPL transcript_analysis to the active transcript_summary. No frontend changes. pgTAP verifies the partial unique blocks double-active and the backfill set prompt_version.
- [x] **B10** — notifications + push_tokens + throttle + quiet-hours triggers. Migration 012: both tables, all RLS, three notification indexes (user/created, partial status, daily-throttle composite), full push_tokens four-policy RLS, `enforce_push_throttle` (raises P0001 at 3rd same-day notification per user/ticker excluding failed), `enforce_quiet_hours` (flips status to skipped_quiet + computes scheduled_for in user tz, respects 'off' preset). Trigger naming uses numeric prefixes `_1_throttle` then `_2_quiet` so alphabetical fire order matches the required throttle-before-quiet semantic. **Frontend:** new `src/lib/push-tokens.js` `registerPushTokenIfPossible` (Constants → projectId → getExpoPushTokenAsync → upsert by (user_id, token)). Wired into `notifications-screen.js` after permission granted and into `app/_layout.js` on cold start when `authStatus === 'authed'`. pgTAP tests 4th-AAPL throws P0001, different ticker bypasses, quiet hours (preset 00-23) defers to skipped_quiet with scheduled_for, cross-user RLS isolation.
- [x] **B11** — subscriptions + audit + final triggers + pg_cron + Settings wiring. Four migrations: 013 (`subscriptions` + `sync_profile_tier` + 3rd revision of handle_new_user adding subscriptions seed + backfill), 014 (`llm_calls` + `data_source_status` audit tables, service-role only, RLS default-deny), 015 (fanout triggers — `trigger_notify_fan_out` Vault-backed, `notify_on_briefing_ready` / `notify_on_event_parsed` / `notify_on_transcript_analysis`, `sync_briefing_prompt_version`), 016 (`pg_cron` jobs defensive — skips with NOTICE if extension absent). **Frontend:** Settings reads profiles row on mount — PLAN value reflects `tier`; notification toggles + quiet-hours sheet wire to `profiles.notify_*` / `quiet_hours_preset` with optimistic update. pgTAP covers handle_new_user revised seed + tier sync (pro/free transition) + audit-table default deny.

#### Edge Functions

- [x] **B12** — `notify_user_event` Edge Function authored. `supabase/functions/notify_user_event/` with `index.ts` (Deno + supabase-js v2 via esm.sh), `deno.json`, README with deploy + smoke-test instructions. Flow: parse payload → watchers query (`watchlist_tickers!inner join watchlists`) → per-pref filter → buildNotification (per kind, queries briefings/event_with_metrics_view/transcripts) → compliance regex gate (forbidden words from compliance.md) → per-row INSERT (so db throttle trigger raises P0001 per-user without batch failure) → batch POST to Expo Push 100/batch → mark sent notifications. Returns `{inserted, skipped_quiet, push_sent, push_failed}` summary.
- [x] **B13** — three maintenance Edge Functions authored. `cleanup_old_notifications` (delete notifications >30d in terminal status, returns deleted count), `retry_skipped_pushes` (picks up `status='skipped_quiet' AND scheduled_for <= now()` rows, re-fans them to Expo Push, marks sent or failed/no-token), `gc_stale_push_tokens` (deletes push_tokens last_seen >30d). Cron schedules already set in migration 016 (B11). `supabase/functions/README.md` covers deploy + local invocation + auth pattern.

#### Realtime + final wiring

- [x] **B14** — three realtime hooks + bus. `src/lib/realtime/` gains: `notifications-bus.js` (module-level pub/sub singleton), `use-notifications-stream.js` (root-level subscribe to notifications INSERT filtered by user_id, broadcasts via bus), `use-ticker-events-stream.js` (per-symbol events `*` event subscription), `use-watched-briefings-stream.js` (filter on `ticker_symbol=in.(...)` capped at 100; UPDATE on briefings, fires onReady only on status transition to ready). New `src/lib/use-user-id.js` helper. **Wiring:** `app/_layout.js` calls useNotificationsStream when authed. `useHomeData` subscribes to the bus (synthesises a minimal pending row for the pill, then re-fetches on promote) + useWatchedBriefingsStream against current watched symbols. `useWatchlist` runs useWatchedBriefingsStream against its items + refresh on briefing-ready. `useTickerDetail` runs useTickerEventsStream + refreshes timeline on event change. All hooks safely no-op when their inputs are empty.
- [x] **B15** — Discover sector heat + biggest surprises + Phase 12 close. Migration 017 (both RPCs, STABLE SECURITY INVOKER so per-table RLS applies). Discover screen now Promise.all-loads all three rails in one effect; empty-state copy on each rail. MOCK_SECTOR_HEAT + MOCK_BIGGEST_SURPRISES deleted; discover/mock.js tombstoned. pgTAP test verifies sector_heat returns without error and biggest_surprises sorted by abs(surprise_pct) desc.

#### Bonus / queue for Phase 13

- [ ] **B16** Settings prefs wiring — `notify_*` toggles + `quiet_hours_preset` on `profiles`. Was due in B10's wiring scope but worth verifying separately.
- [ ] **B17** Discover ticker search → real `tickers` table. Replaces the catalog-backed search currently doing client-side filter.
- [ ] **B18** Materialised view `sector_heat_mv` if `discover_sector_heat()` ever exceeds 100ms. Deferred indefinitely.

---

## Phase 12 acceptance (run after B15)

Two columns: **Authoring** (verified during the loop, files-only) and **Apply** (verified by user after `supabase db push`).

| Check | Authoring | Apply |
| --- | --- | --- |
| No `MOCK_*` constants in `src/features/*/mock.js` (tombstones-only) | ✅ — verified via grep | n/a |
| Every public table has RLS enabled | ✅ — verified by inspection (every CREATE TABLE has ENABLE ROW LEVEL SECURITY in same migration) | ⏳ run `select tablename from pg_tables where schemaname='public' and rowsecurity=false` (should return empty) |
| Sign up → onboarding → /today end-to-end | ⏳ defer to apply | ⏳ smoke test: sign up new email → ack screen → notifications → first tickers → /today |
| `disclaimer_ack_at`, `onboarded_at`, watchlist seed, push token persisted | ✅ — wiring authored | ⏳ verify rows present after smoke test |
| Sign out → sign in → routed to `/today` (ack survives) | ✅ — handle_new_user not re-run for existing user; disclaimer_ack_at stays set | ⏳ verify on device |
| Watchlist add/remove persists across cold start | ✅ — useWatchlist refresh + watchlist_tickers row insert/delete | ⏳ verify on device |
| Insert briefing with `status='ready'` → notification → push | ✅ — fan-out trigger + edge function authored | ⏳ apply migrations, deploy functions, then `update briefings set status='ready' where ...` |
| `supabase test db` passes | ✅ — 12 pgTAP files authored covering all RLS + key RPCs | ⏳ run after `supabase db push` (needs local supabase or Docker for `supabase test db --linked`) |

**Apply steps when user is ready (no Docker needed for these):**

```powershell
# 1. set DB password if not already set
$env:SUPABASE_DB_PASSWORD = "<your-db-password>"

# 2. apply all 17 migrations to remote
supabase db push

# 3. deploy all 4 edge functions
supabase functions deploy notify_user_event
supabase functions deploy cleanup_old_notifications
supabase functions deploy retry_skipped_pushes
supabase functions deploy gc_stale_push_tokens

# 4. (one-off, after first push) build + load russell-1000 seed
python scripts/build_ticker_seed.py
# then run supabase/seed.sql via psql or the SQL editor

# 5. smoke test on device
npx expo start
# sign up → walk through onboarding → /today
```

When all rows in the "Apply" column become ✅, Phase 12 fully closes and Phase 13 (Modal workers) opens.

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
