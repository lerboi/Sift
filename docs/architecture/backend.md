# Backend Architecture (Supabase)

Supabase is doing four jobs for us: **auth**, **Postgres**, **storage** (cold cache for raw filings and transcripts), and **edge functions** (the notification fan-out). Plus Realtime channels for "you're looking at AAPL when a fresh briefing lands" UX.

This doc is the schema design + RLS principles. **Nothing here is migrated yet** — it's the target shape we'll create when we write the first migration.

## High-level model

```
users (Supabase Auth)
  └─ profiles 1:1                 ← extends auth.users with app fields
       └─ watchlists 1:N
            └─ watchlist_tickers N:N → tickers
       └─ push_tokens 1:N
       └─ notifications 1:N        ← per-user delivery records
       └─ subscriptions 1:1        ← (later) RevenueCat mirror

tickers (no owner)
  └─ briefings 1:N                ← per fiscal period
  └─ events 1:N                   ← 8-K filings, parsed
       └─ event_metrics 1:1       ← extracted numbers (revenue, eps, …)
  └─ transcripts 1:N
       └─ transcript_segments 1:N
       └─ transcript_analysis 1:1

model_versions (no owner)         ← ML / LLM artefact registry
```

Two visible patterns:
- **User-owned data** carries `user_id` (FK to `auth.users.id`) and is fully RLS-locked.
- **Catalog data** (tickers, briefings, events, transcripts) is *globally shared* — every user reads the same row. This is the architectural payoff for backend AI: we compute once per ticker, not once per user.

## Schema sketches

### `profiles`

| col | type | notes |
| --- | --- | --- |
| `id` | uuid PK | FK → `auth.users.id`, cascade delete |
| `display_name` | text | |
| `created_at` | timestamptz | default `now()` |
| `notification_pref` | jsonb | `{ briefings, events, transcripts }` booleans |
| `tier` | text | `'free' | 'pro'`. Mirrored from RevenueCat later. |

### `tickers`

| col | type | notes |
| --- | --- | --- |
| `symbol` | text PK | e.g. `'AAPL'`. Uppercase, no exchange suffix at MVP. |
| `name` | text | |
| `sector` | text | |
| `industry` | text | |
| `cik` | text | SEC central index key, zero-padded. Needed for EDGAR queries. |
| `is_active` | bool | for Russell 1000 reconstitution |
| `updated_at` | timestamptz | |

Seed this from Russell 1000 + SEC company tickers JSON once. Refresh quarterly.

### `watchlists` + `watchlist_tickers`

| col | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `user_id` | uuid FK | RLS-owner |
| `name` | text | "Default" for the first one |
| `created_at` | timestamptz | |

```sql
watchlist_tickers (
  watchlist_id uuid REFERENCES watchlists(id) ON DELETE CASCADE,
  ticker_symbol text REFERENCES tickers(symbol),
  added_at timestamptz default now(),
  PRIMARY KEY (watchlist_id, ticker_symbol)
);
```

### `briefings` (pre-earnings, LLM-generated, shared)

| col | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `ticker_symbol` | text FK | |
| `fiscal_period` | text | e.g. `'Q1-2026'` |
| `expected_release_at` | timestamptz | from Finnhub calendar |
| `consensus_eps` | numeric | |
| `consensus_revenue` | numeric | |
| `surprise_prediction` | jsonb | `{ beat: 0.41, meet: 0.32, miss: 0.27 }` |
| `content_md` | text | LLM output in markdown |
| `prompt_version` | text | for prompt-engineering A/B tracking |
| `model_version_id` | uuid FK | → `model_versions` |
| `generated_at` | timestamptz | |

Unique on `(ticker_symbol, fiscal_period)` — one briefing per ticker per quarter, idempotent regeneration.

### `events` (8-K filings, parsed)

| col | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `ticker_symbol` | text FK | |
| `accession_number` | text | SEC accession, unique identifier |
| `form_type` | text | `'8-K'`, future-proof for 10-Q etc. |
| `item_number` | text | `'2.02'` for earnings releases |
| `filed_at` | timestamptz | |
| `detected_at` | timestamptz | when our poller saw it (latency analysis) |
| `exhibit_url` | text | URL to Exhibit 99.1 (raw release) |
| `storage_path` | text | nullable; populated when we cache HTML in Storage |
| `parse_status` | text | `pending | parsed | failed` |
| `parse_error` | text | nullable |

Unique on `accession_number`.

### `event_metrics`

| col | type | notes |
| --- | --- | --- |
| `event_id` | uuid PK FK | |
| `revenue` | numeric | |
| `revenue_yoy` | numeric | % change |
| `eps` | numeric | |
| `eps_yoy` | numeric | |
| `guidance` | jsonb | next-quarter / fy guidance ranges |
| `segment_breakdown` | jsonb | revenue/op-income by segment |
| `surprise_pct` | numeric | (actual - consensus) / consensus |
| `extracted_by` | text | LLM model id, for traceability |
| `extracted_at` | timestamptz | |

### `transcripts` + analysis

```sql
transcripts (
  id uuid PK,
  ticker_symbol text FK,
  fiscal_period text,
  call_date date,
  source text,            -- 'earningscalls.dev' | 'api_ninjas' | etc
  storage_path text,      -- cold cache in Storage
  fetched_at timestamptz,
  UNIQUE (ticker_symbol, fiscal_period)
);

transcript_segments (
  id uuid PK,
  transcript_id uuid FK,
  speaker text,
  role text,              -- 'analyst' | 'executive'
  segment_order int,
  text text,
  embedding vector(1536)  -- pgvector, for novelty detection
);

transcript_analysis (
  transcript_id uuid PK FK,
  tone_shift jsonb,       -- {bearish, neutral, bullish} deltas vs prior call
  novel_topics jsonb,     -- topics not in last 4 transcripts
  guidance_changes jsonb,
  summary_md text,
  model_version_id uuid FK,
  generated_at timestamptz
);
```

Needs the `pgvector` extension — Supabase supports it natively (Dashboard → Database → Extensions).

### `notifications`

| col | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `kind` | text | `'briefing' | 'event' | 'transcript'` |
| `payload` | jsonb | `{ ticker, event_id, title, body, deep_link }` |
| `status` | text | `'pending' | 'sent' | 'delivered' | 'failed'` |
| `error` | text | nullable |
| `created_at` | timestamptz | |
| `sent_at` | timestamptz | nullable |

Mirrors what Expo Push tells us. Source of truth for retries and audit.

### `push_tokens`

| col | type | notes |
| --- | --- | --- |
| `user_id` | uuid FK | |
| `token` | text | Expo push token |
| `platform` | text | `'ios' | 'android'` |
| `last_seen_at` | timestamptz | bump on each app open |
| `created_at` | timestamptz | |

PK = `(user_id, token)`. Tokens rotate occasionally; delete on `404 DeviceNotRegistered` from Expo Push.

### `model_versions`

| col | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `kind` | text | `'surprise_classifier' | 'briefing_prompt' | 'transcript_summary'` |
| `version` | text | semver |
| `storage_path` | text | for model files (joblib, ONNX) |
| `sha256` | text | |
| `metrics` | jsonb | precision/recall/etc on holdout |
| `status` | text | `'staged' | 'active' | 'retired'` |
| `created_at` | timestamptz | |
| `promoted_at` | timestamptz | nullable |

Only one `active` row per `kind` at a time (enforce with partial unique index). Modal writes here; Modal also reads `active` to pick the model for inference.

## Row-level security (RLS) principles

**Default-deny everywhere.** Every table has RLS enabled. Policies are written narrowly per role.

Three logical roles:
- `anon` — never used at runtime. App always signs the user in.
- `authenticated` — a user, identified by `auth.uid()`.
- `service_role` — only used by Modal workers, via `sb_secret_...` key in Modal Secret. Bypasses RLS.

### User-owned tables

```sql
-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile update" ON profiles FOR UPDATE USING (auth.uid() = id);
-- insert handled by trigger on auth.users creation
```

Same pattern for `watchlists`, `push_tokens`, `notifications`, `subscriptions` — match on `user_id = auth.uid()`. `watchlist_tickers` checks the parent watchlist:

```sql
CREATE POLICY "wt read" ON watchlist_tickers FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM watchlists w
    WHERE w.id = watchlist_id AND w.user_id = auth.uid()
  )
);
```

### Catalog tables

```sql
-- tickers / briefings / events / event_metrics / transcripts / transcript_*
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all auth can read briefings" ON briefings FOR SELECT TO authenticated USING (true);
-- no INSERT / UPDATE policy → only service_role can write
```

Pattern: **read = `TO authenticated USING (true)`, write = service-role only**. Modal is the only thing that writes catalog data; users only read it.

### Realtime

Realtime subscriptions inherit RLS. If you `subscribe` to `briefings`, you get every insert. If you `subscribe` to `notifications`, you only get rows where `user_id = auth.uid()`. That's the intent.

For Sift specifically: clients should subscribe to **notifications** (per-user) and optionally to **briefings/events filtered by their watchlist** (broadcast firehose; cheap). Document the channels:

- `realtime:public:notifications:user_id=eq.<uuid>` — per-user
- `realtime:public:events:ticker_symbol=in.(AAPL,MSFT,…)` — opt-in by screen

## Edge functions

One function at MVP: `notify_user_event`.

```
trigger: INSERT on briefings | events | transcript_analysis
purpose: fan out per-watcher notifications + push delivery

steps:
  1. given a new briefing/event for ticker T:
     SELECT distinct user_id
     FROM watchlists w
     JOIN watchlist_tickers wt ON wt.watchlist_id = w.id
     WHERE wt.ticker_symbol = T
  2. for each user:
       INSERT into notifications (user_id, kind, payload, status='pending')
  3. for each user:
       fetch push_tokens
       POST batch to https://exp.host/--/api/v2/push/send
       update notifications.status based on receipt
```

Run it from Modal instead of as an Edge Function if you want lower complexity (one fewer environment to debug). The pros of Edge Functions: triggered automatically by DB inserts, no separate cron. The cons: Deno runtime, JSR imports, can be fiddly. **Decision pending** — both work. Recording it here so future-you knows it's an open call.

## Storage layout

Bucket `raw-filings` (private):
```
raw-filings/
  edgar/8K/{accession_number}.html
  edgar/exhibits/{accession_number}/99.1.html
```

Bucket `transcripts` (private):
```
transcripts/
  {ticker}/{fiscal_period}.txt
  {ticker}/{fiscal_period}.json     ← speaker-tagged
```

Bucket `models` (private, signed-URL access for Modal):
```
models/
  surprise_classifier/{version}.joblib
  briefing_prompts/{version}.json
```

Bucket `public-assets` (public):
```
public-assets/
  ticker-logos/{symbol}.png         ← Clearbit or similar (verify licensing)
```

## Migrations

Use **Supabase CLI** (`supabase migration new …`) so migrations are versioned in git. Don't click-through the dashboard. The migration tree should look like:

```
supabase/
  migrations/
    20260512_000_extensions.sql       enable pgvector
    20260512_001_profiles.sql
    20260512_002_tickers_seed.sql
    20260512_003_watchlists.sql
    20260512_004_catalog.sql          briefings, events, event_metrics
    20260512_005_transcripts.sql
    20260512_006_notifications.sql
    20260512_007_model_versions.sql
    20260512_008_rls_policies.sql
    20260512_009_edge_functions/      function code
```

Apply locally with `supabase db reset` (wipes + replays). Push to remote with `supabase db push`. The CLI keeps a `schema_migrations` table to track applied state.

## Things to design after MVP

- **Soft delete** on user data (gdpr export + 30-day recovery window).
- **Audit log** on RLS-bypass writes (anything via service-role).
- **Read replicas** when query latency on `briefings` joins gets uncomfortable. Supabase Pro tier.
- **Partitioning** on `events` by quarter if the table gets fat. Years away.
