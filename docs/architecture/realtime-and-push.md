# Real-time & Push Notifications

The killer feature is "AAPL just reported, here's the surprise, here's what shifted in guidance — within seconds." This doc describes the latency budget for that path and the moving parts that meet it.

## The latency budget

End-to-end target: **≤15 seconds** from 8-K hitting EDGAR to the user's phone buzzing.
Acceptable upper bound: **≤60 seconds**. Below 60s we're still ahead of every consumer earnings app; below 15s we're competitive with paid pro-trader tools.

```
0s    8-K Item 2.02 + Exhibit 99.1 hit EDGAR
      │
      │ ≤60s (poll interval; usually ~30s)
      ▼
~30s  Modal edgar_poller spots new accession in latest-filings JSON
      │
      │ ~2-4s   fetch Exhibit 99.1 HTML
      │ ~3-6s   LLM structured extraction (Claude Haiku or GPT-4o-mini)
      │ <1s     compute surprise vs cached consensus
      │ <1s     INSERT into events + event_metrics
      ▼
~40s  Edge Function `notify_user_event` fires (Postgres trigger)
      │ ~1-2s   SELECT users with ticker in watchlist
      │ ~1-3s   POST batch to https://exp.host/--/api/v2/push/send
      ▼
~45s  Expo Push delivers to APNS / FCM
      │ ~1-5s   APNS / FCM → device
      ▼
~50s  Device vibrates
```

p50 budget breakdown:
| Stage | Time | Slack |
| --- | --- | --- |
| EDGAR poll lag | 0-60s | Cron min granularity; hardest to shrink |
| Exhibit fetch | 2-4s | Cache layer in Modal; second viewer sees ~0s |
| LLM extraction | 3-6s | Hardest sustained latency; consider streaming output |
| DB writes | <1s | |
| Edge Function fan-out | 1-2s | Linear in watchers/ticker; fine at MVP |
| Push delivery | 1-5s | Out of our hands; APNS occasionally backs up |

**The poll lag dominates.** Going below `Period(seconds=60)` requires either Modal's `keep_warm` on a tighter loop (paid) or running the poller as a long-lived loop with `time.sleep(5)` — neither is free, both are doable later. Document the trade and don't optimise prematurely.

## Why not WebSockets?

Three reasons we use Expo Push, not a persistent WebSocket from device to server:

1. **Background delivery.** Apps in background or terminated can't hold a socket open. APNS/FCM are the OS-level mechanism specifically for background pushes.
2. **Battery.** Persistent sockets drain.
3. **Existing infrastructure.** Supabase Realtime is great when the app is **open**. For "user's phone in their pocket on the train", push is the only answer.

We do use Supabase Realtime as a *complement*: if the app is in the foreground when an event fires, the user sees an in-app update + the push lands in the system tray.

## Expo Push — what to know

**Token registration.** On first sign-in (or first app-open post-sign-in), the app:
1. Requests notification permission (`Notifications.requestPermissionsAsync()`).
2. Gets a token: `Notifications.getExpoPushTokenAsync({ projectId: '...' })`.
3. Upserts `(user_id, token, platform, last_seen_at)` into `push_tokens`.

Tokens rotate occasionally. On every cold start, re-fetch the token and update `last_seen_at`. Garbage-collect tokens older than 30 days with no `last_seen` bump.

**Sending.** From the Edge Function (or a Modal function):

```http
POST https://exp.host/--/api/v2/push/send
Content-Type: application/json

[
  {
    "to": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    "title": "AAPL: EPS $2.14 vs $1.98 est",
    "body": "8.1% beat. Guidance raised.",
    "data": { "deep_link": "sift://events/<event_id>", "kind": "event" },
    "priority": "high",
    "sound": "default"
  },
  ...
]
```

Expo's endpoint accepts batches up to **100 messages** per request. Batching is mandatory once we have non-trivial watcher counts per ticker.

**Receipts.** Push is async — `200 OK` from Expo means "queued", not "delivered". To get delivery state, poll the receipt endpoint a few seconds later:

```http
POST https://exp.host/--/api/v2/push/getReceipts
{ "ids": ["receipt-id-1", "receipt-id-2", ...] }
```

For Sift: we only care about receipts to detect **`DeviceNotRegistered`** (clear the token), and rate-limit issues. Don't block sending on receipts; collect them lazily.

**Priority.** Use `"high"` for events. For briefings (which are scheduled, not time-sensitive), `"normal"` is fine and is kinder to user battery.

## Edge Function: `notify_user_event`

Two implementation options, both viable:

### Option A — Supabase Edge Function (Deno) with DB trigger

```sql
-- Postgres trigger
CREATE TRIGGER on_event_insert
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION supabase_functions.http_request(
    'https://<project>.functions.supabase.co/notify_user_event',
    'POST',
    '{"Content-Type":"application/json"}',
    json_build_object('event_id', NEW.id)::text,
    '5000'
  );
```

Edge Function code receives the event id, queries watchers, POSTs to Expo. Pros: auto-triggered on insert, zero glue. Cons: Deno runtime, JSR imports occasionally fiddly, debugging is harder than Python.

### Option B — Modal function called from the parser

`parse_and_publish.spawn()` already runs in Modal — it can call `fanout_push.spawn(event_id)` after the INSERT. Pros: same language as the rest of the pipeline; easier to test; tighter latency budget (no HTTP hop). Cons: one more Modal function to deploy and pay for.

**Provisional pick:** start with **Option B** because we're already in Python-on-Modal mode and the operational simplicity matters. Switch to A if Modal latency becomes a problem (it won't at this scale).

## In-app realtime

When the app is in the foreground, Supabase Realtime gives us live updates without push round-trips. Subscribe to two channels:

```js
// in src/features/notifications/use-live-events.js
const channel = supabase
  .channel('user-notifications')
  .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}` },
      handleNotification)
  .subscribe();
```

```js
// in a ticker-detail screen
const channel = supabase
  .channel(`ticker-${ticker}`)
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'events',
        filter: `ticker_symbol=eq.${ticker}` },
      refreshEventList)
  .subscribe();
```

The first powers an in-app toast / banner when a push arrives while the user has the app open. The second feeds the ticker detail screen. Always unsubscribe in `useEffect` cleanup.

RLS applies to Realtime — same filter rules, same auth, no extra config.

## What happens when things break

| Failure | Detection | Recovery |
| --- | --- | --- |
| EDGAR returns 429 / 403 | Modal logs + Sentry (later) | Exponential backoff; auto-retry. If sustained, alert. |
| LLM extraction fails | `events.parse_status='failed'` | Cron retry every 5 min for 1 hour; then mark `permanent_failure` |
| Edge Function timeout | Function logs | Stays in `notifications.status='pending'`; cron retry |
| Expo Push 200 but receipt says error | Receipt poll | If `DeviceNotRegistered`, delete token; if `MessageRateExceeded`, backoff |
| User has no push permission | UI flag in `profiles.notification_pref` | Show in-app prompt to enable in Settings; never silent-fail |

**A user who misses a push is worse than a user who never had one** — Sift's value depends on timeliness. The retry strategy above is built around "always deliver eventually, even if late."

## Foreground vs background — UX rules

- **App in foreground:** show an in-app toast/banner; do *not* play a system push sound. Avoid double-notify. The push is still recorded for the tray.
- **App in background:** OS shows the push normally; tap deep-links into the relevant screen.
- **App not running:** OS launches the app and routes to the deep link.

Wire deep-link handling in `app/_layout.js` using `expo-linking`'s URL listener; expo-router will route `sift://events/<id>` to `app/(app)/events/[event_id].js`.

## Quiet hours and rate caps

Compliance and UX both push us toward not blasting users overnight:

- Default quiet hours: 22:00–07:00 in user's local time. Store TZ in `profiles`.
- Cap: max N pushes per ticker per day (default 3 — pre-call, release, post-call). Surface as a setting later.
- Always allow user to mute a ticker or category.

## Standalone-compliance reminder

Every push body **must** stand alone — a screenshot of the lockscreen must not look like investment advice. Examples:

| ✅ "AAPL: EPS $2.14 vs $1.98 est (+8.1% beat). Tap to read briefing." |
| ❌ "AAPL is a buy now — beat expectations" |
| ❌ "Time to add AAPL to your portfolio" |

See [compliance.md](compliance.md). Push wording goes through the same forbidden-word check as in-app copy.
