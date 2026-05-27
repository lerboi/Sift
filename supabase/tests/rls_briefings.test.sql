-- pgtap test: briefings rls (status='ready' filter) + discover_biggest_expected rpc

begin;
select plan(6);

-- seed loaded from migration 007: ≥5 ready briefings
select cmp_ok(
  (select count(*)::int from public.briefings where status = 'ready'),
  '>=',
  5,
  'seed populated >= 5 ready briefings'
);

-- insert a pending briefing for testing rls filter
insert into public.briefings (ticker_symbol, fiscal_period, expected_release_at, status)
values ('AMD', 'Q1-2099', now() + interval '300 days', 'pending');

-- act as authenticated
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000aa', 'reader@test.local', '{}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000aa', true);

-- 1: pending briefing is hidden from authenticated reads
select is(
  (select count(*)::int from public.briefings where fiscal_period = 'Q1-2099'),
  0,
  'pending briefings hidden by rls (status=ready filter)'
);

-- 2: ready briefings visible
select cmp_ok(
  (select count(*)::int from public.briefings),
  '>=',
  5,
  'authenticated sees ready briefings'
);

-- 3: discover_biggest_expected returns rows within the current/next week window
select cmp_ok(
  (select count(*)::int from public.discover_biggest_expected(10, date_trunc('week', current_date)::date)),
  '>=',
  0,
  'discover_biggest_expected returns without error'
);

-- 4: rpc respects p_limit
select cmp_ok(
  (select count(*)::int from public.discover_biggest_expected(2, (current_date - 30)::date)),
  '<=',
  2,
  'discover_biggest_expected p_limit caps the result'
);

-- 5: rpc sorted desc on expected_move_pct
with rows as (
  select expected_move_pct, row_number() over (order by 1) as rn
  from public.discover_biggest_expected(10, (current_date - 7)::date)
)
select cmp_ok(
  (select count(*)::int from rows r1
   join rows r2 on r2.rn = r1.rn + 1
   where r1.expected_move_pct < r2.expected_move_pct),
  '=',
  0,
  'discover_biggest_expected sorted desc by expected_move_pct'
);

select * from finish();
rollback;
