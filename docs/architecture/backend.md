# Backend Architecture (Supabase)

One-page overview. **For the working detail, read [`docs/backend/`](../backend/README.md).** That folder contains:

- `schema.md` — every table, column, constraint, index, with rationale
- `rls-policies.md` — every row-level-security policy
- `triggers-and-functions.md` — DB triggers + edge functions (fan-out, throttle, quiet hours)
- `realtime.md` — channel patterns for in-foreground UX
- `views-and-rpcs.md` — derived data (Home feed, Discover rails, ticker detail)
- `migrations.md` — ordered migration plan + per-environment setup
- `frontend-wiring.md` — surface-by-surface query map
- `iteration-plan.md` — per-tick build sequence (loop contract for Phase 12)
- `conventions.md` — Supabase + Postgres best practices

When this doc and `docs/backend/` disagree, `docs/backend/` wins.

---

## What Supabase does for Sift

Four jobs:

1. **Auth** — PKCE flow, email + Google OAuth, session persisted on device (encrypted via the storage adapter from P10-4).
2. **Postgres** — the source of truth: users, watchlists, tickers, briefings, events, transcripts, signals, model_versions, push_tokens, notifications.
3. **Storage** — cold cache of raw SEC filings + transcript files + ML model artefacts. Private buckets, signed URLs.
4. **Edge Functions** — `notify_user_event` fans out push notifications when a fresh briefing or event lands; `cleanup_old_notifications` / `retry_skipped_pushes` / `gc_stale_push_tokens` run on `pg_cron`.

Plus **Realtime channels** for the in-foreground UX (the "X new events" pill on Home; live event refresh on ticker detail).

## High-level data model

```
auth.users                  ─1:1─→  profiles
                            ─1:1─→  subscriptions
                            ─1:N─→  watchlists ─1:N─→ watchlist_tickers ─N:1─→ tickers
                            ─1:N─→  push_tokens
                            ─1:N─→  notifications

tickers (no owner)          ─1:N─→  ticker_prices
                            ─1:N─→  briefings (1 per fiscal_period)
                            ─1:N─→  events ─1:1─→ event_metrics
                            ─1:N─→  transcripts ─1:N─→ transcript_segments
                                                  ─1:1─→ transcript_analysis

model_versions (no owner)   referenced by briefings, event_metrics, transcript_analysis
llm_calls                   append-only audit
data_source_status          singleton-per-source
```

Two visible patterns:

- **User-owned data** carries `user_id` and is RLS-locked to `auth.uid() = user_id`.
- **Catalog data** has no owner — every authenticated user reads the same rows. This is the architectural payoff for backend AI: one compute per ticker, broadcast to all watchers.

Total: 17 tables. See [schema.md](../backend/schema.md) for every column.

## RLS in one paragraph

Default-deny on every table. Three roles: `anon` (never used at runtime), `authenticated` (signed-in users; `auth.uid()` identifies them), `service_role` (Modal + edge functions only; bypasses RLS). User-owned tables: `auth.uid() = user_id`. Catalog tables: `SELECT TO authenticated USING (true)`, no write policy — only service_role writes. Realtime inherits RLS. Full policy text in [rls-policies.md](../backend/rls-policies.md).

## Push fan-out pipeline

```
event INSERT (parse_status='parsed')
  ↓ trigger
notify_on_event_parsed → trigger_notify_fan_out (pg_net → HTTP POST)
  ↓
Edge Function notify_user_event
  ↓
SELECT user_id FROM watchlist_tickers WHERE ticker_symbol = ?
filter by notification_prefs
INSERT notifications (BEFORE INSERT: throttle + quiet-hours triggers)
  ↓
POST to https://exp.host/--/api/v2/push/send (batched ≤100)
  ↓
update notifications.status to 'sent' / 'failed'
```

Throttle (3/ticker/day) and quiet-hours deferral are enforced by Postgres triggers, not the Edge Function — that way every code path that inserts a notification is gated automatically. Full mechanics in [triggers-and-functions.md](../backend/triggers-and-functions.md).

## Storage layout

| Bucket | Visibility | Contents |
| --- | --- | --- |
| `raw-filings` | private | `edgar/8K/{accession}.html`, `edgar/exhibits/{accession}/99.1.html` |
| `transcripts` | private | `{ticker}/{fiscal_period}.txt`, `{ticker}/{fiscal_period}.json` |
| `models` | private (signed URLs for Modal) | `surprise_classifier/{version}.joblib`, `briefing_prompts/{version}.json` |
| `public-assets` | public | `ticker-logos/{symbol}.png` |

## Migrations

`supabase/migrations/` is the authoritative shape. 17 migration files for the MVP schema, ordered. Apply with `supabase db push`; test locally with `supabase db reset`. **Forward-only** — once pushed, never edit; new changes go in new files. Full ordering + per-environment setup in [migrations.md](../backend/migrations.md).

## What this overview deliberately doesn't cover

- Modal worker code (lives under `modal/` when written; see [`ml-pipeline.md`](ml-pipeline.md))
- React Native client implementation (lives under `src/`; see [`frontend.md`](frontend.md))
- Dashboard configuration (Supabase Auth providers, redirect URL allowlist) — see [`docs/backend/iteration-plan.md` § Pre-loop checklist](../backend/iteration-plan.md#pre-loop-checklist-user-action-before-b1-fires) for the user-action checklist
