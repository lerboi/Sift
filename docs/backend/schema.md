# Schema — table-by-table

Authoritative shape of every table. Constraints, indexes, enums, rationale. RLS policies live in [rls-policies.md](rls-policies.md); triggers/functions live in [triggers-and-functions.md](triggers-and-functions.md); views/RPCs in [views-and-rpcs.md](views-and-rpcs.md).

Two categories, same conventions:

- **Catalog tables** — `tickers`, `ticker_prices`, `briefings`, `events`, `event_metrics`, `transcripts`, `transcript_segments`, `transcript_analysis`, `model_versions`, `llm_calls`, `data_source_status`. No `user_id`. Globally shared, server-written.
- **User-owned tables** — `profiles`, `watchlists`, `watchlist_tickers`, `push_tokens`, `notifications`, `subscriptions`. Tagged by `user_id` (directly or via FK chain). RLS-locked.

---

## Enums

Defined once in `20260525_001_extensions.sql` (alongside extension enables) so every later migration can reference them.

```sql
CREATE TYPE event_source AS ENUM (
  'edgar',           -- 8-K detected via EDGAR poll
  'wire',            -- pre-market press wire detection
  'manual'           -- backfill or operator-inserted
);

CREATE TYPE parse_status AS ENUM (
  'pending',         -- detected, not yet parsed
  'parsed',          -- extraction succeeded, metrics populated
  'failed',          -- extraction failed; will retry
  'needs_review'     -- failed after retries OR output filter flagged
);

CREATE TYPE briefing_status AS ENUM (
  'pending',         -- queued for generation
  'ready',           -- generated and approved
  'needs_review'     -- forbidden-word filter or quality gate flagged
);

CREATE TYPE notification_kind AS ENUM (
  'briefing',        -- pre-earnings briefing ready
  'event',           -- 8-K filing detected
  'transcript'       -- post-call analysis ready
);

CREATE TYPE notification_status AS ENUM (
  'pending',         -- queued, not yet sent
  'sent',            -- handed to Expo Push (200 OK)
  'delivered',       -- receipt confirmed delivery
  'failed',          -- Expo or APNS/FCM error
  'skipped_quiet'    -- in quiet hours; rescheduled
);

CREATE TYPE push_platform AS ENUM ('ios', 'android');

CREATE TYPE model_kind AS ENUM (
  'surprise_classifier',
  'briefing_prompt',
  'extraction_prompt',
  'transcript_summary'
);

CREATE TYPE model_status AS ENUM ('staged', 'active', 'retired');

CREATE TYPE tone AS ENUM ('bullish', 'neutral', 'bearish');

CREATE TYPE guidance_direction AS ENUM ('raised', 'maintained', 'lowered', 'withdrawn', 'none');

CREATE TYPE subscription_tier AS ENUM ('free', 'pro');

CREATE TYPE speaker_role AS ENUM ('executive', 'analyst', 'operator', 'other');
```

Enums constrain inserts and self-document. Adding values is a one-line migration (`ALTER TYPE ... ADD VALUE`). Removing values is harder; prefer adding new ones over re-assigning meaning.

---

## Catalog tables

### `tickers`

The issuer catalog. Seeded once from Russell 1000 + SEC company tickers JSON; refreshed quarterly. No `user_id` — everyone reads.

```sql
CREATE TABLE tickers (
  symbol            text PRIMARY KEY,
  name              text NOT NULL,
  cik               text NOT NULL,           -- SEC central index key, zero-padded to 10 digits
  exchange          text NOT NULL,            -- 'NYSE' | 'NASDAQ' | 'AMEX'
  sector            text NOT NULL,            -- GICS sector
  industry          text,                      -- GICS industry (one level deeper)
  market_cap_class  text NOT NULL DEFAULT 'large',  -- 'small' | 'mid' | 'large' | 'mega'
  is_active         boolean NOT NULL DEFAULT true,
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tickers_symbol_uppercase CHECK (symbol = upper(symbol)),
  CONSTRAINT tickers_cik_format       CHECK (cik ~ '^[0-9]{10}$')
);

CREATE INDEX idx_tickers_sector       ON tickers (sector) WHERE is_active;
CREATE INDEX idx_tickers_cik          ON tickers (cik);
CREATE INDEX idx_tickers_is_active    ON tickers (is_active);
```

**Rationale:**
- PK on `symbol` (not uuid) — symbol is the natural key everywhere in the app and in EDGAR. A uuid surrogate would add a join with no benefit.
- `cik` is needed for every EDGAR API call; cache it here to avoid an extra lookup. Constrain format to catch seed bugs.
- `is_active` flag for Russell 1000 reconstitution — annual changes; never hard-delete (preserves event/briefing history references).
- `market_cap_class` for future filtering on Discover ("biggest expected" sliced by class).

### `ticker_prices`

Daily closes. Used by Watchlist sparklines (last 30) and Discover surprise rail context. Could grow to intraday later; today scope is end-of-day.

```sql
CREATE TABLE ticker_prices (
  ticker_symbol  text NOT NULL REFERENCES tickers(symbol) ON UPDATE CASCADE,
  trade_date     date NOT NULL,
  close          numeric(18, 4) NOT NULL,
  volume         bigint,
  source         text NOT NULL DEFAULT 'finnhub',
  fetched_at     timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (ticker_symbol, trade_date)
);

CREATE INDEX idx_ticker_prices_date ON ticker_prices (trade_date DESC);
```

**Rationale:**
- Composite PK is natural and clusters reads by ticker (Postgres uses heap, not clustered indexes, but the PK is the most common lookup key).
- `source` for traceability — `finnhub` MVP, could swap to alpha_vantage.
- 30-day sparkline = `SELECT close FROM ticker_prices WHERE ticker_symbol = ? AND trade_date >= now() - interval '30 days' ORDER BY trade_date`. With the PK that's an index scan.

### `briefings`

Pre-earnings briefings, one per `(ticker_symbol, fiscal_period)`. LLM-generated. Globally shared.

```sql
CREATE TABLE briefings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker_symbol         text NOT NULL REFERENCES tickers(symbol) ON UPDATE CASCADE,
  fiscal_period         text NOT NULL,                              -- 'Q1-2026' (ISO-like, sortable)
  expected_release_at   timestamptz NOT NULL,                       -- from Finnhub calendar
  consensus_eps         numeric(10, 4),
  consensus_revenue     numeric(18, 2),                              -- USD
  beat_probability      numeric(5, 4),                               -- 0.0000–1.0000
  surprise_prediction   jsonb,                                        -- {"beat":0.41,"meet":0.32,"miss":0.27,"expected_move_pct":0.052}
  content_md            text,                                         -- LLM output, markdown
  prompt_version        text,                                         -- denormalised from model_versions for query speed
  model_version_id      uuid REFERENCES model_versions(id),
  status                briefing_status NOT NULL DEFAULT 'pending',
  generated_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT briefings_unique_per_period UNIQUE (ticker_symbol, fiscal_period),
  CONSTRAINT briefings_beat_probability_range CHECK (beat_probability IS NULL OR (beat_probability >= 0 AND beat_probability <= 1))
);

CREATE INDEX idx_briefings_expected_release_at ON briefings (expected_release_at);
CREATE INDEX idx_briefings_ticker_period       ON briefings (ticker_symbol, fiscal_period);
CREATE INDEX idx_briefings_status              ON briefings (status) WHERE status != 'ready';  -- hot for retry cron
```

**Rationale:**
- `fiscal_period` as `Q1-2026` (not `Q1 26`) because the dash form sorts lexically by year. The frontend displays `Q1 26`; the server stores the sortable form.
- `expected_release_at` is the public earnings calendar timestamp. The actual filing time goes on `events.filed_at`.
- `surprise_prediction` is jsonb because the shape is informational — we want both the full distribution and the expected-move scalar, may add fields (volatility cone, sector-relative) without a schema change.
- `beat_probability` lifted out of jsonb because Discover queries SELECT it for sorting; jsonb extraction is slower.
- `prompt_version` denormalised (kept in sync via trigger) so Discover's "MODEL — biggest expected" doesn't need a join for the version footnote.
- `status` enum gates whether the row is shown to users. `pending` (queued, no content yet) and `needs_review` (forbidden-word filter caught something) both hide. `ready` shows.

### `events`

8-K filings (and future 10-Q / 10-K). One row per filing per ticker.

```sql
CREATE TABLE events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker_symbol     text NOT NULL REFERENCES tickers(symbol) ON UPDATE CASCADE,
  accession_number  text NOT NULL,                               -- SEC accession, e.g. '0000320193-26-000010'
  form_type         text NOT NULL,                               -- '8-K', future '10-Q', '10-K'
  item_number       text,                                         -- '2.02' for earnings
  fiscal_period     text NOT NULL,                                -- 'Q4-2025' — joins to briefings
  source            event_source NOT NULL DEFAULT 'edgar',
  expected_at       timestamptz,                                  -- nullable: wire-detected events may not have scheduled time
  filed_at          timestamptz NOT NULL,                          -- from EDGAR filing index
  detected_at       timestamptz NOT NULL DEFAULT now(),            -- when our poller saw it; latency analysis
  parsed_at         timestamptz,                                   -- when LLM extraction completed
  pushed_at         timestamptz,                                   -- when fan-out fired (analytics)
  exhibit_url       text,                                          -- Exhibit 99.1 URL
  storage_path      text,                                          -- raw HTML cache in Storage
  parse_status      parse_status NOT NULL DEFAULT 'pending',
  parse_error       text,
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT events_accession_unique UNIQUE (accession_number)
);

CREATE INDEX idx_events_ticker_filed_desc ON events (ticker_symbol, filed_at DESC);
CREATE INDEX idx_events_filed_at_desc      ON events (filed_at DESC);
CREATE INDEX idx_events_parse_status       ON events (parse_status) WHERE parse_status != 'parsed';
CREATE INDEX idx_events_ticker_period      ON events (ticker_symbol, fiscal_period);
```

**Rationale:**
- `accession_number` unique guarantees EDGAR poll idempotency — re-seeing a filing is a no-op insert.
- `source` distinguishes EDGAR-confirmed from wire-detected provisional events (per `data-sources.md` § Press wires).
- `expected_at` separate from `filed_at`: scheduled vs actual. The frontend's `state` derivation reads both.
- Three timestamps for the realtime latency budget: `filed_at → detected_at → parsed_at → pushed_at`. Each gap is independently measurable.
- `(ticker_symbol, filed_at DESC)` is the index for ticker detail's past-events list.
- Partial index on `parse_status` skips the 99% of rows that are `parsed`.

### `event_metrics`

The extracted numbers per event. One-to-one with `events`; separate table because metrics population is a distinct pipeline step that may lag the event row.

```sql
CREATE TABLE event_metrics (
  event_id              uuid PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  eps_actual            numeric(10, 4),
  eps_est               numeric(10, 4),
  eps_surprise_pct      numeric(10, 6) GENERATED ALWAYS AS (
                          CASE
                            WHEN eps_est IS NULL OR eps_est = 0 THEN NULL
                            ELSE (eps_actual - eps_est) / eps_est
                          END
                        ) STORED,
  revenue_actual        numeric(18, 2),
  revenue_est           numeric(18, 2),
  revenue_surprise_pct  numeric(10, 6) GENERATED ALWAYS AS (
                          CASE
                            WHEN revenue_est IS NULL OR revenue_est = 0 THEN NULL
                            ELSE (revenue_actual - revenue_est) / revenue_est
                          END
                        ) STORED,
  guidance_direction    guidance_direction,
  guidance_detail       text,
  segments              jsonb,                                      -- [{"name":"Services","actual":24.5,"est":23.8}, ...]
  extracted_by_model_id uuid REFERENCES model_versions(id),
  extracted_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_metrics_surprise ON event_metrics (eps_surprise_pct) WHERE eps_surprise_pct IS NOT NULL;
```

**Rationale:**
- **Generated columns for surprise %** — defined once in DDL, can't be wrong from any consumer. `STORED` so they're indexable for Discover's "biggest recent surprises" rail.
- `CASE` handles divide-by-zero (when est is 0 or NULL).
- `guidance` split into typed direction + free text — direction is enum-constrained for filtering; detail is the human paragraph.
- `segments` jsonb because the shape varies wildly between issuers (AAPL has Services/iPhone/Wearables; banks have Wealth/Investment/Consumer; tech has Cloud/Software/Hardware). A typed segments table is over-engineering until we need to query within.
- Cascade delete from `events` — if an event row is purged (rare), its metrics go with it.

### `transcripts`

Earnings call transcripts. One per (ticker, fiscal_period).

```sql
CREATE TABLE transcripts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker_symbol   text NOT NULL REFERENCES tickers(symbol) ON UPDATE CASCADE,
  fiscal_period   text NOT NULL,
  call_date       date NOT NULL,
  source          text NOT NULL,                                  -- 'earningscalls' | 'api_ninjas' | 'motley_fool'
  storage_path    text NOT NULL,                                  -- raw text cache in Storage
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT transcripts_unique_per_period UNIQUE (ticker_symbol, fiscal_period)
);

CREATE INDEX idx_transcripts_ticker_call_date ON transcripts (ticker_symbol, call_date DESC);
```

### `transcript_segments`

Per-segment text + embedding. Used for novelty detection (cosine distance to prior transcripts) and for the Ticker-detail "transcript snippets" UI.

```sql
CREATE TABLE transcript_segments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id  uuid NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  segment_order  integer NOT NULL,
  speaker        text,
  role           speaker_role NOT NULL DEFAULT 'other',
  content        text NOT NULL,
  embedding      vector(1536),                                    -- OpenAI text-embedding-3-small or Cohere
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT transcript_segments_unique_order UNIQUE (transcript_id, segment_order)
);

CREATE INDEX idx_transcript_segments_transcript ON transcript_segments (transcript_id, segment_order);
CREATE INDEX idx_transcript_segments_embedding  ON transcript_segments USING hnsw (embedding vector_cosine_ops);
```

**Rationale:**
- `vector(1536)` matches OpenAI `text-embedding-3-small` and Cohere `embed-v3` default. If we change embedding models, migrate via a `transcript_segments_v2` table — vector dimensions are fixed per column.
- HNSW index for approximate nearest-neighbour queries. Recall ≈ 95% out of the box; tune `m` and `ef_construction` only if we observe missed neighbours.

### `transcript_analysis`

LLM-generated analysis per transcript. One-to-one with `transcripts`.

```sql
CREATE TABLE transcript_analysis (
  transcript_id      uuid PRIMARY KEY REFERENCES transcripts(id) ON DELETE CASCADE,
  tone               tone NOT NULL,
  tone_score         numeric(5, 4),                                -- -1.0000 (bearish) to 1.0000 (bullish)
  novel_topics       jsonb,                                         -- ["foundry diversification", "services pricing"]
  guidance_changes   jsonb,                                         -- {"direction":"raised","previous":"maintained",...}
  summary_md         text,                                          -- LLM summary, markdown
  model_version_id   uuid REFERENCES model_versions(id),
  generated_at       timestamptz NOT NULL DEFAULT now()
);
```

### `model_versions`

Registry for every ML / LLM artefact. Modal writes, the app reads `status='active'`.

```sql
CREATE TABLE model_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          model_kind NOT NULL,
  version       text NOT NULL,                                     -- semver: '1.2.0'
  storage_path  text,                                               -- for model files (joblib, ONNX)
  sha256        text,                                               -- integrity check
  metrics       jsonb,                                               -- {"logloss":0.91,"brier":0.18,...}
  status        model_status NOT NULL DEFAULT 'staged',
  notes         text,                                                -- human notes on what changed
  created_at    timestamptz NOT NULL DEFAULT now(),
  promoted_at   timestamptz,

  CONSTRAINT model_versions_unique_version UNIQUE (kind, version)
);

CREATE UNIQUE INDEX idx_model_versions_one_active
  ON model_versions (kind)
  WHERE status = 'active';
```

**Rationale:**
- Partial unique index enforces "exactly one `active` per `kind`" without per-row checks. Trying to set a second `active` row is a constraint violation.
- Promotion is a manual `UPDATE` (or a separate `promote_model_version()` function). Caught regressions stay in `staged` without affecting prod.

### `llm_calls`

Per-call cost + latency audit. Append-only. No RLS — service_role only.

```sql
CREATE TABLE llm_calls (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            text NOT NULL,                                    -- 'briefing' | 'extraction' | 'transcript_summary' | 'tone'
  provider        text NOT NULL,                                    -- 'anthropic' | 'openai'
  model           text NOT NULL,                                    -- 'claude-haiku-4-5' | 'gpt-4o-mini'
  prompt_version  text,
  input_tokens    integer,
  output_tokens   integer,
  cost_usd        numeric(10, 6),
  latency_ms      integer,
  success         boolean NOT NULL,
  error           text,
  reference_id    uuid,                                              -- briefing.id / event.id / transcript.id
  reference_kind  text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_llm_calls_created_at ON llm_calls (created_at DESC);
CREATE INDEX idx_llm_calls_kind_model ON llm_calls (kind, model);
```

Aggregated by daily Modal cron into a dashboard. Lets us catch runaway prompts before the bill arrives.

### `data_source_status`

Provider health, scraped by a 5-minute heartbeat. Used for an admin screen (later) and for Modal to refuse to use a known-broken provider.

```sql
CREATE TABLE data_source_status (
  source              text PRIMARY KEY,                              -- 'edgar' | 'finnhub' | 'earningscalls' | ...
  last_success_at     timestamptz,
  last_error_at       timestamptz,
  last_error          text,
  success_count_24h   integer NOT NULL DEFAULT 0,
  error_count_24h     integer NOT NULL DEFAULT 0,
  updated_at          timestamptz NOT NULL DEFAULT now()
);
```

---

## User-owned tables

### `profiles`

Extends `auth.users` with app fields. Auto-created on signup by trigger (see [triggers-and-functions.md](triggers-and-functions.md)).

```sql
CREATE TABLE profiles (
  id                    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name          text,
  tier                  subscription_tier NOT NULL DEFAULT 'free',
  tz                    text NOT NULL DEFAULT 'America/New_York',  -- IANA name
  disclaimer_ack_at     timestamptz,                                 -- the P9-3 onboarding gate; null = needs ack
  onboarded_at          timestamptz,                                 -- set on first-tickers screen confirm
  notify_briefings      boolean NOT NULL DEFAULT true,
  notify_events         boolean NOT NULL DEFAULT true,
  notify_transcripts    boolean NOT NULL DEFAULT false,
  quiet_hours_preset    text NOT NULL DEFAULT '22-07',               -- 'off' | '22-07' | '23-08' | '21-07' | 'overnight'
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_tier ON profiles (tier);
```

**Rationale:**
- `id` is the same uuid as `auth.users.id`. No surrogate. Cascade delete from `auth.users` cleans up cleanly on account deletion.
- **`disclaimer_ack_at`** is the server-side replacement for the local `ACK_KEY` AsyncStorage flag in `src/lib/use-auth-routing.js`. Server-source means new device → still needs ack (current behaviour); same device after sign-out → also needs ack (matches the sign-out-clears-ack pattern).
- **`onboarded_at`** distinguishes "user finished P9-5 first-ticker setup" from "user just ack'd the disclaimer." Lets Settings show "Resume onboarding" if they bailed mid-flow.
- **Typed notification toggles instead of jsonb** — three fixed kinds. Adding a fourth (e.g. `notify_weekly_digest`) is a one-line ALTER. Querying "give me users who want briefings" is `WHERE notify_briefings = true`, no jsonb extraction.
- **`tz` for quiet hours** in IANA format (`America/New_York`). Default to ET because Sift is US-equity-only; non-US users override via Settings later.
- `quiet_hours_preset` matches the 5 presets in `src/features/settings/quiet-hours-sheet.js`. The server enforces; the client displays.

### `watchlists`

N watchlists per user. MVP creates one named `'Default'` on signup; the multi-watchlist UI is post-MVP.

```sql
CREATE TABLE watchlists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL DEFAULT 'Default',
  is_default  boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_watchlists_user ON watchlists (user_id);
CREATE UNIQUE INDEX idx_watchlists_one_default_per_user ON watchlists (user_id) WHERE is_default;
```

### `watchlist_tickers`

N:N between watchlists and tickers.

```sql
CREATE TABLE watchlist_tickers (
  watchlist_id    uuid NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  ticker_symbol   text NOT NULL REFERENCES tickers(symbol) ON UPDATE CASCADE,
  added_at        timestamptz NOT NULL DEFAULT now(),
  sort_order      integer,                                           -- nullable; null = sort by added_at

  PRIMARY KEY (watchlist_id, ticker_symbol)
);

CREATE INDEX idx_watchlist_tickers_ticker ON watchlist_tickers (ticker_symbol);  -- fan-out queries: "who watches AAPL"
```

**Rationale:**
- `(watchlist_id, ticker_symbol)` is the natural composite PK.
- `ticker_symbol` index is critical for fan-out: when a new event for AAPL arrives, the `notify_user_event` function queries `SELECT user_id FROM watchlists w JOIN watchlist_tickers wt ON wt.watchlist_id = w.id WHERE wt.ticker_symbol = 'AAPL'`. Without this index it's a sequential scan.
- `sort_order` nullable because R5's Watchlist redesign deliberately deferred drag-reorder (the list is calendar-sorted by next earnings, not user-ordered). When/if a manual sort mode lands, `sort_order` is ready.

### `push_tokens`

Per-device push tokens. Updated on every cold start via `last_seen_at` bump. Garbage-collected by a daily cron after 30 days of no `last_seen` update.

```sql
CREATE TABLE push_tokens (
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token         text NOT NULL,
  platform      push_platform NOT NULL,
  device_id     text,                                                -- for debugging; nullable
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, token)
);

CREATE INDEX idx_push_tokens_user      ON push_tokens (user_id);
CREATE INDEX idx_push_tokens_last_seen ON push_tokens (last_seen_at);
```

### `notifications`

Per-user delivery record. Source of truth for retries, dedupe, and audit.

```sql
CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind            notification_kind NOT NULL,
  ticker_symbol   text NOT NULL REFERENCES tickers(symbol) ON UPDATE CASCADE,
  reference_id    uuid,                                              -- briefing.id / event.id / transcript.id
  reference_kind  text,                                              -- 'briefing' | 'event' | 'transcript'
  title           text NOT NULL,
  body            text NOT NULL,
  deep_link       text NOT NULL,                                     -- 'sift://events/<id>'
  status          notification_status NOT NULL DEFAULT 'pending',
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  scheduled_for   timestamptz,                                       -- for quiet-hours deferral
  sent_at         timestamptz,
  delivered_at    timestamptz
);

CREATE INDEX idx_notifications_user_created      ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_status            ON notifications (status) WHERE status IN ('pending', 'skipped_quiet', 'failed');
CREATE INDEX idx_notifications_user_ticker_day   ON notifications (user_id, ticker_symbol, (created_at::date));  -- for throttle gate
```

**Rationale:**
- `title` + `body` materialised because Expo Push needs them at send time; computing from `reference_id` at fan-out adds JSON marshalling per row.
- `scheduled_for` for quiet-hours support — if a notification lands inside quiet hours, it gets `status='skipped_quiet'` and `scheduled_for = end_of_quiet_hours`. Cron picks them up at the next tick.
- `(user_id, ticker_symbol, created_at::date)` index supports the **3-pushes-per-ticker-per-day throttle gate** without a separate `push_throttle` table. Counted in a `BEFORE INSERT` trigger.

### `subscriptions`

RevenueCat mirror. Post-MVP stub; the table exists now so the Settings PLAN row's path forward is wired.

```sql
CREATE TABLE subscriptions (
  user_id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                 text NOT NULL DEFAULT 'free',                 -- 'free' | 'pro_monthly' | 'pro_annual'
  status               text NOT NULL DEFAULT 'inactive',             -- 'active' | 'inactive' | 'in_grace_period' | 'cancelled'
  current_period_end   timestamptz,
  source               text NOT NULL DEFAULT 'none',                 -- 'revenuecat' | 'stripe' | 'none'
  raw                  jsonb,                                         -- whatever the source sent
  updated_at           timestamptz NOT NULL DEFAULT now()
);
```

Sync from RevenueCat webhook to a future Edge Function. For MVP, every user has the default row (`plan='free', status='inactive'`) — `profiles.tier` is kept in sync via trigger so RLS / feature-gating reads stay simple.

---

## Cardinality summary

```
auth.users                  ─1:1─→  profiles
                            ─1:1─→  subscriptions
                            ─1:N─→  watchlists ─1:N─→ watchlist_tickers ─N:1─→ tickers
                            ─1:N─→  push_tokens
                            ─1:N─→  notifications

tickers                     ─1:N─→  ticker_prices
                            ─1:N─→  briefings (1 per fiscal_period)
                            ─1:N─→  events ─1:1─→ event_metrics
                            ─1:N─→  transcripts ─1:N─→ transcript_segments
                                                  ─1:1─→ transcript_analysis

model_versions              referenced by briefings, event_metrics, transcript_analysis

llm_calls                   append-only audit, no FKs (reference_id is loose)
data_source_status          singleton-per-source
```

Total: **17 tables**. Catalog: 11. User-owned: 5. Audit/observability: 1.
