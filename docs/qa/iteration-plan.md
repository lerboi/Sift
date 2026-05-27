# QA loop — full app bug-hunt + fix pass

Per-tick protocol for systematically auditing every feature of Sift end-to-end and fixing every bug found. Same structural shape as `docs/backend/iteration-plan.md`. The loop runs cold (no manual bug list from user) so each tick must do its own thorough investigation.

---

## Why this loop exists

After Phase 12 (backend integration) landed all 17 migrations + frontend wiring, the user noticed real-device bugs:

- **Adding a ticker doesn't work**
- **Welcome carousel doesn't show info**
- Likely many more uncaught

The migrations-only-files mode of the backend loop meant frontend rewiring shipped without on-device validation. Some bugs are wire-up mismatches (frontend expects shape X, RPC returns shape Y), some are pre-existing UI quirks now exposed by real data, some are auth/realtime edge cases.

This loop fixes them feature by feature, top-down through the app.

---

## Per-tick protocol

1. **Read all relevant code** for the feature in this tick:
   - The screen file(s) (`app/(group)/...` route + `src/features/<feature>/...`)
   - The hook(s) backing it (`src/features/<feature>/use-*.js`)
   - The components consumed (`src/components/...` and `src/features/<feature>/...`)
   - The relevant backend artefact (migration, RPC body, RLS policy, view shape)
   - The corresponding `docs/backend/frontend-wiring.md` section
2. **Walk the user flow mentally** — what happens on screen mount, what triggers state changes, what the user sees at each step. Note any state that depends on data that may not exist yet (empty watchlist, no briefings ready, no events parsed).
3. **Cross-check shape contracts** between schema → RPC → hook shape → component props. The most common bug class is "RPC returns snake_case, component expects camelCase" or "column type changed but transform didn't follow."
4. **Identify bugs** — write each one into `docs/qa/bugs.md` with:
   - `BUG-NN` id
   - Severity (`blocker` / `major` / `minor` / `polish`)
   - File:line where the bug lives
   - What's wrong
   - What the user sees
5. **Fix each bug** in the same tick. Smallest viable patch; don't refactor surrounding code unless the fix demands it.
6. **Update changelog** (`docs/qa/changelog.md`) — one paragraph: bugs found + fixes applied + any REVIEW: flags.
7. **Mark bugs as `fixed`** in `bugs.md` (status table at top).
8. **Update this file's STATUS** + check the tick's box in the backlog below.
9. **Schedule next tick** via `ScheduleWakeup` (270s max).

### Each tick MUST output

- ≥1 `bugs.md` entry (even if it's "no bugs found — feature works as authored, verified by code review")
- A changelog paragraph
- A check-box toggle in the backlog
- The next ScheduleWakeup call

---

## STATUS

**Last tick:** QA23 — smoke checklist written. **QA LOOP CLOSED.**
**Next:** user walks `docs/qa/smoke-checklist.md` on-device after re-deploying `notify_user_event` edge function.
**Mode:** loop stopped. 25 bugs filed; 18 fixed, 6 polish deferred, 1 minor wontfix.
**Mode:** code-review + fix. No `supabase db push` (schema already live). Frontend edits + small migration corrections if needed (regenerate combined SQL if a schema fix is required).
**Blockers:** none.
**Bug log:** see `docs/qa/bugs.md`.

---

## Backlog

Legend: `[ ]` to do · `[x]` done · `[~]` partial · `[!]` blocked

### Known user-reported bugs (highest priority)

- [x] **QA1** — Known bugs investigated. **BUG-001**: `FLAT_SPARK` undefined ref in use-watchlist.js shape() — crash on post-insert refresh. Fixed. **BUG-003**: missing `GestureHandlerRootView` in root layout. Fixed. **BUG-004**: missing `SafeAreaProvider` in root layout — almost certainly the root cause of BUG-002 (carousel). Fixed. **BUG-002** marked fixed pending on-device verify. **BUG-005**: cosmetic indent typo. Fixed.

### Auth + onboarding

- [x] **QA2** — Sign-in screen audited. Code clean. Filed BUG-006 (wontfix — intentional flash) and BUG-007 (polish — no inline password-length helper). No blockers/majors. SafeAreaProvider fix from QA1 unblocks the KeyboardAvoidingView+insets path here.
- [x] **QA3** — Sign-up screen audited. Code clean. handle_new_user trigger chain (profile + watchlist + subscriptions) is atomic with auth.users insert. Filed BUG-008 (wontfix — Supabase anti-enumeration ambiguity on existing-email signup).
- [x] **QA4** — Auth callback screen audited. Clean. Only fires on cold-start deep link (in-app browser flow handles exchange inline). No bugs.
- [x] **QA5** — Welcome carousel + How Sift Works audited. Both structurally clean by code review. BUG-002 should be resolved by QA1's SafeAreaProvider fix. Compliance copy verified.
- [x] **QA6** — Ack screen audited. Fixed BUG-009 (double-tap race — added submitting state + loading prop). Filed BUG-010 (polish — useAuthRouting doesn't check onboarded_at; user who cold-restarts mid-onboarding skips remaining screens). System self-heals on UPDATE failure via useAuthRouting redirect.
- [x] **QA7** — Notifications onboarding audited. Clean. Push registration degrades gracefully in Expo Go (no projectId → throws → caught → user progresses). Both paths navigate to /first-tickers via `finally` block.
- [x] **QA8** — First-tickers screen audited. Fixed BUG-011 (Skip wrongly persisted selections — refactored to `{persistTickers}` option) + BUG-012 (double-tap guard). Both Continue + Skip now correctly set onboarded_at.

### Core app screens

- [x] **QA9** — Today screen audited. Fixed BUG-013 (major — pending-pill crash from synth row missing metric fields; refactored to count-only token) + BUG-014 (null-safe formatters for EPS/surprise/beatProb + a11y).
- [x] **QA10** — Watchlist screen audited. Fixed BUG-015 (minor — "9999d"/"Q? 26" placeholders displayed literally; now render as em-dashes). Empty + error + sorted branches verified. Swipeables + sheet now functional via QA1's GestureHandlerRootView.
- [x] **QA11** — Discover screen audited. Three rails + search all clean. No bugs filed. Note: seeded briefings may not all show in current-week window (RPC behavior is correct; seed dates are illustrative).
- [x] **QA12** — Ticker detail audited. Clean. Filed BUG-016 (polish, open — ticker drill-in jumps to Watchlist tab from any source; fix is additive scaffolding blocked by "no new features" rule).
- [x] **QA13** — Event detail audited. Fixed BUG-017 (major — failed events showed misleading "0.0% In line" hero; now show "Filing couldn't be parsed") + BUG-018 (minor — source/share rows hidden when no data/url).

### Settings + supplementary

- [x] **QA14** — Settings screen audited. Fixed BUG-019 (hardcoded version). Filed BUG-020 (polish — silent profile-load failure). Sheets work via QA1's GestureHandlerRootView.
- [x] **QA15** — Disclaimer/Privacy/Terms audited. All clean. Compliance copy verified against `docs/architecture/compliance.md`. DRAFT pills on Privacy + Terms serve as honest provisional-content signal.
- [x] **QA16** — All three settings sheets (Subscription / Sign-out / Quiet-hours) audited. Clean. Functional via QA1's GestureHandlerRootView.

### Realtime + push (cross-cutting)

- [x] **QA17** — Notifications realtime stream audited. Clean. Channel name + cleanup + filter + JWT refresh verified by code review. User can test with manual SQL insert.
- [x] **QA18** — Watched-briefings + ticker-events streams audited. Fixed BUG-022 (channel churn on inline onChange — added onChangeRef). Filed BUG-021 (polish — over-firing due to REPLICA IDENTITY DEFAULT; acceptable since refresh is idempotent).

### Polish + edge cases

- [x] **QA19** — Empty-state walkthrough. Every screen audited. All have appropriate EmptyState / empty-rail-copy / fallback hero. No crashes. No new bugs.
- [x] **QA20** — Visual pass. All formatters guarded (per QA9 BUG-014 + QA13 BUG-017/18). No snake_case in JSX. No forbidden words in product copy. Sparkline + date formatters handle null/empty safely. Discover "0.0%" for missing expected_move_pct is acceptable for MVP.
- [x] **QA21** — Navigation + tab state audited. Fixed BUG-023 (major — briefing push deep link routed to 404). REQUIRES edge function re-deploy.
- [x] **QA22** — Error boundaries + recovery audited. Fixed BUG-024 (InlineError ignored title prop — three callers affected) + BUG-025 (event detail had no Retry). All four data-fetch screens (today/watchlist/discover/ticker/event) now surface title + message + Retry on fetch failure.

### Final acceptance

- [x] **QA23** — Smoke checklist written at `docs/qa/smoke-checklist.md`. Structured on-device walkthrough covering all 25 bug fixes + polish-tier deferrals. Loop deliverable.

---

## After the loop ends

User runs the manual smoke checklist from QA23 and pings back with any remaining bugs. Loop can be re-entered with `/loop` against this same plan for round-2 fixes.

---

## Notes on what NOT to do

- **No new features.** Only fix what's broken in the existing surface.
- **No schema redesigns.** Migration corrections only if a column-shape bug is found (e.g. column type drift, missing default). If a fix touches schema, regenerate `_combined_for_sql_editor.sql` and tell the user in changelog.
- **No bundled refactors.** A bug in one screen doesn't justify rewriting unrelated code in the same file. Minimal patch.
- **Don't optimise prematurely.** Slow query? Note in REVIEW. Don't index or rewrite unless the query is blocking.
- **Compliance copy is still non-negotiable.** Don't introduce any directive language while fixing — keep the educational framing.
