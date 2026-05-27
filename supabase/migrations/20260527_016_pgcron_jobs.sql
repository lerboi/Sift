-- 016 — pg_cron jobs (optional, hosted-supabase Pro+ only)
-- schedules the maintenance jobs that drive the cleanup_old_notifications,
-- retry_skipped_pushes, gc_stale_push_tokens edge functions (added in B13).
--
-- pg_cron is only available on Supabase Pro+ tier. Free tier users can
-- either: enable pg_cron via the dashboard (it's a one-click setting), or
-- run these jobs from Modal as a cron worker. this migration is defensive:
-- skips with a NOTICE if pg_cron isn't installed so the migration set still
-- applies cleanly.

do $$
declare
  v_url text;
begin
  perform 1 from pg_extension where extname = 'pg_cron';
  if not found then
    raise notice 'pg_cron not installed; skipping cron schedule. enable via Supabase dashboard or replace with Modal cron.';
    return;
  end if;

  v_url := public.app_config_secret('supabase_functions_url');
  if v_url is null then
    raise notice 'app_config_secret(supabase_functions_url) is null; cron entries scheduled but will no-op until vault is populated.';
  end if;

  -- 3am UTC daily — purge notifications older than 30 days in terminal states.
  perform cron.schedule(
    'sift-cleanup-old-notifications',
    '0 3 * * *',
    $sql$
      select net.http_post(
        url := public.app_config_secret('supabase_functions_url') || '/cleanup_old_notifications',
        headers := jsonb_build_object('Authorization', 'Bearer ' || public.app_config_secret('service_role_key'))
      );
    $sql$
  );

  -- every 5 minutes — pick up status='skipped_quiet' rows whose scheduled_for has elapsed.
  perform cron.schedule(
    'sift-retry-skipped-pushes',
    '*/5 * * * *',
    $sql$
      select net.http_post(
        url := public.app_config_secret('supabase_functions_url') || '/retry_skipped_pushes',
        headers := jsonb_build_object('Authorization', 'Bearer ' || public.app_config_secret('service_role_key'))
      );
    $sql$
  );

  -- weekly Sunday 4am UTC — drop push_tokens not seen in 30 days.
  perform cron.schedule(
    'sift-gc-stale-push-tokens',
    '0 4 * * 0',
    $sql$
      select net.http_post(
        url := public.app_config_secret('supabase_functions_url') || '/gc_stale_push_tokens',
        headers := jsonb_build_object('Authorization', 'Bearer ' || public.app_config_secret('service_role_key'))
      );
    $sql$
  );
end$$;
