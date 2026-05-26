# Views and RPCs — derived data

The schema is normalised. The screens want denormalised, computed shapes. Views and RPCs (server functions exposed via PostgREST) bridge the gap without making the client do joins or aggregations.

Three reasons to put derivation server-side:

1. **Consistency.** Surprise %, `briefing_ready` flags, and sector counts are computed once, the same way, everywhere.
2. **Query count.** A single RPC call returns what would otherwise be 3-5 round-trips with client-side merging.
3. **RLS.** Views inherit RLS from their underlying tables — security stays a property of the schema, not of the consumer.

---

## Conventions

- **Views** for read-only shapes used by many surfaces (`watchlist_with_meta`, `upcoming_earnings`).
- **RPCs** (`SECURITY INVOKER` functions) for shapes that take parameters (`home_events_for_user(user_id)`, `discover_biggest_expected(week_start, limit)`).
- **Materialised views** (cache-on-demand) only when a derivation is expensive AND its inputs change infrequently. Sift has one candidate: `sector_heat` (per-week aggregation refreshed daily).
- All RPCs use `SECURITY INVOKER` (the default) so RLS still applies. `SECURITY DEFINER` is reserved for triggers (see [triggers-and-functions.md](triggers-and-functions.md)).
- Name views as nouns; RPCs as verbs or noun phrases: `briefing_ready_view`, `home_events_for_user()`, `discover_biggest_expected()`.

---

## Views

### `upcoming_earnings` — calendar of expected reports

Shared catalog view; used by Modal (briefing generator), Discover, and Today.

```sql
CREATE VIEW upcoming_earnings AS
SELECT
  t.symbol             AS ticker_symbol,
  t.name               AS ticker_name,
  t.sector,
  b.id                 AS briefing_id,
  b.fiscal_period,
  b.expected_release_at,
  b.consensus_eps,
  b.beat_probability,
  b.surprise_prediction->>'expected_move_pct' AS expected_move_pct,
  b.status             AS briefing_status,
  (b.status = 'ready') AS is_briefing_ready
FROM tickers t
LEFT JOIN briefings b ON b.ticker_symbol = t.symbol
  AND b.expected_release_at > now()
  AND b.expected_release_at <= now() + interval '60 days'
WHERE t.is_active;
```

RLS: inherits from `tickers` (read all) and `briefings` (read `status='ready'`). The LEFT JOIN includes tickers with no upcoming briefing yet — handy for Discover's sector heat.

### `briefing_ready_view` — flat list of ready briefings

```sql
CREATE VIEW briefing_ready_view AS
SELECT
  b.id,
  b.ticker_symbol,
  t.name AS ticker_name,
  t.sector,
  b.fiscal_period,
  b.expected_release_at,
  b.beat_probability,
  b.surprise_prediction,
  b.content_md,
  b.prompt_version,
  b.generated_at
FROM briefings b
JOIN tickers t ON t.symbol = b.ticker_symbol
WHERE b.status = 'ready';
```

Used by ticker detail's past briefings list. The RLS-filtered view means the screen doesn't need to remember the `status='ready'` filter.

### `event_with_metrics_view` — flattened event row

```sql
CREATE VIEW event_with_metrics_view AS
SELECT
  e.id,
  e.ticker_symbol,
  t.name AS ticker_name,
  t.sector,
  e.fiscal_period,
  e.source,
  e.expected_at,
  e.filed_at,
  e.detected_at,
  e.parsed_at,
  e.pushed_at,
  e.exhibit_url,
  e.parse_status,
  m.eps_actual,
  m.eps_est,
  m.eps_surprise_pct,
  m.revenue_actual,
  m.revenue_est,
  m.revenue_surprise_pct,
  m.guidance_direction,
  m.guidance_detail,
  m.segments
FROM events e
JOIN tickers t ON t.symbol = e.ticker_symbol
LEFT JOIN event_metrics m ON m.event_id = e.id
WHERE e.parse_status IN ('parsed', 'failed');
```

The single source of truth for the **Event detail screen**. Replaces `getEventMock()` with one `select * from event_with_metrics_view where id = ?`.

### `watchlist_with_meta_view` — per-user watchlist with derived metadata

```sql
CREATE VIEW watchlist_with_meta_view AS
SELECT
  w.user_id,
  wt.ticker_symbol AS symbol,
  t.name,
  t.sector,
  wt.added_at,
  wt.sort_order,
  next_b.fiscal_period            AS next_fiscal_period,
  next_b.expected_release_at      AS next_expected_at,
  next_b.beat_probability         AS next_beat_probability,
  (next_b.status = 'ready')       AS briefing_ready
FROM watchlists w
JOIN watchlist_tickers wt ON wt.watchlist_id = w.id
JOIN tickers t ON t.symbol = wt.ticker_symbol
LEFT JOIN LATERAL (
  SELECT id, fiscal_period, expected_release_at, beat_probability, status
  FROM briefings b
  WHERE b.ticker_symbol = wt.ticker_symbol
    AND b.expected_release_at > now()
  ORDER BY b.expected_release_at ASC
  LIMIT 1
) next_b ON true;
```

Used by Watchlist screen. RLS filters to `auth.uid() = w.user_id` via the `watchlists` policy.

`LEFT JOIN LATERAL ... LIMIT 1` is the Postgres idiom for "join the single next briefing per ticker." Equivalent to a correlated subquery but more efficient — the planner pushes the LIMIT down.

Sparkline isn't here — it's a separate `ticker_prices` query because the volume (30 rows × N tickers) bloats the row count of a join.

---

## RPCs

### `home_events_for_user(user_id)`

The Today feed. Returns a flat list of events (upcoming briefings + live filings + past results) for the user's watchlist, with computed `state` and `briefing_ready`.

```sql
CREATE FUNCTION home_events_for_user(p_user_id uuid)
RETURNS TABLE (
  state           text,                              -- 'upcoming' | 'live' | 'past'
  ticker_symbol   text,
  ticker_name     text,
  fiscal_period   text,
  expected_at     timestamptz,
  actual_at       timestamptz,                       -- nullable for upcoming
  briefing_id     uuid,                              -- nullable
  beat_probability numeric,                          -- for upcoming
  eps_actual      numeric,                           -- for live/past
  eps_est         numeric,                           -- for live/past
  surprise_pct    numeric,                           -- for live/past
  briefing_ready  boolean,                           -- for upcoming
  reference_id    uuid                               -- briefing.id (upcoming) or event.id (live/past)
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH watched AS (
    SELECT wt.ticker_symbol
    FROM watchlists w
    JOIN watchlist_tickers wt ON wt.watchlist_id = w.id
    WHERE w.user_id = p_user_id
  ),
  upcoming AS (
    SELECT
      'upcoming'::text AS state,
      b.ticker_symbol,
      t.name           AS ticker_name,
      b.fiscal_period,
      b.expected_release_at AS expected_at,
      NULL::timestamptz     AS actual_at,
      b.id              AS briefing_id,
      b.beat_probability,
      NULL::numeric     AS eps_actual,
      NULL::numeric     AS eps_est,
      NULL::numeric     AS surprise_pct,
      (b.status = 'ready') AS briefing_ready,
      b.id              AS reference_id
    FROM briefings b
    JOIN tickers t ON t.symbol = b.ticker_symbol
    WHERE b.ticker_symbol IN (SELECT ticker_symbol FROM watched)
      AND b.expected_release_at > now() - interval '6 hours'      -- 'live' window for not-yet-reported
      AND b.expected_release_at < now() + interval '30 days'
  ),
  live_and_past AS (
    SELECT
      CASE
        WHEN e.filed_at > now() - interval '15 minutes' THEN 'live'
        ELSE 'past'
      END AS state,
      e.ticker_symbol,
      t.name      AS ticker_name,
      e.fiscal_period,
      e.expected_at,
      e.filed_at  AS actual_at,
      NULL::uuid  AS briefing_id,
      NULL::numeric AS beat_probability,
      m.eps_actual,
      m.eps_est,
      m.eps_surprise_pct AS surprise_pct,
      NULL::boolean AS briefing_ready,
      e.id        AS reference_id
    FROM events e
    JOIN tickers t ON t.symbol = e.ticker_symbol
    JOIN event_metrics m ON m.event_id = e.id
    WHERE e.ticker_symbol IN (SELECT ticker_symbol FROM watched)
      AND e.parse_status = 'parsed'
      AND e.filed_at > now() - interval '30 days'                  -- 30d past window
  )
  SELECT * FROM upcoming
  UNION ALL
  SELECT * FROM live_and_past
  ORDER BY COALESCE(actual_at, expected_at) DESC;
$$;
```

**Called from the app:**

```js
const { data, error } = await supabase.rpc('home_events_for_user', { p_user_id: session.user.id });
// data is the flat array; pass through groupByDay() unchanged
```

`SECURITY INVOKER` means the function executes with the caller's RLS context — RLS on `watchlists` etc. still gates which rows are visible. The function takes `p_user_id` as a parameter but Postgres will only ever return the caller's rows because RLS filters the inner queries.

**Note on `state` derivation:** "live" is anything filed in the last 15 minutes. Past that, it's "past." The frontend's `<EventTimelineCard>` honours this naturally — the live ribbon shows for 15 minutes and then fades to the `past` state on the next refresh.

### `discover_biggest_expected(p_limit, p_week)`

```sql
CREATE FUNCTION discover_biggest_expected(
  p_limit integer DEFAULT 4,
  p_week_start date DEFAULT date_trunc('week', current_date)::date
)
RETURNS TABLE (
  ticker_symbol      text,
  ticker_name        text,
  fiscal_period      text,
  expected_release_at timestamptz,
  beat_probability   numeric,
  expected_move_pct  numeric
)
LANGUAGE sql
STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT
    b.ticker_symbol,
    t.name AS ticker_name,
    b.fiscal_period,
    b.expected_release_at,
    b.beat_probability,
    (b.surprise_prediction->>'expected_move_pct')::numeric AS expected_move_pct
  FROM briefings b
  JOIN tickers t ON t.symbol = b.ticker_symbol
  WHERE b.status = 'ready'
    AND b.expected_release_at >= p_week_start
    AND b.expected_release_at < p_week_start + interval '7 days'
  ORDER BY (b.surprise_prediction->>'expected_move_pct')::numeric DESC NULLS LAST
  LIMIT p_limit;
$$;
```

### `discover_sector_heat(p_week_start)`

```sql
CREATE FUNCTION discover_sector_heat(
  p_week_start date DEFAULT date_trunc('week', current_date)::date
)
RETURNS TABLE (sector text, reporting bigint)
LANGUAGE sql
STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT
    t.sector,
    count(DISTINCT b.id) AS reporting
  FROM briefings b
  JOIN tickers t ON t.symbol = b.ticker_symbol
  WHERE b.expected_release_at >= p_week_start
    AND b.expected_release_at < p_week_start + interval '7 days'
  GROUP BY t.sector
  ORDER BY reporting DESC;
$$;
```

### `discover_biggest_surprises(p_days, p_limit)`

```sql
CREATE FUNCTION discover_biggest_surprises(
  p_days integer DEFAULT 7,
  p_limit integer DEFAULT 4
)
RETURNS TABLE (
  event_id        uuid,
  ticker_symbol   text,
  ticker_name     text,
  fiscal_period   text,
  actual_at       timestamptz,
  surprise_pct    numeric
)
LANGUAGE sql
STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT
    e.id AS event_id,
    e.ticker_symbol,
    t.name AS ticker_name,
    e.fiscal_period,
    e.filed_at AS actual_at,
    m.eps_surprise_pct AS surprise_pct
  FROM events e
  JOIN tickers t        ON t.symbol = e.ticker_symbol
  JOIN event_metrics m  ON m.event_id = e.id
  WHERE e.parse_status = 'parsed'
    AND e.filed_at >= now() - (p_days || ' days')::interval
    AND m.eps_surprise_pct IS NOT NULL
  ORDER BY abs(m.eps_surprise_pct) DESC
  LIMIT p_limit;
$$;
```

### `ticker_detail_timeline(p_symbol)`

Returns the chronological spine for ticker detail (upcoming + past events + briefings + transcripts), pre-merged and sorted.

```sql
CREATE FUNCTION ticker_detail_timeline(p_symbol text)
RETURNS TABLE (
  item_id        uuid,
  kind           text,                        -- 'earnings-upcoming' | 'earnings-past' | 'briefing' | 'transcript'
  occurred_at    timestamptz,                 -- expectedAt for upcoming; actualAt / publishedAt / recordedAt otherwise
  payload        jsonb
)
LANGUAGE sql
STABLE SECURITY INVOKER SET search_path = public
AS $$
  -- upcoming
  SELECT
    b.id        AS item_id,
    'earnings-upcoming'::text AS kind,
    b.expected_release_at     AS occurred_at,
    jsonb_build_object(
      'fiscal_period', b.fiscal_period,
      'beat_probability', b.beat_probability,
      'expected_release_at', b.expected_release_at,
      'consensus_eps', b.consensus_eps
    ) AS payload
  FROM briefings b
  WHERE b.ticker_symbol = p_symbol AND b.status = 'ready' AND b.expected_release_at > now()

  UNION ALL

  -- past events
  SELECT
    e.id, 'earnings-past',
    e.filed_at,
    jsonb_build_object(
      'fiscal_period', e.fiscal_period,
      'expected_at', e.expected_at,
      'actual_at', e.filed_at,
      'eps_actual', m.eps_actual,
      'eps_est', m.eps_est,
      'surprise_pct', m.eps_surprise_pct,
      'guidance_direction', m.guidance_direction,
      'guidance_detail', m.guidance_detail,
      'segments', m.segments
    )
  FROM events e JOIN event_metrics m ON m.event_id = e.id
  WHERE e.ticker_symbol = p_symbol AND e.parse_status = 'parsed'

  UNION ALL

  -- past briefings (already-released)
  SELECT
    b.id, 'briefing',
    b.generated_at,
    jsonb_build_object(
      'title', 'Post-call briefing — ' || b.fiscal_period,    -- TODO: template properly
      'content_md', b.content_md,
      'generated_at', b.generated_at,
      'fiscal_period', b.fiscal_period
    )
  FROM briefings b
  WHERE b.ticker_symbol = p_symbol AND b.status = 'ready' AND b.expected_release_at < now()

  UNION ALL

  -- transcripts with analysis
  SELECT
    t.id, 'transcript',
    t.call_date::timestamptz,
    jsonb_build_object(
      'fiscal_period', t.fiscal_period,
      'call_date', t.call_date,
      'tone', ta.tone,
      'novel_topics', ta.novel_topics,
      'summary_md', ta.summary_md
    )
  FROM transcripts t LEFT JOIN transcript_analysis ta ON ta.transcript_id = t.id
  WHERE t.ticker_symbol = p_symbol

  ORDER BY occurred_at DESC;
$$;
```

Returns one flat list that the ticker-detail screen runs through `groupByDay()`. RLS on each underlying table still applies.

### `ticker_sparkline(p_symbol, p_days)`

```sql
CREATE FUNCTION ticker_sparkline(p_symbol text, p_days integer DEFAULT 30)
RETURNS TABLE (trade_date date, close numeric)
LANGUAGE sql
STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT trade_date, close
  FROM ticker_prices
  WHERE ticker_symbol = p_symbol
    AND trade_date >= current_date - (p_days || ' days')::interval
  ORDER BY trade_date ASC;
$$;
```

The Watchlist row consumes this when the screen mounts. Batched per ticker; cached in client state.

---

## Materialised view candidate

### `sector_heat_mv` — refreshed daily

`discover_sector_heat` runs a GROUP BY over `briefings` filtered to the week. At MVP scale this is cheap. If `briefings` grows past a million rows (years away), materialise:

```sql
-- DEFERRED — only when discover_sector_heat() starts running >100ms
CREATE MATERIALIZED VIEW sector_heat_mv AS
SELECT
  date_trunc('week', expected_release_at)::date AS week_start,
  t.sector,
  count(DISTINCT b.id) AS reporting
FROM briefings b
JOIN tickers t ON t.symbol = b.ticker_symbol
WHERE b.expected_release_at > now() - interval '90 days'
  AND b.expected_release_at < now() + interval '30 days'
GROUP BY week_start, t.sector;

CREATE UNIQUE INDEX idx_sector_heat_mv_pk ON sector_heat_mv (week_start, sector);

-- pg_cron: refresh daily
SELECT cron.schedule('sector-heat-refresh', '0 4 * * *',
  $$ REFRESH MATERIALIZED VIEW CONCURRENTLY sector_heat_mv; $$);
```

`CONCURRENTLY` requires the unique index. Without it, the refresh locks the view for writes.

Documented now so when perf matters, the path is known. Skip until needed.

---

## How the frontend calls these

PostgREST exposes RPCs at `/rest/v1/rpc/<function_name>`. The Supabase JS client:

```js
const { data, error } = await supabase.rpc('discover_biggest_expected', { p_limit: 4 });
```

Views are queried like tables:

```js
const { data, error } = await supabase
  .from('watchlist_with_meta_view')
  .select('*');
```

RLS applies in both cases — the function/view never returns rows the user can't see.

See [frontend-wiring.md](frontend-wiring.md) for the per-screen mapping.
