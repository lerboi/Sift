-- pgtap test: subscriptions rls + sync_profile_tier + handle_new_user revised seed + audit tables denied

begin;
select plan(6);

-- 1: create a new user; trigger seeds profile + watchlist + subscriptions stub
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000a1', 'alice@test.local', '{}'::jsonb);

select is(
  (select count(*)::int from public.subscriptions where user_id = '00000000-0000-0000-0000-0000000000a1'),
  1,
  'handle_new_user seeds a subscriptions stub row'
);

select is(
  (select plan from public.subscriptions where user_id = '00000000-0000-0000-0000-0000000000a1'),
  'free',
  'seeded subscription plan = free'
);

-- 2: tier sync — flip subscription to active pro_monthly; profiles.tier should follow
update public.subscriptions
set plan = 'pro_monthly', status = 'active'
where user_id = '00000000-0000-0000-0000-0000000000a1';

select is(
  (select tier::text from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'pro',
  'sync_profile_tier flipped profiles.tier to pro on active pro_monthly'
);

-- 3: revert and tier reverts
update public.subscriptions
set status = 'cancelled'
where user_id = '00000000-0000-0000-0000-0000000000a1';

select is(
  (select tier::text from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'free',
  'sync_profile_tier reverted profiles.tier to free on cancellation'
);

-- 4: authenticated users cannot read llm_calls (no policies → default deny)
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select is(
  (select count(*)::int from public.llm_calls),
  0,
  'authenticated cannot read llm_calls (rls default-deny)'
);

-- 5: authenticated users cannot read data_source_status
select is(
  (select count(*)::int from public.data_source_status),
  0,
  'authenticated cannot read data_source_status (rls default-deny)'
);

select * from finish();
rollback;
