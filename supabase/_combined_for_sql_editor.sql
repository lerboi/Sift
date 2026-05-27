-- COMBINED MIGRATIONS for paste into Supabase SQL Editor.
-- Run in one go; if it fails, the error message will identify which migration block.
-- Regenerated 2026-05-27 after IMMUTABLE-cast fix in 012.

-- ====================================================================
-- 20260527_001_extensions_and_enums.sql
-- ====================================================================

-- 001 — extensions + enums
-- enable all extensions used across the schema, declare every enum type up front
-- so later migrations can reference them in any order.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists moddatetime with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists vector with schema extensions;

-- enums --------------------------------------------------------------------

create type event_source as enum (
  'edgar',
  'wire',
  'manual'
);

create type parse_status as enum (
  'pending',
  'parsed',
  'failed',
  'needs_review'
);

create type briefing_status as enum (
  'pending',
  'ready',
  'needs_review'
);

create type notification_kind as enum (
  'briefing',
  'event',
  'transcript'
);

create type notification_status as enum (
  'pending',
  'sent',
  'delivered',
  'failed',
  'skipped_quiet'
);

create type push_platform as enum ('ios', 'android');

create type model_kind as enum (
  'surprise_classifier',
  'briefing_prompt',
  'extraction_prompt',
  'transcript_summary'
);

create type model_status as enum ('staged', 'active', 'retired');

create type tone as enum ('bullish', 'neutral', 'bearish');

create type guidance_direction as enum (
  'raised',
  'maintained',
  'lowered',
  'withdrawn',
  'none'
);

create type subscription_tier as enum ('free', 'pro');

create type speaker_role as enum (
  'executive',
  'analyst',
  'operator',
  'other'
);


-- ====================================================================
-- 20260527_002_profiles.sql
-- ====================================================================

-- 002 — profiles
-- extends auth.users with app fields. row inserted by handle_new_user trigger
-- on auth.users INSERT (sign-up or first OAuth callback).
--
-- later ticks CREATE OR REPLACE handle_new_user to also seed watchlists (B3)
-- and subscriptions (B11). this file keeps the profile-only minimal version.

create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  display_name          text,
  tier                  subscription_tier not null default 'free',
  tz                    text not null default 'America/New_York',
  disclaimer_ack_at     timestamptz,
  onboarded_at          timestamptz,
  notify_briefings      boolean not null default true,
  notify_events         boolean not null default true,
  notify_transcripts    boolean not null default false,
  quiet_hours_preset    text not null default '22-07',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_profiles_tier on public.profiles (tier);

-- rls -----------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy "own profile select"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "own profile update"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- insert handled by handle_new_user trigger running as definer; no client policy.
-- delete cascades from auth.users; no client policy.

-- triggers ------------------------------------------------------------------

create trigger set_updated_at_profiles
  before update on public.profiles
  for each row
  execute function moddatetime(updated_at);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();


-- ====================================================================
-- 20260527_003_app_config_secret.sql
-- ====================================================================

-- 003 — app_config_secret helper (Vault wrapper)
-- replaces the docs' current_setting('app.foo') pattern, which fails on hosted
-- supabase (ALTER DATABASE SET is denied). vault.decrypted_secrets is the
-- supported primitive on the managed tier.
--
-- secrets stored under fixed names by the user during pre-loop setup:
--   - supabase_functions_url    (https://<ref>.functions.supabase.co)
--   - service_role_key          (sb_secret_...)
--
-- used by trigger_notify_fan_out (added in a later tick alongside the briefings
-- /events fan-out triggers). isolated here so the deviation is documented in
-- exactly one migration.

create or replace function public.app_config_secret(p_name text)
returns text
language plpgsql
security definer
set search_path = public, vault
stable
as $$
declare
  v_value text;
begin
  select decrypted_secret
    into v_value
  from vault.decrypted_secrets
  where name = p_name
  limit 1;
  return v_value;
end;
$$;

revoke execute on function public.app_config_secret(text) from public, anon, authenticated;
-- service_role + postgres owner retain execute by default (they bypass / own).


-- ====================================================================
-- 20260527_004_tickers.sql
-- ====================================================================

-- 004 — tickers
-- issuer catalog. globally readable, service-role writeable. seed with a
-- 20-ticker bootstrap so the app has something to render on first push;
-- full russell-1000 ingest is via scripts/build_ticker_seed.py + seed.sql.

create table public.tickers (
  symbol            text primary key,
  name              text not null,
  cik               text not null,
  exchange          text not null,
  sector            text not null,
  industry          text,
  market_cap_class  text not null default 'large',
  is_active         boolean not null default true,
  updated_at        timestamptz not null default now(),

  constraint tickers_symbol_uppercase check (symbol = upper(symbol)),
  constraint tickers_cik_format       check (cik ~ '^[0-9]{10}$'),
  constraint tickers_market_cap_class check (market_cap_class in ('small','mid','large','mega'))
);

create index idx_tickers_sector    on public.tickers (sector) where is_active;
create index idx_tickers_cik       on public.tickers (cik);
create index idx_tickers_is_active on public.tickers (is_active);

alter table public.tickers enable row level security;

create policy "all auth read tickers"
  on public.tickers for select
  to authenticated
  using (true);

create trigger set_updated_at_tickers
  before update on public.tickers
  for each row
  execute function moddatetime(updated_at);

-- bootstrap seed: a stable 20-ticker set with real CIKs so the EDGAR worker
-- has something to call against from day one. matches the prior TICKER_CATALOG
-- mock in src/features/watchlist/ticker-catalog.js. full russell 1000 follows
-- via supabase/seed.sql (db reset) or a one-off script run against the remote.
insert into public.tickers (symbol, name, cik, exchange, sector, industry, market_cap_class) values
  ('AAPL', 'Apple Inc.',                       '0000320193', 'NASDAQ', 'Information Technology', 'Technology Hardware, Storage & Peripherals', 'mega'),
  ('MSFT', 'Microsoft Corporation',            '0000789019', 'NASDAQ', 'Information Technology', 'Software',                                    'mega'),
  ('NVDA', 'NVIDIA Corporation',               '0001045810', 'NASDAQ', 'Information Technology', 'Semiconductors',                              'mega'),
  ('GOOG', 'Alphabet Inc. (Class C)',          '0001652044', 'NASDAQ', 'Communication Services', 'Interactive Media & Services',                'mega'),
  ('GOOGL','Alphabet Inc. (Class A)',          '0001652044', 'NASDAQ', 'Communication Services', 'Interactive Media & Services',                'mega'),
  ('AMZN', 'Amazon.com, Inc.',                 '0001018724', 'NASDAQ', 'Consumer Discretionary', 'Broadline Retail',                            'mega'),
  ('META', 'Meta Platforms, Inc.',             '0001326801', 'NASDAQ', 'Communication Services', 'Interactive Media & Services',                'mega'),
  ('TSLA', 'Tesla, Inc.',                      '0001318605', 'NASDAQ', 'Consumer Discretionary', 'Automobile Manufacturers',                    'mega'),
  ('AMD',  'Advanced Micro Devices, Inc.',     '0000002488', 'NASDAQ', 'Information Technology', 'Semiconductors',                              'large'),
  ('AVGO', 'Broadcom Inc.',                    '0001730168', 'NASDAQ', 'Information Technology', 'Semiconductors',                              'mega'),
  ('NFLX', 'Netflix, Inc.',                    '0001065280', 'NASDAQ', 'Communication Services', 'Entertainment',                               'large'),
  ('CRM',  'Salesforce, Inc.',                 '0001108524', 'NYSE',   'Information Technology', 'Software',                                    'large'),
  ('ORCL', 'Oracle Corporation',               '0001341439', 'NYSE',   'Information Technology', 'Software',                                    'large'),
  ('ADBE', 'Adobe Inc.',                       '0000796343', 'NASDAQ', 'Information Technology', 'Software',                                    'large'),
  ('INTC', 'Intel Corporation',                '0000050863', 'NASDAQ', 'Information Technology', 'Semiconductors',                              'large'),
  ('COST', 'Costco Wholesale Corporation',     '0000909832', 'NASDAQ', 'Consumer Staples',       'Consumer Staples Merchandise Retail',         'large'),
  ('WMT',  'Walmart Inc.',                     '0000104169', 'NYSE',   'Consumer Staples',       'Consumer Staples Merchandise Retail',         'mega'),
  ('JPM',  'JPMorgan Chase & Co.',             '0000019617', 'NYSE',   'Financials',             'Diversified Banks',                           'mega'),
  ('BAC',  'Bank of America Corporation',      '0000070858', 'NYSE',   'Financials',             'Diversified Banks',                           'large'),
  ('V',    'Visa Inc.',                        '0001403161', 'NYSE',   'Financials',             'Transaction & Payment Processing Services',   'mega')
on conflict (symbol) do nothing;


-- ====================================================================
-- 20260527_005_watchlists.sql
-- ====================================================================

-- 005 — watchlists + watchlist_tickers + view + handle_new_user extension
-- one default watchlist per user, seeded by the auth trigger. user can have
-- more later (multi-watchlist UI is post-MVP). watchlist_tickers is the N:N
-- join; rls is parent-checked via the watchlists.user_id chain.

create table public.watchlists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'Default',
  is_default  boolean not null default true,
  created_at  timestamptz not null default now()
);

create index idx_watchlists_user on public.watchlists (user_id);
create unique index idx_watchlists_one_default_per_user
  on public.watchlists (user_id)
  where is_default;

create table public.watchlist_tickers (
  watchlist_id   uuid not null references public.watchlists(id) on delete cascade,
  ticker_symbol  text not null references public.tickers(symbol) on update cascade,
  added_at       timestamptz not null default now(),
  sort_order     integer,
  primary key (watchlist_id, ticker_symbol)
);

-- fanout query path: "who watches AAPL?" needs an index on ticker_symbol
-- because the notify_user_event edge function joins by ticker.
create index idx_watchlist_tickers_ticker on public.watchlist_tickers (ticker_symbol);

-- rls -----------------------------------------------------------------------

alter table public.watchlists enable row level security;

create policy "own watchlists select"
  on public.watchlists for select to authenticated
  using (auth.uid() = user_id);

create policy "own watchlists insert"
  on public.watchlists for insert to authenticated
  with check (auth.uid() = user_id);

create policy "own watchlists update"
  on public.watchlists for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own watchlists delete"
  on public.watchlists for delete to authenticated
  using (auth.uid() = user_id);

alter table public.watchlist_tickers enable row level security;

-- parent-checked: a watchlist_tickers row is yours iff its parent watchlist
-- belongs to you. EXISTS turns into a hash semi-join (watchlists.user_id is
-- indexed) so cost stays flat as watchlists grows.
create policy "wt select via own watchlist"
  on public.watchlist_tickers for select to authenticated
  using (exists (
    select 1 from public.watchlists w
    where w.id = watchlist_id and w.user_id = auth.uid()
  ));

create policy "wt insert via own watchlist"
  on public.watchlist_tickers for insert to authenticated
  with check (exists (
    select 1 from public.watchlists w
    where w.id = watchlist_id and w.user_id = auth.uid()
  ));

create policy "wt update via own watchlist"
  on public.watchlist_tickers for update to authenticated
  using (exists (
    select 1 from public.watchlists w
    where w.id = watchlist_id and w.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.watchlists w
    where w.id = watchlist_id and w.user_id = auth.uid()
  ));

create policy "wt delete via own watchlist"
  on public.watchlist_tickers for delete to authenticated
  using (exists (
    select 1 from public.watchlists w
    where w.id = watchlist_id and w.user_id = auth.uid()
  ));

-- extend handle_new_user: also seed a default watchlist on signup.
-- this is the second of three revisions; B11 will add the subscriptions stub.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_watchlist_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    )
  );

  insert into public.watchlists (user_id, name, is_default)
  values (new.id, 'Default', true)
  returning id into v_watchlist_id;

  return new;
end;
$$;

-- view ----------------------------------------------------------------------
-- briefings table doesn't exist until B5; next_* columns are null placeholders
-- here. B5 will CREATE OR REPLACE to populate from the briefings LATERAL join.

create view public.watchlist_with_meta_view as
select
  w.user_id,
  wt.ticker_symbol         as symbol,
  t.name,
  t.sector,
  wt.added_at,
  wt.sort_order,
  null::text               as next_fiscal_period,
  null::timestamptz        as next_expected_at,
  null::numeric(5,4)       as next_beat_probability,
  false                    as briefing_ready
from public.watchlists w
join public.watchlist_tickers wt on wt.watchlist_id = w.id
join public.tickers t            on t.symbol        = wt.ticker_symbol;

-- view inherits rls from underlying tables (watchlists policy filters to
-- auth.uid()=user_id). no separate grant needed beyond the default usage.


-- ====================================================================
-- 20260527_006_ticker_prices.sql
-- ====================================================================

-- 006 — ticker_prices + sparkline rpc + seed
-- daily closes for the watchlist sparkline. composite PK clusters reads by
-- (ticker_symbol, trade_date desc). modal daily-close cron lands in B11 / phase
-- 13; for now we seed 30d of synthetic curves for 10 bootstrap tickers so the
-- watchlist row has something visually plausible to draw.

create table public.ticker_prices (
  ticker_symbol  text not null references public.tickers(symbol) on update cascade,
  trade_date     date not null,
  close          numeric(18, 4) not null,
  volume         bigint,
  source         text not null default 'finnhub',
  fetched_at     timestamptz not null default now(),
  primary key (ticker_symbol, trade_date)
);

create index idx_ticker_prices_date on public.ticker_prices (trade_date desc);

alter table public.ticker_prices enable row level security;

create policy "all auth read ticker_prices"
  on public.ticker_prices for select
  to authenticated
  using (true);

-- rpc: sparkline as flat (date, close) rows for a symbol. SECURITY INVOKER so
-- the existing rls policy gates rows. STABLE because output depends only on
-- params and committed data.

create or replace function public.ticker_sparkline(p_symbol text, p_days integer default 30)
returns table (trade_date date, close numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select trade_date, close
  from public.ticker_prices
  where ticker_symbol = upper(p_symbol)
    and trade_date >= current_date - p_days
  order by trade_date asc;
$$;

-- seed: 30d of plausible closes for 10 bootstrap tickers. uses a sine wave
-- with per-ticker phase + amplitude so the lines look distinct without being
-- noisy. price scaling reflects rough 2026 levels for visual sanity.
insert into public.ticker_prices (ticker_symbol, trade_date, close, source)
select
  s.symbol,
  (current_date - g.i)::date as trade_date,
  (s.base * (1 + sin((g.i + s.phase) * 0.42) * s.amp))::numeric(18, 4) as close,
  'seed'
from (values
  ('AAPL', 200.0,  0, 0.04),
  ('MSFT', 420.0,  1, 0.03),
  ('NVDA', 130.0,  2, 0.06),
  ('GOOG', 175.0,  3, 0.04),
  ('AMZN', 200.0,  4, 0.05),
  ('META', 540.0,  5, 0.05),
  ('TSLA', 250.0,  6, 0.08),
  ('AMD',  130.0,  7, 0.06),
  ('JPM',  270.0,  8, 0.03),
  ('WMT',  95.0,   9, 0.02)
) as s(symbol, base, phase, amp)
cross join generate_series(0, 29) as g(i)
on conflict (ticker_symbol, trade_date) do nothing;


-- ====================================================================
-- 20260527_007_briefings.sql
-- ====================================================================

-- 007 — briefings + discover RPC + watchlist view replace + seed
-- pre-earnings briefings, one per (ticker_symbol, fiscal_period). lifecycle:
-- pending → ready (or needs_review). rls hides non-ready so a half-baked row
-- is never visible to clients. status enum was declared in migration 001.

create table public.briefings (
  id                    uuid primary key default gen_random_uuid(),
  ticker_symbol         text not null references public.tickers(symbol) on update cascade,
  fiscal_period         text not null,                                  -- 'Q1-2026' sortable
  expected_release_at   timestamptz not null,
  consensus_eps         numeric(10, 4),
  consensus_revenue     numeric(18, 2),
  beat_probability      numeric(5, 4),
  surprise_prediction   jsonb,                                          -- {"beat":0.41,"meet":0.32,"miss":0.27,"expected_move_pct":0.052}
  content_md            text,
  prompt_version        text,                                           -- denormalised from model_versions
  model_version_id      uuid,                                           -- FK enforced in B9 when model_versions exists
  status                briefing_status not null default 'pending',
  generated_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint briefings_unique_per_period
    unique (ticker_symbol, fiscal_period),
  constraint briefings_beat_probability_range
    check (beat_probability is null or (beat_probability >= 0 and beat_probability <= 1))
);

create index idx_briefings_expected_release_at on public.briefings (expected_release_at);
create index idx_briefings_ticker_period       on public.briefings (ticker_symbol, fiscal_period);
create index idx_briefings_status_pending      on public.briefings (status) where status <> 'ready';

alter table public.briefings enable row level security;

create policy "all auth read briefings"
  on public.briefings for select
  to authenticated
  using (status = 'ready');

create trigger set_updated_at_briefings
  before update on public.briefings
  for each row
  execute function moddatetime(updated_at);

-- discover_biggest_expected: ranks ready briefings for the given week by
-- expected_move_pct (extracted from the surprise_prediction jsonb).
-- security invoker so the rls policy (status='ready') applies.

create or replace function public.discover_biggest_expected(
  p_limit       integer default 4,
  p_week_start  date    default date_trunc('week', current_date)::date
)
returns table (
  ticker_symbol       text,
  ticker_name         text,
  fiscal_period       text,
  expected_release_at timestamptz,
  beat_probability    numeric,
  expected_move_pct   numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    b.ticker_symbol,
    t.name as ticker_name,
    b.fiscal_period,
    b.expected_release_at,
    b.beat_probability,
    (b.surprise_prediction->>'expected_move_pct')::numeric as expected_move_pct
  from public.briefings b
  join public.tickers t on t.symbol = b.ticker_symbol
  where b.status = 'ready'
    and b.expected_release_at >= p_week_start
    and b.expected_release_at <  p_week_start + interval '7 days'
  order by (b.surprise_prediction->>'expected_move_pct')::numeric desc nulls last
  limit p_limit;
$$;

-- replace watchlist_with_meta_view to populate next_* from briefings
-- (B3 created the view with null placeholders since briefings didn't exist).

create or replace view public.watchlist_with_meta_view as
select
  w.user_id,
  wt.ticker_symbol         as symbol,
  t.name,
  t.sector,
  wt.added_at,
  wt.sort_order,
  next_b.fiscal_period       as next_fiscal_period,
  next_b.expected_release_at as next_expected_at,
  next_b.beat_probability    as next_beat_probability,
  (next_b.status = 'ready')  as briefing_ready
from public.watchlists w
join public.watchlist_tickers wt on wt.watchlist_id = w.id
join public.tickers t            on t.symbol        = wt.ticker_symbol
left join lateral (
  select id, fiscal_period, expected_release_at, beat_probability, status
  from public.briefings b
  where b.ticker_symbol = wt.ticker_symbol
    and b.expected_release_at > now()
  order by b.expected_release_at asc
  limit 1
) next_b on true;

-- seed: a handful of upcoming briefings for the bootstrap tickers so discover
-- has something to render and the watchlist view's next_* columns light up.
-- expected_release_at dates are ~1-7 days out from migration apply time.

insert into public.briefings (
  ticker_symbol, fiscal_period, expected_release_at,
  consensus_eps, consensus_revenue,
  beat_probability, surprise_prediction,
  content_md, prompt_version, status, generated_at
)
values
  ('NVDA', 'Q1-2026', (current_date + 1)::timestamptz + interval '16 hours',
   1.0500, 26000000000,
   0.7100, '{"beat":0.71,"meet":0.20,"miss":0.09,"expected_move_pct":0.052}'::jsonb,
   E'## NVDA — Q1 26 setup\n\nConsensus EPS 1.05 on $26.0bn revenue. Model leans positive on continued data-center demand; expected move of ±5.2% reflects volatility around guidance.\n\n_Educational use only. Not investment advice._',
   'v1.0', 'ready', now()),

  ('AAPL', 'Q3-2026', (current_date + 3)::timestamptz + interval '16 hours 30 minutes',
   2.1000, 95400000000,
   0.6500, '{"beat":0.65,"meet":0.25,"miss":0.10,"expected_move_pct":0.031}'::jsonb,
   E'## AAPL — Q3 26 setup\n\nServices growth has been the swing factor since Q2. Consensus EPS 2.10 on $95.4bn revenue. ±3.1% expected move; below the multi-year average for AAPL.\n\n_Educational use only. Not investment advice._',
   'v1.0', 'ready', now()),

  ('MSFT', 'Q2-2026', (current_date + 5)::timestamptz + interval '16 hours',
   3.4000, 65000000000,
   0.6200, '{"beat":0.62,"meet":0.28,"miss":0.10,"expected_move_pct":0.038}'::jsonb,
   E'## MSFT — Q2 26 setup\n\nAzure growth and Copilot ARR are the watch items. Consensus EPS 3.40 on $65.0bn revenue. ±3.8% expected move.\n\n_Educational use only. Not investment advice._',
   'v1.0', 'ready', now()),

  ('GOOG', 'Q1-2026', (current_date + 6)::timestamptz + interval '16 hours',
   2.0500, 91000000000,
   0.4900, '{"beat":0.49,"meet":0.30,"miss":0.21,"expected_move_pct":0.028}'::jsonb,
   E'## GOOG — Q1 26 setup\n\nSearch growth and YouTube monetisation in focus. Consensus EPS 2.05 on $91.0bn revenue. ±2.8% expected move; close to the neutral line.\n\n_Educational use only. Not investment advice._',
   'v1.0', 'ready', now()),

  ('TSLA', 'Q2-2026', (current_date + 4)::timestamptz + interval '16 hours',
   0.6500, 28000000000,
   0.4200, '{"beat":0.42,"meet":0.28,"miss":0.30,"expected_move_pct":0.078}'::jsonb,
   E'## TSLA — Q2 26 setup\n\nAuto margins remain the dominant signal. Consensus EPS 0.65 on $28.0bn revenue. ±7.8% expected move; one of the higher-vol names this cycle.\n\n_Educational use only. Not investment advice._',
   'v1.0', 'ready', now())

on conflict (ticker_symbol, fiscal_period) do nothing;


-- ====================================================================
-- 20260527_008_events_and_metrics.sql
-- ====================================================================

-- 008 — events + event_metrics + view + seed
-- 8-K filings (today; future 10-Q/10-K). metrics one-to-one with events, split
-- because extraction is a distinct pipeline step that lags the event insert.

create table public.events (
  id                uuid primary key default gen_random_uuid(),
  ticker_symbol     text not null references public.tickers(symbol) on update cascade,
  accession_number  text not null,
  form_type         text not null,
  item_number       text,
  fiscal_period     text not null,
  source            event_source not null default 'edgar',
  expected_at       timestamptz,
  filed_at          timestamptz not null,
  detected_at       timestamptz not null default now(),
  parsed_at         timestamptz,
  pushed_at         timestamptz,
  exhibit_url       text,
  storage_path      text,
  parse_status      parse_status not null default 'pending',
  parse_error       text,
  created_at        timestamptz not null default now(),

  constraint events_accession_unique unique (accession_number)
);

create index idx_events_ticker_filed_desc on public.events (ticker_symbol, filed_at desc);
create index idx_events_filed_at_desc     on public.events (filed_at desc);
create index idx_events_parse_status      on public.events (parse_status) where parse_status <> 'parsed';
create index idx_events_ticker_period     on public.events (ticker_symbol, fiscal_period);

alter table public.events enable row level security;

create policy "all auth read events"
  on public.events for select
  to authenticated
  using (parse_status in ('parsed', 'failed'));

create table public.event_metrics (
  event_id              uuid primary key references public.events(id) on delete cascade,
  eps_actual            numeric(10, 4),
  eps_est               numeric(10, 4),
  eps_surprise_pct      numeric(10, 6) generated always as (
    case when eps_est is null or eps_est = 0 then null
         else (eps_actual - eps_est) / eps_est end
  ) stored,
  revenue_actual        numeric(18, 2),
  revenue_est           numeric(18, 2),
  revenue_surprise_pct  numeric(10, 6) generated always as (
    case when revenue_est is null or revenue_est = 0 then null
         else (revenue_actual - revenue_est) / revenue_est end
  ) stored,
  guidance_direction    guidance_direction,
  guidance_detail       text,
  segments              jsonb,
  extracted_by_model_id uuid,
  extracted_at          timestamptz not null default now()
);

-- partial index on the generated column for the "biggest recent surprises"
-- query path (B15). null filtered out because surprise % is null when est is.
create index idx_event_metrics_surprise
  on public.event_metrics (eps_surprise_pct)
  where eps_surprise_pct is not null;

alter table public.event_metrics enable row level security;

-- parent-checked: only visible if parent event row is visible.
create policy "all auth read event_metrics"
  on public.event_metrics for select
  to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.parse_status = 'parsed'
    )
  );

-- view: flattened event row with metrics joined. used by event-screen.
create or replace view public.event_with_metrics_view as
select
  e.id,
  e.ticker_symbol,
  t.name             as ticker_name,
  t.sector,
  e.fiscal_period,
  e.source,
  e.expected_at,
  e.filed_at,
  e.detected_at,
  e.parsed_at,
  e.pushed_at,
  e.exhibit_url,
  e.parse_status,
  m.eps_actual,
  m.eps_est,
  m.eps_surprise_pct,
  m.revenue_actual,
  m.revenue_est,
  m.revenue_surprise_pct,
  m.guidance_direction,
  m.guidance_detail,
  m.segments
from public.events e
join public.tickers t        on t.symbol   = e.ticker_symbol
left join public.event_metrics m on m.event_id = e.id
where e.parse_status in ('parsed', 'failed');

-- seed: 3 past parsed events with full metrics so event-screen renders end-to-end.
-- accession_number values are real-formatted (XXXXXXXXXX-YY-NNNNNN) but synthetic;
-- they will not resolve on EDGAR. exhibit_url points to a real example so the
-- "view source" link is testable.

with seed_events as (
  insert into public.events (
    ticker_symbol, accession_number, form_type, item_number, fiscal_period,
    source, expected_at, filed_at, detected_at, parsed_at, pushed_at,
    exhibit_url, parse_status
  )
  values
    ('AAPL', '0000320193-26-000010', '8-K', '2.02', 'Q4-2025',
     'edgar', now() - interval '14 days', now() - interval '14 days' + interval '2 minutes',
     now() - interval '14 days' + interval '2 minutes 8 seconds',
     now() - interval '14 days' + interval '2 minutes 12 seconds',
     now() - interval '14 days' + interval '2 minutes 14 seconds',
     'https://www.sec.gov/Archives/edgar/data/320193/000032019326000010/aapl-20260128.htm',
     'parsed'),

    ('NVDA', '0001045810-26-000023', '8-K', '2.02', 'Q4-2025',
     'edgar', now() - interval '7 days', now() - interval '7 days' + interval '90 seconds',
     now() - interval '7 days' + interval '92 seconds',
     now() - interval '7 days' + interval '95 seconds',
     now() - interval '7 days' + interval '97 seconds',
     'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000023/nvda-20260225.htm',
     'parsed'),

    ('TSLA', '0001318605-26-000018', '8-K', '2.02', 'Q1-2026',
     'edgar', now() - interval '3 days', now() - interval '3 days' + interval '4 minutes',
     now() - interval '3 days' + interval '4 minutes 5 seconds',
     now() - interval '3 days' + interval '4 minutes 9 seconds',
     now() - interval '3 days' + interval '4 minutes 11 seconds',
     'https://www.sec.gov/Archives/edgar/data/1318605/000131860526000018/tsla-20260420.htm',
     'parsed')

  on conflict (accession_number) do nothing
  returning id, ticker_symbol
)
insert into public.event_metrics (
  event_id, eps_actual, eps_est, revenue_actual, revenue_est,
  guidance_direction, guidance_detail, segments
)
select
  e.id,
  case e.ticker_symbol
    when 'AAPL' then 2.14
    when 'NVDA' then 1.18
    when 'TSLA' then 0.59
  end,
  case e.ticker_symbol
    when 'AAPL' then 1.98
    when 'NVDA' then 1.05
    when 'TSLA' then 0.65
  end,
  case e.ticker_symbol
    when 'AAPL' then 124300000000
    when 'NVDA' then 28200000000
    when 'TSLA' then 27100000000
  end,
  case e.ticker_symbol
    when 'AAPL' then 122400000000
    when 'NVDA' then 26000000000
    when 'TSLA' then 28000000000
  end,
  case e.ticker_symbol
    when 'AAPL' then 'raised'::guidance_direction
    when 'NVDA' then 'raised'::guidance_direction
    when 'TSLA' then 'maintained'::guidance_direction
  end,
  case e.ticker_symbol
    when 'AAPL' then 'FY guidance midpoint raised by $0.10'
    when 'NVDA' then 'Data Center revenue guidance for next quarter raised ~6%'
    when 'TSLA' then 'Full-year delivery range maintained; capex bias higher'
  end,
  case e.ticker_symbol
    when 'AAPL' then '[{"name":"Services","actual":24.5,"est":23.8},{"name":"iPhone","actual":67.1,"est":66.0},{"name":"Wearables","actual":11.9,"est":12.3}]'::jsonb
    when 'NVDA' then '[{"name":"Data Center","actual":22.7,"est":20.8},{"name":"Gaming","actual":3.1,"est":3.0},{"name":"Automotive","actual":0.45,"est":0.40}]'::jsonb
    when 'TSLA' then '[{"name":"Automotive","actual":22.6,"est":23.5},{"name":"Energy","actual":3.1,"est":2.9},{"name":"Services","actual":1.4,"est":1.6}]'::jsonb
  end
from seed_events e;


-- ====================================================================
-- 20260527_009_home_events_rpc.sql
-- ====================================================================

-- 009 — home_events_for_user rpc
-- the Today feed: flat list of (state, payload) rows for the user's watched
-- tickers, unioning upcoming briefings with parsed events. consumer side
-- groups by day; state classification ('upcoming' | 'live' | 'past') is
-- computed here so the frontend doesn't recompute.
--
-- security invoker: rls on watchlists / briefings / events / event_metrics
-- still gates rows. the p_user_id parameter is informational — postgres only
-- ever returns the caller's rows because the inner queries filter via the
-- caller's RLS context. passing the param avoids a session() round-trip on
-- the frontend.

create or replace function public.home_events_for_user(p_user_id uuid)
returns table (
  state             text,
  ticker_symbol     text,
  ticker_name       text,
  fiscal_period     text,
  expected_at       timestamptz,
  actual_at         timestamptz,
  briefing_id       uuid,
  beat_probability  numeric,
  eps_actual        numeric,
  eps_est           numeric,
  surprise_pct      numeric,
  briefing_ready    boolean,
  reference_id      uuid
)
language sql
stable
security invoker
set search_path = public
as $$
  with watched as (
    select wt.ticker_symbol
    from public.watchlists w
    join public.watchlist_tickers wt on wt.watchlist_id = w.id
    where w.user_id = p_user_id
  ),
  upcoming as (
    select
      'upcoming'::text       as state,
      b.ticker_symbol,
      t.name                 as ticker_name,
      b.fiscal_period,
      b.expected_release_at  as expected_at,
      null::timestamptz      as actual_at,
      b.id                   as briefing_id,
      b.beat_probability,
      null::numeric          as eps_actual,
      null::numeric          as eps_est,
      null::numeric          as surprise_pct,
      (b.status = 'ready')   as briefing_ready,
      b.id                   as reference_id
    from public.briefings b
    join public.tickers t on t.symbol = b.ticker_symbol
    where b.ticker_symbol in (select ticker_symbol from watched)
      and b.expected_release_at > now() - interval '6 hours'
      and b.expected_release_at < now() + interval '30 days'
      and b.status = 'ready'
  ),
  live_and_past as (
    select
      case
        when e.filed_at > now() - interval '15 minutes' then 'live'
        else 'past'
      end                    as state,
      e.ticker_symbol,
      t.name                 as ticker_name,
      e.fiscal_period,
      e.expected_at,
      e.filed_at             as actual_at,
      null::uuid             as briefing_id,
      null::numeric          as beat_probability,
      m.eps_actual,
      m.eps_est,
      m.eps_surprise_pct     as surprise_pct,
      null::boolean          as briefing_ready,
      e.id                   as reference_id
    from public.events e
    join public.tickers t       on t.symbol  = e.ticker_symbol
    join public.event_metrics m on m.event_id = e.id
    where e.ticker_symbol in (select ticker_symbol from watched)
      and e.parse_status = 'parsed'
      and e.filed_at > now() - interval '30 days'
  )
  select *
  from (
    select * from upcoming
    union all
    select * from live_and_past
  ) all_events
  order by coalesce(actual_at, expected_at) desc;
$$;


-- ====================================================================
-- 20260527_010_transcripts.sql
-- ====================================================================

-- 010 — transcripts + transcript_segments + transcript_analysis
-- + ticker_detail_timeline rpc
-- per-call text + embedded segments + llm analysis. embedding dimension 1536
-- locks us to openai text-embedding-3-small or cohere embed-v3 default.

create table public.transcripts (
  id              uuid primary key default gen_random_uuid(),
  ticker_symbol   text not null references public.tickers(symbol) on update cascade,
  fiscal_period   text not null,
  call_date       date not null,
  source          text not null,                                       -- 'earningscalls' | 'api_ninjas' | 'motley_fool'
  storage_path    text not null,                                       -- raw text in storage
  fetched_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),

  constraint transcripts_unique_per_period unique (ticker_symbol, fiscal_period)
);

create index idx_transcripts_ticker_call_date on public.transcripts (ticker_symbol, call_date desc);

alter table public.transcripts enable row level security;
create policy "all auth read transcripts"
  on public.transcripts for select to authenticated using (true);

create table public.transcript_segments (
  id             uuid primary key default gen_random_uuid(),
  transcript_id  uuid not null references public.transcripts(id) on delete cascade,
  segment_order  integer not null,
  speaker        text,
  role           speaker_role not null default 'other',
  content        text not null,
  embedding      vector(1536),
  created_at     timestamptz not null default now(),

  constraint transcript_segments_unique_order unique (transcript_id, segment_order)
);

create index idx_transcript_segments_transcript on public.transcript_segments (transcript_id, segment_order);
-- hnsw for approximate nearest-neighbour (novelty detection).
-- recall ~95% out of the box; tune m / ef_construction only if observed bad.
create index idx_transcript_segments_embedding
  on public.transcript_segments using hnsw (embedding vector_cosine_ops);

alter table public.transcript_segments enable row level security;
create policy "all auth read transcript_segments"
  on public.transcript_segments for select to authenticated using (true);

create table public.transcript_analysis (
  transcript_id      uuid primary key references public.transcripts(id) on delete cascade,
  tone               tone not null,
  tone_score         numeric(5, 4),
  novel_topics       jsonb,
  guidance_changes   jsonb,
  summary_md         text,
  model_version_id   uuid,                                              -- FK added in B9
  generated_at       timestamptz not null default now()
);

alter table public.transcript_analysis enable row level security;
create policy "all auth read transcript_analysis"
  on public.transcript_analysis for select to authenticated using (true);

-- ticker_detail_timeline: unions everything a single ticker's screen needs
-- into one flat ordered list. payload is jsonb so each kind can shape its own
-- fields without altering the rpc signature. security invoker so the
-- per-table rls (briefings status=ready, events parse_status, etc) applies.

create or replace function public.ticker_detail_timeline(p_symbol text)
returns table (
  item_id      uuid,
  kind         text,
  occurred_at  timestamptz,
  payload      jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  -- upcoming briefings (status = ready, expected after now)
  select
    b.id  as item_id,
    'earnings-upcoming'::text as kind,
    b.expected_release_at as occurred_at,
    jsonb_build_object(
      'fiscal_period',       b.fiscal_period,
      'beat_probability',    b.beat_probability,
      'expected_release_at', b.expected_release_at,
      'consensus_eps',       b.consensus_eps,
      'surprise_prediction', b.surprise_prediction
    )
  from public.briefings b
  where b.ticker_symbol = upper(p_symbol)
    and b.status = 'ready'
    and b.expected_release_at > now()

  union all

  -- past parsed events with metrics
  select
    e.id, 'earnings-past',
    e.filed_at,
    jsonb_build_object(
      'fiscal_period',       e.fiscal_period,
      'expected_at',         e.expected_at,
      'actual_at',           e.filed_at,
      'eps_actual',          m.eps_actual,
      'eps_est',             m.eps_est,
      'surprise_pct',        m.eps_surprise_pct,
      'revenue_actual',      m.revenue_actual,
      'revenue_est',         m.revenue_est,
      'revenue_surprise_pct', m.revenue_surprise_pct,
      'guidance_direction',  m.guidance_direction,
      'guidance_detail',     m.guidance_detail,
      'segments',            m.segments
    )
  from public.events e
  join public.event_metrics m on m.event_id = e.id
  where e.ticker_symbol = upper(p_symbol)
    and e.parse_status = 'parsed'

  union all

  -- past briefings (status=ready, expected_release_at already passed)
  select
    b.id, 'briefing',
    coalesce(b.generated_at, b.expected_release_at),
    jsonb_build_object(
      'title',           'Post-call briefing — ' || b.fiscal_period,
      'content_md',      b.content_md,
      'generated_at',    b.generated_at,
      'fiscal_period',   b.fiscal_period,
      'prompt_version',  b.prompt_version
    )
  from public.briefings b
  where b.ticker_symbol = upper(p_symbol)
    and b.status = 'ready'
    and b.expected_release_at <= now()

  union all

  -- transcripts (with optional analysis)
  select
    t.id, 'transcript',
    t.call_date::timestamptz,
    jsonb_build_object(
      'fiscal_period', t.fiscal_period,
      'call_date',     t.call_date,
      'tone',          ta.tone,
      'tone_score',    ta.tone_score,
      'novel_topics',  ta.novel_topics,
      'summary_md',    ta.summary_md
    )
  from public.transcripts t
  left join public.transcript_analysis ta on ta.transcript_id = t.id
  where t.ticker_symbol = upper(p_symbol)

  order by occurred_at desc;
$$;

-- seed: one transcript + analysis for AAPL Q4-2025 (matches the events seed).
with t as (
  insert into public.transcripts (ticker_symbol, fiscal_period, call_date, source, storage_path)
  values ('AAPL', 'Q4-2025', (current_date - 14)::date, 'earningscalls', 'transcripts/aapl-q4-2025.txt')
  on conflict (ticker_symbol, fiscal_period) do nothing
  returning id
)
insert into public.transcript_analysis (
  transcript_id, tone, tone_score, novel_topics, guidance_changes, summary_md
)
select
  t.id,
  'neutral'::tone,
  0.12,
  '["foundry diversification","services pricing power"]'::jsonb,
  '{"direction":"raised","previous":"maintained","detail":"FY midpoint +$0.10"}'::jsonb,
  E'## AAPL — Q4 25 call summary\n\nBeat EPS by 8.1%, revenue +1.7%. Tone shifted slightly cautious on China demand vs Q3 ''25. FY guidance midpoint raised by $0.10. Analysts pushed three times on the AI roadmap without commitment.\n\n_Educational use only. Not investment advice._'
from t;


-- ====================================================================
-- 20260527_011_model_versions.sql
-- ====================================================================

-- 011 — model_versions + FK additions
-- registry for every ml / llm artefact (classifiers, prompts). modal writes,
-- the app only reads status='active'. partial unique index enforces "exactly
-- one active per kind" without per-row trigger logic.
--
-- this migration also adds the FK constraints that briefings (007),
-- event_metrics (008), and transcript_analysis (010) deferred — they all
-- declared `model_version_id uuid` without a reference so the schema would
-- still apply in per-tick order.

create table public.model_versions (
  id            uuid primary key default gen_random_uuid(),
  kind          model_kind not null,
  version       text not null,
  storage_path  text,
  sha256        text,
  metrics       jsonb,
  status        model_status not null default 'staged',
  notes         text,
  created_at    timestamptz not null default now(),
  promoted_at   timestamptz,

  constraint model_versions_unique_version unique (kind, version)
);

-- enforces exactly-one-active-row-per-kind without a per-row check. trying to
-- set a second 'active' raises a unique violation; the promotion procedure
-- demotes the prior active to 'retired' in one transaction.
create unique index idx_model_versions_one_active
  on public.model_versions (kind)
  where status = 'active';

alter table public.model_versions enable row level security;

create policy "all auth read model_versions"
  on public.model_versions for select
  to authenticated
  using (status = 'active');

-- bootstrap: two active rows so briefing fan-out + extraction can reference them.
insert into public.model_versions (kind, version, status, notes, promoted_at)
values
  ('briefing_prompt',      '1.0', 'active', 'B9 bootstrap. mvp prompt set authored 2026-05-27.',         now()),
  ('surprise_classifier',  '0.1', 'active', 'B9 bootstrap. placeholder constant-output until B17 train.', now()),
  ('extraction_prompt',    '1.0', 'active', 'B9 bootstrap. 8-K / exhibit 99.1 metric extraction prompt.', now()),
  ('transcript_summary',   '1.0', 'active', 'B9 bootstrap. post-call summary + novelty topic prompt.',     now())
on conflict (kind, version) do nothing;

-- add the deferred FK constraints. validating against existing rows: the
-- prior migrations seeded `model_version_id` NULL throughout, so the
-- constraint validates trivially.
alter table public.briefings
  add constraint briefings_model_version_id_fk
  foreign key (model_version_id) references public.model_versions(id);

alter table public.event_metrics
  add constraint event_metrics_extracted_by_model_id_fk
  foreign key (extracted_by_model_id) references public.model_versions(id);

alter table public.transcript_analysis
  add constraint transcript_analysis_model_version_id_fk
  foreign key (model_version_id) references public.model_versions(id);

-- backfill: now that model_versions exists, point the seeded briefings at the
-- active briefing_prompt row so the prompt_version denormalisation makes sense.
update public.briefings
set
  model_version_id = (select id from public.model_versions where kind = 'briefing_prompt' and status = 'active'),
  prompt_version = (select version from public.model_versions where kind = 'briefing_prompt' and status = 'active')
where model_version_id is null;

update public.transcript_analysis
set model_version_id = (select id from public.model_versions where kind = 'transcript_summary' and status = 'active')
where model_version_id is null;


-- ====================================================================
-- 20260527_012_notifications_and_push.sql
-- ====================================================================

-- 012 — notifications + push_tokens + throttle + quiet-hours triggers
-- per-user delivery record (source of truth for retries, dedupe, audit) +
-- device tokens for expo push. throttle and quiet-hours invariants enforced
-- in db so any path (edge function, modal, manual psql) gets the same gates.

create table public.push_tokens (
  user_id       uuid not null references auth.users(id) on delete cascade,
  token         text not null,
  platform      push_platform not null,
  device_id     text,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  primary key (user_id, token)
);

create index idx_push_tokens_user      on public.push_tokens (user_id);
create index idx_push_tokens_last_seen on public.push_tokens (last_seen_at);

alter table public.push_tokens enable row level security;

create policy "own push tokens select"
  on public.push_tokens for select to authenticated
  using (auth.uid() = user_id);

create policy "own push tokens insert"
  on public.push_tokens for insert to authenticated
  with check (auth.uid() = user_id);

create policy "own push tokens update"
  on public.push_tokens for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own push tokens delete"
  on public.push_tokens for delete to authenticated
  using (auth.uid() = user_id);

-- notifications -------------------------------------------------------------

create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  kind            notification_kind not null,
  ticker_symbol   text not null references public.tickers(symbol) on update cascade,
  reference_id    uuid,
  reference_kind  text,
  title           text not null,
  body            text not null,
  deep_link       text not null,
  status          notification_status not null default 'pending',
  error           text,
  created_at      timestamptz not null default now(),
  scheduled_for   timestamptz,
  sent_at         timestamptz,
  delivered_at    timestamptz
);

create index idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

create index idx_notifications_status
  on public.notifications (status)
  where status in ('pending', 'skipped_quiet', 'failed');

-- supports the 3-per-ticker-per-day throttle gate without a separate counter table.
-- the day-bucket expression is anchored to UTC so it's IMMUTABLE (required for
-- index expressions). semantic: throttle resets at 00:00 UTC, not local tz.
create index idx_notifications_user_ticker_day
  on public.notifications (user_id, ticker_symbol, ((created_at at time zone 'UTC')::date));

alter table public.notifications enable row level security;

-- read-only for users; service_role inserts via the fan-out edge function.
create policy "own notifications select"
  on public.notifications for select to authenticated
  using (auth.uid() = user_id);

-- triggers ------------------------------------------------------------------
-- naming convention: numeric prefixes guarantee fire order alphabetically.
-- throttle MUST run before quiet-hours: if the day cap is exceeded we reject
-- outright (P0001); no point computing the quiet-hours deferral after that.

create or replace function public.enforce_push_throttle()
returns trigger
language plpgsql
as $$
declare
  todays_count int;
begin
  select count(*)
    into todays_count
  from public.notifications
  where user_id      = new.user_id
    and ticker_symbol = new.ticker_symbol
    and (created_at at time zone 'UTC')::date = (new.created_at at time zone 'UTC')::date
    and status != 'failed';

  if todays_count >= 3 then
    raise exception 'push throttle exceeded for user % ticker % on %', new.user_id, new.ticker_symbol, (new.created_at at time zone 'UTC')::date
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger notifications_before_insert_1_throttle
  before insert on public.notifications
  for each row execute function public.enforce_push_throttle();

create or replace function public.enforce_quiet_hours()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_tz             text;
  preset              text;
  start_hr            int;
  end_hr              int;
  local_hour          int;
  quiet_end_local     timestamp;
begin
  select tz, quiet_hours_preset
  into user_tz, preset
  from public.profiles where id = new.user_id;

  if preset is null or preset = 'off' then
    return new;
  end if;

  -- preset format: 'SS-EE' (start and end hours in local time).
  start_hr := split_part(preset, '-', 1)::int;
  end_hr   := split_part(preset, '-', 2)::int;
  local_hour := extract(hour from new.created_at at time zone user_tz);

  -- quiet hours span midnight (e.g. 22-07): in-quiet if hour >= start OR hour < end.
  -- daytime quiet hours (rare): in-quiet if hour >= start AND hour < end.
  if (start_hr > end_hr and (local_hour >= start_hr or local_hour < end_hr))
     or (start_hr <= end_hr and local_hour >= start_hr and local_hour < end_hr) then
    quiet_end_local := date_trunc('day', new.created_at at time zone user_tz)
                       + make_interval(hours => end_hr);
    if quiet_end_local <= (new.created_at at time zone user_tz) then
      quiet_end_local := quiet_end_local + interval '1 day';
    end if;

    new.status := 'skipped_quiet';
    new.scheduled_for := quiet_end_local at time zone user_tz;
  end if;

  return new;
end;
$$;

create trigger notifications_before_insert_2_quiet
  before insert on public.notifications
  for each row execute function public.enforce_quiet_hours();


-- ====================================================================
-- 20260527_013_subscriptions.sql
-- ====================================================================

-- 013 — subscriptions + sync_profile_tier + handle_new_user revision
-- post-mvp stub. table exists now so the settings PLAN row's path forward
-- is wired; RevenueCat webhook fills it later. profiles.tier mirrors
-- subscriptions.status+plan via trigger so RLS / feature gating reads stay
-- cheap (no join).

create table public.subscriptions (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  plan                 text not null default 'free',
  status               text not null default 'inactive',
  current_period_end   timestamptz,
  source               text not null default 'none',
  raw                  jsonb,
  updated_at           timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "own subscription select"
  on public.subscriptions for select to authenticated
  using (auth.uid() = user_id);

create trigger set_updated_at_subscriptions
  before update on public.subscriptions
  for each row
  execute function moddatetime(updated_at);

-- mirror subscriptions → profiles.tier so reads stay one-table.
create or replace function public.sync_profile_tier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set tier = case
    when new.status = 'active' and new.plan like 'pro_%' then 'pro'::subscription_tier
    else 'free'::subscription_tier
  end
  where id = new.user_id;
  return new;
end;
$$;

create trigger subscriptions_after_change_sync_tier
  after insert or update on public.subscriptions
  for each row execute function public.sync_profile_tier();

-- third revision of handle_new_user: now also seeds the subscriptions stub.
-- previous revisions: B1 (profile only), B3 (added default watchlist).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_watchlist_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    )
  );

  insert into public.watchlists (user_id, name, is_default)
  values (new.id, 'Default', true)
  returning id into v_watchlist_id;

  insert into public.subscriptions (user_id, plan, status, source)
  values (new.id, 'free', 'inactive', 'none');

  return new;
end;
$$;

-- backfill subscriptions for any users that signed up before this migration
-- (the b1..b10 seed test users would otherwise lack a row).
insert into public.subscriptions (user_id, plan, status, source)
select u.id, 'free', 'inactive', 'none'
from auth.users u
left join public.subscriptions s on s.user_id = u.id
where s.user_id is null;


-- ====================================================================
-- 20260527_014_audit_tables.sql
-- ====================================================================

-- 014 — llm_calls + data_source_status
-- append-only audit + provider-health observability. service_role only.
-- no client RLS policies → invisible to authenticated/anon (default deny).

create table public.llm_calls (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null,                                   -- 'briefing' | 'extraction' | 'transcript_summary' | 'tone'
  provider        text not null,                                   -- 'anthropic' | 'openai'
  model           text not null,                                   -- 'claude-haiku-4-5' | 'gpt-4o-mini'
  prompt_version  text,
  input_tokens    integer,
  output_tokens   integer,
  cost_usd        numeric(10, 6),
  latency_ms      integer,
  success         boolean not null,
  error           text,
  reference_id    uuid,
  reference_kind  text,
  created_at      timestamptz not null default now()
);

create index idx_llm_calls_created_at on public.llm_calls (created_at desc);
create index idx_llm_calls_kind_model on public.llm_calls (kind, model);

alter table public.llm_calls enable row level security;
-- no select / insert / update / delete policies — service_role only.
-- admin dashboard later can add a role-claim-gated select policy.

create table public.data_source_status (
  source              text primary key,                            -- 'edgar' | 'finnhub' | 'earningscalls' | ...
  last_success_at     timestamptz,
  last_error_at       timestamptz,
  last_error          text,
  success_count_24h   integer not null default 0,
  error_count_24h     integer not null default 0,
  updated_at          timestamptz not null default now()
);

alter table public.data_source_status enable row level security;
-- service_role only, like llm_calls. admin ui later may relax.

-- bootstrap the source rows so modal heartbeat upserts always have a row.
insert into public.data_source_status (source) values
  ('edgar'),
  ('finnhub'),
  ('earningscalls')
on conflict (source) do nothing;


-- ====================================================================
-- 20260527_015_fanout_triggers.sql
-- ====================================================================

-- 015 — fanout + sync_briefing_prompt_version triggers
-- moves three tables from "writes silently" to "writes trigger the
-- notify_user_event edge function." uses the vault-backed app_config_secret
-- helper from 003 (replaces the doc's current_setting('app.foo') pattern
-- since hosted supabase denies ALTER DATABASE SET).
--
-- the edge function in B12 receives:
--   { kind: 'briefing' | 'event' | 'transcript',
--     ticker_symbol: text,
--     reference_id: uuid }

create or replace function public.trigger_notify_fan_out(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url     text;
  v_key     text;
begin
  v_url := public.app_config_secret('supabase_functions_url');
  v_key := public.app_config_secret('service_role_key');

  -- silently no-op if secrets not yet provisioned in vault. lets local dev
  -- and test environments insert briefings/events without a real fan-out.
  if v_url is null or v_key is null then
    return;
  end if;

  perform net.http_post(
    url     := v_url || '/notify_user_event',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := p_payload,
    timeout_milliseconds := 5000
  );
end;
$$;

-- briefings: fire when status flips to 'ready'.
create or replace function public.notify_on_briefing_ready()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'ready' and (tg_op = 'INSERT' or old.status is distinct from 'ready') then
    perform public.trigger_notify_fan_out(jsonb_build_object(
      'kind',           'briefing',
      'ticker_symbol',  new.ticker_symbol,
      'reference_id',   new.id
    ));
  end if;
  return new;
end;
$$;

create trigger briefings_after_change_notify
  after insert or update of status on public.briefings
  for each row execute function public.notify_on_briefing_ready();

-- events: fire when parse_status flips to 'parsed' (matches the rls filter).
create or replace function public.notify_on_event_parsed()
returns trigger
language plpgsql
as $$
begin
  if new.parse_status = 'parsed' and (tg_op = 'INSERT' or old.parse_status is distinct from 'parsed') then
    perform public.trigger_notify_fan_out(jsonb_build_object(
      'kind',           'event',
      'ticker_symbol',  new.ticker_symbol,
      'reference_id',   new.id
    ));
  end if;
  return new;
end;
$$;

create trigger events_after_change_notify
  after insert or update of parse_status on public.events
  for each row execute function public.notify_on_event_parsed();

-- transcript_analysis: fire on insert (analysis row is created once per
-- transcript by modal, no status transitions). join to transcript for ticker.
create or replace function public.notify_on_transcript_analysis()
returns trigger
language plpgsql
as $$
declare
  v_ticker text;
begin
  select ticker_symbol into v_ticker
  from public.transcripts
  where id = new.transcript_id;

  if v_ticker is null then
    return new;
  end if;

  perform public.trigger_notify_fan_out(jsonb_build_object(
    'kind',           'transcript',
    'ticker_symbol',  v_ticker,
    'reference_id',   new.transcript_id
  ));
  return new;
end;
$$;

create trigger transcript_analysis_after_insert_notify
  after insert on public.transcript_analysis
  for each row execute function public.notify_on_transcript_analysis();

-- sync_briefing_prompt_version: keeps the denormalised briefings.prompt_version
-- in sync with model_versions.version. saves a join on every discover read.

create or replace function public.sync_briefing_prompt_version()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.model_version_id is distinct from old.model_version_id then
    if new.model_version_id is not null then
      select version into new.prompt_version
      from public.model_versions
      where id = new.model_version_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger briefings_before_change_sync_prompt
  before insert or update of model_version_id on public.briefings
  for each row execute function public.sync_briefing_prompt_version();


-- ====================================================================
-- 20260527_016_pgcron_jobs.sql
-- ====================================================================

-- 016 — pg_cron jobs (optional, hosted-supabase Pro+ only)
-- schedules the maintenance jobs that drive the cleanup_old_notifications,
-- retry_skipped_pushes, gc_stale_push_tokens edge functions (added in B13).
--
-- pg_cron is only available on Supabase Pro+ tier. Free tier users can
-- either: enable pg_cron via the dashboard (it's a one-click setting), or
-- run these jobs from Modal as a cron worker. this migration is defensive:
-- skips with a NOTICE if pg_cron isn't installed so the migration set still
-- applies cleanly.

do $$
declare
  v_url text;
begin
  perform 1 from pg_extension where extname = 'pg_cron';
  if not found then
    raise notice 'pg_cron not installed; skipping cron schedule. enable via Supabase dashboard or replace with Modal cron.';
    return;
  end if;

  v_url := public.app_config_secret('supabase_functions_url');
  if v_url is null then
    raise notice 'app_config_secret(supabase_functions_url) is null; cron entries scheduled but will no-op until vault is populated.';
  end if;

  -- 3am UTC daily — purge notifications older than 30 days in terminal states.
  perform cron.schedule(
    'sift-cleanup-old-notifications',
    '0 3 * * *',
    $sql$
      select net.http_post(
        url := public.app_config_secret('supabase_functions_url') || '/cleanup_old_notifications',
        headers := jsonb_build_object('Authorization', 'Bearer ' || public.app_config_secret('service_role_key'))
      );
    $sql$
  );

  -- every 5 minutes — pick up status='skipped_quiet' rows whose scheduled_for has elapsed.
  perform cron.schedule(
    'sift-retry-skipped-pushes',
    '*/5 * * * *',
    $sql$
      select net.http_post(
        url := public.app_config_secret('supabase_functions_url') || '/retry_skipped_pushes',
        headers := jsonb_build_object('Authorization', 'Bearer ' || public.app_config_secret('service_role_key'))
      );
    $sql$
  );

  -- weekly Sunday 4am UTC — drop push_tokens not seen in 30 days.
  perform cron.schedule(
    'sift-gc-stale-push-tokens',
    '0 4 * * 0',
    $sql$
      select net.http_post(
        url := public.app_config_secret('supabase_functions_url') || '/gc_stale_push_tokens',
        headers := jsonb_build_object('Authorization', 'Bearer ' || public.app_config_secret('service_role_key'))
      );
    $sql$
  );
end$$;


-- ====================================================================
-- 20260527_017_discover_rpcs.sql
-- ====================================================================

-- 017 — discover_sector_heat + discover_biggest_surprises rpcs
-- discover screen middle + bottom rails. both STABLE SECURITY INVOKER so
-- the briefings (status=ready) and events (parse_status=parsed) RLS filters
-- apply automatically. no new tables; pure read queries.

create or replace function public.discover_sector_heat(
  p_week_start date default date_trunc('week', current_date)::date
)
returns table (sector text, reporting bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    t.sector,
    count(distinct b.id) as reporting
  from public.briefings b
  join public.tickers t on t.symbol = b.ticker_symbol
  where b.expected_release_at >= p_week_start
    and b.expected_release_at <  p_week_start + interval '7 days'
  group by t.sector
  order by reporting desc;
$$;

create or replace function public.discover_biggest_surprises(
  p_days  integer default 7,
  p_limit integer default 4
)
returns table (
  event_id        uuid,
  ticker_symbol   text,
  ticker_name     text,
  fiscal_period   text,
  actual_at       timestamptz,
  surprise_pct    numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    e.id           as event_id,
    e.ticker_symbol,
    t.name         as ticker_name,
    e.fiscal_period,
    e.filed_at     as actual_at,
    m.eps_surprise_pct as surprise_pct
  from public.events e
  join public.tickers t       on t.symbol  = e.ticker_symbol
  join public.event_metrics m on m.event_id = e.id
  where e.parse_status = 'parsed'
    and e.filed_at >= now() - (p_days || ' days')::interval
    and m.eps_surprise_pct is not null
  order by abs(m.eps_surprise_pct) desc
  limit p_limit;
$$;


