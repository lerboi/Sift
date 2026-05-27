-- pgtap test: notifications + push_tokens rls + throttle + quiet hours

begin;
select plan(7);

-- two users; trigger seeds default watchlists
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@test.local', '{}'::jsonb),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test.local',   '{}'::jsonb);

-- alice: quiet hours off so we can isolate throttle behaviour
update public.profiles set quiet_hours_preset = 'off' where id = '00000000-0000-0000-0000-00000000000a';

-- service_role inserts to seed three valid notifications for alice/AAPL today
insert into public.notifications (user_id, kind, ticker_symbol, title, body, deep_link)
values
  ('00000000-0000-0000-0000-00000000000a', 'briefing', 'AAPL', 't1', 'b1', 'sift://x'),
  ('00000000-0000-0000-0000-00000000000a', 'event',    'AAPL', 't2', 'b2', 'sift://x'),
  ('00000000-0000-0000-0000-00000000000a', 'transcript','AAPL', 't3', 'b3', 'sift://x');

-- 1: three notifications inserted
select is(
  (select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-00000000000a'),
  3,
  'three notifications inserted under the cap'
);

-- 2: fourth raises P0001
prepare fourth_aapl as
  insert into public.notifications (user_id, kind, ticker_symbol, title, body, deep_link)
  values ('00000000-0000-0000-0000-00000000000a', 'event', 'AAPL', 't4', 'b4', 'sift://x');
select throws_ok(
  'execute fourth_aapl',
  'P0001',
  null,
  'fourth AAPL notification today raises push throttle'
);

-- 3: a different ticker on the same day is allowed
prepare nvda_today as
  insert into public.notifications (user_id, kind, ticker_symbol, title, body, deep_link)
  values ('00000000-0000-0000-0000-00000000000a', 'event', 'NVDA', 't', 'b', 'sift://x');
select lives_ok('execute nvda_today', 'different ticker bypasses per-ticker throttle');

-- 4: quiet-hours trigger flips status to skipped_quiet when preset matches now
update public.profiles set quiet_hours_preset = '00-23', tz = 'UTC'
  where id = '00000000-0000-0000-0000-00000000000b';

insert into public.notifications (user_id, kind, ticker_symbol, title, body, deep_link)
values ('00000000-0000-0000-0000-00000000000b', 'briefing', 'TSLA', 't', 'b', 'sift://x');

select is(
  (select status::text from public.notifications
   where user_id = '00000000-0000-0000-0000-00000000000b' and ticker_symbol = 'TSLA'),
  'skipped_quiet',
  'quiet-hours trigger deferred bob TSLA notification (preset 00-23 covers entire day)'
);

select isnt(
  (select scheduled_for from public.notifications
   where user_id = '00000000-0000-0000-0000-00000000000b' and ticker_symbol = 'TSLA'),
  null::timestamptz,
  'scheduled_for set when status flipped to skipped_quiet'
);

-- act as authenticated alice
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);

-- 5: alice sees only her own notifications
select cmp_ok(
  (select count(*)::int from public.notifications),
  '>=',
  3,
  'alice sees her notifications'
);

select is(
  (select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-00000000000b'),
  0,
  'alice does not see bob notifications'
);

select * from finish();
rollback;
