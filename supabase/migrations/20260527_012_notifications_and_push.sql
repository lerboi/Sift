-- 012 — notifications + push_tokens + throttle + quiet-hours triggers
-- per-user delivery record (source of truth for retries, dedupe, audit) +
-- device tokens for expo push. throttle and quiet-hours invariants enforced
-- in db so any path (edge function, modal, manual psql) gets the same gates.

create table public.push_tokens (
  user_id       uuid not null references auth.users(id) on delete cascade,
  token         text not null,
  platform      push_platform not null,
  device_id     text,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  primary key (user_id, token)
);

create index idx_push_tokens_user      on public.push_tokens (user_id);
create index idx_push_tokens_last_seen on public.push_tokens (last_seen_at);

alter table public.push_tokens enable row level security;

create policy "own push tokens select"
  on public.push_tokens for select to authenticated
  using (auth.uid() = user_id);

create policy "own push tokens insert"
  on public.push_tokens for insert to authenticated
  with check (auth.uid() = user_id);

create policy "own push tokens update"
  on public.push_tokens for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own push tokens delete"
  on public.push_tokens for delete to authenticated
  using (auth.uid() = user_id);

-- notifications -------------------------------------------------------------

create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  kind            notification_kind not null,
  ticker_symbol   text not null references public.tickers(symbol) on update cascade,
  reference_id    uuid,
  reference_kind  text,
  title           text not null,
  body            text not null,
  deep_link       text not null,
  status          notification_status not null default 'pending',
  error           text,
  created_at      timestamptz not null default now(),
  scheduled_for   timestamptz,
  sent_at         timestamptz,
  delivered_at    timestamptz
);

create index idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

create index idx_notifications_status
  on public.notifications (status)
  where status in ('pending', 'skipped_quiet', 'failed');

-- supports the 3-per-ticker-per-day throttle gate without a separate counter table.
-- the day-bucket expression is anchored to UTC so it's IMMUTABLE (required for
-- index expressions). semantic: throttle resets at 00:00 UTC, not local tz.
create index idx_notifications_user_ticker_day
  on public.notifications (user_id, ticker_symbol, ((created_at at time zone 'UTC')::date));

alter table public.notifications enable row level security;

-- read-only for users; service_role inserts via the fan-out edge function.
create policy "own notifications select"
  on public.notifications for select to authenticated
  using (auth.uid() = user_id);

-- triggers ------------------------------------------------------------------
-- naming convention: numeric prefixes guarantee fire order alphabetically.
-- throttle MUST run before quiet-hours: if the day cap is exceeded we reject
-- outright (P0001); no point computing the quiet-hours deferral after that.

create or replace function public.enforce_push_throttle()
returns trigger
language plpgsql
as $$
declare
  todays_count int;
begin
  select count(*)
    into todays_count
  from public.notifications
  where user_id      = new.user_id
    and ticker_symbol = new.ticker_symbol
    and (created_at at time zone 'UTC')::date = (new.created_at at time zone 'UTC')::date
    and status != 'failed';

  if todays_count >= 3 then
    raise exception 'push throttle exceeded for user % ticker % on %', new.user_id, new.ticker_symbol, (new.created_at at time zone 'UTC')::date
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger notifications_before_insert_1_throttle
  before insert on public.notifications
  for each row execute function public.enforce_push_throttle();

create or replace function public.enforce_quiet_hours()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_tz             text;
  preset              text;
  start_hr            int;
  end_hr              int;
  local_hour          int;
  quiet_end_local     timestamp;
begin
  select tz, quiet_hours_preset
  into user_tz, preset
  from public.profiles where id = new.user_id;

  if preset is null or preset = 'off' then
    return new;
  end if;

  -- preset format: 'SS-EE' (start and end hours in local time).
  start_hr := split_part(preset, '-', 1)::int;
  end_hr   := split_part(preset, '-', 2)::int;
  local_hour := extract(hour from new.created_at at time zone user_tz);

  -- quiet hours span midnight (e.g. 22-07): in-quiet if hour >= start OR hour < end.
  -- daytime quiet hours (rare): in-quiet if hour >= start AND hour < end.
  if (start_hr > end_hr and (local_hour >= start_hr or local_hour < end_hr))
     or (start_hr <= end_hr and local_hour >= start_hr and local_hour < end_hr) then
    quiet_end_local := date_trunc('day', new.created_at at time zone user_tz)
                       + make_interval(hours => end_hr);
    if quiet_end_local <= (new.created_at at time zone user_tz) then
      quiet_end_local := quiet_end_local + interval '1 day';
    end if;

    new.status := 'skipped_quiet';
    new.scheduled_for := quiet_end_local at time zone user_tz;
  end if;

  return new;
end;
$$;

create trigger notifications_before_insert_2_quiet
  before insert on public.notifications
  for each row execute function public.enforce_quiet_hours();
