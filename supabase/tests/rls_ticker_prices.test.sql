-- pgtap test: ticker_prices rls + ticker_sparkline rpc

begin;
select plan(5);

-- seed loaded from migration 006: 10 tickers x 30 days = 300 rows
select cmp_ok(
  (select count(*)::int from public.ticker_prices),
  '>=',
  300,
  'seed populated >= 300 ticker_prices rows'
);

-- create a synthetic user, act as them
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000aa', 'reader@test.local', '{}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000aa', true);

-- authenticated can read all rows
select cmp_ok(
  (select count(*)::int from public.ticker_prices),
  '>=',
  300,
  'authenticated reads all ticker_prices'
);

-- rpc returns 30 rows for AAPL by default
select is(
  (select count(*)::int from public.ticker_sparkline('AAPL')),
  30,
  'ticker_sparkline default 30 days returns 30 rows for AAPL'
);

-- rpc respects p_days
select is(
  (select count(*)::int from public.ticker_sparkline('AAPL', 7)),
  7,
  'ticker_sparkline p_days=7 returns 7 rows'
);

-- rpc uppercases input
select is(
  (select count(*)::int from public.ticker_sparkline('aapl', 30)),
  30,
  'ticker_sparkline normalises lowercase input via upper()'
);

select * from finish();
rollback;
