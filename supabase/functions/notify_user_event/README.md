# notify_user_event

Deno/TS edge function. Receives fan-out POSTs from `trigger_notify_fan_out` (migration 015) and writes per-user notifications + sends Expo Push.

## Deploy

```
supabase functions deploy notify_user_event
```

(Per project setup; no env var injection needed — Supabase auto-provisions `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.)

## Smoke test

Insert a briefing with `status='ready'` for a ticker someone is watching:

```sql
update public.briefings set status = 'ready' where ticker_symbol = 'AAPL' limit 1;
```

The trigger fires → POSTs the function → notifications row appears → push delivered to any registered device.

Check `notifications` row count + `status`:

```sql
select * from public.notifications where ticker_symbol = 'AAPL' order by created_at desc limit 5;
```

## Compliance gate

Each notification's title + body is regex-checked against the forbidden-word list from `docs/architecture/compliance.md` before insertion. Any match blocks the entire fan-out (logged, function returns 200 with `reason: "compliance_blocked"`). Phase 13 promotion gates LLM-generated body strings — if a briefing's `content_md` ever produces a directive verb, the briefing's `status` should also flip to `needs_review` so this filter doesn't have to catch it.

## Throttle + quiet hours

The function does NOT pre-check those gates. It INSERTs per-row; the DB triggers `enforce_push_throttle` and `enforce_quiet_hours` (migration 012) reject 4th-of-day pushes (P0001, silently skipped here) and flip in-quiet-hours rows to `status='skipped_quiet'` with a `scheduled_for` timestamp (picked up by `retry_skipped_pushes` cron).

## Return shape

```json
{
  "inserted": 3,
  "skipped_quiet": 1,
  "push_sent": 2,
  "push_failed": 0
}
```
