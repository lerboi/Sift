-- 002 — profiles
-- extends auth.users with app fields. row inserted by handle_new_user trigger
-- on auth.users INSERT (sign-up or first OAuth callback).
--
-- later ticks CREATE OR REPLACE handle_new_user to also seed watchlists (B3)
-- and subscriptions (B11). this file keeps the profile-only minimal version.

create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  display_name          text,
  tier                  subscription_tier not null default 'free',
  tz                    text not null default 'America/New_York',
  disclaimer_ack_at     timestamptz,
  onboarded_at          timestamptz,
  notify_briefings      boolean not null default true,
  notify_events         boolean not null default true,
  notify_transcripts    boolean not null default false,
  quiet_hours_preset    text not null default '22-07',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_profiles_tier on public.profiles (tier);

-- rls -----------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy "own profile select"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "own profile update"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- insert handled by handle_new_user trigger running as definer; no client policy.
-- delete cascades from auth.users; no client policy.

-- triggers ------------------------------------------------------------------

create trigger set_updated_at_profiles
  before update on public.profiles
  for each row
  execute function moddatetime(updated_at);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
