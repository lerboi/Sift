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
