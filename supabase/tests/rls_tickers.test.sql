-- pgtap test: tickers RLS — catalog read by all authenticated, no writes.

begin;
select plan(4);

-- bootstrap rows from migration 004 should exist
select cmp_ok(
  (select count(*)::int from public.tickers),
  '>=',
  20,
  'bootstrap seed populated at least 20 tickers'
);

-- create a synthetic auth user and act as them
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000aa', 'reader@test.local', '{}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000aa', true);

-- authenticated users can SELECT all active tickers
select cmp_ok(
  (select count(*)::int from public.tickers),
  '>=',
  20,
  'authenticated reads see the catalog'
);

-- authenticated users cannot INSERT
prepare insert_attempt as
  insert into public.tickers (symbol, name, cik, exchange, sector)
  values ('TEST', 'Test Co.', '0000000001', 'NYSE', 'Financials');

select throws_ok(
  'execute insert_attempt',
  '42501',
  null,
  'authenticated cannot insert into tickers (no insert policy)'
);

-- authenticated users cannot UPDATE
update public.tickers set name = 'Hijacked' where symbol = 'AAPL';
reset role;
select is(
  (select name from public.tickers where symbol = 'AAPL'),
  'Apple Inc.',
  'AAPL name unchanged after attempted hijack (rls filtered update to 0 rows)'
);

select * from finish();
rollback;
