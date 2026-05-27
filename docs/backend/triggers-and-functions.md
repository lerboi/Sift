# Triggers, functions, and edge functions

Server-side logic. Three layers:

1. **DB triggers + functions** (Postgres, `plpgsql`) — invariants, derived state, fan-out fan-out.
2. **Edge functions** (Supabase, Deno) — anything that calls external HTTP (Expo Push), runs longer than a trigger should, or needs JS/TS.
3. **Scheduled jobs** — `pg_cron` for in-DB tasks; Modal for everything else.

---

## DB triggers + functions

### `set_updated_at` — auto-bump `updated_at` columns

Universal pattern via the `moddatetime` extension (enabled in `20260525_001_extensions.sql`).

```sql
-- Apply per table that has an updated_at column.
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

-- Repeat for: tickers, briefings, subscriptions.
```

`moddatetime` is a tiny extension that does only this. Avoids hand-rolled triggers per table.

### `on_auth_user_created` — auto-create `profiles` and default `watchlist`

Fires when Supabase Auth inserts a row into `auth.users` (sign-up or first OAuth login).

```sql
CREATE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER                                    -- run with elevated privileges to bypass RLS on insert
SET search_path = public
AS $$
DECLARE
  new_watchlist_id uuid;
BEGIN
  -- 1. profile
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  -- 2. default watchlist
  INSERT INTO public.watchlists (user_id, name, is_default)
  VALUES (NEW.id, 'Default', true)
  RETURNING id INTO new_watchlist_id;

  -- 3. inactive subscription stub (so all RLS reads have a row to find)
  INSERT INTO public.subscriptions (user_id, plan, status, source)
  VALUES (NEW.id, 'free', 'inactive', 'none');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

**Rationale:**
- `SECURITY DEFINER` is required because RLS on `profiles` doesn't permit `INSERT` from a logged-in user (we only have UPDATE/SELECT policies). The trigger runs in DB context with full privileges.
- `SET search_path = public` is a security hardening — without it, a malicious schema-search-path attack could redirect the inserts. Always set explicitly on SECURITY DEFINER functions.
- The fallback `display_name` (`split_part(email, '@', 1)`) gives the user something sensible until they edit it. Settings will let them change it later.
- Three inserts in one trigger keeps signup atomic — either all happen or the auth.users row rollback cascades.

### `set_profile_tier_from_subscription` — keep `profiles.tier` in sync

```sql
CREATE FUNCTION sync_profile_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET tier = CASE
    WHEN NEW.status = 'active' AND NEW.plan LIKE 'pro_%' THEN 'pro'::subscription_tier
    ELSE 'free'::subscription_tier
  END
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER subscriptions_after_update_sync_tier
  AFTER INSERT OR UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_profile_tier();
```

Lets feature-gating reads check `profiles.tier` without joining `subscriptions` — one less query per request.

### `enforce_push_throttle` — 3 pushes per ticker per day max

Per `realtime-and-push.md` § Quiet hours and rate caps + Settings' "Pushes are throttled to a maximum of three per ticker per day" copy.

```sql
CREATE FUNCTION enforce_push_throttle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  todays_count int;
BEGIN
  SELECT count(*)
  INTO todays_count
  FROM notifications
  WHERE user_id      = NEW.user_id
    AND ticker_symbol = NEW.ticker_symbol
    AND created_at::date = NEW.created_at::date
    AND status != 'failed';                          -- failed attempts don't count toward the cap

  IF todays_count >= 3 THEN
    RAISE EXCEPTION 'push throttle exceeded for user % ticker % on %', NEW.user_id, NEW.ticker_symbol, NEW.created_at::date
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER notifications_before_insert_throttle
  BEFORE INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION enforce_push_throttle();
```

The fan-out edge function catches the `P0001` and skips the row (logs it; doesn't surface to user). Index `idx_notifications_user_ticker_day` from `schema.md` makes the count cheap.

**Why DB-side, not edge-function-side:**
- The check is needed before *any* fan-out path inserts. Modal and the edge function both bypass user-facing code.
- Database constraints don't get bypassed by mistake the way edge-function logic does.
- The trigger fires per row even when fan-out inserts in batches.

### `enforce_quiet_hours` — defer pushes that land inside quiet hours

```sql
CREATE FUNCTION enforce_quiet_hours()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tz             text;
  preset              text;
  start_hr            int;
  end_hr              int;
  local_hour          int;
  quiet_end_local     timestamp;
BEGIN
  SELECT tz, quiet_hours_preset
  INTO user_tz, preset
  FROM profiles WHERE id = NEW.user_id;

  IF preset = 'off' THEN
    RETURN NEW;
  END IF;

  -- preset format: 'SS-EE' where SS, EE are start/end hours in user's local tz
  start_hr := split_part(preset, '-', 1)::int;
  end_hr   := split_part(preset, '-', 2)::int;
  local_hour := EXTRACT(HOUR FROM NEW.created_at AT TIME ZONE user_tz);

  -- quiet hours span midnight (e.g. 22-07): in-quiet if hour >= start OR hour < end
  -- daytime quiet hours (rare): in-quiet if hour >= start AND hour < end
  IF (start_hr > end_hr AND (local_hour >= start_hr OR local_hour < end_hr))
     OR (start_hr <= end_hr AND local_hour >= start_hr AND local_hour < end_hr) THEN
    -- compute the next end-of-quiet timestamp in user's tz
    quiet_end_local := date_trunc('day', NEW.created_at AT TIME ZONE user_tz)
                       + make_interval(hours => end_hr);
    IF quiet_end_local <= (NEW.created_at AT TIME ZONE user_tz) THEN
      quiet_end_local := quiet_end_local + interval '1 day';
    END IF;

    NEW.status := 'skipped_quiet';
    NEW.scheduled_for := quiet_end_local AT TIME ZONE user_tz;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER notifications_before_insert_quiet
  BEFORE INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION enforce_quiet_hours();
```

Order matters: **throttle runs first, then quiet-hours** — if a notification would exceed the throttle, it's rejected outright. Triggers fire in alphabetical order on the trigger name unless explicitly ordered; the names above (`notifications_before_insert_throttle` < `notifications_before_insert_quiet`) get the right order naturally.

A retry worker picks up `status='skipped_quiet'` rows where `scheduled_for <= now()` and re-sends them (via the edge function's `retry_pending` cron path).

### `denormalise_briefing_prompt_version`

Keeps `briefings.prompt_version` in sync with `model_versions.version` when the FK changes. Saves a join on every Discover read.

```sql
CREATE FUNCTION sync_briefing_prompt_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.model_version_id IS DISTINCT FROM OLD.model_version_id THEN
    SELECT version INTO NEW.prompt_version
    FROM model_versions
    WHERE id = NEW.model_version_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER briefings_before_update_sync_prompt
  BEFORE INSERT OR UPDATE OF model_version_id ON briefings
  FOR EACH ROW
  EXECUTE FUNCTION sync_briefing_prompt_version();
```

---

## Fan-out trigger — DB → Edge Function

When a row is inserted in `briefings`, `events`, or `transcript_analysis`, the fan-out edge function runs.

```sql
-- Helper: invoke the notify_user_event Edge Function via Supabase's pg_net.
-- Requires the `pg_net` extension (enabled in Supabase by default).

CREATE FUNCTION trigger_notify_fan_out(p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- hosted supabase: vault-backed lookup. self-hosted alternative uses
  -- current_setting('app.foo'); see § "Setting runtime parameters" below.
  PERFORM net.http_post(
    url     := public.app_config_secret('supabase_functions_url') || '/notify_user_event',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.app_config_secret('service_role_key')
    ),
    body    := p_payload,
    timeout_milliseconds := 5000
  );
END;
$$;

-- Trigger per source table
CREATE FUNCTION notify_on_briefing_ready()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'ready' AND (OLD IS NULL OR OLD.status != 'ready') THEN
    PERFORM trigger_notify_fan_out(jsonb_build_object(
      'kind', 'briefing',
      'ticker_symbol', NEW.ticker_symbol,
      'reference_id', NEW.id
    ));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER briefings_after_change_notify
  AFTER INSERT OR UPDATE OF status ON briefings
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_briefing_ready();

-- Similar for events.parse_status='parsed' and transcript_analysis insert.
CREATE FUNCTION notify_on_event_parsed()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parse_status = 'parsed' AND (OLD IS NULL OR OLD.parse_status != 'parsed') THEN
    PERFORM trigger_notify_fan_out(jsonb_build_object(
      'kind', 'event',
      'ticker_symbol', NEW.ticker_symbol,
      'reference_id', NEW.id
    ));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER events_after_change_notify
  AFTER INSERT OR UPDATE OF parse_status ON events
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_event_parsed();
```

**Why fire on `parsed`, not on `pending` insert:**
The frontend doesn't show `pending` events (RLS filters them out). Push fan-out should match — wait until the parsed data is queryable, then notify. If the parser updates the row from `pending` → `parsed`, the AFTER UPDATE trigger catches that transition.

**`public.app_config_secret(...)`:** hosted Supabase doesn't permit `ALTER DATABASE ... SET app.*`, so we wrap `vault.decrypted_secrets` in a SECURITY DEFINER helper. See § "Setting runtime parameters" below for the rationale and the migration that installs it (`003_app_config_secret.sql`).

---

## Edge functions (Supabase, Deno)

### `notify_user_event`

Triggered by the DB fan-out functions above. Single function handles all three notification kinds.

```ts
// supabase/functions/notify_user_event/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface FanOutPayload {
  kind: 'briefing' | 'event' | 'transcript';
  ticker_symbol: string;
  reference_id: string;
}

Deno.serve(async (req) => {
  const payload: FanOutPayload = await req.json();
  const { kind, ticker_symbol, reference_id } = payload;

  // 1. Find watchers
  const { data: watchers } = await supabase
    .from('watchlist_tickers')
    .select('watchlist:watchlists!inner(user_id)')
    .eq('ticker_symbol', ticker_symbol);

  const userIds = [...new Set(watchers?.map(w => w.watchlist.user_id) ?? [])];
  if (userIds.length === 0) return new Response('no watchers', { status: 200 });

  // 2. Load notification payload templates (per-kind body builders)
  const notifContent = await buildNotification(kind, reference_id);

  // 3. Filter by user notification prefs
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, notify_briefings, notify_events, notify_transcripts')
    .in('id', userIds);

  const wanters = profiles?.filter(p =>
    (kind === 'briefing'   && p.notify_briefings) ||
    (kind === 'event'      && p.notify_events) ||
    (kind === 'transcript' && p.notify_transcripts)
  ) ?? [];

  // 4. INSERT notifications (throttle + quiet-hours triggers handle the rest)
  const rows = wanters.map(p => ({
    user_id: p.id,
    kind,
    ticker_symbol,
    reference_id,
    reference_kind: kind,
    title: notifContent.title,
    body: notifContent.body,
    deep_link: notifContent.deepLink,
  }));

  const { error } = await supabase.from('notifications').insert(rows);
  if (error) {
    console.error('notif insert failed', error);
    // Throttle exceptions (P0001) are not retried; other errors are
    return new Response(JSON.stringify({ error }), { status: 500 });
  }

  // 5. Fetch sendable (not skipped_quiet) push tokens
  const sendableUserIds = rows.filter(r => r.status !== 'skipped_quiet').map(r => r.user_id);
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('user_id, token')
    .in('user_id', sendableUserIds);

  // 6. Batch POST to Expo Push (max 100 per batch)
  const messages = tokens?.map(t => ({
    to: t.token,
    title: notifContent.title,
    body: notifContent.body,
    data: { deep_link: notifContent.deepLink, kind, reference_id },
    priority: kind === 'event' ? 'high' : 'normal',
    sound: 'default',
  })) ?? [];

  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip' },
      body: JSON.stringify(batch),
    });
  }

  return new Response(JSON.stringify({ inserted: rows.length, sent: messages.length }), { status: 200 });
});

async function buildNotification(kind: string, refId: string) {
  // load the source row, format title/body, return { title, body, deepLink }
  // …per kind, with compliance copy gate
}
```

**Compliance copy gate:** `buildNotification` runs every output through a forbidden-word regex (the same one from `compliance.md`). Any flagged content sets `notifications.status='failed'` with an error; the row is never sent. Manual review queue catches these.

### `cleanup_old_notifications` — daily cron

```ts
// supabase/functions/cleanup_old_notifications/index.ts
Deno.serve(async () => {
  // Delete notifications older than 30 days that are in a terminal state.
  // Keep recent rows for audit + the user's in-app notif tray.
  const { error } = await supabase
    .from('notifications')
    .delete()
    .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .in('status', ['sent', 'delivered', 'failed']);

  return new Response(JSON.stringify({ ok: !error }), { status: error ? 500 : 200 });
});
```

Schedule via `pg_cron`:

```sql
SELECT cron.schedule(
  'cleanup-old-notifications',
  '0 3 * * *',   -- 3am UTC daily
  $$ SELECT net.http_post(
       url := current_setting('app.supabase_functions_url') || '/cleanup_old_notifications',
       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
     ) $$
);
```

### `retry_skipped_pushes` — every 5 minutes

Picks up `notifications` where `status = 'skipped_quiet' AND scheduled_for <= now()` and re-fires the relevant Expo Push call (without re-running the throttle/quiet-hours triggers; those have already gated).

Schedule similarly via `pg_cron`.

### `gc_stale_push_tokens` — weekly

Deletes `push_tokens` with `last_seen_at < now() - interval '30 days'`. Cheap maintenance.

---

## Edge function vs Modal — when to use which

| Workload | Edge Function | Modal |
| --- | --- | --- |
| Fan-out (DB trigger → HTTP POST) | ✅ Triggered automatically; low latency hop | OK; needs separate cron to listen |
| EDGAR poll (long-running, 60s loop) | ❌ Per-invocation runtime cap | ✅ Persistent function with `keep_warm=1` |
| LLM call (3-6s) | ✅ within timeout | ✅ |
| ML model inference (load joblib model) | ❌ no Python runtime | ✅ |
| Pure DB cleanup | ✅ short-running | overkill |
| Webhook receiver (RevenueCat, Stripe) | ✅ HTTP-first | OK but Edge Function is the natural fit |

**Rule of thumb:** Edge Function if (a) triggered by HTTP / DB event, (b) <60s runtime, (c) JS/TS or pure SQL. Modal otherwise.

---

## Setting runtime parameters

The fan-out trigger needs the edge-function base URL and the service role key. Two paths depending on where the database is hosted.

### Hosted Supabase (what Sift uses) — Vault

Hosted Supabase denies `ALTER DATABASE ... SET app.*` (42501 permission denied — only superuser can set custom GUCs, and managed-tier roles aren't superuser). Use **Supabase Vault** instead:

```sql
-- run once per environment in the SQL editor
select vault.create_secret(
  'https://<project-ref>.functions.supabase.co',
  'supabase_functions_url',
  'base URL for invoking edge functions from triggers'
);

select vault.create_secret(
  '<sb_secret_...>',
  'service_role_key',
  'service_role key for trigger->edge-function auth'
);
```

Triggers read via the `public.app_config_secret(name text)` helper installed by migration `003_app_config_secret.sql`. That wrapper is `SECURITY DEFINER` (so it can see `vault.decrypted_secrets`) and revoked from `anon` / `authenticated` (so PostgREST can't expose it).

Inside trigger bodies, the canonical pattern is:

```sql
perform net.http_post(
  url     := public.app_config_secret('supabase_functions_url') || '/notify_user_event',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || public.app_config_secret('service_role_key')
  ),
  body    := p_payload,
  timeout_milliseconds := 5000
);
```

Vault keeps the key encrypted at rest, and rotating it is one `vault.create_secret` (or `vault.update_secret`) call — no migration required.

### Self-hosted Postgres — `ALTER DATABASE` (legacy reference)

When running against self-hosted Postgres (not hosted Supabase), the GUC pattern works:

```sql
ALTER DATABASE postgres SET app.supabase_functions_url = 'https://<project-ref>.functions.supabase.co';
ALTER DATABASE postgres SET app.service_role_key = '<sb_secret_...>';
```

Triggers then read via `current_setting('app.supabase_functions_url')` and `current_setting('app.service_role_key')`. Don't commit a migration that sets these literally — the service role key must not end up in git.

**Sift runs on hosted Supabase**, so the GUC path is documented only as the alternative pattern. All trigger code in this repo uses `app_config_secret` (Vault).
