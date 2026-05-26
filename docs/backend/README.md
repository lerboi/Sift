# Sift Backend Plan

Detailed specs for the Supabase backend. The loop reads these when building backend phases.

[`docs/architecture/backend.md`](../architecture/backend.md) stays as the one-page overview; this folder is the working detail.

## Read order

1. **[conventions.md](conventions.md)** — Supabase + Postgres best practices we follow. Read once, internalise.
2. **[schema.md](schema.md)** — every table, every column, every index. The authoritative shape.
3. **[rls-policies.md](rls-policies.md)** — security model. Every table is default-deny.
4. **[triggers-and-functions.md](triggers-and-functions.md)** — auto-profile-on-signup, `updated_at`, push-throttle gate, edge functions.
5. **[realtime.md](realtime.md)** — channel patterns for in-foreground UX.
6. **[views-and-rpcs.md](views-and-rpcs.md)** — derived data (Home feed, Discover rails, ticker detail composition).
7. **[frontend-wiring.md](frontend-wiring.md)** — every screen → exact query/mutation. Cross-reference when wiring a screen.
8. **[migrations.md](migrations.md)** — ordered migration files; what each does; how to apply.
9. **[iteration-plan.md](iteration-plan.md)** — per-tick build sequence the loop executes.

## Naming

| Concern | Convention |
| --- | --- |
| Tables | snake_case, plural (`tickers`, `briefings`, `event_metrics`) |
| Columns | snake_case |
| Foreign keys | `<table>_id` for uuid, `<table>_symbol` for symbol-keyed (only `ticker_symbol`) |
| Booleans | `is_*` or `has_*` prefix |
| Timestamps | always `timestamptz`, never `timestamp`. `_at` suffix (`created_at`, `filed_at`, `disclaimer_ack_at`) |
| JSONB | `_json` not needed; just name the field (`payload`, `metrics`, `guidance`) |
| Indexes | `idx_<table>_<columns>` |
| RLS policies | `<verb> <scope>` (e.g. `"own profile select"`, `"all auth read tickers"`) |

## What's owned by whom

| Role | Reads | Writes |
| --- | --- | --- |
| `anon` | Nothing. Every screen requires sign-in. | Nothing |
| `authenticated` (signed-in user) | Own user-data + all catalog data | Own user-data only |
| `service_role` (Modal workers, edge functions) | Everything | Everything. Used by EDGAR poller, briefing generator, fan-out function. **Never exposed to clients.** |

`service_role` writes are how the catalog stays globally consistent: one model output per ticker, broadcast to all watchers.

## Design choices worth knowing up-front

| Choice | Why |
| --- | --- |
| Catalog data has no `user_id` | One compute, many readers. Aligns with backend-AI ADR and compliance "impersonal" prong. |
| `profiles.id = auth.users.id` (no extra surrogate) | Lets RLS clauses be `auth.uid() = id` directly; cascade delete is automatic. |
| `briefings` unique on `(ticker_symbol, fiscal_period)` | Idempotent regeneration — re-running the generator never duplicates. |
| `events` unique on `accession_number` | Idempotent EDGAR poll — re-seeing a filing never duplicates. |
| Generated columns for surprise % | Eliminates "every consumer recomputes" drift. Stored, indexed. |
| Postgres enums for fixed value sets | `event_source`, `parse_status`, `model_status`, etc. — type-safe and self-documenting. We accept the migration cost when adding values. |
| Typed `notification_prefs` columns on `profiles`, not jsonb | Three fixed kinds + quiet hours; jsonb would over-rotate. |
| Default-deny RLS everywhere | Single audit lens: any row exposed without a policy is a bug. |
| Edge Function for fan-out, not Modal | One fewer environment to debug; trigger fires automatically on INSERT. (Reversible — see triggers-and-functions.md.) |
| Embedded sparkline data in `ticker_prices`, not jsonb on `tickers` | Time-series shape; future intraday extension is just more rows. |

## What this folder does NOT cover

- Modal worker code (lives under `modal/` when written; see [`ml-pipeline.md`](../architecture/ml-pipeline.md))
- React Native client implementation (lives under `src/`; see [`frontend.md`](../architecture/frontend.md))
- Dashboard configuration (Supabase Auth providers, redirect URL allowlist) — `iteration-plan.md` flags these as user-action steps interleaved with code work

## Source of truth

When any doc here disagrees with `docs/architecture/backend.md`, **this folder wins**. The architecture doc is the one-pager; this folder is the working detail.
