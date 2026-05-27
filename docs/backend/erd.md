# ER diagram — Sift backend

ASCII because GitHub renders it monospace and it survives copy-paste into reviews. Updated incrementally per tick. Numbers in parens indicate the migration where each table was created.

Legend:
- `─►` references (FK, with cardinality on the side)
- `[PK]` primary key, `[FK]` foreign key, `*` not null
- `{enum}` postgres enum type

```
                                     ┌───────────────────────────┐
                                     │ auth.users                │
                                     │   id  uuid [PK]           │
                                     │   email                   │
                                     │   raw_user_meta_data jsonb│
                                     └────────┬──────────────────┘
                                              │ 1:1 (cascade)
                                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ profiles  (002)                                                  │
│   id                    uuid [PK, FK auth.users(id)]             │
│   display_name          text                                     │
│   tier                  {subscription_tier} *  default 'free'    │
│   tz                    text *               default 'America/NY'│
│   disclaimer_ack_at     timestamptz                              │
│   onboarded_at          timestamptz                              │
│   notify_briefings      boolean *            default true        │
│   notify_events         boolean *            default true        │
│   notify_transcripts    boolean *            default false       │
│   quiet_hours_preset    text *               default '22-07'     │
│   created_at, updated_at  timestamptz *      default now()       │
│                                                                  │
│   trigger: on_auth_user_created → handle_new_user (DEFINER)      │
│            set_updated_at_profiles (moddatetime)                 │
│   rls: own select / own update (auth.uid()=id; with check)       │
└──────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────┐
│ tickers  (004)                       ← catalog, no user_id       │
│   symbol             text [PK]                                   │
│   name               text *                                      │
│   cik                text *  check ~ '^[0-9]{10}$'               │
│   exchange           text *                                      │
│   sector             text *                                      │
│   industry           text                                        │
│   market_cap_class   text *  default 'large'                     │
│                              check in (small/mid/large/mega)     │
│   is_active          boolean *  default true                     │
│   updated_at         timestamptz *  default now()                │
│                                                                  │
│   constraint: symbol = upper(symbol)                             │
│   indexes: (sector) where is_active, (cik), (is_active)          │
│   trigger: set_updated_at_tickers (moddatetime)                  │
│   rls: all auth read; no client write (service-role only)        │
│   seed: 20 bootstrap rows from migration 004;                    │
│         full russell-1000 via scripts/build_ticker_seed.py +     │
│         supabase/seed.sql (db reset) or psql \copy               │
└──────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────┐
│ vault.secrets (managed by supabase)                              │
│   supabase_functions_url  → consumed by app_config_secret(name)  │
│   service_role_key        → consumed by app_config_secret(name)  │
└──────────────────────────────────────────────────────────────────┘

  helper: public.app_config_secret(text) returns text  (003)
          SECURITY DEFINER over vault.decrypted_secrets
          execute revoked from public/anon/authenticated
```

┌──────────────────────────────────────────────────────────────────┐
│ watchlists  (005)                                                │
│   id           uuid [PK]                                         │
│   user_id      uuid [FK auth.users(id)] *  cascade               │
│   name         text *      default 'Default'                     │
│   is_default   boolean *   default true                          │
│   created_at   timestamptz *                                     │
│                                                                  │
│   indexes: (user_id), unique partial (user_id) where is_default  │
│   rls: own select/insert/update/delete (auth.uid()=user_id)      │
│   trigger: on_auth_user_created seeds 1 row on signup            │
└──────────────────────────────────────────────────────────────────┘
                  │ 1
                  ▼ N
┌──────────────────────────────────────────────────────────────────┐
│ watchlist_tickers  (005)                                         │
│   watchlist_id   uuid  [FK watchlists] *  cascade                │
│   ticker_symbol  text  [FK tickers]    *  on update cascade      │
│   added_at       timestamptz *                                   │
│   sort_order     integer                                         │
│   PK (watchlist_id, ticker_symbol)                               │
│                                                                  │
│   index: (ticker_symbol) — used by notify_user_event fanout      │
│   rls: parent-checked via EXISTS(watchlists where user_id=uid)   │
└──────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────┐
│ VIEW watchlist_with_meta_view  (005)                             │
│   per-user denormalised watchlist row with next-earnings meta.   │
│   user_id, symbol, name, sector, added_at, sort_order,           │
│   next_fiscal_period, next_expected_at, next_beat_probability,   │
│   briefing_ready.                                                │
│   B3: next_* columns NULL (briefings table doesn't exist yet).   │
│   B5: CREATE OR REPLACE adds LATERAL join to briefings.          │
│   rls inherits from underlying tables (watchlists.user_id).      │
└──────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────┐
│ ticker_prices  (006)                  ← catalog, no user_id      │
│   ticker_symbol  text [FK tickers] *  on update cascade          │
│   trade_date     date *                                          │
│   close          numeric(18,4) *                                 │
│   volume         bigint                                          │
│   source         text *  default 'finnhub'                       │
│   fetched_at     timestamptz *                                   │
│   PK (ticker_symbol, trade_date)                                 │
│                                                                  │
│   index: (trade_date desc)                                       │
│   rls: all auth read; no client write (service-role only)        │
│   seed (006): 10 tickers x 30 daily closes (sine-walk synthetic) │
│   modal phase 13: replaces seed with real finnhub daily closes   │
└──────────────────────────────────────────────────────────────────┘

  RPC: public.ticker_sparkline(p_symbol text, p_days int = 30)     (006)
       returns table (trade_date date, close numeric)
       SECURITY INVOKER (rls of ticker_prices applies)
       STABLE


┌──────────────────────────────────────────────────────────────────┐
│ briefings  (007)                       ← catalog, no user_id     │
│   id                    uuid [PK]                                │
│   ticker_symbol         text [FK tickers] *  on update cascade   │
│   fiscal_period         text *  'Q1-2026' sortable               │
│   expected_release_at   timestamptz *                            │
│   consensus_eps         numeric(10,4)                            │
│   consensus_revenue     numeric(18,2)                            │
│   beat_probability      numeric(5,4)  check in [0,1]             │
│   surprise_prediction   jsonb                                    │
│   content_md            text                                     │
│   prompt_version        text                                     │
│   model_version_id      uuid  (FK added in B9)                   │
│   status                {briefing_status} *  default 'pending'   │
│   generated_at          timestamptz                              │
│   created_at, updated_at  timestamptz *                          │
│                                                                  │
│   unique (ticker_symbol, fiscal_period)                          │
│   indexes: (expected_release_at), (ticker_symbol, fiscal_period),│
│            partial (status) where status <> 'ready'              │
│   rls: select to authenticated where status='ready'              │
│   trigger: set_updated_at_briefings (moddatetime)                │
│   seed (007): 5 ready briefings for NVDA/AAPL/MSFT/GOOG/TSLA     │
└──────────────────────────────────────────────────────────────────┘

  RPC: public.discover_biggest_expected(                              (007)
         p_limit int = 4,
         p_week_start date = date_trunc('week', current_date)
       )
       returns table (ticker_symbol, ticker_name, fiscal_period,
                      expected_release_at, beat_probability,
                      expected_move_pct)
       STABLE SECURITY INVOKER — rls of briefings applies (ready only)

  watchlist_with_meta_view CREATE OR REPLACE (007): next_* now populated
  from briefings via LATERAL join (was NULL placeholders in B3).


┌──────────────────────────────────────────────────────────────────┐
│ events  (008)                          ← catalog, no user_id     │
│   id                uuid [PK]                                    │
│   ticker_symbol     text [FK tickers] *  on update cascade       │
│   accession_number  text *  unique                               │
│   form_type         text *  '8-K'/'10-Q'/'10-K'                  │
│   item_number       text   '2.02' for earnings                   │
│   fiscal_period     text *                                       │
│   source            {event_source} *  default 'edgar'            │
│   expected_at       timestamptz                                  │
│   filed_at          timestamptz *                                │
│   detected_at       timestamptz *  default now()                 │
│   parsed_at         timestamptz                                  │
│   pushed_at         timestamptz                                  │
│   exhibit_url       text                                         │
│   storage_path      text                                         │
│   parse_status      {parse_status} *  default 'pending'          │
│   parse_error       text                                         │
│   created_at        timestamptz *                                │
│                                                                  │
│   indexes: (ticker_symbol, filed_at desc), (filed_at desc),      │
│            partial (parse_status) where <> 'parsed',             │
│            (ticker_symbol, fiscal_period)                        │
│   rls: select to authenticated where parse_status in             │
│        ('parsed','failed')   — pending hidden                    │
│   seed (008): 3 parsed events (AAPL Q4-25, NVDA Q4-25, TSLA Q1-26)│
└──────────────────────────────────────────────────────────────────┘
                  │ 1:1 (cascade)
                  ▼
┌──────────────────────────────────────────────────────────────────┐
│ event_metrics  (008)                                             │
│   event_id              uuid [PK, FK events]  on delete cascade  │
│   eps_actual            numeric(10,4)                            │
│   eps_est               numeric(10,4)                            │
│   eps_surprise_pct      numeric  GENERATED STORED                │
│                         (eps_actual - eps_est) / nullif(eps_est,0)│
│   revenue_actual        numeric(18,2)                            │
│   revenue_est           numeric(18,2)                            │
│   revenue_surprise_pct  numeric  GENERATED STORED                │
│   guidance_direction    {guidance_direction}                     │
│   guidance_detail       text                                     │
│   segments              jsonb                                    │
│   extracted_by_model_id uuid  (FK added in B9)                   │
│   extracted_at          timestamptz *                            │
│                                                                  │
│   index: partial (eps_surprise_pct) where not null               │
│   rls: parent-checked via EXISTS(events parsed)                  │
└──────────────────────────────────────────────────────────────────┘

  VIEW public.event_with_metrics_view  (008)
       e + tickers.name/sector + LEFT JOIN event_metrics
       filtered to parse_status in ('parsed','failed')
       used by event-screen via supabase.from(view).eq('id', id).maybeSingle()


  RPC: public.home_events_for_user(p_user_id uuid)                  (009)
       returns table (state text, ticker_symbol, ticker_name,
                      fiscal_period, expected_at, actual_at, briefing_id,
                      beat_probability, eps_actual, eps_est, surprise_pct,
                      briefing_ready, reference_id)
       union of:
         upcoming (briefings status=ready, expected_release_at in [-6h, +30d])
         live_and_past (parsed events in last 30d; live = filed < 15min ago)
       STABLE SECURITY INVOKER — rls of underlying tables applies.


┌──────────────────────────────────────────────────────────────────┐
│ transcripts  (010)                     ← catalog, no user_id     │
│   id              uuid [PK]                                      │
│   ticker_symbol   text [FK tickers] *  on update cascade         │
│   fiscal_period   text *                                         │
│   call_date       date *                                         │
│   source          text *  'earningscalls' | 'api_ninjas' | etc   │
│   storage_path    text *                                         │
│   fetched_at, created_at  timestamptz *                          │
│                                                                  │
│   unique (ticker_symbol, fiscal_period)                          │
│   index: (ticker_symbol, call_date desc)                         │
│   rls: all auth read                                             │
│   seed (010): 1 AAPL Q4-2025 transcript                          │
└──────────────────────────────────────────────────────────────────┘
                  │ 1
                  ▼ N
┌──────────────────────────────────────────────────────────────────┐
│ transcript_segments  (010)                                       │
│   id              uuid [PK]                                      │
│   transcript_id   uuid [FK transcripts] *  on delete cascade     │
│   segment_order   integer *                                      │
│   speaker         text                                           │
│   role            {speaker_role} *  default 'other'              │
│   content         text *                                         │
│   embedding       vector(1536)                                   │
│   created_at      timestamptz *                                  │
│                                                                  │
│   unique (transcript_id, segment_order)                          │
│   indexes: (transcript_id, segment_order),                       │
│            HNSW (embedding vector_cosine_ops)                    │
│   rls: all auth read                                             │
└──────────────────────────────────────────────────────────────────┘
                  ▲
                  │ 1:1 (cascade)
                  │
┌──────────────────────────────────────────────────────────────────┐
│ transcript_analysis  (010)                                       │
│   transcript_id      uuid [PK, FK transcripts] cascade           │
│   tone               {tone} *                                    │
│   tone_score         numeric(5,4)                                │
│   novel_topics       jsonb                                       │
│   guidance_changes   jsonb                                       │
│   summary_md         text                                        │
│   model_version_id   uuid  (FK added in B9)                      │
│   generated_at       timestamptz *                               │
│                                                                  │
│   rls: all auth read                                             │
│   seed (010): 1 analysis for the AAPL Q4-2025 transcript         │
└──────────────────────────────────────────────────────────────────┘

  RPC: public.ticker_detail_timeline(p_symbol text)                 (010)
       returns table (item_id uuid, kind text, occurred_at, payload jsonb)
       union of upcoming briefings + past events + past briefings + transcripts
       STABLE SECURITY INVOKER — per-table RLS applies.


┌──────────────────────────────────────────────────────────────────┐
│ model_versions  (011)                  ← service-role write only │
│   id            uuid [PK]                                        │
│   kind          {model_kind} *                                   │
│   version       text *                                           │
│   storage_path  text                                             │
│   sha256        text                                             │
│   metrics       jsonb                                            │
│   status        {model_status} *  default 'staged'               │
│   notes         text                                             │
│   created_at, promoted_at  timestamptz                           │
│                                                                  │
│   unique (kind, version)                                         │
│   partial unique (kind) where status='active'                    │
│     — enforces exactly-one-active-per-kind                       │
│   rls: select to authenticated where status='active'             │
│   seed (011): 4 active rows (briefing_prompt, surprise_classifier,│
│   extraction_prompt, transcript_summary)                         │
└──────────────────────────────────────────────────────────────────┘
                  ▲       ▲       ▲
                  │       │       │ FK added in 011
                  │       │       └── transcript_analysis.model_version_id
                  │       └────────── event_metrics.extracted_by_model_id
                  └────────────────── briefings.model_version_id


┌──────────────────────────────────────────────────────────────────┐
│ push_tokens  (012)                                               │
│   user_id       uuid [FK auth.users] *  cascade                  │
│   token         text *                                           │
│   platform      {push_platform} *                                │
│   device_id     text                                             │
│   last_seen_at  timestamptz *  default now()                     │
│   created_at    timestamptz *                                    │
│   PK (user_id, token)                                            │
│                                                                  │
│   indexes: (user_id), (last_seen_at)                             │
│   rls: own select/insert/update/delete (auth.uid()=user_id)      │
│   frontend: upserted from notifications-screen (Allow) and on    │
│             every cold start via app/_layout.js useEffect.       │
└──────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────┐
│ notifications  (012)                                             │
│   id              uuid [PK]                                      │
│   user_id         uuid [FK auth.users] *  cascade                │
│   kind            {notification_kind} *                          │
│   ticker_symbol   text [FK tickers] *  on update cascade         │
│   reference_id    uuid                                           │
│   reference_kind  text                                           │
│   title           text *                                         │
│   body            text *                                         │
│   deep_link       text *                                         │
│   status          {notification_status} *  default 'pending'     │
│   error           text                                           │
│   created_at      timestamptz *                                  │
│   scheduled_for   timestamptz                                    │
│   sent_at, delivered_at  timestamptz                             │
│                                                                  │
│   indexes: (user_id, created_at desc),                           │
│            partial (status) where status in (pending,            │
│              skipped_quiet, failed),                             │
│            (user_id, ticker_symbol, (created_at::date))          │
│              — supports the per-ticker daily throttle gate       │
│                                                                  │
│   rls: own select only; service_role inserts via fan-out         │
│                                                                  │
│   triggers (BEFORE INSERT, alphabetical fire order):             │
│     notifications_before_insert_1_throttle                       │
│       → enforce_push_throttle: P0001 if >=3 today                │
│     notifications_before_insert_2_quiet                          │
│       → enforce_quiet_hours: flip to skipped_quiet +             │
│          set scheduled_for if inside the user's quiet preset     │
└──────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────┐
│ subscriptions  (013)                                             │
│   user_id              uuid [PK, FK auth.users] cascade          │
│   plan                 text *  default 'free'                    │
│   status               text *  default 'inactive'                │
│   current_period_end   timestamptz                               │
│   source               text *  default 'none'                    │
│   raw                  jsonb                                     │
│   updated_at           timestamptz *                             │
│                                                                  │
│   rls: own select only                                           │
│   trigger: sync_profile_tier (AFTER INSERT OR UPDATE) mirrors    │
│            status+plan into profiles.tier                        │
│   seed: handle_new_user inserts free/inactive on signup;         │
│         migration backfills existing users                       │
└──────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────┐
│ llm_calls  (014)                  ← audit, service-role only     │
│   id, kind, provider, model, prompt_version,                     │
│   input_tokens, output_tokens, cost_usd, latency_ms,             │
│   success, error, reference_id, reference_kind, created_at       │
│                                                                  │
│   indexes: (created_at desc), (kind, model)                      │
│   rls: NO POLICIES → default deny for anon/authenticated         │
└──────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────┐
│ data_source_status  (014)         ← singleton per source         │
│   source [PK], last_success_at, last_error_at, last_error,       │
│   success_count_24h, error_count_24h, updated_at                 │
│                                                                  │
│   rls: NO POLICIES → service-role only                           │
│   seed (014): edgar, finnhub, earningscalls                      │
└──────────────────────────────────────────────────────────────────┘

  Triggers added in 015:
    trigger_notify_fan_out(jsonb)  — vault-backed POST to edge fn
    notify_on_briefing_ready       — briefings status → ready
    notify_on_event_parsed         — events parse_status → parsed
    notify_on_transcript_analysis  — transcript_analysis insert
    sync_briefing_prompt_version   — denormalise version on FK change

  pg_cron jobs (016, Pro+):
    sift-cleanup-old-notifications  '0 3 * * *'
    sift-retry-skipped-pushes       '*/5 * * * *'
    sift-gc-stale-push-tokens       '0 4 * * 0'

## Schema set complete — Phase 12 tables fully provisioned.
Next ticks (B12–B15) deploy edge functions, wire realtime, and finish the
Discover middle + bottom rails.
- `events`, `event_metrics` (B6)
- `transcripts`, `transcript_segments`, `transcript_analysis` (B8)
- `model_versions` (B9)
- `notifications`, `push_tokens` (B10)
- `subscriptions` (B11)
- `llm_calls`, `data_source_status` (B11)

Each tick will append its table block above the "Tables not yet created" header.
