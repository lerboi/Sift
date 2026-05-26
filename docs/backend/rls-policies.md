# RLS policies — every table, every action

Default-deny everywhere. If a table isn't listed here, it doesn't exist (or it's a bug).

Three roles:
- **`anon`** — never used at runtime. Every screen requires sign-in. No policies → no access.
- **`authenticated`** — a signed-in user, identified by `auth.uid()`.
- **`service_role`** — Modal workers and edge functions via the `sb_secret_...` key. Bypasses RLS entirely. **Never exposed to clients.**

Enable RLS in the same migration that creates the table:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
```

---

## User-owned tables

The pattern: `auth.uid() = user_id` (or `id` for `profiles`).

### `profiles`

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile select"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "own profile update"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- INSERT is handled by the auth-trigger (service_role context); no client policy.
-- DELETE is handled by cascade from auth.users; no client policy.
```

`WITH CHECK` is the post-update gate — without it, a user could `UPDATE profiles SET id = '<other-user>'` and steal a row. Always pair `USING` (the read-side filter) with `WITH CHECK` (the write-side validation) on UPDATEs.

### `watchlists`

```sql
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own watchlists select"
  ON watchlists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "own watchlists insert"
  ON watchlists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own watchlists update"
  ON watchlists FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own watchlists delete"
  ON watchlists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
```

### `watchlist_tickers`

Parent-checked: a row in `watchlist_tickers` is yours iff its `watchlist_id` belongs to you.

```sql
ALTER TABLE watchlist_tickers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wt select via own watchlist"
  ON watchlist_tickers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM watchlists w
      WHERE w.id = watchlist_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "wt insert via own watchlist"
  ON watchlist_tickers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM watchlists w
      WHERE w.id = watchlist_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "wt update via own watchlist"
  ON watchlist_tickers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM watchlists w
      WHERE w.id = watchlist_id AND w.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM watchlists w
      WHERE w.id = watchlist_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "wt delete via own watchlist"
  ON watchlist_tickers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM watchlists w
      WHERE w.id = watchlist_id AND w.user_id = auth.uid()
    )
  );
```

The `EXISTS` subquery is cheap because `watchlists.user_id` is indexed. Postgres turns it into a hash semi-join.

### `push_tokens`

```sql
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own push tokens select"
  ON push_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "own push tokens insert"
  ON push_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own push tokens update"
  ON push_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own push tokens delete"
  ON push_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
```

Push tokens get inserted from the app on first sign-in; the device claims a token for the authenticated user. Sign-out triggers DELETE so the next user on the device doesn't inherit them.

### `notifications`

Read-only for users; service_role writes via fan-out.

```sql
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notifications select"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policy for users.
-- The fan-out edge function uses service_role to write.
-- Users can't dismiss server-side; in-app UI is read-only.
```

Future: if the client should mark notifications as "read", add a `read_at` column and an UPDATE policy scoped to `auth.uid() = user_id AND (NEW.read_at IS NOT NULL AND OLD.read_at IS NULL)`. Don't ship until needed.

### `subscriptions`

Read-only for users; webhook (service_role) writes.

```sql
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own subscription select"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
```

---

## Catalog tables — `authenticated read`, service-role write

Same pattern for every catalog table: `SELECT TO authenticated USING (true)`, no other policy.

```sql
-- Apply to each catalog table:
--   tickers, ticker_prices, briefings, events, event_metrics,
--   transcripts, transcript_segments, transcript_analysis,
--   model_versions, data_source_status

ALTER TABLE tickers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all auth read tickers" ON tickers FOR SELECT TO authenticated USING (true);

ALTER TABLE ticker_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all auth read ticker_prices" ON ticker_prices FOR SELECT TO authenticated USING (true);

ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all auth read briefings"
  ON briefings FOR SELECT TO authenticated
  USING (status = 'ready');                          -- hide pending / needs_review

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all auth read events"
  ON events FOR SELECT TO authenticated
  USING (parse_status IN ('parsed', 'failed'));      -- hide pending; surface failed so frontend can show an InlineError state

ALTER TABLE event_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all auth read event_metrics"
  ON event_metrics FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.parse_status = 'parsed')
  );

ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all auth read transcripts" ON transcripts FOR SELECT TO authenticated USING (true);

ALTER TABLE transcript_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all auth read transcript_segments" ON transcript_segments FOR SELECT TO authenticated USING (true);

ALTER TABLE transcript_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all auth read transcript_analysis" ON transcript_analysis FOR SELECT TO authenticated USING (true);

ALTER TABLE model_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all auth read model_versions"
  ON model_versions FOR SELECT TO authenticated
  USING (status = 'active');                          -- users only ever see the active model

ALTER TABLE data_source_status ENABLE ROW LEVEL SECURITY;
-- No SELECT policy for authenticated. Service-role only.
-- (Admin UI later may add a role-gated policy.)
```

**Why filter `briefings` to `status='ready'` in RLS:**
Hiding `pending`/`needs_review` at the database layer means there's no path for the client to render a half-baked briefing — even if a screen forgot to filter, the row isn't returned. Belt-and-braces with the screen-level `WHERE status='ready'`.

**Why filter `events` to `parsed`/`failed`:**
- `parsed` is the happy path.
- `failed` is exposed so the frontend can render an `<InlineError>` ("filing couldn't be parsed — try again later") rather than a silent gap.
- `pending` is hidden — exposing it would race the parser and show flickering data.

---

## Audit table — service-role only

### `llm_calls`

```sql
ALTER TABLE llm_calls ENABLE ROW LEVEL SECURITY;
-- No policies. Service-role only.
```

Append-only audit. Future admin dashboard adds a SELECT policy gated on a role-claim check.

---

## Testing policies

Two approaches; use both during development.

### 1. In the Supabase SQL editor (manual)

```sql
-- Simulate as a specific user
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claim.sub', '<user-uuid>', true);

SELECT * FROM watchlists;  -- should return only that user's
SELECT * FROM briefings;   -- should return all 'ready' briefings
```

### 2. In CI (automated)

Use the Supabase CLI's `supabase test db` (pgTAP) — write assertions per table:

```sql
-- supabase/tests/rls_watchlists.test.sql
BEGIN;
SELECT plan(3);

-- as user A: insert own watchlist OK
SELECT set_config('request.jwt.claim.sub', 'user-a-uuid', true);
SELECT lives_ok($$ INSERT INTO watchlists (user_id, name) VALUES ('user-a-uuid', 'Test') $$, 'A can insert own');

-- as user A: insert someone else's watchlist FAILS
SELECT throws_ok($$ INSERT INTO watchlists (user_id, name) VALUES ('user-b-uuid', 'Test') $$, NULL, NULL, 'A cannot insert as B');

-- as user A: select user B's rows returns nothing
SELECT set_config('request.jwt.claim.sub', 'user-a-uuid', true);
SELECT is_empty($$ SELECT * FROM watchlists WHERE user_id = 'user-b-uuid' $$, 'A cannot see B');

SELECT * FROM finish();
ROLLBACK;
```

Run with `supabase test db` in CI. Catches the kind of typo (`USING` instead of `WITH CHECK`) that grants more than intended.

---

## Common RLS bugs to watch

| Bug | What happens | Fix |
| --- | --- | --- |
| Forgot `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` | Table is publicly readable | Always include in the table's create migration |
| `USING` without `WITH CHECK` on UPDATE | User can change `user_id` to steal rows | Always pair them |
| Policy on parent table; FK rows on child | Child rows are visible without check | Add explicit policy on child with EXISTS subquery |
| Policy using `current_user` instead of `auth.uid()` | Returns the DB role, not the JWT subject | Use `auth.uid()` for app users, `current_user` only in service code |
| `SECURITY DEFINER` function exposed to clients | Bypasses RLS unconditionally | Mark `SECURITY INVOKER` or gate manually inside the function |
| Realtime subscription without filter | Client receives every row insert; filtered client-side | Always filter at `.on('postgres_changes', { filter: '...' })` |

See [conventions.md § RLS](conventions.md#rls) for the canonical rules.
