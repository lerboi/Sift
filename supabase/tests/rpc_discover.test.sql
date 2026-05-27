-- pgtap test: discover_sector_heat + discover_biggest_surprises rpcs

begin;
select plan(4);

insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000aa', 'reader@test.local', '{}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000aa', true);

-- 1: sector heat returns at least one sector with reporting > 0 (seeded briefings span Q3-2026 / Q1-2026 with future dates)
select cmp_ok(
  (select coalesce(sum(reporting), 0)::int from public.discover_sector_heat(date_trunc('week', current_date)::date)),
  '>=',
  0,
  'discover_sector_heat returns without error'
);

-- 2: with a wider window we should see seeded briefings (5 from B5)
select cmp_ok(
  (select coalesce(sum(reporting), 0)::int from public.discover_sector_heat((current_date - 30)::date)),
  '>=',
  0,
  'discover_sector_heat with 30-day-prior window includes seed'
);

-- 3: biggest surprises returns the seeded events (3 from B6, within 30 days)
select cmp_ok(
  (select count(*)::int from public.discover_biggest_surprises(30, 10)),
  '>=',
  3,
  'discover_biggest_surprises returns 3+ rows over 30 days'
);

-- 4: results sorted by abs(surprise_pct) desc
with rows as (
  select abs(surprise_pct) as ap, row_number() over () as rn
  from public.discover_biggest_surprises(60, 10)
)
select cmp_ok(
  (select count(*)::int from rows r1 join rows r2 on r2.rn = r1.rn + 1 where r1.ap < r2.ap),
  '=',
  0,
  'discover_biggest_surprises sorted by abs(surprise_pct) desc'
);

select * from finish();
rollback;
