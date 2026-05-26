# Frontend wiring — surface-by-surface query map

Every frontend mock or async surface, mapped to its real Supabase query/mutation. Use as the loop's reference when wiring a screen.

Format per entry:

- **Surface** — where it lives in `src/`
- **Reads from / writes to** — table/view/RPC
- **Replaces** — current mock or local-state hack
- **Notes** — gotchas

---

## Auth + routing

### `useAuthRouting` (`src/lib/use-auth-routing.js`)

**Reads:**
- `supabase.auth.getSession()` (already wired)
- `profiles.disclaimer_ack_at` via `select disclaimer_ack_at from profiles where id = session.user.id` — **replaces** `AsyncStorage.getItem(ACK_KEY)`

**Status mapping:**
- no session → `'unauthed'`
- session + `disclaimer_ack_at IS NULL` → `'unonboarded'`
- session + `disclaimer_ack_at IS NOT NULL` → `'authed'`

**Notes:**
- The auth-trigger from [triggers-and-functions.md](triggers-and-functions.md) auto-creates the profile row on signup. The `disclaimer_ack_at` field starts NULL and is set by P9-3 confirm.
- Local `ACK_KEY` AsyncStorage becomes dead code; remove its set/clear sites in the same tick.

### `app/_layout.js` push token registration (new)

**Writes:**
- `push_tokens` UPSERT on app open: `(user_id, token, platform, last_seen_at)` with `last_seen_at = now()`.

**Notes:**
- Runs once per cold start AFTER auth status is `'authed'`.
- Token comes from `Notifications.getExpoPushTokenAsync({ projectId })`.
- Use `upsert` with `onConflict: 'user_id,token'`.

---

## Today screen (`src/features/home/`)

### `useHomeData` (`src/features/home/use-home-data.js`)

**Reads:**
- `supabase.rpc('home_events_for_user', { p_user_id: userId })` — flat list with `state` per row.

**Replaces:**
- `MOCK_HOME_EVENTS` (delete file in same tick — see [conventions.md](conventions.md) on tombstoning mocks)
- `MOCK_PENDING_EVENT` (delete; pending now comes from realtime subscription, not synthetic timeout)

**Pending arrival:**
- Subscribe to `notifications` table with filter `user_id=eq.<uuid>`. New row → push onto `pending` array.
- Triggers the "X new events" pill identically to current mock behaviour.

**Error state:**
- The hook's `error` shape `{ message, code }` is the InlineError contract (already wired in P11-4).
- Supabase errors come back as `{ message: string, code: string, details: string }` — map straight through.

### `home-screen.js`

No query changes; consumes `useHomeData` output. The screen-side `groupByDay` from `src/lib/dates.js` keeps working — the RPC returns timestamps in the same shape.

---

## Watchlist screen (`src/features/watchlist/`)

### `MOCK_WATCHLIST` + add/remove handlers (`watchlist-screen.js`)

**Reads:**
- `supabase.from('watchlist_with_meta_view').select('*')` — returns watchlist rows with `name`, `sector`, `next_fiscal_period`, `next_expected_at`, `next_beat_probability`, `briefing_ready`.

**Writes:**
- Add: `supabase.from('watchlist_tickers').insert({ watchlist_id: <default-id>, ticker_symbol: <symbol> })`
- Remove: `supabase.from('watchlist_tickers').delete().eq('watchlist_id', <default-id>).eq('ticker_symbol', <symbol>)`

**Sparkline:**
- `supabase.rpc('ticker_sparkline', { p_symbol, p_days: 30 })` per ticker on screen mount. Cache per ticker in a Map; refresh once per session.
- Alternative for fewer round-trips: `supabase.rpc('ticker_sparklines_batch', { p_symbols: [...] })` — write this RPC if N-watchlist-tickers calls are slow. Defer until measured.

**Default watchlist id:**
- Read once after auth: `supabase.from('watchlists').select('id').eq('user_id', userId).eq('is_default', true).single()`. Cache in client state for the session.

**Replaces:**
- `MOCK_WATCHLIST` (delete in same tick)
- `fakeSeries(...)` (sparkline generator — delete)
- `add(symbol)` handler that splices into local state — now does insert + realtime subscription triggers re-fetch.

### `add-ticker-sheet.js`

**Reads:**
- `searchCatalog(query, excludeSymbols)` from `ticker-catalog.js` — **rewire** to `supabase.from('tickers').select('symbol, name').ilike('symbol', `${q}%`).limit(12)`.
- `excludeSymbols` filter applied client-side after the result lands.

**Replaces:**
- The local `TICKER_CATALOG` constant. Keep `ticker-catalog.js` exporting `getCompanyName(symbol)` for now — that becomes a simple cached lookup against `tickers` once the full table is queried (use a React Query / SWR cache on first load).

---

## Discover screen (`src/features/discover/`)

### `discover-screen.js`

Three rails, three RPC calls:

**Reads:**
- `supabase.rpc('discover_biggest_expected', { p_limit: 4 })` → top rail
- `supabase.rpc('discover_sector_heat')` → middle rail
- `supabase.rpc('discover_biggest_surprises', { p_days: 7, p_limit: 4 })` → bottom rail

**Search:**
- Same as Watchlist's `add-ticker-sheet` — `supabase.from('tickers').select('symbol, name').ilike('symbol', `${q}%`).limit(8)`.

**Replaces:**
- `MOCK_BIGGEST_EXPECTED`, `MOCK_SECTOR_HEAT`, `MOCK_BIGGEST_SURPRISES` (delete `mock.js` in the tick that wires all three rails).

**Compliance gate stays:** the screen-side `"Model"` prefix and `"expected"` qualifier are independent of data source. The RPC returns the raw numbers; the screen still formats per the compliance copy rules.

---

## Ticker detail (`src/features/ticker/`)

### `ticker-screen.js`

**Reads:**
- `supabase.rpc('ticker_detail_timeline', { p_symbol })` — one call, returns the flat chronological spine with payloads per kind.
- `supabase.from('tickers').select('name, sector').eq('symbol', symbol).single()` — hero metadata.
- `supabase.rpc('ticker_sparkline', { p_symbol, p_days: 30 })` — hero sparkline.

**Replaces:**
- `getTickerMock(ticker)` from `src/features/ticker/mock.js` (delete file)
- All four sub-arrays: `nextEarnings`, `pastEvents`, `pastBriefings`, `transcripts` — all live inside the RPC return.

**Watchlist toggle:**
- `onWatchlist` boolean: query `watchlist_tickers` once on mount with `where ticker_symbol = ? AND watchlist_id = default_id`. Cache.
- Add: `insert`; Remove: `delete`. Optimistic UI: toggle local state first, reconcile on response.

**Realtime:**
- Subscribe to `events` filtered to `ticker_symbol=eq.<symbol>` — refetch on INSERT or `parse_status` UPDATE.
- Also `transcript_analysis` INSERT for the same ticker (via transcript join — needs a server view or a less-targeted subscription).

---

## Event detail (`src/features/event/`)

### `event-screen.js`

**Reads:**
- `supabase.from('event_with_metrics_view').select('*').eq('id', eventId).single()` — single denormalised row.

**Replaces:**
- `getEventMock(id)` (delete file).
- All client-side fields (`filedAt`, `detectedAt`, `pushedAt`) come from the view directly. Format on render.

**Notes:**
- The "filing pipeline" UI ribbon (`filed → detected → pushed`) reads `filed_at`, `detected_at`, `pushed_at` columns. Compute the deltas client-side for display.

---

## Settings (`src/features/settings/`)

### `settings-screen.js`

**Email row:** already wired in B18 — reads `session.user.email` via `supabase.auth.getSession()`.

**Notification toggles + quiet hours:**

**Reads:**
- `supabase.from('profiles').select('notify_briefings, notify_events, notify_transcripts, quiet_hours_preset').eq('id', userId).single()` — on mount.

**Writes:**
- Per toggle change: `supabase.from('profiles').update({ notify_briefings: value }).eq('id', userId)`.
- Quiet hours change: `update({ quiet_hours_preset: value })`.

**Replaces:**
- Local `useState` for each of the four prefs. Initial state comes from the profile read; updates round-trip to server.
- Use optimistic update pattern: flip locally first, write to server, revert on error.

**Sign-out:**
- Already wired in P10-3. The DELETE of `ACK_KEY` becomes irrelevant since `disclaimer_ack_at` is server-side and isn't cleared on client sign-out — the user keeps their ack across sign-ins. (If they sign in as a different user, that user has their own profile with their own ack state.)

---

## Onboarding (`src/features/onboarding/`)

### `ack-screen.js`

**Writes:**
- On confirm: `supabase.from('profiles').update({ disclaimer_ack_at: new Date().toISOString() }).eq('id', userId)`.

**Replaces:**
- `AsyncStorage.setItem(ACK_KEY, new Date().toISOString())`.

**Notes:**
- After the update succeeds, `useAuthRouting`'s subscription on `onAuthStateChange` doesn't fire (auth didn't change). Manually invalidate the routing status — easiest path: navigate forward explicitly (`router.push('/notifications')`), as the screen already does. The next cold start re-reads profile and routes correctly.

### `notifications-screen.js`

**Writes:**
- After Notifications.requestPermissionsAsync(): if granted, also get the push token and UPSERT to `push_tokens`.

**Notes:**
- If user denies, do NOT insert a row. They can re-enable later from OS Settings; the next app open will detect permission and register.

### `first-tickers-screen.js`

**Writes:**
- On confirm with N selections: `supabase.from('watchlist_tickers').insert(selections.map(s => ({ watchlist_id, ticker_symbol: s })))`.
- Sets `profiles.onboarded_at = now()` so the user can't be re-routed back to first-tickers.

**Replaces:**
- The current local-only optimistic prepend to Home's mock data.

---

## Auth screens (`src/features/auth/`)

### `sign-in-screen.js`, `sign-up-screen.js`, `auth-callback-screen.js`

All three are already wired to Supabase auth. **No changes needed** for the schema rollout — the auth-trigger on `auth.users` insert creates the profile + default watchlist automatically.

**Sign-up's "Check your email" branch:**
- Stays as-is. When the user clicks the email link, `auth.users` insert fires → trigger creates profile → user lands on `/welcome` via `useAuthRouting`.

---

## Data flow summary

```
User signs up
  → auth.users INSERT
  → handle_new_user() trigger creates profiles + default watchlists + subscriptions rows
  → useAuthRouting reads new profile → disclaimer_ack_at is NULL → routes to /welcome
  → Welcome → How Sift Works → Ack confirm
    → ack-screen UPDATEs profiles.disclaimer_ack_at = now()
  → Notifications primer → on Allow, UPSERT push_tokens
  → First-tickers → on confirm, INSERT watchlist_tickers, UPDATE profiles.onboarded_at
  → Routed to /today
  → useHomeData calls rpc.home_events_for_user(uid) → flat list
  → Realtime subscribed to notifications:user_id=eq.<uid>
  → When AAPL files an 8-K:
       Modal EDGAR poller INSERTs events → triggers extraction → updates parse_status='parsed'
       → trigger fires notify_on_event_parsed → calls notify_user_event Edge Function
       → Edge Function: finds watchers → INSERTs notifications per user
         (throttle trigger + quiet-hours trigger gate insertion)
       → Edge Function: POSTs to Expo Push for non-skipped notifications
  → User's phone vibrates (background) OR pill shows on Today (foreground via Realtime)
```

---

## Pattern: optimistic updates

Most user-initiated mutations are good candidates for optimism — perceived latency drops to zero, the round-trip happens in the background.

```js
async function addTicker(symbol) {
  // optimistic: prepend locally
  setItems(prev => [{ symbol, name: '…', /* placeholders */ }, ...prev]);

  const { error } = await supabase
    .from('watchlist_tickers')
    .insert({ watchlist_id, ticker_symbol: symbol });

  if (error) {
    // revert
    setItems(prev => prev.filter(i => i.symbol !== symbol));
    showError(error.message);
  }
  // success: realtime subscription will refresh with the canonical row
}
```

Applies to: Watchlist add/remove, Settings toggle, ack confirm, first-tickers seed.

NOT for: anything with a server-side enforced constraint where the user needs to see "this failed" promptly (e.g. push throttle — but that's invisible to the user anyway).
