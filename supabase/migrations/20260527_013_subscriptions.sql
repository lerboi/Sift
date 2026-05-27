-- 013 — subscriptions + sync_profile_tier + handle_new_user revision
-- post-mvp stub. table exists now so the settings PLAN row's path forward
-- is wired; RevenueCat webhook fills it later. profiles.tier mirrors
-- subscriptions.status+plan via trigger so RLS / feature gating reads stay
-- cheap (no join).

create table public.subscriptions (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  plan                 text not null default 'free',
  status               text not null default 'inactive',
  current_period_end   timestamptz,
  source               text not null default 'none',
  raw                  jsonb,
  updated_at           timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "own subscription select"
  on public.subscriptions for select to authenticated
  using (auth.uid() = user_id);

create trigger set_updated_at_subscriptions
  before update on public.subscriptions
  for each row
  execute function moddatetime(updated_at);

-- mirror subscriptions → profiles.tier so reads stay one-table.
create or replace function public.sync_profile_tier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set tier = case
    when new.status = 'active' and new.plan like 'pro_%' then 'pro'::subscription_tier
    else 'free'::subscription_tier
  end
  where id = new.user_id;
  return new;
end;
$$;

create trigger subscriptions_after_change_sync_tier
  after insert or update on public.subscriptions
  for each row execute function public.sync_profile_tier();

-- third revision of handle_new_user: now also seeds the subscriptions stub.
-- previous revisions: B1 (profile only), B3 (added default watchlist).

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

  insert into public.subscriptions (user_id, plan, status, source)
  values (new.id, 'free', 'inactive', 'none');

  return new;
end;
$$;

-- backfill subscriptions for any users that signed up before this migration
-- (the b1..b10 seed test users would otherwise lack a row).
insert into public.subscriptions (user_id, plan, status, source)
select u.id, 'free', 'inactive', 'none'
from auth.users u
left join public.subscriptions s on s.user_id = u.id
where s.user_id is null;
