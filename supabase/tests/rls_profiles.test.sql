-- pgtap test: profiles rls + handle_new_user trigger
-- run with: supabase test db
-- requires the migrations 001-003 to be applied first.

begin;
select plan(7);

-- create two synthetic auth users; trigger should auto-create profile rows
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000000a', 'alice@test.local', '{}'::jsonb),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test.local',   '{}'::jsonb);

-- 1: trigger created two profile rows
select is(
  (select count(*)::int from public.profiles where id in (
    '00000000-0000-0000-0000-00000000000a',
    '00000000-0000-0000-0000-00000000000b'
  )),
  2,
  'handle_new_user created profile rows for both signups'
);

-- 2: display_name defaulted from email local-part
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'alice',
  'display_name defaulted from email when raw_user_meta_data lacks it'
);

-- 3: defaults populated
select is(
  (select tier::text from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'free',
  'tier defaults to free'
);

select is(
  (select disclaimer_ack_at from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  null::timestamptz,
  'disclaimer_ack_at starts null'
);

-- switch to authenticated role acting as alice
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);

-- 4: alice sees only her own profile
select is(
  (select count(*)::int from public.profiles),
  1,
  'alice can only select her own profile row'
);

-- 5: alice can update her own profile
update public.profiles set disclaimer_ack_at = now()
  where id = '00000000-0000-0000-0000-00000000000a';
select isnt(
  (select disclaimer_ack_at from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  null::timestamptz,
  'alice updated her own disclaimer_ack_at'
);

-- 6: alice cannot update bob's profile (silent 0 rows under rls)
update public.profiles set disclaimer_ack_at = now()
  where id = '00000000-0000-0000-0000-00000000000b';

-- need to peek as superuser to verify bob's row unchanged
reset role;
select is(
  (select disclaimer_ack_at from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  null::timestamptz,
  'alice could not modify bob (rls filtered the update)'
);

select * from finish();
rollback;
