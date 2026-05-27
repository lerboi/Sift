-- 003 — app_config_secret helper (Vault wrapper)
-- replaces the docs' current_setting('app.foo') pattern, which fails on hosted
-- supabase (ALTER DATABASE SET is denied). vault.decrypted_secrets is the
-- supported primitive on the managed tier.
--
-- secrets stored under fixed names by the user during pre-loop setup:
--   - supabase_functions_url    (https://<ref>.functions.supabase.co)
--   - service_role_key          (sb_secret_...)
--
-- used by trigger_notify_fan_out (added in a later tick alongside the briefings
-- /events fan-out triggers). isolated here so the deviation is documented in
-- exactly one migration.

create or replace function public.app_config_secret(p_name text)
returns text
language plpgsql
security definer
set search_path = public, vault
stable
as $$
declare
  v_value text;
begin
  select decrypted_secret
    into v_value
  from vault.decrypted_secrets
  where name = p_name
  limit 1;
  return v_value;
end;
$$;

revoke execute on function public.app_config_secret(text) from public, anon, authenticated;
-- service_role + postgres owner retain execute by default (they bypass / own).
