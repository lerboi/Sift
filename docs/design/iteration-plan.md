# Sift — UI/UX Iteration Plan

Self-contained protocol + backlog for the design-iteration loop. **This file is the contract** — the loop reads it, picks the next thing, does it, updates the file.

If you're an agent reading this for the first time, read [`learnings.md`](learnings.md) and [`palette.md`](palette.md) before starting work. SETUP.md is the product source of truth; this plan is about *expressing* what SETUP.md describes through the UI.

---

## What Sift is (read every tick, do not drift)

Sift is a **mobile earnings intelligence app for self-directed US-equity investors**. It detects new 8-K earnings filings, generates LLM briefings, predicts beat/meet/miss, and pushes structured insights. **Framed as educational research, never investment advice** — this framing is load-bearing for compliance (SEC/FCA publisher's exclusion).

Every UI decision is judged against four anchors:

1. **Educational, not advisory** — never "advice", "recommend", "should buy"; probability colours stay neutral, never green/red. (See `../architecture/compliance.md`.)
2. **Numbers are the product** — mono font, tabular figures, generous spacing; if a number is unreadable, the design failed.
3. **Calm over excitement** — Apple Stocks vibe, not Robinhood; no confetti, no pulsing badges, no auto-play sound.
4. **Mobile only, mobile shape** — web build is a dev convenience (430pt max-width frame); never optimise for desktop.

If a tick's plan conflicts with any anchor above, the anchor wins — adjust the plan, don't bend the anchor.

---

## FOCUS (optional override)

> If non-empty, the loop should advance THIS thread first, ignoring backlog order. Clear when done.

_(none — Phase R closed tick 54, 2026-05-22. All four user critiques addressed: ticker detail is now one chronological spine, Home anchors on date eyebrows, Home and Watchlist are visually distinct, Events tab replaced by Discover. Backlog resumes at P7-4.)_

---

## Loop protocol (per tick)

1. **Read, in order:**
   - The **"What Sift is"** anchor above. Re-ground every tick — it's two paragraphs, cheap.
   - `learnings.md` § Design principles + § Apple HIG + the iteration log tail.
   - `palette.md` (skim — confirm tokens you're about to use exist).
   - This file's **FOCUS** line, **STATUS** section, and **Bug log** below.
   - **If FOCUS references a brief or sub-document** (e.g. `redesign-2026-05-22.md`), read it in full before picking. The brief's mockups and decisions override generic intuition; don't reinvent.
2. **Pick** what to do this tick:
   - **If the Bug log has unresolved entries**, prioritise them (always — visible bugs erode trust in everything else built).
   - Otherwise, if the last 3+ ticks were all forward-build, do a **UI review pass** — see "UI review cadence" below.
   - Otherwise, pick the next unchecked backlog item (top to bottom), unless FOCUS overrides.
3. **Plan** the unit of work (1–3 sentences, in your head or in the changelog entry).
4. **Build** it. Mock data is fine and expected — backend isn't ready and shouldn't block design work.
5. **Verify** the bundler still boots clean (`npx expo start --no-dev --offline --port 8084` for ~20s; or `npx expo-doctor`). If you have a screen visible, eyeball it.
6. **Write a changelog entry** in [`changelog.md`](changelog.md): one paragraph + a "next time" note.
7. **Capture learnings** in [`learnings.md`](learnings.md) if you discovered something durable (a new heuristic, a library quirk, an Apple HIG rule you didn't know). Don't fluff — only if it's *new and reusable*.
8. **Check the box** in this file. If you discovered sub-items, add them as nested unchecked items beneath the parent.
9. **Update STATUS** below with one line: where you are, what's next, any blockers.
10. **Schedule the next tick** via `ScheduleWakeup` with a delay appropriate to the work just done (60–270s for momentum; longer if the next item needs research you've queued).

### UI review cadence

After every 3 forward-build ticks, dedicate one tick to a **UI review pass**:

- Read recent changelog entries to recall what's been touched.
- Mentally walk every screen built so far in its loading, populated, and empty states. Note anything that would make a user wince: bad spacing, undersized tap targets, colour misuse, broken contrast, untrimmed text, mismatched safe-area handling, web/native divergence.
- Add findings to the **Bug log** below — each one a one-liner with a hypothesis. Prioritise visibility (something on every screen > corner case).
- Fix the top 1–2 bugs immediately; queue the rest.
- Record what you reviewed and what you couldn't (e.g., "no device available, motion not verified") in the changelog so coverage gaps are honest.

This step is a real tick — write a changelog entry, update STATUS, schedule the next wakeup.

### When to stop the loop

- When all build items in Phase 0–10 are checked AND at least one polish pass has run.
- Or: the bundler is broken and you can't fix it in 2 attempts — stop and tell the user.
- Or: you hit an item that requires a product decision the user hasn't made (e.g., specific copy, a brand asset). Park it, leave a note, move to the next unblocked item.

### Rules

- **One item per tick.** No batching. Small tight units beat sprawling diffs.
- **No new dependencies without justification in the changelog.** Every `npm install` line gets a sentence on why.
- **Code comment style: lowercase, one line, only for non-obvious why.** See [`/CLAUDE.md`](../../CLAUDE.md).
- **Compliance copy is sacred** — no "advice", no "recommend", no "should buy". See [`compliance.md`](../architecture/compliance.md).
- **Mock data lives in `src/features/<feature>/mock.js`** — keep it co-located so we can delete in one shot when real APIs land.
- **Never use raw hex colors in components.** Always through `colors.*` from `src/theme`.

---

## STATUS

**Last tick:** tick 77 — P11-8 shipped: tab-scoped event detail routes; canonical `/events/[id]` preserved for deep-links.
**Next:** **session-pause again.** Only P11-5 (light mode, user-gated) remains. No productive next item without user input.
**Blockers:** none.

## Bug log

User-reported and review-found UI issues. Each gets fixed in priority order before the build backlog resumes.

- [x] **B10** Hero metaRow disconnect — resolved by **R6** (tick 50): ticker hero was rewritten end-to-end. Symbol → one-line `name · sector` → sparkline+30d row. The disconnected pill-left/sparkline-right composition no longer exists.
- [x] **B11** UP NEXT "▲ 65%" reads directional — resolved by **R3** (tick 47): `<EventTimelineCard>` upcoming state renders the beat-probability as a labeled metric (`Beat probability  65% ⓘ`) with no triangle. Triangles only appear for realized outcomes in signal colours.
- [x] **B13** Watchlist empty-state CTA noop — resolved by **P5-6** (tick 42): empty-state CTA wires to `openSheet` → `<AddTickerSheet>`. Verified in current `watchlist-screen.js`.
- [ ] **B14** Event detail METRICS tiles and ACTUAL vs ESTIMATE compare bars show the same data (EPS + Revenue actual vs estimate) twice. Consider merging — either embed a tiny compare bar inside each MetricTile, or drop the tiles in favour of the bigger compare bars. Defer; both visualisations are individually OK and serve slightly different reading speeds.
- [x] **B17** Discover sector-heat rows had a `→` chevron implying nav but tap fired only haptic — fixed tick 69 (UI review pass). Removed chevron + downgraded Pressable to View since there's no destination. Sector-detail navigation is a real Phase 12+ feature, not a chevron stub.
- [x] **B18** Settings Email row showed hardcoded `"you@example.com"` — fixed tick 69 (UI review pass). Now reads `session.user.email` via `supabase.auth.getSession()` on mount; falls back to `—` when no session.
- [x] **B16** Watchlist sparkline trend tint — fixed tick 49 (as part of R5): sparklines now default to `text.secondary`; `trend` prop preserved on the data shape so future real 30d-change data can re-tint with intent.

- [x] **B8** PAST EVENTS placeholder on ticker detail — fixed tick 28: icon + "Coming soon" headline + subhead description of what'll go there. Reads as deliberate, not TODO.
- [x] **B9** Event detail stub — fixed tick 28: uses `<EmptyState>` (Activity icon, "Event detail coming soon", description listing what's coming). Same shape as Watchlist/Events tab empty states for consistency.

- [x] **B3** Settings tab has no Stack/large title — fixed tick 25: converted to `app/(app)/settings/{_layout,index}.js`, same Stack screenOptions as Watchlist/Events/Today (large-title + transparent + blur on iOS, solid `bg.base` on Android). Stripped inline `Settings` h1 and SafeAreaView top edge from `settings-screen.js`.
- [x] **B4** `<NewEventsPill>` sticky-on-scroll — fixed tick 27: added an always-rendered `pillSlot` View as the ScrollView's first child + `stickyHeaderIndices={[0]}`. Slot is transparent + `pointerEvents="box-none"` when empty (collapses, touches pass through); when `pending.length > 0` the pill appears centred and pins to the top of the scroll viewport as the user scrolls. Native sticky behavior; no Reanimated needed.
- [x] **B5** ticker hero hardcoded mono string — fixed tick 26: replaced `...text.displayLg + fontFamily: 'JetBrainsMono_500Medium'` with `...text.displayLgMono` (which already wires mono medium + tabular-nums).
- [x] **B6** Tab bar inactive color is `text.tertiary` (#5C657A) — quite muted, easy to miss the inactive tabs. — fixed tick 24: bumped to `text.secondary` (#9CA3B5).
- [x] **B7** Settings screen empty/broken-looking — fixed tick 24: built `<SettingsGroup>` and `<SettingsRow>` primitives (iOS-style grouped rows, hairline dividers, optional value/chevron/destructive), rendered three groups (ACCOUNT / NOTIFICATIONS / ABOUT) with realistic mock content + a footer note + the long disclaimer. Rows are stub-tappable with `select()` haptic.

- [x] **B1** White bar above content on every screen. — tick 22 (initial guess) + tick 23 (real fix), 2026-05-11
  Initial fix was wrong — `app.json` `userInterfaceStyle` is ignored in Expo Go (it only takes effect in a native dev build). **Real cause:** react-navigation's default `ThemeProvider` uses `DefaultTheme` with `colors.background: 'white'` when the OS reports light mode; that white painted the navigator container behind transparent headers and bled into the safe-area top. **Real fix:** wrap root `app/_layout.js` in `<ThemeProvider value={SiftNavTheme}>` with `DarkTheme` extended by our palette. The `app.json` `dark` style + dark splash still ship for the eventual dev build.
- [x] **B2** Bottom tab bar visually cut off. — tick 22, 2026-05-11
  Fix: `useSafeAreaInsets()` in `(app)/_layout.js`; `tabBarStyle.height = baseHeight + insets.bottom`, `paddingBottom: insets.bottom || 6`. Custom heights now play nice with the home-indicator on iPhone and the Android nav bar in edge-to-edge mode.

---

## Backlog

Legend: `[ ]` to do · `[x]` done · `[~]` partially done / has sub-items · `[!]` blocked

### Phase R — Redesign sprint (FOCUS)

Driven by [`redesign-2026-05-22.md`](redesign-2026-05-22.md) — read it before starting any R-tick. Ordering principle: data shape first, then primitives, then screens, then deletions. Do not interleave with later phases until R closes.

- [x] **R1** Data shape + mock refactor — tick 45, 2026-05-22. Shipped `src/lib/dates.js` (`groupByDay`, `formatDayHeader`, `formatEventTime`, `formatMarketAnchor`) + added `expectedAt`/`actualAt` to every event across the four mock files. Existing `when`/`dateLabel`/`date`/`filedAt` strings preserved so consumers compile unchanged. Verified via a Node smoke harness (deleted after use) + clean Metro boot.
  - [ ] **R1a** (deferred to R6) — add `publishedAt` to ticker `pastBriefings`, `recordedAt` to ticker `transcripts`, when the ticker timeline rewrite needs them.
  - [ ] **R1b** (deferred to R4) — fix weekend `expectedAt` values in `home/mock.js` and `ticker/mock.js` `pastEvents` (TSLA Sat May 23, AAPL Sat Nov 1, etc.) when consumers migrate off the `when` strings. Cosmetic.
- [x] **R2** `<DayHeader>` primitive — tick 46, 2026-05-22. `src/components/day-header.js` consumes `formatDayHeader`; elides the duplicated weekday when relative IS the weekday. Verified by forcing a Metro bundle and grepping for the export.
- [x] **R3** `<EventTimelineCard>` primitive — tick 47, 2026-05-22. `src/components/event-timeline-card.js` ships all three states. Also extended `src/lib/dates.js` with `formatRelativePast` for the live ribbon. Verified by Metro bundle.
  - [ ] **R3a** (deferred to R4) — Home mocks lack `name`; R4 must provide it (via a shared ticker→name lookup, or by extending home mocks). Decide in R4.
- [x] **R4** Today screen rewrite — tick 48, 2026-05-22. Home now flows events through `groupByDay` + `<DayHeader>` + `<EventTimelineCard>`. Section labels gone, sticky pill + pull-to-refresh + empty state preserved. Mock collapsed to one flat array with `state` per event; `useHomeData` returns `{events, ...}`. R3a (`getCompanyName` in ticker-catalog) and R1b (MSFT weekend → Mon) closed inline.
- [x] **R5** Watchlist row + sort selector — tick 49, 2026-05-22. New two-line row layout, muted sparkline (closes B16), `<SortSelector>` primitive backed by `<AppSheet>`. `groupByWeek` retired from the screen (still exported for safety). Three sort modes: date / alpha / recent.
- [x] **R6** Ticker detail timeline rewrite — tick 50, 2026-05-22. Hero tightened; everything below renders as one `<DayHeader>` + content-card spine via `buildTimeline` + `groupByDay`. `<EventTimelineCard>` gained `hideIdentity` (and a non-tappable badge variant for the briefing-ready row when no handler is wired). R1a closed inline (publishedAt/recordedAt on briefings + transcripts). Methodology sheet + sticky CTA + disclaimer all preserved.
- [x] **R7** Discover screen — tick 51, 2026-05-22. Search + three rails (model-predicted biggest expected, sector heat, recent biggest surprises). Compliance copy gate cleared (Model prefix + expected qualifier; no forbidden words). Route registered; tab bar swap in R8.
- [x] **R8** Tab bar swap + Events deletion — tick 52, 2026-05-22. Tab order: Today · Watchlist · Discover · Settings. Events tab `href: null`'d to keep `[event_id]` route reachable. 4 files + 2 orphan components deleted. Detail-only Stack `_layout.js` added so the dynamic route gets a header.
  - [ ] **R8a** (deferred to R9) — when on `/events/<id>` from Today/ticker, no tab shows as selected. Visual artifact; fix by hosting the detail route under the originating tab.
- [x] **R9** Cross-screen consistency pass — tick 53, 2026-05-22. Swept all 5 screens. Orphan `'in 2h'`/`'tomorrow'` strings: none. Fixed: removed duplicate date display on ticker detail (BriefingCard + TranscriptCard gained `showDate={false}` opt-out); deleted orphan `past-event-row.js`. Queued to Phase 11: aspirational ⏰/📄/💬 glyphs and R8a (no-selected-tab on `/events/<id>`).
- [x] **R10** Phase R close-out — tick 54, 2026-05-22. `palette.md` "Component implications" section rewritten as post-Phase-R conventions (DayHeader shape, EventTimelineCard state table, live-ribbon colour decision, outcome arrows, prediction display, briefing-ready badge, sparkline tint). `learnings.md` gained a Phase R summary entry with four durable patterns. FOCUS cleared. Phase R **closed**.

### Phase 0 — Foundation

These unblock everything. Do them first. Each is small.

- [x] **P0-1** Web max-width wrapper (web only) — tick 1, 2026-05-11
  `src/components/web-frame.js` + wrapped Stack in `app/_layout.js`. `Platform.OS === 'web'` → 430pt centred frame with `bg.inset` outer bg.
- [x] **P0-2** Refine the typography scale to iOS-aligned tokens — tick 2, 2026-05-11
  New tokens in `src/theme/index.js`: `displayLg/displaySm/title/headline/body/callout/subhead/footnote/caption` + 6 mono variants with `fontVariant: ['tabular-nums']`. Migrated `earnings-card.js` + `header.js`. Synced `palette.md` to match.
- [ ] **P0-3** Component primitives (one tick each — split into sub-items)
  - [x] **P0-3a** `<Button>` — primary / secondary / ghost variants; loading state; pressed scale 0.98 + haptic light — tick 3, 2026-05-11
  - [x] **P0-3b** `<Card>` — `bg.surface` + `border.subtle` + `radius.lg` + padding token; optional `onPress` → pressable variant with same scale + haptic. Refactored `earnings-card.js`. — tick 4, 2026-05-11
  - [x] **P0-3c** `<Pill>` — variants accent/neutral/positive/negative/warning/info; sm/md sizes. Migrated `header.js` to consume. — tick 5, 2026-05-11
  - [x] **P0-3d** `<MonoNumber>` — size token (`displayLg`/`headline`/`body`/`callout`/`subhead`/`footnote`), auto VoiceOver labelling for `▲▼━+−%`; consumed by `earnings-card.js`. — tick 6, 2026-05-11
  - [x] **P0-3e** `<Skeleton>` — rect + circle, opacity pulse 0.5↔1 over 1.6s. Pinned at 0.5 under reduced motion. Hidden from a11y tree. — tick 7, 2026-05-11
  - [x] **P0-3f** `<EmptyState>` — title + optional description + optional icon + optional CTA (via `<Button>`). — tick 8, 2026-05-11
  - [x] **P0-3g** `<InlineError>` — alert-role chip with icon, message, optional error code (mono), optional retry button. — tick 8, 2026-05-11
  - [x] **P0-3h** `<DisclaimerFooter>` audit — added `variant` (`short`|`long`) per palette.md canonical text; `align`, `style` overrides; horizontal padding for long-form readability. — tick 9, 2026-05-11
- [x] **P0-4** `src/lib/haptics.js` — thin wrapper around `expo-haptics` — tick 3, 2026-05-11
  Five named functions: `tap`, `select`, `success`, `error`, `warning`. Centralised for later audit. Reduced-motion gating deferred to P0-5 callers.
- [x] **P0-5** `useReducedMotion()` hook — `src/lib/use-reduced-motion.js`. Subscribes to `reduceMotionChanged`. First consumer: Skeleton. — tick 7, 2026-05-11
- [x] **P0-6** Blur material wrapper — `<BlurSurface>` using `expo-blur` (`tint='dark'`, `intensity=70`); Android <SDK31 falls back to translucent `bg.elevated`. `BlurTarget` not required on Expo SDK 54. — tick 10, 2026-05-11

### Phase 1 — Navigation shell

- [x] **P1-1** Decision: **4 tabs** — Today, Watchlist, Events, Settings. Learn deferred to P8 placeholder. — tick 11, 2026-05-11
- [x] **P1-2** Bottom tab bar — `<Tabs>` from `expo-router` with `bg.surface` + 1px top border, accent active tint, lucide icons (Home/Bookmark/Activity/Settings). Native-tabs upgrade deferred (works fine in JS for MVP). — tick 11, 2026-05-11
- [x] **P1-3** Large title in Stack screens — all four tabs (Today/Watchlist/Events/Settings — wait, Settings is still flat) now use native iOS large title via per-tab `Stack` layout. Settings remains flat as a single-screen tab; will add Stack in P7. Today's old internal `<Header>` deleted. — tick 14, 2026-05-11
- [x] **P1-4** Modal sheet conventions — installed `@gorhom/bottom-sheet@5` (works fine with installed Reanimated 4), wrote `<AppSheet>` forwardRef wrapper with default `60%` snap, pan-down-to-close, accent-tinted handle, backdrop at 0.6 opacity. Detents adjustable per usage. — tick 13, 2026-05-11
- [~] **P1-5** Tab → Stack composition with deep links — partial
  Per-tab Stacks exist for Watchlist and Events (folder + `_layout.js` pattern). Today and Settings still flat. Deep-link verification deferred until ticker detail (P3) + event detail (P4) screens land. — tick 12, 2026-05-11

### Phase 2 — Home / Today screen

- [x] **P2-1** Information architecture redesign — three sections (LIVE NOW / UPCOMING / RECENT), each gated on data length so empty sections don't render. New `<EventCard>` for realized events (actual vs estimate + surprise % with `signal.positive`/`signal.negative` since these are realized outcomes). Mock data split into `src/features/home/mock.js`. — tick 15, 2026-05-11
- [x] **P2-2** Migrate `earnings-card.js` to new primitives — `<Card>` (tick 4), `<MonoNumber>` (tick 6). Briefing-ready indicator is bespoke (dot + accent text) rather than a `<Pill>` — feels lighter inline. — completed across ticks 4-6, marked 2026-05-11
- [x] **P2-3** Loading skeleton state — `<HomeSkeleton>` renders an UPCOMING section with 3 skeleton cards matching `EarningsCard` shape. `useHomeData()` simulates an 800ms loading delay so the skeleton path is exercised on every cold start. — tick 16, 2026-05-11
- [x] **P2-4** Empty state — when post-load all three sections are empty, render `<EmptyState>` ("Nothing on your radar yet" + "Add a ticker in Watchlist to see upcoming earnings and live filings here"). CTA wiring deferred until watchlist add-sheet exists (P5-6). — tick 16, 2026-05-11
- [x] **P2-5** Pull-to-refresh — `RefreshControl` on the home ScrollView, `tintColor: colors.text.tertiary`; `useHomeData()` exposes `refresh()` + separate `refreshing` flag (so refresh doesn't trigger the skeleton). — tick 17, 2026-05-11
- [x] **P2-6** "X new events" pill pattern — `<NewEventsPill count onTap>` with `FadeInDown`/`FadeOutUp` Reanimated entrance/exit. Fires one light haptic when `pending.length` flips from 0 → >0. Tap promotes pending into the LIVE NOW section. `useHomeData()` simulates a new AMD event arriving 5s after first load. — tick 18, 2026-05-11
- [x] **P2-7** Card tap → detail navigation — EarningsCard taps push to `/watchlist/<ticker>`, EventCard taps push to `/events/<ticker>` (event_id placeholder). Cross-tab navigation switches to the destination tab's Stack. Stub detail screens at both routes (real content in P3/P4). — tick 19, 2026-05-11

### Phase 3 — Ticker detail screen

`app/(app)/watchlist/[ticker].js` (also reachable from home).

- [x] **P3-1** Hero section — big mono ticker, full name, sector pill, SVG sparkline (30 deterministic mock points). — tick 20, 2026-05-11
- [x] **P3-2** "Up next" card — period + when + EPS estimate + beat probability with accent-blue arrow (not green per compliance) + "Model confidence based on prior 12 quarters" qualifier. — tick 20, 2026-05-11
- [x] **P3-3** Past briefings list — `<BriefingCard>` collapsible (2-line preview ↔ full text) with rotating chevron + LayoutAnimation. Plain text for now; markdown renderer is a separate decision (open item). — tick 21, 2026-05-11
- [x] **P3-4** Past events list — `<PastEventRow>` with period+date (left), actual EPS + "vs $est" (mid), surprise arrow+% right-aligned in `signal.positive/negative/neutral`, chevron, hairline divider between rows, tap routes to `/events/<id>`. List wrapped in a single `<Card padding={0}>` for iOS-list density. Five mock past events in `mock.js`. — tick 29, 2026-05-22
- [x] **P3-5** Transcript snippets accordion — `<TranscriptCard>` collapsible (2-line preview ↔ full snippet) with tone pill (`bullish ▲ / neutral ━ / bearish ▼`, mapped to positive/neutral/negative variants). Expanded view shows a "NOVEL TOPICS" eyebrow + chip row (border + bg.elevated). Three mock transcripts in ticker mock. — tick 30, 2026-05-22
- [x] **P3-6** Sticky CTA: add/remove from watchlist — bottom-anchored bar (absolute, safe-area inset, hairline top border, solid `bg.base`). `<Button>` swaps `primary` (`BookmarkPlus` icon, "Add to watchlist") ↔ `secondary` (`BookmarkCheck` icon, "On watchlist") with `haptics.select()` on toggle. ScrollView reserves bottom padding so content isn't hidden. Mock state — wires to Supabase later. — tick 31, 2026-05-22
- [x] **P3-7** Disclaimer inline + methodology sheet — added a small `Info` icon next to the beat-probability number on the UP NEXT card; tap opens an `<AppSheet>` (gorhom 55% snap) titled "How this prediction works" with three paragraphs: inputs the model uses, what the percent IS (calibrated probability, statistical, not personalised) and IS NOT (forecast/recommendation), and a closing compliance line. Inline qualifier under the metric row updated to "Model confidence based on prior 12 quarters · not a recommendation". — tick 33, 2026-05-22

### Phase 4 — Event detail screen

`app/(app)/events/[event_id].js`

- [x] **P4-1** Event detail hero — coloured `<Pill>` (positive/negative/neutral) carries the qualifier "Reported beat / Reported miss / In line" with the directional arrow; the big surprise % below uses `displayLg` mono in neutral `text.primary` (not green/red) so the focal number stays calm; subhead caption "EPS surprise vs estimate" + footnote with filed timestamp. Mock `getEventMock(id)` for sandbox data. — tick 34, 2026-05-22
- [x] **P4-2** Parsed metrics grid — three sections on event detail. METRICS: two-column row of `<MetricTile>` (EPS + Revenue), each shows label, actual (mono headline), "vs $est" reference, delta arrow+% in signal color. GUIDANCE: a Card with a coloured `<Pill>` ("Guidance raised/maintained/lowered") + detail line. SEGMENTS: dense list inside `<Card padding={0}>`, each row has segment name + estimate (left), actual (mid mono), delta (right) with arrow + signal color + hairline dividers. — tick 35, 2026-05-22
- [x] **P4-3** Actual-vs-estimate bar viz — `<CompareBar>` twin-bar viz: actual fill (signal-tinted by surprise sign) + estimate fill (muted with subtle border) on the same scale (max × 1.05 headroom). Stacked rows with legend / track / value-right. Two instances per event (EPS + Revenue) inside a single Card. Plain View+flex, no Skia. — tick 36, 2026-05-22
- [x] **P4-4** Filing timeline strip — three-step vertical stepper inside a Card: "8-K filed on EDGAR" → "Detected by Sift" (+8s) → "Pushed to your device" (+14s). Accent-coloured dots on the first two, `signal.positive` on the final to signal "within target". Hairline vertical connectors between dots. Footer Pill "within 15s target" reinforces the SLA per `realtime-and-push.md`. — tick 37, 2026-05-22
- [x] **P4-5** Source link — `SettingsRow` "View original Exhibit 99.1" opens the EDGAR exhibit URL via `WebBrowser.openBrowserAsync` (`PAGE_SHEET` presentation on iOS — Safari sheet in-app, not OS browser). `expo-web-browser` installed. — tick 38, 2026-05-22
- [x] **P4-6** Share — `Share.share()` with a factual body: ticker + period + classification, EPS + revenue lines with surprise %, guidance direction, and "Via Sift — educational research, not investment advice." footer (standalone-compliance per learnings). — tick 38, 2026-05-22

### Phase 5 — Watchlist screen

- [x] **P5-1** Sectioned list view — `groupByWeek()` partitions items by `daysAway` into THIS WEEK (<7d), NEXT WEEK (7-13d), LATER (≥14d); empty groups are filtered out. Each group renders an eyebrow label + a single `<Card padding={0}>` with hairline-divided rows. Six mock tickers covering all three buckets. — tick 39, 2026-05-22
- [x] **P5-2** Row layout — `<WatchlistRow>` with three columns: left (symbol headline-mono + name footnote, 1-line truncate), middle (64×20 sparkline tinted by `trend` — positive/negative/secondary), right (`date` + `Nd` with optional `accent` briefing-ready dot). Chevron tail. Full-row Pressable with tap haptic, routes to `/watchlist/<symbol>`. — tick 39, 2026-05-22
- [x] **P5-3** Swipe-to-remove — each WatchlistRow now wrapped in `<ReanimatedSwipeable>` (the non-deprecated API from `react-native-gesture-handler/ReanimatedSwipeable`). Reveal-on-left-swipe action: 96pt `signal.negative` panel with Trash2 icon + "Remove" caption. Tap fires `haptics.warning()` and removes from state; `swipeable.close()` resets. `overshootRight: false` prevents the rubber-band beyond the action. Card has `overflow: hidden` so action stays clipped to the row container. — tick 41, 2026-05-22
- [~] **P5-4** Reorder via long-press drag — **deferred**. The watchlist is rendered as a *derived view* sorted by upcoming earnings date and grouped by week. Manual reorder doesn't map cleanly — a user drags AAPL above MSFT but the grouping engine puts them back in date order on next render. Apple Stocks supports reorder because their list is user-ordered; ours is calendar-ordered. Revisit if/when we add an "All tickers" mode with user-defined sort. — tick 42, 2026-05-22
- [x] **P5-5** Empty state — already shipped tick 28 (rendered when `items.length === 0`); CTA wires to add sheet next. — tick 42, 2026-05-22
- [x] **P5-6** Add ticker sheet — `<AddTickerSheet>` (gorhom bottom sheet, 75% snap) with title + `<BottomSheetTextInput>` search row + filtered results list. Searches by symbol prefix or name substring against `TICKER_CATALOG` (20 mock US large-caps), excludes already-watched symbols. Tap → `haptics.success()` + optimistic prepend to items + close sheet. Sheet is opened by a `Plus` icon in `headerRight` of the watchlist Stack screen AND by the empty-state CTA. — tick 42, 2026-05-22

### Phase 6 — Events feed

- [x] **P6-1** Filterable list — two-axis filter (scope: All/Watchlist; outcome: All/Beats/Misses/In line) via new `<FilterChip>` primitive. `useMemo` recomputes `groupByDate(filterEvents(...))` on filter change. — tick 43, 2026-05-22
- [x] **P6-2** Date section headers — TODAY / YESTERDAY / MAY 19 eyebrows above each group (`text.micro` + tertiary + letter-spacing). Sorted by mock dateLabel; later upgrade to actual date math. — tick 43, 2026-05-22
- [x] **P6-3** Outcome filter chips — Beats / Misses / In line (+ "All outcomes"). The chips are *visual* filters that classify by `surprisePct` sign; UI carries no directional language ("Beats" describes the outcome class, not a recommendation). — tick 43, 2026-05-22
- [x] **P6-4** Search by ticker — TextInput at top of events feed (bg.surface + border, lucide Search icon, X to clear, autoCapitalize=characters). Search filter joins scope + outcome via the same `useMemo`. Filter is "ticker starts with query" — matches both `A` → AAPL, AMZN and `AA` → AAPL alone. — tick 44, 2026-05-22
- [x] **P6-5** Empty state — when filters yield zero matches: `<EmptyState>` "No events match" + "Try a broader filter — switch back to All outcomes, or expand the scope from Watchlist to All." — tick 43, 2026-05-22

### Phase 7 — Settings

- [x] **P7-1** Account section — tick 57, 2026-05-22. Sign-out row now opens a confirmation sheet (destructive friction); destructive Button variant added. Email row stays read-only until Phase 10 auth flow lands.
- [x] **P7-2** Notifications — tick 56, 2026-05-22. Three Switch toggles (briefings / 8-K / transcripts) + quiet-hours preset sheet (5 options). `<SettingsRow>` extended with a `trailing` prop. Time-picker dep deferred (preset-only for MVP).
- [x] **P7-3** About — tick 58, 2026-05-22. Privacy + Terms push-screens shipped (`/settings/privacy`, `/settings/terms`) with DRAFT pills and `<LegalSection>` primitive hoisted from the disclaimer screen. Attribution/open-source row deferred to Phase 11.
  - [ ] **P7-3a** (deferred to Phase 11) — Attribution / Open source row in ABOUT, listing third-party deps + licenses. Best generated from package.json automatically.
- [x] **P7-4** Show full disclaimer screen — tick 55, 2026-05-22. New route `/settings/disclaimer` with the canonical disclaimer text from `compliance.md` broken into 7 sections. Settings ABOUT row wired. Inline long-disclaimer swapped to short variant (footer rule preserved).
- [x] **P7-5** Subscription placeholder — tick 59, 2026-05-22. PLAN group with `Plan` value=`Free` row + coming-soon sheet. RevenueCat wires in Phase 12.

### Phase 8 — Learn (OBSOLETE)

Phase R replaced the speculative 5th-tab "Learn" idea with Discover (Today / Watchlist / Discover / Settings). There's no Learn tab to populate. If in-app educational content (explainers, model cards) is later desired it should be a fresh phase tied to a real product decision.

- [~] **P8-1** Placeholder screen — obsolete tick 59, 2026-05-22.

### Phase 9 — Onboarding

Per learnings § onboarding. Mandatory legal ack is non-negotiable.

- [x] **P9-1** Welcome carousel — tick 60, 2026-05-22. New `(onboarding)` route group + headerless Stack; 3-slide horizontal pager with PageDots primitive + Skip + Next/Get-started button. Finish replaces to `/today`; P9-2 will push to `how-sift-works` instead.
- [x] **P9-2** "How Sift works" — tick 61, 2026-05-22. 4-bullet single-page explainer at `/how-sift-works` (EDGAR / Briefings / Predictions / What Sift isn't). Welcome screen's advance now pushes to it.
- [x] **P9-3** Mandatory legal ack — tick 62, 2026-05-22. `/ack` screen with Apple Health Studies pattern: scroll-to-enable + 2 checkboxes + gated Continue. New `<Checkbox>` primitive. P10-3 will record `disclaimer_ack_at` server-side at the confirm step.
- [x] **P9-4** Notification permissions primer + system prompt — tick 63, 2026-05-22. `/notifications` primer screen explaining 3 push kinds + throttling + quiet hours; Allow button fires `Notifications.requestPermissionsAsync()`. Installed `expo-notifications@~0.32.17` (justified — core product mechanism). Plugin registered in `app.json`; native wiring waits for `expo prebuild` in Phase 10.
- [x] **P9-5** First-ticker setup — tick 64, 2026-05-22. `/first-tickers` multi-select of 5 large-caps; adaptive CTA ("Skip for now" → "Add N tickers"). Notifications screen now pushes here. **Phase 9 complete.**

### Phase 10 — Auth flow

- [x] **P10-1** Sign-in / sign-up screens — tick 65, 2026-05-22. New `(auth)` route group; `/sign-in` + `/sign-up` with Supabase `signInWithPassword` + `signUp` wired; `<TextField>` primitive; email-confirm success screen. Google OAuth stubbed — full wiring in P10-2.
- [x] **P10-2** PKCE deep-link handler — tick 66, 2026-05-22. `flowType: 'pkce'` on supabase client; real Google OAuth via `signInWithOAuth` + `WebBrowser.openAuthSessionAsync` + `exchangeCodeForSession`. Fallback `/auth-callback` screen for cold-start deep-link delivery.
- [x] **P10-3** Session restore — tick 67, 2026-05-22. `useAuthRouting()` hook reads session + local ack, routes to `/sign-in` / `/welcome` / `/today`. Splash stays up until decision lands. Real sign-out wired (clears Supabase session + local ack); ack-screen writes the local ack on confirm.
- [x] **P10-4** Encrypted session storage — tick 68, 2026-05-22. `src/lib/storage.js` AES-GCM adapter (key in `expo-secure-store`, ciphertext in AsyncStorage); wired into supabase client. New deps: `@noble/ciphers` + `expo-crypto`. **Phase 10 complete.**

### Phase 11 — Polish passes

Run AFTER each preceding phase completes, OR interleave every 2–3 build items.

- [x] **P11-1** Motion audit — tick 73, 2026-05-22. Card + Button press-release switched to `withSpring` (damping 22 / stiffness 180 / mass 1); press-in keeps timing snap; reduced-motion still respected. All other motion surfaces verified-as-correct.
- [x] **P11-2** Haptic audit — tick 70, 2026-05-22. Audited 50+ call sites; fixed 3 feedback-type mismatches (briefing/transcript expand → select, settings row → tap). Centralized reduce-motion gating in `src/lib/haptics.js` (skip tap+select, keep success/warning/error).
- [x] **P11-3** Accessibility audit — tick 71, 2026-05-22. Reduced-motion gating added to Card + Button press-scale + briefing/transcript chevron rotations. `<TextField>` gained `accessibilityLabel` + `accessibilityHint`. VoiceOver pronunciation already strong via `<MonoNumber>.speakable()`. Real-device VoiceOver/AX3 verification queued for Phase 12.
- [x] **P11-4** Empty/error state audit — tick 72, 2026-05-22. Home gained `<InlineError>` consumer; coverage table verified for all 8 loadable surfaces. Static screens noted as n/a; primitive ready for real-data hookups.
- [ ] **P11-5** Light mode (deferred decision — skip unless user opens it)
- [x] **P11-6** Live Activities stub spec — tick 76, 2026-05-22. `docs/architecture/live-activities.md` covers v1 scope (3 states × 3 surfaces), implementation path (expo-live-activity + prebuild + Swift extension), why not now, trigger conditions for revisiting, and compliance constraints. Indexed in `docs/README.md`.
- [x] **P11-7** Timeline glyphs — tick 75, 2026-05-22. Clock on upcoming time-anchor, FileText on BriefingCard header, MessageCircle on TranscriptCard header (lucide outlines, not emoji — calm aesthetic).
- [x] **P11-8** No-selected-tab artifact — tick 77, 2026-05-22. Duplicated `/events/[event_id]` under each consuming tab (`today/`, `watchlist/`, `discover/`); callers updated to push tab-scoped URLs. Canonical `/events/[event_id]` preserved for deep-link entry.
- [x] **P11-9** Onboarding CTA consistency — tick 74, 2026-05-22. Reversed direction: made first-tickers match welcome/how-sift-works (dual Skip+Continue) instead of the other way around (first-tickers' adaptive pattern was wrong for state-less screens). Hoisted shared topBar to `<OnboardingTopBar>` primitive (rule of three).

---

## Definition of "done" for the whole loop

- Every Phase 0–10 item checked.
- At least one full polish pass completed.
- App boots clean, every screen renders against mock data, web build looks mobile-shaped.
- `changelog.md` has one entry per tick.
- `learnings.md` has been added to at least 5 times over the run.

When done, stop the loop with a final summary entry and STATUS = "complete — awaiting product/backend integration".

---

## Cross-references

- Product spec: [`SETUP.md`](../../SETUP.md)
- Color/spacing/type tokens: [`palette.md`](palette.md)
- Frontend architecture target: [`../architecture/frontend.md`](../architecture/frontend.md)
- Compliance rules: [`../architecture/compliance.md`](../architecture/compliance.md)
- Real-time / push budget: [`../architecture/realtime-and-push.md`](../architecture/realtime-and-push.md)
- Comment style + general agreements: [`/CLAUDE.md`](../../CLAUDE.md)
