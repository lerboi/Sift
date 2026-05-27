-- pgtap test: watchlists + watchlist_tickers rls
-- verifies isolation between two users.

begin;
select plan(8);

-- two synthetic users; trigger seeds a default watchlist each
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@test.local', '{}'::jsonb),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test.local',   '{}'::jsonb);

-- 1: handle_new_user created one watchlist per user
select is(
  (select count(*)::int from public.watchlists where user_id = '00000000-0000-0000-0000-00000000000a'),
  1,
  'alice has 1 default watchlist'
);

select is(
  (select is_default from public.watchlists where user_id = '00000000-0000-0000-0000-00000000000a' limit 1),
  true,
  'alice default flag is true'
);

-- act as alice
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);

-- 2: alice sees only her watchlist
select is(
  (select count(*)::int from public.watchlists),
  1,
  'alice sees only her own watchlist'
);

-- 3: alice can insert into her watchlist
prepare alice_insert as
  insert into public.watchlist_tickers (watchlist_id, ticker_symbol)
  select w.id, 'AAPL' from public.watchlists w
  where w.user_id = '00000000-0000-0000-0000-00000000000a';
select lives_ok('execute alice_insert', 'alice can insert into her own watchlist');

-- 4: row visible via view, filtered to alice
select is(
  (select count(*)::int from public.watchlist_with_meta_view),
  1,
  'view returns alice''s one row'
);

-- 5: alice cannot insert into bob's watchlist
prepare alice_attempt_bob as
  insert into public.watchlist_tickers (watchlist_id, ticker_symbol)
  select w.id, 'MSFT' from public.watchlists w
  where w.user_id = '00000000-0000-0000-0000-00000000000b';
select throws_ok(
  'execute alice_attempt_bob',
  '42501',
  null,
  'alice cannot insert into bob''s watchlist (parent-check rls denies)'
);

-- switch to bob
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);

-- 6: bob sees only his (empty) watchlist tickers
select is(
  (select count(*)::int from public.watchlist_tickers),
  0,
  'bob sees no watchlist_tickers'
);

select is(
  (select count(*)::int from public.watchlist_with_meta_view),
  0,
  'view returns 0 rows for bob'
);

select * from finish();
rollback;
