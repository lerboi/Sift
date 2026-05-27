# Edge Functions

Sift's Supabase Edge Functions (Deno runtime). One subdirectory per function.

## Inventory

| Function | Trigger | Cadence |
| --- | --- | --- |
| `notify_user_event` | DB trigger `trigger_notify_fan_out` (migration 015) | on briefing-ready / event-parsed / transcript-analysis insert |
| `cleanup_old_notifications` | `pg_cron` job `sift-cleanup-old-notifications` (migration 016) | daily 3am UTC |
| `retry_skipped_pushes` | `pg_cron` job `sift-retry-skipped-pushes` (migration 016) | every 5 min |
| `gc_stale_push_tokens` | `pg_cron` job `sift-gc-stale-push-tokens` (migration 016) | weekly Sunday 4am UTC |

## Deploy all

```
supabase functions deploy notify_user_event
supabase functions deploy cleanup_old_notifications
supabase functions deploy retry_skipped_pushes
supabase functions deploy gc_stale_push_tokens
```

Auto-injected env vars in the Supabase Edge runtime:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` (unused here)

No manual env setup required.

## Auth

Cron-triggered functions are POSTed by `pg_cron` with `Authorization: Bearer <service_role_key>` (pulled from Vault via `app_config_secret`). `notify_user_event` is POSTed by `trigger_notify_fan_out` with the same.

If you need to invoke a function from an unauthenticated browser context, set `verify_jwt = false` in `supabase/config.toml` under the function's section. Sift doesn't currently expose any function this way.

## Local invocation

```
supabase functions serve <function_name>
curl -X POST http://127.0.0.1:54321/functions/v1/<function_name> \
  -H "Authorization: Bearer <service_role_key>"
```

For `notify_user_event` you also need a JSON body:

```
curl -X POST http://127.0.0.1:54321/functions/v1/notify_user_event \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{"kind":"briefing","ticker_symbol":"AAPL","reference_id":"<uuid>"}'
```

## Conventions

- One file per function (`index.ts`). Helpers move to `_shared/` when reused.
- supabase-js imported via `https://esm.sh/@supabase/supabase-js@2`; pinned major to avoid surprise breakages.
- `auth: { persistSession: false, autoRefreshToken: false }` on every client — serverless context, no session to persist.
- Return 200 with `{ ok: true, ...summary }` on success; 500 on backend errors (cron retries naturally). 4xx for caller-fixable errors.
- Log via `console.warn` / `console.error` — Supabase dashboard surfaces these searchably.
