# Migrations — ordered plan

Every change to the database is a numbered migration file in `supabase/migrations/`. Forward-only, never edited after `supabase db push`.

## File naming

`<timestamp>_<NNN>_<description>.sql`

- `<timestamp>` — `YYYYMMDD` (the CLI generates `YYYYMMDDHHMMSS`; we abbreviate to date because we don't do more than one migration per day at MVP cadence; the per-day counter NNN handles ordering)
- `<NNN>` — 3-digit zero-padded counter within the day's batch
- `<description>` — snake_case, terse, what it adds (`profiles`, `tickers_seed`, `rls_policies_user_tables`)

Example: `20260525_001_extensions.sql`

## The MVP migration tree

Ordered. Each migration applies cleanly against the previous state. Run with `supabase db reset` locally to verify, then `supabase db push` to apply to a remote project.

```
supabase/
  config.toml                              ← project config
  migrations/
    20260525_001_extensions_and_enums.sql
    20260525_002_profiles.sql
    20260525_003_tickers.sql
    20260525_004_ticker_prices.sql
    20260525_005_watchlists.sql
    20260525_006_briefings.sql
    20260525_007_events_and_metrics.sql
    20260525_008_transcripts.sql
    20260525_009_model_versions.sql
    20260525_010_notifications_and_push.sql
    20260525_011_subscriptions.sql
    20260525_012_audit_tables.sql
    20260525_013_rls_policies.sql
    20260525_014_views.sql
    20260525_015_rpcs.sql
    20260525_016_triggers.sql
    20260525_017_pgcron_jobs.sql
  functions/
    notify_user_event/
      index.ts
      deno.json
    cleanup_old_notifications/
      index.ts
    retry_skipped_pushes/
      index.ts
    gc_stale_push_tokens/
      index.ts
  seed/
    russell_1000.csv                      ← used by tickers seed migration
  tests/
    rls_profiles.test.sql
    rls_watchlists.test.sql
    rls_notifications.test.sql
    fn_home_events_for_user.test.sql
```

## What each migration does

| # | File | Purpose |
| --- | --- | --- |
| 001 | `extensions_and_enums.sql` | Enable `pgcrypto`, `pgvector`, `moddatetime`, `pg_net`. Declare all enum types from [schema.md](schema.md). |
| 002 | `profiles.sql` | Create `profiles` table (extends `auth.users`). Triggers + RLS deferred to 013/016. |
| 003 | `tickers.sql` | Create `tickers` table. Add seed for Russell 1000 from `seed/russell_1000.csv` via `COPY`. |
| 004 | `ticker_prices.sql` | Create `ticker_prices` table. Empty — Modal populates via daily cron from Finnhub. |
| 005 | `watchlists.sql` | Create `watchlists` + `watchlist_tickers` tables. |
| 006 | `briefings.sql` | Create `briefings` table. |
| 007 | `events_and_metrics.sql` | Create `events` + `event_metrics` tables. `event_metrics.eps_surprise_pct` / `revenue_surprise_pct` generated columns defined here. |
| 008 | `transcripts.sql` | Create `transcripts`, `transcript_segments` (with `vector(1536)` + HNSW index), `transcript_analysis` tables. |
| 009 | `model_versions.sql` | Create `model_versions` table + partial unique index for one-active-per-kind. |
| 010 | `notifications_and_push.sql` | Create `notifications` + `push_tokens` tables. |
| 011 | `subscriptions.sql` | Create `subscriptions` table (post-MVP stub, populated by future RevenueCat webhook). |
| 012 | `audit_tables.sql` | Create `llm_calls` + `data_source_status`. |
| 013 | `rls_policies.sql` | One file. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + every policy from [rls-policies.md](rls-policies.md). Why bundled: easier to audit "is every table protected" by looking at one file. |
| 014 | `views.sql` | All views from [views-and-rpcs.md](views-and-rpcs.md) — `upcoming_earnings`, `briefing_ready_view`, `event_with_metrics_view`, `watchlist_with_meta_view`. |
| 015 | `rpcs.sql` | All RPC functions — `home_events_for_user`, `discover_*`, `ticker_detail_timeline`, `ticker_sparkline`. |
| 016 | `triggers.sql` | All triggers + their backing functions — `handle_new_user`, `sync_profile_tier`, `enforce_push_throttle`, `enforce_quiet_hours`, `notify_on_briefing_ready`, `notify_on_event_parsed`, `set_updated_at_*`, `sync_briefing_prompt_version`. Also the `trigger_notify_fan_out` helper. |
| 017 | `pgcron_jobs.sql` | `cron.schedule(...)` for `cleanup-old-notifications`, `retry-skipped-pushes`, `gc-stale-push-tokens`, optional `sector-heat-refresh`. |

## Why this ordering

- **Extensions before everything** — `pgvector` needed for transcript_segments; `pgcrypto` for `gen_random_uuid()`; enums must exist before tables that use them.
- **`profiles` before `watchlists`** — FK dependency.
- **Tables before policies** — RLS targets specific tables; can't reference non-existent ones.
- **Tables before views** — views reference table columns.
- **Tables + views before RPCs** — RPCs query both.
- **Everything before triggers** — triggers reference functions; functions reference tables, views, and other functions.
- **Triggers before pg_cron jobs** — cron jobs call helper functions defined alongside triggers.

## Per-environment setup (run manually, not as a migration)

Two settings must be applied to each environment AFTER `supabase db push` but BEFORE triggers fire:

```sql
ALTER DATABASE postgres SET app.supabase_functions_url = 'https://<project-ref>.functions.supabase.co';
ALTER DATABASE postgres SET app.service_role_key      = '<sb_secret_...>';
```

These aren't migrations because (a) the values differ per env, (b) the service role key must never live in a git-committed file. Document them in `supabase/README.md` (to be written during the build).

## Seeding `tickers`

The Russell 1000 + SEC `company_tickers.json` snapshot lives in `seed/russell_1000.csv` — a one-time generator script (`scripts/build_ticker_seed.py`, to be written) merges:

1. iShares Russell 1000 ETF holdings CSV (free download).
2. SEC's `https://www.sec.gov/files/company_tickers.json` for CIK mapping.
3. GICS sector + industry from a chosen source (Finnhub or static manual mapping).

Output columns match `tickers` schema. The migration uses:

```sql
\copy tickers (symbol, name, cik, exchange, sector, industry, market_cap_class)
  FROM 'seed/russell_1000.csv' WITH (FORMAT csv, HEADER true);
```

Refresh annually (Russell rebalance in June). Future re-seed migration replaces rows by `is_active = false` for delisted, INSERTs new constituents.

## Local development loop

```bash
# Initialise once
supabase init
supabase link --project-ref <your-ref>

# Edit migration file. Test locally:
supabase db reset                              # wipes local, replays all migrations
supabase test db                                # runs supabase/tests/*.test.sql

# Apply to remote:
supabase db push
```

`supabase db reset` is the safety net — if a migration is order-dependent or syntactically wrong, the local reset catches it before remote push.

## Edge function deployment

Separate from migrations:

```bash
supabase functions deploy notify_user_event
supabase functions deploy cleanup_old_notifications
# etc
```

Each function lives under `supabase/functions/<name>/`. Code is JS/TS, runtime is Deno.

For local development:

```bash
supabase functions serve notify_user_event --env-file .env.local
```

## Rollback strategy

Forward-only migrations means rollback is itself a new migration:

```
20260601_001_revert_subscription_status_enum.sql      -- DROP TYPE ... CASCADE if needed
```

Never edit a previously-applied file. The `supabase_migrations.schema_migrations` table tracks applied versions; out-of-order edits desync local from remote silently.

## Backup before destructive migrations

Any migration that `DROP TABLE`, `DROP COLUMN`, or non-trivially `ALTER` an existing column gets:

1. A `pg_dump` of the affected tables to local first (`pg_dump --table=<t> > backup.sql`).
2. A note in the migration file's header comment with the date + size of the backup.

MVP migrations are mostly `CREATE` — destructive operations are rare and conscious.

## Verifying the schema is applied

```sql
-- Check enabled extensions
SELECT extname, extversion FROM pg_extension;

-- Check tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Check RLS is on
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;
-- This should return EMPTY. Any tables here are unprotected.

-- Check pending migrations
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;
```

Run these after every `supabase db push` to a fresh env.
