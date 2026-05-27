-- pgtap test: transcripts rls + ticker_detail_timeline rpc

begin;
select plan(5);

-- 1: seed inserted at least one transcript
select cmp_ok(
  (select count(*)::int from public.transcripts),
  '>=',
  1,
  'seed populated transcripts'
);

-- act as authenticated user
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000aa', 'reader@test.local', '{}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000aa', true);

-- 2: authenticated can read transcripts
select cmp_ok(
  (select count(*)::int from public.transcripts),
  '>=',
  1,
  'authenticated reads transcripts'
);

-- 3: authenticated can read transcript_analysis
select cmp_ok(
  (select count(*)::int from public.transcript_analysis),
  '>=',
  1,
  'authenticated reads transcript_analysis'
);

-- 4: rpc returns rows for AAPL (upcoming briefing + past event + transcript at minimum)
select cmp_ok(
  (select count(*)::int from public.ticker_detail_timeline('AAPL')),
  '>=',
  3,
  'ticker_detail_timeline returns at least 3 rows for AAPL (briefing + event + transcript)'
);

-- 5: rpc results contain the transcript kind
select is(
  (select count(*)::int
   from public.ticker_detail_timeline('AAPL')
   where kind = 'transcript'),
  1,
  'AAPL has exactly one transcript row from seed'
);

select * from finish();
rollback;
