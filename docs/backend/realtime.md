# Realtime — channels and subscription patterns

Supabase Realtime + Expo Push are complementary:

- **Expo Push** — phone in pocket, app backgrounded. The only delivery path the OS guarantees.
- **Realtime** — app open in foreground. Lets the user see updates without a push round-trip; powers Home's "X new events" pill and ticker-detail live refresh.

Realtime inherits RLS — anything you can't `SELECT`, you can't `subscribe` to. No extra config needed.

---

## Channels we subscribe to

### 1. Per-user notifications

The user's "X new events" pill on Home + any in-app toast.

```js
// src/lib/realtime/use-notifications-stream.js
import { useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export function useNotificationsStream(userId, onArrived) {
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => onArrived(payload.new),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, onArrived]);
}
```

Used in `app/_layout.js` once auth is settled — every screen benefits. The handler routes to:
- Today: increment `pending` count, trigger the new-events-pill animation
- All screens: optional in-foreground toast (`<Toast>` primitive not yet built — Phase 12+)

### 2. Per-ticker events (ticker detail screen)

When the user is on `/watchlist/AAPL` or `/today/events/<id>`, subscribe to fresh events for that ticker.

```js
// src/lib/realtime/use-ticker-events-stream.js
export function useTickerEventsStream(symbol, onChange) {
  useEffect(() => {
    if (!symbol) return;
    const channel = supabase
      .channel(`ticker-events:${symbol}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `ticker_symbol=eq.${symbol}` },
        onChange,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'event_metrics' },
        onChange,                                  // event_metrics doesn't have ticker_symbol; refresh on any change and rely on screen-side filtering
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [symbol, onChange]);
}
```

`onChange` triggers a re-fetch of the ticker timeline (cheap) or a targeted state merge if perf becomes a concern.

### 3. Per-ticker briefing-ready (Watchlist + Today)

When a briefing flips to `status='ready'`, the relevant Watchlist row's `briefingReady` flag flips on, and the new-events pill on Today increments.

This subscription is broader than per-ticker — every briefing across all the user's watchlist tickers could fire. The simplest model:

```js
// hook attached once at app root
const userWatchedSymbols = useWatchedSymbols(userId);  // returns ['AAPL', 'MSFT', ...]

const channel = supabase
  .channel('briefings-ready')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'briefings',
      filter: `ticker_symbol=in.(${userWatchedSymbols.join(',')})`,
    },
    (payload) => {
      if (payload.new.status === 'ready' && payload.old.status !== 'ready') {
        invalidateWatchlist();
        invalidateTodayFeed();
      }
    },
  )
  .subscribe();
```

`filter: in.(…)` works for up to ~100 values. Beyond that, the alternative is a server-side view that flattens "briefings on my watchlist" and subscribing to that view's RLS-filtered changes — out of scope for MVP.

### 4. Postgres Changes vs Broadcast

Supabase Realtime has two modes:

- **Postgres Changes** — INSERT/UPDATE/DELETE on tables. RLS-applied. Used for everything above.
- **Broadcast** — ephemeral messages between clients (no DB write). Useful for "user is typing" or "user is viewing AAPL right now" (live presence).

Sift uses Postgres Changes only at MVP. Broadcast is a feature-creep risk — explicit "no" until a real use case appears.

---

## Subscription lifecycle

Always:

1. **Subscribe in `useEffect`** with the right dependencies.
2. **Unsubscribe in cleanup** — `supabase.removeChannel(channel)`.
3. **Re-subscribe on auth change** — if `userId` flips (sign-out → sign-in), the channel name changes and the old channel must be torn down.

The common bug:

```js
// ❌ DOES NOT UNSUBSCRIBE
useEffect(() => {
  supabase.channel('x').on(...).subscribe();
}, []);
```

Each mount leaks a WebSocket. After 10 navigation cycles you've pinned 10 connections. Always:

```js
useEffect(() => {
  const channel = supabase.channel('x').on(...).subscribe();
  return () => { supabase.removeChannel(channel); };
}, [deps]);
```

---

## What we deliberately do NOT subscribe to

| Table | Why not |
| --- | --- |
| `tickers` | Static; updates quarterly. Not worth a connection. |
| `ticker_prices` | High write volume during market hours; would flood. Use a periodic `useQuery` pull on Watchlist screens instead. |
| `transcripts` | Low frequency; pull on demand when the ticker detail screen mounts. |
| `transcript_segments` | Volume is high during ingestion; users don't need live updates while a transcript is being processed. |
| `llm_calls`, `data_source_status` | Admin observability; not user-facing. |

---

## Capacity math

Supabase Free tier: **200 concurrent connections** to Realtime.

Per-app-foreground connections: 2 (notifications + active screen). At 100 simultaneous foreground users, that's 200 connections — at the cap. Pro tier raises to 500.

For the MVP demo audience (single-digit users): irrelevant. Documented so the capacity ceiling doesn't surprise us at launch.

---

## Auth + Realtime

When the user signs out:

1. `supabase.auth.signOut()` invalidates the JWT.
2. Existing Realtime channels are still open but RLS now denies. They'll silently stop receiving events.
3. The `onAuthStateChange` listener in `useAuthRouting` fires; mount-effects unsubscribe via dependency change (`userId` → null).
4. Next sign-in re-subscribes with a fresh JWT.

The window between (1) and (3) is tiny. If you observe stale events, ensure all channel subscriptions are gated on `if (!userId) return;` like the snippet above.
