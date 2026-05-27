-- pgtap test: events + event_metrics rls + view + generated columns

begin;
select plan(7);

-- 1: seed inserted 3 parsed events
select cmp_ok(
  (select count(*)::int from public.events where parse_status = 'parsed'),
  '>=',
  3,
  'seed populated >= 3 parsed events'
);

-- 2: generated columns computed correctly
select cmp_ok(
  (select round(eps_surprise_pct, 4)
   from public.event_metrics m
   join public.events e on e.id = m.event_id
   where e.ticker_symbol = 'AAPL' limit 1),
  '=',
  round(((2.14 - 1.98) / 1.98)::numeric, 4),
  'eps_surprise_pct generated column matches manual calc for AAPL'
);

-- 3: insert a pending event for rls verification
insert into public.events (ticker_symbol, accession_number, form_type, fiscal_period, filed_at, parse_status)
values ('MSFT', '0000789019-99-000099', '8-K', 'Q9-2099', now(), 'pending');

-- act as authenticated user
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000aa', 'reader@test.local', '{}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000aa', true);

-- 4: pending events hidden
select is(
  (select count(*)::int from public.events where accession_number = '0000789019-99-000099'),
  0,
  'pending events hidden from authenticated reads'
);

-- 5: view returns parsed events only
select cmp_ok(
  (select count(*)::int from public.event_with_metrics_view),
  '>=',
  3,
  'view returns at least 3 rows for parsed events'
);

-- 6: view joins metrics
select isnt(
  (select eps_actual from public.event_with_metrics_view
   where ticker_symbol = 'AAPL' limit 1),
  null::numeric,
  'view exposes eps_actual through left join'
);

-- 7: event_metrics rls: cannot see metrics for pending events
select is(
  (select count(*)::int
   from public.event_metrics m
   join public.events e on e.id = m.event_id
   where e.parse_status = 'pending'),
  0,
  'event_metrics rls: pending parent hides metrics'
);

select * from finish();
rollback;
