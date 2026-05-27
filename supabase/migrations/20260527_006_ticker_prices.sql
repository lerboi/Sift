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
