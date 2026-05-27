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
