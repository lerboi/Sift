-- supabase db reset hook. runs after migrations finish.
-- loads the russell-1000 seed if the csv exists (run scripts/build_ticker_seed.py first).
-- on-conflict-do-nothing means re-running is safe and the bootstrap rows from
-- migration 004 are not duplicated.

\set seed_path 'supabase/seed/russell_1000.csv'

-- only attempt the copy if the csv was generated. silently skip otherwise so
-- a fresh clone of the repo (no csv yet) doesn't break db reset.
\if :{?seed_path}
  begin;
  create temporary table _ticker_seed (like public.tickers including defaults) on commit drop;
  \copy _ticker_seed (symbol, name, cik, exchange, sector, industry, market_cap_class) from 'supabase/seed/russell_1000.csv' csv header;
  insert into public.tickers (symbol, name, cik, exchange, sector, industry, market_cap_class, is_active)
  select symbol, name, cik, exchange, sector, industry, market_cap_class, true
  from _ticker_seed
  on conflict (symbol) do update set
    name = excluded.name,
    cik = excluded.cik,
    exchange = excluded.exchange,
    sector = excluded.sector,
    industry = excluded.industry,
    market_cap_class = excluded.market_cap_class,
    updated_at = now()
  where public.tickers.is_active = true;
  commit;
\endif
