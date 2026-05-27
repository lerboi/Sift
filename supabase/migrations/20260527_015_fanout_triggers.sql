-- 015 — fanout + sync_briefing_prompt_version triggers
-- moves three tables from "writes silently" to "writes trigger the
-- notify_user_event edge function." uses the vault-backed app_config_secret
-- helper from 003 (replaces the doc's current_setting('app.foo') pattern
-- since hosted supabase denies ALTER DATABASE SET).
--
-- the edge function in B12 receives:
--   { kind: 'briefing' | 'event' | 'transcript',
--     ticker_symbol: text,
--     reference_id: uuid }

create or replace function public.trigger_notify_fan_out(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url     text;
  v_key     text;
begin
  v_url := public.app_config_secret('supabase_functions_url');
  v_key := public.app_config_secret('service_role_key');

  -- silently no-op if secrets not yet provisioned in vault. lets local dev
  -- and test environments insert briefings/events without a real fan-out.
  if v_url is null or v_key is null then
    return;
  end if;

  perform net.http_post(
    url     := v_url || '/notify_user_event',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := p_payload,
    timeout_milliseconds := 5000
  );
end;
$$;

-- briefings: fire when status flips to 'ready'.
create or replace function public.notify_on_briefing_ready()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'ready' and (tg_op = 'INSERT' or old.status is distinct from 'ready') then
    perform public.trigger_notify_fan_out(jsonb_build_object(
      'kind',           'briefing',
      'ticker_symbol',  new.ticker_symbol,
      'reference_id',   new.id
    ));
  end if;
  return new;
end;
$$;

create trigger briefings_after_change_notify
  after insert or update of status on public.briefings
  for each row execute function public.notify_on_briefing_ready();

-- events: fire when parse_status flips to 'parsed' (matches the rls filter).
create or replace function public.notify_on_event_parsed()
returns trigger
language plpgsql
as $$
begin
  if new.parse_status = 'parsed' and (tg_op = 'INSERT' or old.parse_status is distinct from 'parsed') then
    perform public.trigger_notify_fan_out(jsonb_build_object(
      'kind',           'event',
      'ticker_symbol',  new.ticker_symbol,
      'reference_id',   new.id
    ));
  end if;
  return new;
end;
$$;

create trigger events_after_change_notify
  after insert or update of parse_status on public.events
  for each row execute function public.notify_on_event_parsed();

-- transcript_analysis: fire on insert (analysis row is created once per
-- transcript by modal, no status transitions). join to transcript for ticker.
create or replace function public.notify_on_transcript_analysis()
returns trigger
language plpgsql
as $$
declare
  v_ticker text;
begin
  select ticker_symbol into v_ticker
  from public.transcripts
  where id = new.transcript_id;

  if v_ticker is null then
    return new;
  end if;

  perform public.trigger_notify_fan_out(jsonb_build_object(
    'kind',           'transcript',
    'ticker_symbol',  v_ticker,
    'reference_id',   new.transcript_id
  ));
  return new;
end;
$$;

create trigger transcript_analysis_after_insert_notify
  after insert on public.transcript_analysis
  for each row execute function public.notify_on_transcript_analysis();

-- sync_briefing_prompt_version: keeps the denormalised briefings.prompt_version
-- in sync with model_versions.version. saves a join on every discover read.

create or replace function public.sync_briefing_prompt_version()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.model_version_id is distinct from old.model_version_id then
    if new.model_version_id is not null then
      select version into new.prompt_version
      from public.model_versions
      where id = new.model_version_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger briefings_before_change_sync_prompt
  before insert or update of model_version_id on public.briefings
  for each row execute function public.sync_briefing_prompt_version();
