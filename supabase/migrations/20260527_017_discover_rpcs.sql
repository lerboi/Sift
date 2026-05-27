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
