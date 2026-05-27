-- 005 — watchlists + watchlist_tickers + view + handle_new_user extension
-- one default watchlist per user, seeded by the auth trigger. user can have
-- more later (multi-watchlist UI is post-MVP). watchlist_tickers is the N:N
-- join; rls is parent-checked via the watchlists.user_id chain.

create table public.watchlists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'Default',
  is_default  boolean not null default true,
  created_at  timestamptz not null default now()
);

create index idx_watchlists_user on public.watchlists (user_id);
create unique index idx_watchlists_one_default_per_user
  on public.watchlists (user_id)
  where is_default;

create table public.watchlist_tickers (
  watchlist_id   uuid not null references public.watchlists(id) on delete cascade,
  ticker_symbol  text not null references public.tickers(symbol) on update cascade,
  added_at       timestamptz not null default now(),
  sort_order     integer,
  primary key (watchlist_id, ticker_symbol)
);

-- fanout query path: "who watches AAPL?" needs an index on ticker_symbol
-- because the notify_user_event edge function joins by ticker.
create index idx_watchlist_tickers_ticker on public.watchlist_tickers (ticker_symbol);

-- rls -----------------------------------------------------------------------

alter table public.watchlists enable row level security;

create policy "own watchlists select"
  on public.watchlists for select to authenticated
  using (auth.uid() = user_id);

create policy "own watchlists insert"
  on public.watchlists for insert to authenticated
  with check (auth.uid() = user_id);

create policy "own watchlists update"
  on public.watchlists for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own watchlists delete"
  on public.watchlists for delete to authenticated
  using (auth.uid() = user_id);

alter table public.watchlist_tickers enable row level security;

-- parent-checked: a watchlist_tickers row is yours iff its parent watchlist
-- belongs to you. EXISTS turns into a hash semi-join (watchlists.user_id is
-- indexed) so cost stays flat as watchlists grows.
create policy "wt select via own watchlist"
  on public.watchlist_tickers for select to authenticated
  using (exists (
    select 1 from public.watchlists w
    where w.id = watchlist_id and w.user_id = auth.uid()
  ));

create policy "wt insert via own watchlist"
  on public.watchlist_tickers for insert to authenticated
  with check (exists (
    select 1 from public.watchlists w
    where w.id = watchlist_id and w.user_id = auth.uid()
  ));

create policy "wt update via own watchlist"
  on public.watchlist_tickers for update to authenticated
  using (exists (
    select 1 from public.watchlists w
    where w.id = watchlist_id and w.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.watchlists w
    where w.id = watchlist_id and w.user_id = auth.uid()
  ));

create policy "wt delete via own watchlist"
  on public.watchlist_tickers for delete to authenticated
  using (exists (
    select 1 from public.watchlists w
    where w.id = watchlist_id and w.user_id = auth.uid()
  ));

-- extend handle_new_user: also seed a default watchlist on signup.
-- this is the second of three revisions; B11 will add the subscriptions stub.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_watchlist_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    )
  );

  insert into public.watchlists (user_id, name, is_default)
  values (new.id, 'Default', true)
  returning id into v_watchlist_id;

  return new;
end;
$$;

-- view ----------------------------------------------------------------------
-- briefings table doesn't exist until B5; next_* columns are null placeholders
-- here. B5 will CREATE OR REPLACE to populate from the briefings LATERAL join.

create view public.watchlist_with_meta_view as
select
  w.user_id,
  wt.ticker_symbol         as symbol,
  t.name,
  t.sector,
  wt.added_at,
  wt.sort_order,
  null::text               as next_fiscal_period,
  null::timestamptz        as next_expected_at,
  null::numeric(5,4)       as next_beat_probability,
  false                    as briefing_ready
from public.watchlists w
join public.watchlist_tickers wt on wt.watchlist_id = w.id
join public.tickers t            on t.symbol        = wt.ticker_symbol;

-- view inherits rls from underlying tables (watchlists policy filters to
-- auth.uid()=user_id). no separate grant needed beyond the default usage.
