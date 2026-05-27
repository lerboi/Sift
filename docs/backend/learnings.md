# Backend loop — learnings

Durable, reusable patterns and gotchas surfaced during the build. Skim before starting a new tick.

---

## Hosted Supabase ≠ self-hosted Postgres

Several primitives in the docs assume self-hosted Postgres (`ALTER DATABASE SET`, full superuser, direct `pg_settings` manipulation). On hosted Supabase those return 42501. The workarounds:

| Self-hosted pattern | Hosted Supabase replacement |
| --- | --- |
| `ALTER DATABASE postgres SET app.foo = '...'` | `vault.create_secret('...', 'foo', ...)` |
| `current_setting('app.foo')` in triggers | `public.app_config_secret('foo')` (definer wrapper over `vault.decrypted_secrets`) |
| `CREATE EXTENSION ... CASCADE` for restricted exts | Pre-enable via Supabase dashboard → Database → Extensions; the migration uses `CREATE EXTENSION IF NOT EXISTS` after enable |
| Direct `pg_cron` install | Free tier has no `pg_cron`; ticks B17 (cron jobs) need `pg_cron` enabled via dashboard or scheduled from Modal as fallback |

When you see `current_setting('app.*')` in any doc, it's the legacy path — translate to Vault before writing the migration.

## RLS UPDATEs fail silently, not loudly

RLS-rejected UPDATEs return "0 rows affected", they don't throw. Write pgTAP tests as "verify row was not modified" using `is(...)` against a known-null value, not `throws_ok(...)`. Same for DELETEs.

## Migration file naming

`<YYYYMMDD>_<NNN>_<description>.sql`. The CLI generates a longer timestamp but the docs (and this project) abbreviate to date + a per-day counter. If you write more than one migration in a day, the counter resolves ordering — Postgres lexicographic sort puts `..._001_` before `..._002_`.

## handle_new_user is built incrementally

Per the iteration plan, the auth-trigger that auto-creates dependent rows (`profiles` + `watchlists` + `subscriptions`) is rolled out across three ticks (B1, B3, B11). Each ticks owns its own `CREATE OR REPLACE FUNCTION public.handle_new_user()` re-definition. Do not pack the full version into B1 — the referenced tables don't exist yet, the migration will fail.

## Defensive frontend wiring

Until `supabase db push` runs, all queries against the new tables 404. Wrap every new `from(...)` / `rpc(...)` in error-handling that degrades safely — show an InlineError, fall back to a safe default, or route to a harmless screen. Never let an undefined table cause a JS exception that white-screens the app.

Example: `useAuthRouting` treats a profile-fetch error as `unonboarded` (routes to `/welcome`) rather than `unauthed` (would loop the user back to sign-in).

## Views that reference yet-to-exist tables: NULL-placeholder + CREATE OR REPLACE

When migration N creates a view that conceptually depends on table M created later, write the view in N with `null::<type> as <col>` placeholders for the M-derived columns. Then migration M does `CREATE OR REPLACE VIEW` to swap in the real projection. The view exists across the whole migration sequence so frontend wiring doesn't get a "view not found" error mid-build.

**Critical: cast the placeholder to the EXACT type the real column will have.** `numeric` and `numeric(5,4)` look identical to a human but Postgres treats them as distinct types — `CREATE OR REPLACE VIEW` raises 42P16 if the new column's type differs from the placeholder's. Same for `text` vs `varchar(N)`, `timestamp` vs `timestamptz`, `int` vs `bigint`.

Concrete example bug we hit (fixed post-loop): `watchlist_with_meta_view` (migration 005) originally shipped with `null::numeric as next_beat_probability`. Migration 007 swapped that to `next_b.beat_probability` which is `numeric(5,4)`. Result: 42P16 on apply. Fix: change the placeholder to `null::numeric(5,4)`. Always cross-reference the target column's declaration before authoring the placeholder.

## Don't pack multi-stage trigger functions into one migration

Functions like `handle_new_user` end up needing to insert into multiple tables (profiles in B1, +watchlists in B3, +subscriptions in B11). Per the iteration plan, do not pack the full version into B1 and create empty stub tables — those tables would lack RLS and indexes. Instead `CREATE OR REPLACE FUNCTION` in each tick that adds a new dependent table. Each replacement is one of:

```sql
create or replace function public.handle_new_user() ... -- replaces prior body
```

The trigger binding (`on_auth_user_created`) doesn't need re-creation because it references the function by name, not body.

## Trigger fire order: use numeric prefixes, not "natural" names

Postgres fires per-event triggers in **alphabetical order of the trigger name**. The schema doc's "natural" naming (`notifications_before_insert_throttle`, `_quiet`) gets the order wrong: `q` (113) < `t` (116), so quiet would run before throttle — backwards from the intended semantic.

Fix: numeric prefixes. `notifications_before_insert_1_throttle`, `_2_quiet`. Explicit and impossible to misread.

## Defensive secrets in trigger helpers

Functions that read sensitive values from Vault should handle missing secrets gracefully:

```sql
v_url := public.app_config_secret('supabase_functions_url');
if v_url is null then return; end if;
```

Lets local dev / pgTAP tests run without a populated Vault, while production still fires fan-outs. A stricter alternative: `RAISE WARNING` (non-fatal) when missing in production, so logs surface the misconfig without breaking the insert.

## pg_cron is Pro+ only on hosted Supabase

Don't author a migration that requires `pg_cron` unconditionally. Wrap in `DO $$ BEGIN IF NOT FOUND ... END$$` so the migration applies on Free tier (with a NOTICE) and on Pro+ (with the schedules actually created). Phase 13 Modal worker is the Free-tier alternative for scheduled jobs.

## Don't pack all triggers into 016_triggers.sql

The schema doc's "one 016_triggers.sql" plan is aspirational. In practice triggers belong with the table they augment — `set_updated_at_profiles` in 002, RLS triggers per-table, fan-out triggers in their own file 015 because they cross-cut multiple tables and share `trigger_notify_fan_out`. Trade-off: lose the single "audit all triggers" file; gain easier per-tick reasoning. Trigger inventory can be reconstructed via `select * from pg_trigger where not tgisinternal`.
