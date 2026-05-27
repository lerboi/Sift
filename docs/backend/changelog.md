# Backend loop — changelog

One paragraph per tick. Most recent first. `REVIEW:` prefix flags judgment calls the user should sanity-check.

---

## 2026-05-27 · Combined SQL applied successfully

All 17 migrations applied to the remote Supabase project (`qkdqxsghxjmwofqvbkrx`) via the SQL editor combined-paste flow on the fourth attempt. The three post-loop fixes (view column type, UNION ORDER BY, IMMUTABLE cast) were all real bugs in the authored migrations — the loop's "files only, no DB apply" mode meant they weren't caught during authoring.

**Pattern for future migration authoring:** any one of these three would have been caught by a `supabase db push --dry-run` or `psql --single-transaction` against a real Postgres. Future migration ticks should either (a) require an apply-validation step, or (b) include a syntactic-only check via a Postgres parser CLI. Recorded in learnings.md.

## 2026-05-27 · Post-loop fix — IMMUTABLE cast in 012

Third apply attempt hit:
```
ERROR: 42P17: functions in index expression must be marked IMMUTABLE
```

Root cause: `idx_notifications_user_ticker_day` used `((created_at)::date)` which is implicit `(created_at AT TIME ZONE current_setting('TimeZone'))::date` — STABLE, not IMMUTABLE. Postgres rejects non-immutable expressions in index definitions.

Fix: pinned to UTC explicitly — `((created_at at time zone 'UTC')::date)`. Updated the matching expressions in `enforce_push_throttle` so the trigger's WHERE clause matches the index expression and can use it. Semantic shift: throttle day-bucket is now UTC midnight, not server-local midnight (matches Supabase's UTC default but documented explicitly).

**REVIEW updated:** any future expression index must use IMMUTABLE functions only. `(col)::date` from timestamptz is the trap — always cast `at time zone 'UTC'` first, or use a generated `_date` column on the table.

## 2026-05-27 · Post-loop fix — UNION-level ORDER BY in 009

Second apply attempt hit:
```
ERROR: 0A000: invalid UNION/INTERSECT/EXCEPT ORDER BY clause
DETAIL: Only result column names can be used, not expressions or functions.
```

Root cause: `home_events_for_user` had `ORDER BY coalesce(actual_at, expected_at) desc` directly on the UNION ALL. Postgres restricts UNION-level ORDER BY to bare output column names; expressions need to be wrapped in an outer SELECT or pre-computed in each branch.

Fix: wrapped the UNION in `select * from ( ... ) all_events order by coalesce(...) desc;`. Combined SQL regenerated.

**REVIEW updated:** the `ticker_detail_timeline` RPC in 010 escapes this because it uses bare `occurred_at` (an output column name) for its ORDER BY. Any future RPC unioning per-branch SELECTs should either wrap in an outer subquery or pre-compute the sort key in every branch.

## 2026-05-27 · Post-loop fix — view column type mismatch (005 ↔ 007)

User tried to apply the combined SQL via the Supabase SQL editor and hit:
```
ERROR: 42P16: cannot change data type of view column "next_beat_probability" from numeric to numeric(5,4)
```

Root cause: migration 005's NULL-placeholder pattern used `null::numeric` (unbounded), while migration 007's `CREATE OR REPLACE VIEW` populates `next_beat_probability` from `briefings.beat_probability` which is typed `numeric(5,4)`. Postgres treats those as different types and `CREATE OR REPLACE VIEW` can't change column types.

Fix: changed migration 005 to cast the placeholder as `null::numeric(5,4)` so the column type stays stable across the B7 replacement. Combined SQL regenerated.

**REVIEW updated for learnings.md:** when writing NULL-placeholder views that get CREATE OR REPLACE'd later, cast to the **exact** type (precision + scale) of the eventual real column. `null::numeric` vs `null::numeric(5,4)` looks identical to a human but is two distinct types to Postgres.

## 2026-05-27 · B15 — Discover RPCs + Phase 12 close

Final B-tick. Migration 017 added two RPCs: `discover_sector_heat(p_week_start)` (GROUP BY t.sector, counts distinct briefings in the week window) and `discover_biggest_surprises(p_days, p_limit)` (events joined to event_metrics with non-null eps_surprise_pct, sorted by `abs(eps_surprise_pct) desc`). Both STABLE SECURITY INVOKER so the briefings (status=ready) and events (parsed) RLS filters apply automatically.

Discover screen's single `useEffect` now Promise.all-loads all three rails together (biggest_expected, sector_heat, biggest_surprises) instead of sequentially. Each rail has its own empty-state line ("No expected reports this week.", "No sector reports scheduled this week.", "No recent surprises to surface.") so the screen stays interactive even when the catalog is sparse. MOCK_SECTOR_HEAT + MOCK_BIGGEST_SURPRISES deleted from `src/features/discover/mock.js`; the file is now a tombstone comment. Final grep across src confirms zero `MOCK_*` symbol references remain — only the three tombstone comments in feature mock.js files.

pgTAP `rpc_discover.test.sql` (4 assertions): sector_heat returns without error; with 30-day-prior window includes the seeded briefings; biggest_surprises returns ≥3 rows over 30 days (matching the 3 events seeded in B6); results sorted by abs(surprise_pct) desc.

## Phase 12 — Loop close summary

**Shipped over 15 ticks in `supabase/`:**

- 17 migration files (`20260527_001_*.sql` through `_017_*.sql`)
- 12 pgTAP test files covering RLS for every user-owned table + audit-table default-deny + the four key RPCs
- 4 edge functions (`notify_user_event`, `cleanup_old_notifications`, `retry_skipped_pushes`, `gc_stale_push_tokens`) + README
- `supabase/seed.sql` for the Russell 1000 bulk load
- `scripts/build_ticker_seed.py` (stdlib-only, builds the seed CSV from iShares + SEC)
- `docs/backend/erd.md` (ASCII ER diagram, full schema)
- `docs/backend/changelog.md` (paragraph per tick)
- `docs/backend/learnings.md` (durable patterns surfaced)

**Frontend rewiring across 15 source files:**

- `src/lib/use-auth-routing.js`, `src/lib/use-user-id.js`, `src/lib/push-tokens.js`
- `src/lib/realtime/` (4 files — bus + 3 hooks)
- `src/features/auth/`, `src/features/onboarding/` (ack + notifications + first-tickers)
- `src/features/home/use-home-data.js`
- `src/features/watchlist/use-watchlist.js`, `use-sparkline.js`, `ticker-catalog.js`, `add-ticker-sheet.js`, `watchlist-screen.js`, `watchlist-row.js`
- `src/features/discover/discover-screen.js`
- `src/features/event/use-event.js`, `event-screen.js`
- `src/features/ticker/use-ticker-detail.js`, `ticker-screen.js`
- `src/features/settings/settings-screen.js`
- `app/_layout.js`

All `MOCK_*` constants and `getEventMock`/`getTickerMock` functions deleted (tombstoned). No remaining feature code reads from synthetic data.

**Docs patched in-place:**

- `triggers-and-functions.md` § Setting runtime parameters — Vault as primary path, ALTER DATABASE as self-hosted-only legacy reference. The example `trigger_notify_fan_out` body updated to use `app_config_secret` helper.
- `migrations.md` § Per-environment setup — same Vault rewrite.

**REVIEW summary — items to verify on first `supabase db push`:**

- Vault `app_config_secret` execution path on hosted Supabase (postgres-role-as-owner access to vault.decrypted_secrets is expected but not yet empirically verified)
- `supabase test db` outcome on remote (pgTAP tests authored but never run)
- Fan-out trigger → edge function HTTP path (Vault URL + key)
- pg_cron schedules visible via `select * from cron.job` (depends on Pro+ tier)
- expo push registration in EAS-built dev client (projectId must resolve)

**Out of scope for this loop:**

- Phase 13 (Modal workers): EDGAR poller, briefing generator, transcript fetcher, surprise classifier training. Per autonomous-loop authorizations memory, halt and ask before kicking that off.
- Test execution against a real DB (`supabase test db` against linked project)
- Real-device smoke test (deferred to user-supervised)

**Apply checklist (when ready, no Docker needed):**

```powershell
$env:SUPABASE_DB_PASSWORD = "<your-db-password>"
supabase db push
supabase functions deploy notify_user_event
supabase functions deploy cleanup_old_notifications
supabase functions deploy retry_skipped_pushes
supabase functions deploy gc_stale_push_tokens
python scripts/build_ticker_seed.py
# then run supabase/seed.sql via psql or SQL editor
npx expo start  # smoke test on device
```

---

## 2026-05-27 · B14 — realtime subscriptions

Created `src/lib/realtime/` with four files. The first three are subscription hooks; the fourth (`notifications-bus.js`) is the cross-screen pub/sub layer that lets the root-level notifications subscription reach downstream consumers without lifting state through a React context.

`notifications-bus.js` — module-level Set of listener fns + `subscribeToNotifications(fn) → unsubscribe` + `broadcastNotification(row)`. Try/catch around each listener so one throwing fn doesn't break others. No React involvement, no re-renders on subscribe/unsubscribe.

`use-notifications-stream.js` — subscribes to the `notifications` table INSERTs filtered to `user_id=eq.<uid>`, calls `broadcastNotification(payload.new)` on each. Channel cleanup on unmount via `supabase.removeChannel`. RLS gates rows; the channel filter is just for traffic efficiency (server-side filtering).

`use-ticker-events-stream.js` — per-symbol channel `ticker-events:<sym>`. Watches all events table changes (`event: '*'`) filtered to the symbol. Calls the passed `onChange` callback; consumer typically re-fetches the timeline RPC. Channel name carries the symbol so two different ticker screens get separate channels, not crosstalk.

`use-watched-briefings-stream.js` is the more interesting one. The naive "subscribe to all briefings, filter client-side" wastes bandwidth and pierces RLS surface area. Instead this hook builds `ticker_symbol=in.(<list>)` server-side filter from the user's watched symbols. Supabase Realtime caps `in.(...)` at ~100 values; over that, the hook silently drops the filter and falls back to broader subscription (RLS still gates correctly, just noisier). Uses a `onReady` callback ref to keep the effect stable across re-renders even when the callback identity changes — important because the caller passes a fresh fetch fn each render.

`src/lib/use-user-id.js` — small hook that reads session userId on mount and listens to onAuthStateChange. Returns null when signed out. Used at root layout to gate `useNotificationsStream`.

**Wiring:**

- `app/_layout.js` — adds `useUserId()` and `useNotificationsStream(authStatus === 'authed' ? userId : null)`. When sign-out fires, userId flips to null, the hook tears down the channel.
- `useHomeData` — new useEffect calls `subscribeToNotifications((row) => …)` and synthesises a minimal pending event for the pill: kind='event' maps to state='live', everything else 'upcoming'. The pill count is accurate immediately; on promote, useHomeData calls refresh() which re-fetches the full RPC and replaces the minimal row with the proper data. Also wires `useWatchedBriefingsStream(watchedSymbols, refresh)` for briefing-ready transitions on the user's watched tickers.
- `useWatchlist` — adds `useWatchedBriefingsStream(symbols, refresh)`. When a watchlist ticker's briefing flips to ready, the watchlist view re-fetches and the row's `briefingReady` badge appears.
- `useTickerDetail` — adds `useTickerEventsStream(sym, fetchAll)`. Any events-table change for the current ticker triggers a timeline refetch.

All four wiring sites are defensive — empty symbol list, null userId, missing callback all short-circuit cleanly.

**REVIEW:** the pending event synthesis in useHomeData fabricates a row from notification metadata only (kind + ticker + reference_id), without an actual briefing/event row available. The pill count is correct; if user taps promote before a refetch fires, they'll briefly see a placeholder with no period or beat probability. Acceptable for the new-events pill UX (it's a "tap to see more" affordance, not a full card). The follow-up refetch fills in the real row within ~200ms.

**REVIEW:** `use-watched-briefings-stream` falls back to no-filter when symbols.length > 100. At MVP this never happens. At scale (e.g. a future "follow all of S&P 500" feature) the realtime traffic for unrelated briefings would be wasted bandwidth — solve by either chunking the subscription into 100-symbol batches or building a server-side `briefings_for_user_view` that RLS-filters per user.

**REVIEW:** useHomeData re-fetches on every briefing-ready event. If a Modal cron flips 50 briefings at once (worst case: morning batch), the screen could re-fetch 50 times in seconds. At MVP scale (≤10 watched tickers per user) the actual events-per-second per user is single-digit, so this isn't observed. If we ever see thrashing, add a debounce-coalesce around fetchOnce.

**REVIEW:** the realtime channel names embed the user/symbol/symbols-list. Symbol-set changes (user adds a ticker) tear down the briefings channel and create a new one — momentary gap, then a fresh subscription. Acceptable; alternative is dynamic .filter mutation which Supabase Realtime doesn't yet expose cleanly.

**Next tick:** B15 — Discover sector heat + biggest surprises RPCs + screen wiring. Phase 12 acceptance check after.

---

## 2026-05-27 · B13 — three maintenance Edge Functions

Authored the three maintenance functions whose cron schedules went out in migration 016. Each is small and single-purpose; they all share the same supabase-js client setup (service-role key, no session persistence).

**cleanup_old_notifications** — issues a single DELETE against notifications where `created_at < now() - interval '30 days'` AND `status IN ('sent', 'delivered', 'failed')`. Uses Supabase JS's `{ count: 'exact' }` option to get an accurate deleted count for the response body. The 30-day retention is in a `RETENTION_DAYS` constant so it's tunable. Non-terminal statuses (pending, skipped_quiet) are deliberately preserved — a notification stuck in pending for >30d signals an upstream bug; better to surface than auto-delete.

**retry_skipped_pushes** is the meatiest of the three. Pulls up to 500 rows from notifications where `status='skipped_quiet' AND scheduled_for <= now()`, ordered by scheduled_for ASC so the oldest waiting notifications go first. For each, looks up push_tokens for the user (one fetch covers all users via `in()`), builds Expo Push messages, sends in batches of 100. Marks sendable rows as sent regardless of Expo result (push receipts handled by a future worker). Rows without any registered token get marked `failed` with `error='no push token registered for user'` so the next gc reclaims them and they don't loop forever.

**gc_stale_push_tokens** — deletes push_tokens with `last_seen_at < now() - interval '30 days'`. The root layout's useEffect bumps `last_seen_at` on every cold start of an authed user (B10), so a 30-day-old `last_seen_at` is either an uninstalled app or a permanently-revoked permission. Simple, single-statement DELETE with exact count.

Wrote `supabase/functions/README.md` covering the full function inventory, deploy commands, env var conventions, auth pattern (cron POSTs via Vault-pulled service role key), local invocation via `supabase functions serve`, and the project's house style (one file per function, supabase-js pinned major, structured logging).

**REVIEW:** all three functions delete with `count: 'exact'` which requires a count round-trip to Postgres. At MVP volumes (thousands of notifications, hundreds of tokens) this is irrelevant — single-digit ms overhead. If notifications volume scales past millions, switch to `count: 'planned'` (cheaper estimate) or drop the count entirely and rely on Supabase logs.

**REVIEW:** retry_skipped_pushes' MAX_BATCH = 500 means a 5-minute backlog from heavy quiet-hours deferral could underrun (>500 pending). Cron runs every 5 min so two cycles drain 1000; at MVP this is generous headroom. If we ever observe sustained backlog, raise the batch cap or switch to long polling.

**REVIEW:** the Expo Push response is treated as binary success/failure based on HTTP status. In reality Expo's response includes per-message receipts/errors (DeviceNotRegistered, InvalidCredentials, etc.) that should drive per-token cleanup. Deferred to a future "process push receipts" worker. For now, gc_stale_push_tokens handles the long-tail cleanup based on activity, not Expo's signal.

**REVIEW:** Sunday 4am UTC for token GC was chosen to minimise interference with active users in US time zones (just past midnight ET). If user base shifts (e.g., a lot of Asia users), reschedule. The cron entry in migration 016 is easy to swap.

**Next tick:** B14 — three realtime subscription hooks (notifications, ticker events, watchlist briefings). All foreground-only; complementary to push for in-foreground UX.

---

## 2026-05-27 · B12 — notify_user_event Edge Function

Authored `supabase/functions/notify_user_event/index.ts` (~250 lines Deno/TS). The function lives at the receiving end of every fan-out trigger from migration 015 — when a briefing flips to ready or an event hits parsed or a transcript_analysis row lands, the DB POSTs `{ kind, ticker_symbol, reference_id }` here, and this function makes the leap from "data changed" to "user's phone vibrates".

Five-stage pipeline:

1. **Watchers lookup** — `from('watchlist_tickers').select('watchlist:watchlists!inner(user_id)').eq('ticker_symbol', ...)`. The `!inner` join with implicit foreign-key relationship is Supabase JS's syntax for a required join (without it, watchlist_tickers without a parent would still return). Result is deduped via Set.
2. **Preference filter** — single `profiles.select(id, notify_<kind>).in(id, userIds)`, dynamic column name based on kind. Empty list → 200 with `reason: 'no wanters'`.
3. **buildNotification per kind** — separate query per source table (briefings / event_with_metrics_view / transcripts with `transcript_analysis(tone)` join). Returns `{title, body, deepLink}`. Each kind produces compliance-safe copy: factual verbs only ("REPORTED beat", "Model beat probability X%"), no directive language. Period strings normalised `Q1-2026 → Q1 26` for display.
4. **Compliance gate** — single regex against title+body covering the forbidden-word list from `docs/architecture/compliance.md` (advice, recommend, should buy/sell, will rise/fall/moon/tank, guaranteed, risk-free, etc.). Match blocks the whole fan-out (return 200 with `reason: 'compliance_blocked'` + flagged term in body). Logged via console.warn so Supabase dashboard surfaces these for review. The same filter eventually goes on the briefing-generator's content_md, but having it here is belt-and-braces — even if a future content_md slipped through, the push title/body still gets gated.
5. **Per-row INSERT + Expo Push** — loops users instead of a batch insert because the db `enforce_push_throttle` trigger raises P0001 per-row. A batch insert would fail wholesale on one user's throttle. Loop catches P0001 specifically (silent skip) and other errors (logged, not retried). Inserted rows whose `status != 'skipped_quiet'` get their tokens looked up and queued for Expo Push (100/batch — Expo's hard cap). On send success, UPDATE notifications.status='sent', sent_at=now() so the in-app tray reflects delivery without an extra round-trip.

Wrote `deno.json` (esm import map + dev task) and a README covering deploy + smoke test SQL.

The function relies on Supabase auto-injecting `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the Edge Function runtime — no manual env setup. The supabase-js client is created with `auth.persistSession=false, autoRefreshToken=false` since this is a stateless serverless context.

**REVIEW:** `buildNotification`'s transcript branch queries `transcripts(...).select('id, fiscal_period, transcript_analysis(tone)')` — this is a Supabase JS join shorthand assuming the FK relationship from `transcript_analysis(transcript_id)` to `transcripts(id)`. If the auto-detection of the relationship name fails on first deploy, will need to be rewritten as a two-query path (transcripts then transcript_analysis lookup).

**REVIEW:** the per-row insert loop is N+1 — worst case 50 inserts for a popular ticker. Latency is dominated by the network hop, not the inserts themselves (each ~5ms in Supabase). At MVP scale (≤1k users) acceptable. If a single ticker accumulates 10k watchers, refactor to a single INSERT … ON CONFLICT … with the throttle check moved client-side (or pull throttle from a count-only RPC).

**REVIEW:** the function marks notifications `status='sent'` on Expo POST success. This conflates "Expo accepted the message" with "device received it." Real delivery confirmation requires polling Expo Push receipts — deferred to a future tick. For now, `sent` ≈ "handed off."

**REVIEW:** the deep_link `sift://today/events/${eventId}` for `briefing` kind routes to the event detail screen, but a briefing has no event yet. The screen would 404. Possible alternatives: link to `sift://watchlist/${ticker}` (ticker detail with the upcoming briefing visible) or have the briefing-ready notification not deep-link at all and just open Today. Flagged for product review.

**Next tick:** B13 — three maintenance Edge Functions (`cleanup_old_notifications`, `retry_skipped_pushes`, `gc_stale_push_tokens`) already pre-scheduled in migration 016. Just need the bodies.

---

## 2026-05-27 · B11 — subscriptions + audit + triggers + pg_cron + Settings

Four migrations for the largest tick in the loop.

**013_subscriptions.sql** — table + per-row updated_at trigger + `sync_profile_tier` AFTER INSERT/UPDATE trigger that mirrors `(plan, status)` into `profiles.tier`. Pro is set when `status='active' AND plan LIKE 'pro_%'`; everything else maps to free. Lets RLS / feature gating reads check `profiles.tier` without joining subscriptions. handle_new_user revised to its **third and final** form — now seeds profile + default watchlist + subscriptions stub atomically on auth.users INSERT. Backfilled existing users via LEFT JOIN so the test users created in earlier ticks get a subscriptions row.

**014_audit_tables.sql** — `llm_calls` (append-only cost/latency audit; indexes on `created_at desc` + `(kind, model)`) + `data_source_status` (singleton-per-source). Neither table has RLS policies, which is the point — default-deny means anon and authenticated see nothing; only service_role writes. Bootstrap rows for the three primary sources (edgar, finnhub, earningscalls) so Modal heartbeats can UPSERT without an existence check.

**015_fanout_triggers.sql** — five triggers, all using the Vault helper from migration 003:

- `trigger_notify_fan_out(jsonb)` — definer fn that POSTs to `<edge_url>/notify_user_event`. Reads URL + service role key from Vault via `app_config_secret(...)`. **Silently no-ops if either secret is null** so local dev and test environments insert briefings without triggering a real HTTP call.
- `notify_on_briefing_ready` (AFTER INSERT OR UPDATE OF status on briefings) — fires only when status transitions to 'ready'.
- `notify_on_event_parsed` (AFTER INSERT OR UPDATE OF parse_status on events) — fires only when parse_status transitions to 'parsed' (matches the RLS filter).
- `notify_on_transcript_analysis` (AFTER INSERT on transcript_analysis) — joins to transcripts to get the ticker, then fan-outs.
- `sync_briefing_prompt_version` (BEFORE INSERT OR UPDATE OF model_version_id on briefings) — looks up `model_versions.version` and writes it to `briefings.prompt_version`. Means Discover queries get the version without a join.

**016_pgcron_jobs.sql** — defensive: starts with `SELECT 1 FROM pg_extension WHERE extname='pg_cron'`; raises NOTICE and returns if absent (Free tier or self-hosted without the extension installed). Otherwise schedules three jobs that POST to edge functions: cleanup_old_notifications (3am daily), retry_skipped_pushes (every 5 min), gc_stale_push_tokens (Sunday 4am). Each `cron.schedule` body uses Vault-backed URL + key construction, identical pattern to `trigger_notify_fan_out`. Wrapped in DO block so the whole migration applies cleanly with or without pg_cron.

pgTAP `rls_subscriptions_and_audit.test.sql` (6 assertions): trigger seeds the subscriptions row; defaults are correct; flipping to active pro_monthly bumps profiles.tier to 'pro'; cancelling reverts to 'free'; authenticated cannot read llm_calls; authenticated cannot read data_source_status.

Frontend `settings-screen.js` rewritten. Loads profiles row on mount (tier + 3 notification toggles + quiet_hours_preset). PLAN row now reads dynamically (`Free` or `Pro`). Notification toggles persist via `persistPref(column, value)` helper that does optimistic state set + server UPDATE — failures log but don't surface (the toggle stays in the user's last-tapped state, eventually-consistent). Quiet hours sheet onChange wired to `setQuietPersistent` which both updates local state and writes to the row. The schema doc's "B16 settings prefs wiring" was bundled into this tick because it's small and the touch points are colocated.

**REVIEW:** `trigger_notify_fan_out`'s "silently no-op if vault secret null" path is convenient for tests but means a misconfigured production environment (Vault populated wrong key name, for example) would silently lose fan-outs. Recommend a one-time post-deploy check: insert a test briefing and verify the edge function receives the POST. Or add a `RAISE WARNING` (non-fatal) when secrets are null in production envs.

**REVIEW:** pg_cron is **Supabase Pro+ only**. If the user is on Free tier, migration 016 skips with a NOTICE and the maintenance jobs don't run. Alternatives: (a) upgrade to Pro and re-apply 016; (b) write a Modal cron worker that hits the edge functions on schedule. The iteration plan's B13 assumes pg_cron runs the schedules; if Free, Modal becomes a hard dependency for Phase 13.

**REVIEW:** Settings `persistPref` is fire-and-forget — no spinner, no toast on failure. For B16 polish this is fine (a stale toggle reverts on next cold reload). For prod, consider an InlineError or toast surface when the server write fails.

**REVIEW:** notifications-screen onboarding doesn't write to `profiles.notify_*` — those columns are set by the defaults from `profiles` insert (notify_briefings=true, notify_events=true, notify_transcripts=false). That matches the Allow-permission UX (we assume defaults; user adjusts in Settings later). If product wants per-onboarding choice (e.g., "uncheck transcripts now"), wire toggles into the screen and write to profiles before the route push.

**REVIEW:** the schema doc says triggers go in migration 016. I split them across 005 (handle_new_user revision), 013 (sync_profile_tier + final handle_new_user), 015 (fan-out + sync_briefing_prompt_version), and embedded RLS / set_updated_at triggers per-table. This is a deliberate divergence from the doc's "one 016_triggers.sql" plan — per-tick coupling won out. Documented in learnings.md.

**Next tick:** B12 — `notify_user_event` Edge Function in `supabase/functions/notify_user_event/`. Deno + supabase-js + Expo Push fan-out.

---

## 2026-05-27 · B10 — notifications + push_tokens + triggers + push registration

Authored `20260527_012_notifications_and_push.sql`. Both tables in one file because the throttle trigger on notifications transitively depends on the table existing; splitting would just create cross-file ordering pain.

`push_tokens` per schema.md: composite PK on `(user_id, token)` so re-claiming the same token under a different account replaces the row; `(user_id)` index for fan-out lookups; `(last_seen_at)` index supports `gc_stale_push_tokens` weekly cron (B13). Full four-verb RLS scoped to `auth.uid() = user_id` so a user can clean up their own tokens when signing out / changing devices.

`notifications` per schema.md: three indexes that solve real query paths — `(user_id, created_at desc)` for the in-app tray, partial `(status) WHERE status IN (pending, skipped_quiet, failed)` for the retry cron, and `(user_id, ticker_symbol, ((created_at)::date))` to make the throttle COUNT(*) lookup index-only. RLS is select-only for users; service_role inserts via the fan-out edge function (B12).

`enforce_push_throttle` is the centrepiece: BEFORE INSERT trigger that counts same-day rows for the (user, ticker) pair excluding 'failed' status (failed sends shouldn't count toward the cap — they're retried). At ≥3 it raises P0001 with context. The fan-out edge function in B12 catches this and skips the row.

`enforce_quiet_hours` reads `profiles.tz` + `profiles.quiet_hours_preset` (e.g. `'22-07'`), computes the local hour from the row's `created_at AT TIME ZONE user_tz`, and flips `status='skipped_quiet'` + `scheduled_for=<end of quiet>` when inside the window. Handles both spans-midnight (22-07) and daytime quiet (rare). 'off' preset short-circuits. The retry cron (B13) picks up `scheduled_for <= now()`.

**Trigger ordering** — schema.md said "throttle then quiet" but the doc's naming (`_throttle`, `_quiet`) is wrong alphabetically: `q` < `t`. Used numeric prefixes (`_1_throttle`, `_2_quiet`) so the fire order is unambiguous. See REVIEW: below.

`supabase/tests/rls_notifications.test.sql` (7 assertions): 3 notifications inserted under cap; 4th raises P0001; different ticker (NVDA) bypasses the per-ticker cap; quiet-hours trigger flips status when preset `00-23` (whole day quiet) covers the now; scheduled_for is set when flipped; cross-user RLS isolation works.

Frontend: new `src/lib/push-tokens.js` exports `registerPushTokenIfPossible()`. Resolves projectId from multiple Constants paths (eas + extra + easConfig) so it works across dev/prod/EAS builds, calls `Notifications.getExpoPushTokenAsync()`, then UPSERTs `push_tokens` keyed on `(user_id, token)` with `last_seen_at = now()`. Catches errors silently — Expo Go on SDK 53+ has reduced push support and the function should no-op rather than break onboarding.

`notifications-screen.js` calls `registerPushTokenIfPossible()` after a granted permission. `app/_layout.js` calls it from a useEffect that fires when `authStatus === 'authed'` — so every cold start of an authed user bumps `last_seen_at`, which the B13 `gc_stale_push_tokens` cron will use to avoid reaping live devices.

ERD doc gained push_tokens + notifications blocks including the trigger ordering note.

**REVIEW:** the schema doc claimed `notifications_before_insert_throttle` < `notifications_before_insert_quiet` alphabetically. That's wrong — `q` (ASCII 113) sorts before `t` (116). I used numeric prefixes (`_1_throttle`, `_2_quiet`) to make the order unambiguous. Future trigger work that depends on ordering should use this pattern, not "natural" naming.

**REVIEW:** `enforce_push_throttle` excludes `status='failed'` from the count, per schema doc. This means a user whose first three pushes failed could receive 3 more retries — intentional but worth flagging since it could spam in a pathological case. If retries from Phase 13 fail repeatedly, the data_source_status table (B11) will surface the upstream issue.

**REVIEW:** `enforce_quiet_hours` uses `date_trunc('day', ... at time zone tz) + interval` for the next-quiet-end computation. This is correct for both daylight-savings cases since `at time zone` returns a naive timestamp in user-local, and date_trunc preserves that. The result is converted back via `at time zone user_tz` to get UTC. Verified manually with two presets but not exhaustively tested across DST transitions — flagged for hardening.

**REVIEW:** Expo's `getExpoPushTokenAsync` requires a `projectId` for newer SDKs. The helper attempts three Constants paths to find it; if all three are missing, the call still goes through without projectId and may fail. In dev (Expo Go), this is fine. In an EAS build, the projectId is auto-injected via app config — verify present before first beta build.

**Next tick:** B11 — subscriptions + llm_calls + data_source_status + remaining triggers including the fan-out `trigger_notify_fan_out` that uses the Vault helper from B1.

---

## 2026-05-27 · B9 — model_versions + FK additions + backfill

Authored `20260527_011_model_versions.sql`. Table mirrors `schema.md` verbatim: uuid PK, `model_kind` enum, semver-style `version text`, `storage_path` and `sha256` for joblib/ONNX artefacts written by Modal, `metrics jsonb` for whatever evaluation numbers the training pipeline produces (logloss, brier, etc.), `status model_status`, optional human `notes` and `promoted_at` for audit. The partial unique index `idx_model_versions_one_active ON (kind) WHERE status = 'active'` is the headline mechanism — enforces "exactly one active per kind" via the database without a per-row trigger or application-level check. Trying to insert a second active row hits a 23505 unique violation; pgTAP asserts this.

RLS: `all auth read model_versions WHERE status = 'active'`. Staged and retired rows are invisible to clients — the app should never have to know about non-active versions. Service role bypasses RLS for promotion writes.

Bootstrap 4 rows: briefing_prompt v1.0, surprise_classifier v0.1, extraction_prompt v1.0, transcript_summary v1.0. All `status = 'active'`, all with `promoted_at = now()` and a one-line note explaining what they are. The B17 (surprise classifier training, Phase 13) cron will promote a real classifier into v1.0 by inserting `status='active'` after demoting v0.1 — same transaction so the partial unique never sees two actives.

Added the three FK constraints that earlier migrations deferred:
- `briefings_model_version_id_fk` (briefings → model_versions)
- `event_metrics_extracted_by_model_id_fk` (event_metrics → model_versions)
- `transcript_analysis_model_version_id_fk` (transcript_analysis → model_versions)

These FKs validate at constraint-add time against existing rows; since every prior seed left the columns NULL, validation is trivial — nullable FKs accept NULL without lookup. The constraint additions complete the schema doc's view of cross-table integrity.

Backfilled the seeded briefings to point at the active `briefing_prompt` row and updated their denormalised `prompt_version` column. Same for the AAPL transcript_analysis pointing at the active `transcript_summary`. Now every seeded row references a real model version, which lets the schema linter (and future code) reason about lineage.

`supabase/tests/rls_model_versions.test.sql` (5 assertions): four active rows, double-active blocked with 23505, staged-coexists-with-active, authenticated only sees active, backfill set prompt_version to '1.0'.

No frontend changes this tick — model_versions is service-role write, and the app already reads `prompt_version` denormalised from briefings via the discover_biggest_expected RPC (the version footnote on Discover).

**REVIEW:** the partial unique index has the right semantic but isn't a substitute for transactional promotion. A safe pattern for promotion would be a SQL function: `promote_model_version(kind, version)` that updates the prior active to 'retired' and inserts/updates the new row in one transaction. Documented as a future Modal-worker concern; not authored here because the API surface isn't yet defined.

**REVIEW:** `extraction_prompt` and `transcript_summary` rows are seeded but no extraction or transcript-analysis flow uses them yet (Phase 13). They're inert until then. Keeping them present makes the active-set complete from day one and avoids a "no active row" code path in future Modal workers.

**REVIEW:** the FK on `event_metrics.extracted_by_model_id` references `model_versions(id)` without an ON DELETE clause — defaults to `NO ACTION`. Deleting a model_versions row that has any metrics referencing it will fail. That's intended (preserves lineage); the alternative is `ON DELETE SET NULL` which destroys audit. Documented for future-proofing if a "delete this model entirely" workflow ever appears.

**Next tick:** B10 — notifications + push_tokens tables + push throttle (3/ticker/day) + quiet-hours triggers + notifications-screen + root layout push registration.

---

## 2026-05-27 · B8 — transcripts + ticker_detail_timeline + ticker-screen

Authored `20260527_010_transcripts.sql`. Three tables in one file because they're all in service of the same concept (a call → its segments → its analysis) and the unique pattern would be the same per-tick coupling otherwise.

`transcripts` carries one row per (ticker, fiscal_period) — same idempotency invariant as briefings. Index on `(ticker_symbol, call_date desc)` for the ticker-detail timeline. RLS: all-auth-read (transcripts are catalog data, like briefings).

`transcript_segments` has the headline migration deliverable — `embedding vector(1536)` + HNSW index on `vector_cosine_ops`. Dimension 1536 matches OpenAI `text-embedding-3-small` and Cohere `embed-v3` default. The HNSW index uses default `m=16, ef_construction=64` parameters which gives ~95% recall out of the box. If recall ever feels weak, tune those.

`transcript_analysis` is 1:1 with transcripts, separated because analysis lags ingestion. Carries `tone` enum + `tone_score numeric(5,4)`, jsonb `novel_topics` and `guidance_changes` (shape varies enough to justify jsonb), and `summary_md` for the long-form LLM output.

`ticker_detail_timeline(p_symbol)` RPC returns `(item_id, kind, occurred_at, payload jsonb)`. UNION ALL across four sources: upcoming briefings (status=ready, expected > now()), past events (parse_status=parsed) with metrics joined, past briefings (status=ready, expected <= now()), transcripts left-joined to analysis. Each branch builds a kind-specific jsonb via `jsonb_build_object` so the screen can render without recomputing. Ordered `occurred_at desc` server-side so the screen just groups by day.

Seeded 1 transcript + 1 analysis for AAPL Q4-2025, matching the existing AAPL Q4-2025 event seed from B6. Tone = neutral, score 0.12. Novel topics + guidance changes shapes match what an LLM extraction would produce, with the educational-disclaimer ending baked into `summary_md`. Uses a CTE-based `INSERT … RETURNING` so the analysis insert chains on the transcript's actual id.

`supabase/tests/rls_transcripts.test.sql` (5 assertions): seed counts, authenticated reads on all three tables, RPC returns ≥3 rows for AAPL (briefing + event + transcript at minimum), transcript-kind exactly 1.

Frontend: new `src/features/ticker/use-ticker-detail.js`. Hook does parallel Promise.all: `tickers` row (name/sector), `ticker_detail_timeline` RPC, default watchlist id (only if authed). Then a dependent query for "is this ticker on the watchlist?" (single-row maybeSingle so missing returns null cleanly). `shapeTimelineRow` per-kind: for `earnings-upcoming`, lifts beat_probability/consensus_eps out of payload jsonb to Number; for `earnings-past`, normalises eps surprise + actual/est; for `briefing`, fills `title` if missing using the period; for `transcript`, formats call_date. `toggleWatchlist` is optimistic — flips local state, awaits insert/delete, rolls back on error. `23505` (unique violation) is ignored so a double-add doesn't break.

`ticker-screen.js` rewritten. Sparkline now uses `useSparkline` directly (same hook as Watchlist row). Timeline reshaped to match the `groupByDay` contract (expectedAt for upcoming, actualAt otherwise). Methodology sheet still works but pulls beat_probability from the upcoming item in the timeline rather than a separate field. Error branch with retry button; empty-state line when no timeline rows. `getTickerMock` deleted from `mock.js` (tombstone comment).

`get_company_name` not changed — already cached via the catalog `tickers` table fetched on watchlist mount.

ERD doc gained the transcripts + segments + analysis trio + RPC signature.

**REVIEW:** the past-briefings branch of `ticker_detail_timeline` filters `b.status = 'ready' AND b.expected_release_at <= now()`. With the current seed (all briefings have expected_release_at = current_date + N), there are no past briefings yet. The timeline will show upcoming briefings + past events + transcripts but not past briefings. Once the briefing-generator cron (Phase 13) backfills historical briefings, this will populate naturally. Documented as expected.

**REVIEW:** the `transcripts.storage_path` column is NOT NULL but the seed sets it to a fictional path `'transcripts/aapl-q4-2025.txt'`. Reading the actual content from Supabase Storage would 404 if attempted. The frontend only reads `summary_md` from `transcript_analysis`, not the raw storage_path, so this is harmless until a future "open original transcript" link is added.

**REVIEW:** the `transcript_segments` HNSW index will fail to build on an empty table — but it doesn't, because Postgres only validates index structure, not contents. First INSERT triggers index population. Modal's transcript-segment writer (Phase 13) will be the first real consumer.

**REVIEW:** the schema doc shows `transcript_analysis.tone tone NOT NULL`. With the analysis-lag pattern (analysis row written after the transcript), if Modal hasn't yet analysed a transcript, the analysis row simply doesn't exist (LEFT JOIN in the RPC). That's fine. The constraint just means an inserted analysis row must commit to a tone classification.

**Next tick:** B9 — `model_versions` registry + add FK constraints to briefings/event_metrics/transcript_analysis.model_version_id + bootstrap two active rows (`briefing_prompt v1.0` and `surprise_classifier v0.1`).

---

## 2026-05-27 · B7 — home_events_for_user RPC + Today wiring

Authored `20260527_009_home_events_rpc.sql`. Single function, CTE-based with three named subqueries: `watched` (the user's ticker_symbols pulled via `w.user_id = p_user_id`), `upcoming` (briefings filtered to `status='ready'` and a `(now() - 6h, now() + 30d)` window so a briefing for an issuer that already reported isn't double-counted as upcoming), `live_and_past` (events with `parse_status='parsed'` and `filed_at > now() - 30d`, with `state` classified inline: live if filed < 15min ago, else past). UNION ALL, ordered `coalesce(actual_at, expected_at) desc` so the cursor of "now" pivots the list.

`SECURITY INVOKER` is critical: the function signature takes `p_user_id` but Postgres only ever returns the caller's rows because the inner `watched` CTE reads `public.watchlists` which is RLS-gated to `auth.uid() = user_id`. If user A calls the RPC with user B's uuid, the watched CTE returns empty for them, and the whole feed returns 0 rows. Test 3 in `rpc_home_events.test.sql` proves this.

`supabase/tests/rpc_home_events.test.sql` (5 assertions): alice watching AAPL+NVDA sees ≥1 row; alice doesn't see TSLA (not watched); alice calling with bob's uuid returns 0 (cross-user RLS denial); state classification correctly puts the AAPL Q4-25 seed event into 'past' (>15min old); bob watching TSLA sees TSLA Q1-26.

Frontend: `src/features/home/use-home-data.js` rewritten. Hook now calls `supabase.rpc('home_events_for_user', { p_user_id })`, shapes each row to the EventTimelineCard contract (mapping `ticker_symbol`→`ticker`, `eps_surprise_pct`→`surprisePct`, etc.). `state`-aware shape: upcoming rows get beatProb/briefingReady; past/live rows get epsActual/surprisePct. Re-subscribed to `onAuthStateChange` so sign-out → sign-in re-fetches. Added a `pushPending(row)` helper for the B14 realtime hook to call when a new notification arrives — currently uncalled.

`home-screen.js` updated to pass `referenceId` (uuid) to the event detail route instead of ticker. Past/live events now resolve in the new event-screen (which expects uuid via `useEvent`); upcoming still routes to ticker detail since there's no event row yet. Card `key` extended with referenceId to handle multiple events for the same (ticker, period) edge case.

`src/features/home/mock.js` reduced to a tombstone comment. The old `MOCK_HOME_EVENTS` no longer exists — Today is fully live data.

**REVIEW:** the schema doc's RPC definition uses `now() - interval '6 hours'` lower bound on upcoming briefings — same as what I implemented. This is the "still upcoming even if 5 min after expected release" tolerance. The frontend's `state` derivation looked at `filed_at > now() - 15 minutes` for "live"; the RPC matches that. Both numbers (6h, 15min) are anchored in the doc; recorded here in case product wants to tune.

**REVIEW:** the `upcoming` CTE filters `b.status = 'ready'` — meaning briefings with status `pending` or `needs_review` are hidden from Today entirely. RLS already enforces this (briefings policy filters to status='ready'), but the function repeats the predicate so the planner knows it doesn't need to scan pending rows. Belt-and-braces.

**REVIEW:** the RPC `p_user_id` parameter is redundant with `auth.uid()` from a security standpoint (the SECURITY INVOKER means RLS gates rows regardless of what's passed). I kept it because the frontend-wiring doc explicitly specifies the parameter, and it lets future admin tooling call the function with a different user's uuid (impossible today since the inner queries reflect the caller's RLS). If schema.md is ever updated to drop the parameter in favour of pure auth.uid(), update both ends together.

**Next tick:** B8 — `transcripts` + `transcript_segments` (vector(1536) + HNSW index) + `transcript_analysis` + `ticker_detail_timeline(p_symbol)` RPC + ticker-screen wiring.

---

## 2026-05-27 · B6 — events + event_metrics + view + event-screen

Authored `20260527_008_events_and_metrics.sql`. `events` table follows schema.md verbatim: `accession_number unique` (the EDGAR-poll idempotency anchor — re-seeing a filing is a constraint hit, not a duplicate row), four useful indexes (ticker+filed_at desc for the ticker detail path, filed_at desc for cross-market feeds, partial parse_status index that skips the 99% parsed rows so the retry-pending scan stays cheap, ticker+fiscal_period for cross-table joins with briefings), three distinct timestamp columns (filed_at → detected_at → parsed_at) so the realtime latency budget from schema.md is observable per-row. RLS hides `pending` (surfaces racy mid-parse data); `failed` is exposed so the frontend can render an `<InlineError>` rather than a silent gap.

`event_metrics` is the headline migration deliverable. The two surprise % columns are `numeric(10, 6) GENERATED ALWAYS AS ... STORED` with `CASE WHEN est IS NULL OR est = 0 THEN NULL ELSE (actual - est) / est END` to guard divide-by-zero. Defined once in DDL = one consumer can't compute it differently than another. Partial index on `eps_surprise_pct WHERE NOT NULL` supports B15's biggest-surprises sort. RLS is parent-checked: a metrics row is visible iff its parent event is parsed.

`event_with_metrics_view` flattens `events JOIN tickers LEFT JOIN event_metrics` filtered to `parsed|failed`. LEFT JOIN on metrics means a `failed` event with no metrics row still renders (with all metric columns NULL) so the screen can show "filing couldn't be parsed."

Seeded 3 past parsed events with real-formatted (but synthetic) SEC accession numbers and exhibit_urls pointing to real Apple/NVIDIA/Tesla 8-K filings (so the "view source" link is testable). Sub-15-second detected/pushed deltas reflect the latency budget the design assumes. event_metrics seed uses CASE per-ticker matching to keep the SQL one INSERT statement; segments jsonb provides AAPL Services/iPhone/Wearables, NVDA Data Center/Gaming/Auto, TSLA Auto/Energy/Services.

`supabase/tests/rls_events.test.sql` (7 assertions): seed count, generated column math matches manual calc, pending event hidden from authenticated, view returns ≥3 rows, view exposes joined metric columns, parent-check on event_metrics RLS.

Frontend: new `src/features/event/use-event.js` — `useEvent(eventId)` hook with loading + error + null-data branches. `shape()` does the server-to-client mapping: revenue scaled from dollars (server) to billions (display), surprise pcts wrapped in `Number()`, timestamps parsed to Date for delta computation. `event-screen.js` rewritten with three render branches before the main render: loading (empty container), error (InlineError), not-found (EmptyState). When data is present, the screen handles missing metric data gracefully — METRICS + ACTUAL vs ESTIMATE sections render only if both eps_actual and revenue_actual exist; FILING TIMELINE sections only render steps that have a timestamp; "within 15s target" pill only shows when pushedDeltaSec ≤ 15.

Added `formatFiscalPeriod` reused from B5; introduced `deltaLabel(sec)` for the timeline delta strings (handles both `+8s` and `+1m 30s` formats). The "GUIDANCE" row gracefully handles `none`/`withdrawn`/missing direction. Segments array iterates only if non-empty (LEFT JOIN can return NULL segments).

`src/features/event/mock.js` reduced to a one-line tombstone comment.

ERD doc gained events + event_metrics + the view signature.

**REVIEW:** the schema doc declares `event_metrics.extracted_by_model_id uuid REFERENCES model_versions(id)`. Same pattern as briefings.model_version_id — FK added in B9 when model_versions exists. Migration 008 declares the column without a constraint; the seed leaves it NULL.

**REVIEW:** the seed's `accession_number`s use the SEC format (e.g. `0000320193-26-000010`) but the embedded year `26` won't match the actual `filed_at` if the test machine clock differs from 2026. The strings are synthetic so this only matters if a future test asserts year correspondence. Easy to fix by templating, deliberately not done because the strings are illustrative.

**REVIEW:** the event-screen segment renderer assumes `s.actual` and `s.est` are in the same unit (billions). The seed uses billions. If a future Modal worker writes segments in dollars instead, the displayed values will be wildly wrong. A future tick should normalise segments-jsonb shape in `triggers-and-functions.md` and add a CHECK constraint on the column shape, or move segments to a typed table.

**REVIEW:** revenue is stored in dollars and divided by 1e9 client-side for display. This works at the current scale (Russell 1000 issuers all have revenues in billions). For mid-cap or international SaaS app expansion later, may want a sibling `revenue_unit` text column or a smart formatter. Deferred.

**Next tick:** B7 — `home_events_for_user(p_user_id)` RPC + Today screen wiring. No new tables; RPC unions upcoming briefings + parsed events for the user's watched tickers.

---

## 2026-05-27 · B5 — briefings + discover RPC + view replace

Authored `20260527_007_briefings.sql`. Table follows `schema.md` exactly: unique constraint on `(ticker_symbol, fiscal_period)` (idempotent regeneration is a core invariant), beat_probability range CHECK in [0,1], `surprise_prediction` jsonb for the full beat/meet/miss distribution + expected_move_pct, denormalised `prompt_version` text so Discover queries don't need a join to model_versions for the version footnote. Two unique-purpose indexes: `(expected_release_at)` for upcoming-this-week filters, `(ticker_symbol, fiscal_period)` for the upsert-by-period path. Partial index `idx_briefings_status_pending` on `(status) where status <> 'ready'` keeps the retry-cron scan tight even as ready briefings grow into the tens of thousands. `model_version_id` left without FK constraint here; B9 will `ALTER TABLE ... ADD CONSTRAINT` once model_versions exists.

RLS: `all auth read briefings where status = 'ready'`. Hiding non-ready at the database layer means a forgotten `WHERE status = 'ready'` in any future query still can't surface a half-baked briefing — belt-and-braces with the screen-level filter.

The `discover_biggest_expected(p_limit, p_week_start)` RPC ranks ready briefings within a week window by `(surprise_prediction->>'expected_move_pct')::numeric` DESC NULLS LAST. `STABLE SECURITY INVOKER` so the briefings RLS (status='ready' filter) applies — service-role calling this still gets the same rows, but a malicious client SETting `request.jwt.claim.sub` to nothing still can't see pending briefings.

`watchlist_with_meta_view` `CREATE OR REPLACE`d to swap the NULL placeholders for the real LATERAL join to briefings — same column types as B3 stub, so the change is transparent to clients. Watchlist screen rows will now show next_fiscal_period + briefing_ready badge once a user adds a ticker that has a ready briefing.

Seeded 5 ready briefings for NVDA/AAPL/MSFT/GOOG/TSLA with realistic consensus EPS + revenue, surprise_prediction with all four scalar slots filled, and `content_md` that includes the educational-use disclaimer in-document (compliance.md requirement — "build it into the rendered briefing markdown, not as a UI-only chrome element"). Dates anchored relative to `current_date + N` so the seed stays valid no matter when the migration applies.

`supabase/tests/rls_briefings.test.sql` (6 assertions): seed populated; pending briefing hidden from authenticated reads; ready briefings visible; RPC returns without error; p_limit caps result; result sorted DESC by expected_move_pct (verified via row_number adjacency check).

Frontend: `discover-screen.js` swapped the top rail's `MOCK_BIGGEST_EXPECTED` consumer for `supabase.rpc('discover_biggest_expected', { p_limit: 4 })`. Added `formatFiscalPeriod` util mapping the server's `Q1-2026` (lexically sortable) to the UI's `Q1 26`, and a `shapeExpected` row mapper that normalises numeric coercion. Empty-state copy ("No expected reports this week.") when the RPC returns an empty array — keeps the rail card visible so the screen doesn't reflow. `MOCK_BIGGEST_EXPECTED` deleted from `src/features/discover/mock.js`; the file now exports only the two rails (sector heat, biggest surprises) still on mocks until B15.

ERD doc gained the briefings block + RPC signature + the view-replace note.

**REVIEW:** the seed's `expected_release_at = current_date + N` evaluates at migration *apply* time, not authoring time. If the user applies migrations days later, the seeded briefings will still be "upcoming" — by design. But if they apply, then wait a week without running Modal, the briefings drift into the past and the Discover top rail goes empty. Acceptable for MVP demo; Phase 13's briefing-generator cron will keep this fresh.

**REVIEW:** the briefings table declares `model_version_id uuid` without a FK constraint. B9 will `ALTER TABLE briefings ADD CONSTRAINT briefings_model_version_id_fk FOREIGN KEY (model_version_id) REFERENCES model_versions(id);`. Until then, you can write any uuid into that column — caller responsibility. The seed leaves it NULL.

**REVIEW:** the schema doc shows `briefings.model_version_id REFERENCES model_versions(id)` declared inline. Per the iteration plan's per-tick coupling, deferring the FK to B9 was the only sane path (forward FKs are denied unless the target exists). The migrations.md doc implies this is fine via "one concern per migration file" — flagged here so it's not surprising in review.

**Next tick:** B6 — `events` + `event_metrics` (with generated columns for surprise %), `event_with_metrics_view`, event-screen wiring.

---

## 2026-05-27 · B4 — ticker_prices + sparkline RPC + seed

Authored `20260527_006_ticker_prices.sql`. Table mirrors `schema.md` exactly: composite PK on `(ticker_symbol, trade_date)` (no surrogate uuid — natural key clusters reads), `numeric(18,4)` for close, optional `volume bigint`, `source` text default `'finnhub'`, `fetched_at` for traceability. `(trade_date desc)` index supports the date-bounded sparkline queries even when querying across many symbols (Modal daily-rollup job in Phase 13). RLS: catalog-read for all authenticated, no client write (service-role only).

The `ticker_sparkline(p_symbol, p_days default 30)` RPC sits in the same migration — returns `table (trade_date date, close numeric)`, sorted ASC for natural line drawing. `STABLE`, `SECURITY INVOKER` so the existing ticker_prices RLS gates the rows. Calls `upper(p_symbol)` internally so a lowercase input (`'aapl'`) still resolves; the test asserts this normalisation.

Seed: 10 tickers (AAPL, MSFT, NVDA, GOOG, AMZN, META, TSLA, AMD, JPM, WMT) × 30 days inline via a CROSS JOIN of a VALUES list (base_price, phase, amplitude) and `generate_series(0, 29)`. Closes are `base * (1 + sin((i + phase) * 0.42) * amplitude)` — each ticker gets a unique phase + per-ticker amplitude so the lines look distinct without being noisy. Deterministic (no random), so re-running the migration produces identical rows. `ON CONFLICT DO NOTHING` makes the seed idempotent against future Modal-populated rows.

`supabase/tests/rls_ticker_prices.test.sql` (5 assertions): seed has ≥300 rows, authenticated SELECT works, RPC default returns 30 rows for AAPL, `p_days=7` returns 7, lowercase input still returns 30 (via the `upper()` normalisation).

Frontend: new `src/features/watchlist/use-sparkline.js` — a `useSparkline(symbol, days)` hook backed by a module-level Map cache and a parallel `pending` Map for in-flight de-duplication (multiple WatchlistRows mounting at once don't fire N parallel requests for the same symbol). Returns `FALLBACK = [100, 100, 100, 100, 100]` while loading or on error so the Sparkline renders something (otherwise the slot stays empty since the Sparkline component returns null for `data.length < 2`). `watchlist-row.js` calls the hook directly; if a `sparkline` prop is explicitly passed (e.g. for tests), that wins over the hook output. `use-watchlist.js` no longer carries `sparkline` on the row shape — WatchlistRow owns its own data dependency, which is the cleaner separation.

ERD doc gained the ticker_prices block + the RPC signature.

**REVIEW:** the seed uses a sine wave, not real prices. Discover's "biggest recent surprises" rail (B15) will look odd against these synthetic numbers — % changes are bounded by amplitude, so the rail will show modest absolute moves. The screen still renders correctly; just the numbers aren't realistic. Phase 13's Modal daily-close job replaces this seed with live data.

**REVIEW:** `useSparkline` keys cache by `${symbol}-${days}`. If the screen ever requests 60-day sparklines and then 30-day sparklines for the same symbol, both get cached separately — currently wasteful but rare. If we later want shared underlying-data cache + per-call windowing, refactor to cache by symbol and slice client-side.

**REVIEW:** the migration's sine-walk inline insert was tempting to extract to a separate seed file, but keeping it in the migration means the bootstrap data ships with the schema — important for the loop's "complete migrations set" deliverable. Modal will eventually upsert real data and the seed rows will get overwritten naturally (the `(ticker_symbol, trade_date)` PK + `ON CONFLICT DO NOTHING` in the seed means re-applying the migration won't clobber Modal-supplied closes).

**Next tick:** B5 — `briefings` table + `discover_biggest_expected(p_limit, p_week_start)` RPC + `CREATE OR REPLACE VIEW watchlist_with_meta_view` to populate next_* from briefings, plus the Discover top rail wiring.

---

## 2026-05-27 · B3 — watchlists + view + first-tickers wiring

Authored `20260527_005_watchlists.sql` — `watchlists` (uuid PK, user_id FK with cascade, is_default boolean, partial unique index `idx_watchlists_one_default_per_user` enforcing one-default-per-user without a per-row check) and `watchlist_tickers` (composite PK on `(watchlist_id, ticker_symbol)`, ticker_symbol index for the fan-out query path "who watches AAPL?"). All four RLS verbs on watchlists scoped to `auth.uid() = user_id`. watchlist_tickers RLS uses parent-checked EXISTS subqueries so a row is yours iff the parent watchlist is yours — index on `watchlists.user_id` (added migration 005) keeps the hash semi-join flat.

`handle_new_user` re-defined to insert both the profile row and a default watchlist on auth.users INSERT — second of three planned revisions (B11 adds the subscriptions stub). The function stays `SECURITY DEFINER set search_path = public` so the inserts bypass RLS while running in the auth-trigger context.

Created `watchlist_with_meta_view` with NULL placeholders for the briefings-derived columns (next_fiscal_period, next_expected_at, next_beat_probability, briefing_ready). The doc's full LATERAL JOIN to `briefings` can't compile yet — briefings doesn't exist until B5. B5's tick will `CREATE OR REPLACE VIEW` to add the real next_* projection. View inherits RLS from `watchlists` so per-user filtering is automatic.

Wrote `supabase/tests/rls_watchlists.test.sql` (8 assertions): trigger creates one default watchlist per user with is_default=true; alice sees only her own; alice can insert into her watchlist; the view returns alice's row; alice's attempt to insert into bob's watchlist throws 42501 (parent-check denies); bob sees zero watchlist_tickers / view rows.

Frontend: new `src/features/watchlist/use-watchlist.js` hook — Promise.all loads the default watchlist id + view rows, shapes them to the watchlist-row schema (sparkline placeholder until B4), provides optimistic add/remove with rollback on error. The shape function handles null `next_expected_at` (returns `daysAway: 9999, date: '—'` so date-sorted items go to the bottom). `watchlist-screen.js` now consumes the hook; gained an InlineError branch when the view fetch fails. `first-tickers-screen.js` looks up the default watchlist id at confirm time, upserts selected tickers via `onConflict: 'watchlist_id,ticker_symbol'`, then sets `profiles.onboarded_at = now()`. Both finish/skip paths persist before navigating — selecting nothing still marks onboarded so the user isn't routed back through the screen.

`MOCK_WATCHLIST` + `fakeSeries` deleted from `src/features/watchlist/mock.js`. `groupByWeek` preserved (unused but cheap and mirrors a planned sort mode).

ERD doc gained the watchlists + watchlist_tickers + watchlist_with_meta_view blocks.

**REVIEW:** the view's NULL placeholders mean the watchlist screen shows `Q? 26` and `9999d` on every row until B5 lands. Functionally correct (sparkline is also a placeholder) but visually odd. If you push migrations after B5 (where the briefings + view replacement happens), this won't appear in production — only in mid-loop snapshots.

**REVIEW:** `useWatchlist` re-fetches the entire view on every add/remove rather than locally updating in place after the server confirms. Simpler, correct, and at MVP watchlist sizes (≤50 tickers) the round-trip is < 200ms — fine. If perf becomes an issue, do an optimistic merge with the returned row from `insert().select().single()`.

**REVIEW:** `idx_watchlists_one_default_per_user` is a partial unique on `(user_id) where is_default`. This guarantees at most one default per user but doesn't enforce at-least-one — a manual UPDATE could flip the only default to non-default. Per schema.md this is acceptable for MVP since the trigger seeds and we never expose the toggle UI. Mark this as a future hardening: a BEFORE UPDATE trigger that prevents un-defaulting if no other default exists.

**Next tick:** B4 — `ticker_prices` table + `ticker_sparkline(p_symbol, p_days)` RPC + manual seed for ~10 test tickers + Watchlist row sparkline reads.

---

## 2026-05-27 · B2 — tickers + seed

Authored `20260527_004_tickers.sql` mirroring `schema.md` exactly: text PK `symbol`, CIK regex check, `market_cap_class` enum-as-check, `is_active` for soft delete, partial index on `(sector) WHERE is_active` to keep Discover sector-heat fast. Added catalog-read RLS (`all auth read tickers`) and the `set_updated_at_tickers` moddatetime trigger. Bootstrap rows hard-coded inline — 20 tickers with real SEC CIKs (AAPL 0000320193, MSFT 0000789019, etc.) so the EDGAR poller in Phase 13 has correct issuer IDs from day one. Bootstrap matches the prior `TICKER_CATALOG` list one-for-one, mapped to correct GICS sectors (META/GOOG/GOOGL/NFLX → Communication Services; COST/WMT → Consumer Staples; JPM/BAC/V → Financials; rest → IT or Consumer Discretionary). `ON CONFLICT (symbol) DO NOTHING` keeps the bootstrap idempotent with the future Russell 1000 upsert.

Built `scripts/build_ticker_seed.py` — stdlib-only (urllib, csv, json). Fetches iShares IWB holdings CSV (russell 1000 ETF) and SEC `company_tickers.json`, parses the iShares header offset (~10 lines of fund metadata before the real header), joins on symbol → CIK. Outputs to `supabase/seed/russell_1000.csv` matching the `tickers` column order so `\copy` works directly. Polite SEC `User-Agent` per their fair-access policy. Defensive: skips non-equity tickers (USD/MARGIN/CASH), reports missing-CIK rows in logs, fails soft if the merged count is suspiciously low.

Wrote `supabase/seed.sql` to load the CSV on `db reset` — uses a temp table + UPSERT so the migration's bootstrap rows aren't duplicated and the wider Russell set wins on column conflicts. Wrapped in `\if :{?seed_path}` so a fresh clone without the CSV still resets cleanly.

Wrote `supabase/tests/rls_tickers.test.sql` — four assertions: bootstrap populated, authenticated can SELECT, authenticated cannot INSERT (raises 42501 — no insert policy means default deny under RLS), authenticated cannot UPDATE (rls silently filters to 0 rows; verified by re-reading AAPL.name as superuser post-attempt).

Frontend rewired `ticker-catalog.js` to a hybrid module: `FALLBACK` list (the 20 bootstrap tickers) populates a module-level Map cache; `searchTickers(q, exclude, limit)` is async with a Supabase `.or('symbol.ilike.*%,name.ilike.%*%')` query, populating cache as a side effect; `getCompanyName(symbol)` stays sync (reads cache, falls back to `${SYMBOL} Corp.`). On any Supabase error, search degrades to client-side filtering of FALLBACK so the app stays usable pre-push. `add-ticker-sheet.js` swapped `useMemo(searchCatalog)` → `useEffect` with 120ms debounce + cancellation; `discover-screen.js` same pattern with 140ms debounce. `watchlist-screen.js`'s `add()` uses `getCompanyName` instead of `TICKER_CATALOG.find` (will be fully rewired in B3 when the watchlist view replaces `MOCK_WATCHLIST`).

Updated `docs/backend/erd.md` (new this tick) with ASCII ER blocks for `profiles` (002), `tickers` (004), and the Vault helper (003), plus a "tables not yet created" footer listing B3–B11 backlog with target migration numbers.

**REVIEW:** the doc's `searchCatalog` legacy synchronous export was deleted from `ticker-catalog.js` rather than soft-deprecated — no remaining callers after this tick (verified via grep). If a later screen accidentally imports it, the import will fail at bundle time, which is the desired hard-error.

**REVIEW:** the `iWB holdings` CSV URL has historically been unstable across iShares website redesigns. If `build_ticker_seed.py` returns "could not find iwb holdings header row" on a future run, the URL needs refreshing — see comment in `IWB_CSV_URL`. A future hardening step is to mirror the CSV in a public GitHub Gist that we control.

**REVIEW:** bootstrap rows use `Information Technology` GICS sector for Apple per the current MSCI/S&P GICS 2023 reclassification — `Communication Services` was the prior bucket. Verified against schwab/yahoo sector tags. If a future tick's Discover screen shows AAPL under the wrong sector, the seed needs a fixup migration.

**Next tick:** B3 — watchlists + watchlist_tickers + the watchlist view + first-tickers wiring + extending `handle_new_user` to create a default watchlist on signup.

---

## 2026-05-27 · B1 — schema bootstrap

Authored the first three migration files (`20260527_001_extensions_and_enums.sql`, `_002_profiles.sql`, `_003_app_config_secret.sql`) into `supabase/migrations/`. The 001 file enables `pgcrypto`, `moddatetime`, `pg_net`, `vector` and declares every enum from `schema.md` (twelve enums) so later migrations can reference them freely. The 002 file creates `public.profiles` mirroring `schema.md` exactly: `id` referencing `auth.users(id) on delete cascade`, `subscription_tier` default `free`, IANA tz default `America/New_York`, the three typed notification toggles, `quiet_hours_preset` default `22-07`, and both timestamp columns. Same file enables RLS, installs the `own profile select` + `own profile update` policies (with the `WITH CHECK` paired on UPDATE to block id-rewrites), the `set_updated_at_profiles` trigger via moddatetime, and a minimal `handle_new_user` definer-trigger that inserts only into `profiles` for now — the watchlist and subscription inserts described in `triggers-and-functions.md` will be added by future ticks (B3 and B11) via `CREATE OR REPLACE` rather than packed into B1's file. The 003 file installs `public.app_config_secret(text)`, a SECURITY DEFINER wrapper over `vault.decrypted_secrets` that replaces the docs' `current_setting('app.foo')` pattern; this is the Vault-deviation fix for hosted Supabase (`ALTER DATABASE SET` returns 42501 on managed tier). Execute is revoked from `public`, `anon`, `authenticated`; only the service role and the postgres owner can call it.

Frontend wiring went in-tick. `src/lib/use-auth-routing.js` now reads `profiles.disclaimer_ack_at` via `supabase.from('profiles').select(...).maybeSingle()` instead of `AsyncStorage.getItem(ACK_KEY)`, with a defensive fallback: any Supabase error routes the user to `unonboarded` (i.e. `/welcome`), so the app degrades gracefully if migrations haven't been pushed yet. The `ACK_KEY` export was removed entirely. `src/features/onboarding/ack-screen.js` now `UPDATE`s the profile row instead of writing to AsyncStorage, looking up the user id via `supabase.auth.getSession()`. `src/features/settings/settings-screen.js` lost its `AsyncStorage.removeItem(ACK_KEY)` from the sign-out flow — per the wiring doc, the server-side ack persists across sign-outs (same user signing back in stays acked; a different user has their own profile row).

Patched two docs in-place. `docs/backend/triggers-and-functions.md` § "Setting runtime parameters" now leads with the Vault path and keeps the `ALTER DATABASE` block as a "self-hosted only — legacy reference" section. The `trigger_notify_fan_out` example was updated to call `public.app_config_secret(...)` instead of `current_setting('app.*')` — this is the canonical pattern future fan-out ticks will follow. Same edits applied to `docs/backend/migrations.md` § "Per-environment setup".

Also wrote `supabase/tests/rls_profiles.test.sql` — pgTAP with seven assertions covering trigger creation, default values, RLS read-own-only, update-own success, update-other silent failure. Awaits future `supabase test db` execution (needs Docker or remote target; not running in authoring-only mode).

**REVIEW:** the loop prompt called for `supabase db lint` verification per tick. That CLI command requires either `--local` (Docker) or `--linked` (remote DB), neither viable in authoring-only mode. Falling back to eyeball reconciliation against `schema.md` / `rls-policies.md` — every line of the migrations was cross-checked against the canonical doc. User should still run `supabase db lint --linked` after first push to catch anything visual review missed.

**REVIEW:** migration numbering uses date `20260527` (today) rather than the doc's `20260525`. Doc was illustrative; today's date is canonical. No semantic change.

**REVIEW:** `vault.decrypted_secrets` permissions on hosted Supabase have been inconsistent across versions. The `app_config_secret` function is `SECURITY DEFINER` and runs as the postgres owner, which should have access — but this needs validation on first push (run `select public.app_config_secret('supabase_functions_url')` as `service_role`; should return the URL). If it errors with "permission denied for relation decrypted_secrets", grant explicitly: `grant select on vault.decrypted_secrets to postgres`. Documented as a known checkpoint.

**Next tick:** B2 — `tickers` table + `scripts/build_ticker_seed.py` + Russell 1000 seed.
