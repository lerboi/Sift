-- pgtap test: home_events_for_user rpc respects rls + state classification

begin;
select plan(5);

-- create two users; both signal up triggers seed default watchlists
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@test.local', '{}'::jsonb),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test.local',   '{}'::jsonb);

-- alice watches AAPL + NVDA; bob watches TSLA
insert into public.watchlist_tickers (watchlist_id, ticker_symbol)
select w.id, t.symbol
from public.watchlists w
cross join (values ('AAPL'), ('NVDA')) as t(symbol)
where w.user_id = '00000000-0000-0000-0000-00000000000a';

insert into public.watchlist_tickers (watchlist_id, ticker_symbol)
select w.id, 'TSLA'
from public.watchlists w
where w.user_id = '00000000-0000-0000-0000-00000000000b';

-- act as alice
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);

-- 1: alice gets rows for her watchlist (AAPL Q4-25 past from seed; AAPL/NVDA briefings from seed)
select cmp_ok(
  (select count(*)::int from public.home_events_for_user('00000000-0000-0000-0000-00000000000a')),
  '>=',
  1,
  'alice gets at least 1 row from home_events_for_user'
);

-- 2: alice does not get TSLA rows
select is(
  (select count(*)::int
   from public.home_events_for_user('00000000-0000-0000-0000-00000000000a')
   where ticker_symbol = 'TSLA'),
  0,
  'alice does not see TSLA events (not watched)'
);

-- 3: rpc enforces rls — alice cannot fetch bob's feed by passing his uuid.
-- because the inner cte filters via w.user_id = p_user_id AND rls,
-- the watched cte is empty when alice calls with bob's uuid (alice can't
-- see bob's watchlists rows). result: empty.
select is(
  (select count(*)::int from public.home_events_for_user('00000000-0000-0000-0000-00000000000b')),
  0,
  'alice cannot fetch bob''s feed (rls denies the inner watchlist read)'
);

-- 4: state classification: past events more than 15 min old should be 'past'
select is(
  (select state
   from public.home_events_for_user('00000000-0000-0000-0000-00000000000a')
   where ticker_symbol = 'AAPL' and actual_at is not null
   limit 1),
  'past',
  'AAPL Q4-25 event (>15min old) is classified as past'
);

-- switch to bob
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);

-- 5: bob sees TSLA Q1-26 event (parsed in seed)
select is(
  (select ticker_symbol
   from public.home_events_for_user('00000000-0000-0000-0000-00000000000b')
   where ticker_symbol = 'TSLA' and actual_at is not null
   limit 1),
  'TSLA',
  'bob sees TSLA Q1-26 event'
);

select * from finish();
rollback;
