-- pgtap test: model_versions rls + one-active-per-kind constraint

begin;
select plan(5);

-- 1: seeded 4 active rows
select is(
  (select count(*)::int from public.model_versions where status = 'active'),
  4,
  'four active model rows seeded (one per kind)'
);

-- 2: partial unique index prevents second active per kind
prepare double_active as
  insert into public.model_versions (kind, version, status)
  values ('briefing_prompt', '1.1', 'active');
select throws_ok(
  'execute double_active',
  '23505',
  null,
  'cannot insert a second active briefing_prompt (partial unique)'
);

-- 3: staged inserts allowed even when active exists
prepare staged_insert as
  insert into public.model_versions (kind, version, status)
  values ('briefing_prompt', '1.1-staged', 'staged');
select lives_ok('execute staged_insert', 'staged briefing_prompt v1.1 can coexist with active v1.0');

-- act as authenticated
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000aa', 'reader@test.local', '{}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000aa', true);

-- 4: authenticated reads only active rows
select cmp_ok(
  (select count(*)::int from public.model_versions),
  '=',
  4,
  'authenticated sees only the 4 active rows (staged hidden)'
);

-- 5: backfill set briefings.prompt_version
reset role;
select is(
  (select prompt_version from public.briefings where ticker_symbol = 'AAPL' limit 1),
  '1.0',
  'B9 backfill set briefings.prompt_version to active briefing_prompt version'
);

select * from finish();
rollback;
