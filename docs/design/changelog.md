# Sift — UI/UX Iteration Changelog

One entry per loop tick. Format below. Newest at top.

```
## YYYY-MM-DD · tick N · <one-line title>

- **Did:** what shipped this tick (1-3 bullets, terse)
- **Files:** path/to/files.js (changed/added)
- **Verified:** how (bundler boots / expo-doctor / visual eyeball)
- **Learnings:** added to learnings.md? what
- **Next:** what the next tick should pick up (often the next backlog item; sometimes a sub-item discovered mid-flight)
```

---

## 2026-05-22 · tick 44 · Ticker search on Events feed (P6-4) — Phase 6 complete

- **Did:** added a search TextInput at the top of the Events screen — `bg.surface` rounded chip with Search icon left and an X clear button when text present. `autoCapitalize: 'characters'` keeps the keyboard in caps for tickers. Search filter wired into `filterEvents()` as a fourth predicate (`e.ticker.startsWith(q)`), running through the same `useMemo`. Cross-product filtering works: search "A" + scope=Watchlist + outcome=Beats narrows to watchlisted A-tickers that beat.
- **Files:** `src/features/events/mock.js`, `src/features/events/events-screen.js`.
- **Verified:** Metro boots clean (port 8132, background task exit 0).
- **Phase 6 complete.** Filterable list, date headers, outcome chips, ticker search, empty state.
- **Learnings:** none new.
- **Next:** P7-4 — long disclaimer screen/sheet behind the Settings "Disclaimer" row.

## 2026-05-22 · tick 43 · Events feed — filters + date groups + empty state (P6-1/2/3/5)

- **Did:** real Events tab. 8 mock events spanning three date labels (TODAY / YESTERDAY / MAY 19) with mixed surprise signs and watchlist membership. Two-axis filter at top:
  - Scope: All / Watchlist (via `e.onWatchlist`)
  - Outcome: All / Beats / Misses / In line (via `classify(surprisePct)`)
  Filter UI is a wrap-row of `<FilterChip>` (new primitive: pressable chip in accent.muted when selected, bg.surface otherwise, `haptics.select()` on tap). A vertical 1px divider separates the two filter groups in the wrap row.
  Body: `useMemo` runs `groupByDate(filterEvents(...))` on filter change; each group renders an eyebrow + `<EventCard>` list (same component as Today). Empty state when filters return 0 matches with instructions to broaden filters.
- **Files:** `src/features/events/mock.js`, `src/components/filter-chip.js` (new); `src/features/events/events-screen.js` (rewrite — was just a placeholder).
- **Verified:** Metro boots clean (port 8131, 20s).
- **Learnings:** none new — `useMemo` for derived list state is the right hook to keep filter recomputes cheap.
- **Next:** P6-4 — ticker text search on the events feed.

## 2026-05-22 · tick 42 · Add-ticker sheet + P5-4 deferred (P5-5/6) — Phase 5 effectively complete

- **Did:**
  - **P5-4 deferred.** Reorder doesn't map cleanly onto a derived calendar-sorted view — manual drag order would be overridden on re-render. Apple Stocks supports reorder because their list is user-ordered; ours is date-ordered. Revisit when we add a hypothetical "All tickers" custom-sort mode.
  - **P5-5 marked done** — empty state shipped in tick 28; tick 42 wires its CTA.
  - **P5-6 shipped.** New `ticker-catalog.js` (20 large-caps) + `searchCatalog(query, excludeSymbols)`. `<AddTickerSheet>` uses gorhom BottomSheet (75% snap) with `<BottomSheetTextInput>` for in-sheet keyboard handling, prefix/substring search, exclude-already-watched, optimistic prepend on tap, `haptics.success()` + close. Opened by both: a `<Plus>` icon in `headerRight` of the watchlist Stack (set via `<Stack.Screen options={...}>` inside the screen), and the empty-state CTA.
- **Files:** `src/features/watchlist/ticker-catalog.js`, `src/features/watchlist/add-ticker-sheet.js` (new); `src/features/watchlist/watchlist-screen.js` (rewrite — added sheet + headerRight + add fn).
- **Verified:** Metro boots clean (port 8130, 20s). Gesture/keyboard behavior should be tested on device.
- **Phase 5 done.** Sectioned list, row layout, swipe-to-remove, empty state, add-sheet. P5-4 (reorder) intentionally deferred.
- **Learnings:** none new (`BottomSheetTextInput` is the right escape from gorhom's gesture-input clash, matches `learnings.md` shortlist).
- **Next:** Phase 6 — P6-1 Events feed filterable list.

## 2026-05-22 · tick 41 · Swipe-to-remove on watchlist (P5-3)

- **Did:** wrapped each `<WatchlistRow>` in a `<SwipeableRow>` shim that wires `<ReanimatedSwipeable>` (the modern, non-deprecated API at `react-native-gesture-handler/ReanimatedSwipeable`). Right-side action panel: 96pt-wide `signal.negative` fill with `Trash2` icon + "Remove" caption, fully accessible (`accessibilityRole=button`, `accessibilityLabel="Remove from watchlist"`). Tap fires `haptics.warning()`, filters the item out of state, then `swipeable.close()`s. `overshootRight: false` so the user can't rubber-band past the action. Card gets `overflow: hidden` so the panel is clipped to the row container, otherwise it bleeds past the rounded corners.
- **Files:** `src/features/watchlist/watchlist-screen.js`.
- **Verified:** Metro boots clean (port 8129, 20s). Visual / gesture verification needed on device — Expo Go web preview can't exercise the swipe.
- **Learnings:** none new (confirmed `ReanimatedSwipeable` import path matches what's in `learnings.md § RN library shortlist`).
- **Next:** P5-4 — long-press reorder.

## 2026-05-22 · tick 40 · UI review pass + event-screen lint

- **Reviewed:** event detail (8 sections deep — hero, metrics, compare-bar, guidance, timeline, segments, source, disclaimer); watchlist (3 mock buckets); plus a sanity pass on Today / ticker detail / settings.
- **Logged deferred:** B14 (METRICS tiles + ACTUAL vs ESTIMATE compare bars show overlapping data — consolidate later, both currently OK), B16 (watchlist sparkline trend tint is mock-decorative; mute until real 30d-change wired).
- **Fixed (lint):** event-screen had dead imports (`ArrowUp` / `ArrowDown` / `Minus`) and an unused `Icon` field in the `GUIDANCE` map — left over from an earlier design with arrow icons inside the Pill. Removed them. Also collapsed the `(() => {…})()` IIFE around the guidance Card to a flat JSX expression — same output, fewer surprises.
- **Files:** `src/features/event/event-screen.js`.
- **Verified:** Metro boots clean (port 8128, 20s).
- **Learnings:** none new.
- **Next:** P5-3 — swipe-to-remove via `ReanimatedSwipeable` (current learning recommends the new gesture-handler API, not the deprecated `Swipeable`).

## 2026-05-22 · tick 39 · Watchlist list + row (P5-1 + P5-2)

- **Did:** Watchlist tab no longer always-empty. New `MOCK_WATCHLIST` with 6 tickers spanning the three week buckets; `groupByWeek()` partitions by `daysAway` (<7 / 7-13 / ≥14) and filters empty groups. `WatchlistScreen` falls back to the existing `<EmptyState>` when `items.length === 0` (toggle in code) so the empty-state path is preserved. New `<WatchlistRow>` is a three-column Pressable: left = symbol (headline-mono) + name (footnote, 1-line), middle = 64×20 `<Sparkline>` tinted by `trend` (`up→positive`, `down→negative`, `flat→secondary`), right = date + days + optional accent briefing-ready dot. Hairline divider between rows inside a single `<Card padding={0}>` per group. Tap → `haptics.tap()` → `/watchlist/<symbol>`.
- **Files:** `src/features/watchlist/mock.js`, `src/features/watchlist/watchlist-row.js` (new); `src/features/watchlist/watchlist-screen.js` (rewrite).
- **Verified:** Metro boots clean (port 8127, 20s).
- **Learnings:** none new — reused the hairline-rows-in-padding-0-Card pattern that's now everywhere.
- **Cadence:** 5 forward-build ticks (P4-1, P4-2, P4-3, P4-4, P4-5/6, P5-1/2) since last review. Next tick is a review pass.

## 2026-05-22 · tick 38 · Source link + share (P4-5 + P4-6) — Phase 4 complete

- **Did:** installed `expo-web-browser`; reused `<SettingsRow>` for two action rows inside a single Card under SOURCE: "View original Exhibit 99.1" (ExternalLink icon) opens the EDGAR URL via `WebBrowser.openBrowserAsync(url, { presentationStyle: PAGE_SHEET })` — Safari sheet on iOS, Custom Tab on Android, no app-exit. "Share" (Share2 icon) calls `Share.share({ message })` with a factual body: `{ticker} {period} earnings — reported beat\nEPS $… vs $… estimate (+X%)\nRevenue …\nGuidance raised.\n\nVia Sift — educational research, not investment advice.` Standalone-compliance per learnings — every shared screenshot/snippet must contain the disclaimer.
- **Files:** `src/features/event/event-screen.js`; `package.json` (+expo-web-browser); `app.json` (auto-added "expo-web-browser" plugin).
- **Verified:** Metro boots clean (port 8126, 22s).
- **Phase 4 done.** Hero, metrics grid (EPS/Revenue tiles), compare-bar viz, guidance, segments, filing timeline, source link, share — all six items shipped across 5 ticks.
- **Learnings:** none new (re-using `<SettingsRow>` for action rows is now the established pattern for "discrete list of one-tap actions in a Card").
- **Next:** Phase 5 — P5-1 Watchlist list view sectioned by reporting week. Cadence calls for a review tick the one after that.

## 2026-05-22 · tick 37 · Filing timeline strip on event detail (P4-4)

- **Did:** new FILING TIMELINE section under the GUIDANCE card. Vertical three-step stepper inside a Card: (1) "8-K filed on EDGAR" at the filing timestamp, (2) "Detected by Sift" `+8s after filing`, (3) "Pushed to your device" `+14s after filing`. Accent-blue dots on steps 1-2; `signal.positive` dot on the final to communicate "within target". Hairline connector lines between dots (`border.default`, 1px). A `<Pill variant="positive" size="sm">within 15s target</Pill>` footer cites the realtime-and-push SLA.
- **Files:** `src/features/event/event-screen.js`.
- **Verified:** Metro boots clean (port 8125, 20s).
- **Learnings:** none new — inline IIFE pattern (`{(() => {...})()}`) avoided a one-off component for the stepper since it's specific to this screen.
- **Next:** P4-5 — source link to EDGAR Exhibit 99.1 (in-app browser).

## 2026-05-22 · tick 36 · Compare-bar viz on event detail (P4-3)

- **Did:** new `<CompareBar label actual estimate formatter surprisePct>` — twin horizontal bars on the same scale. Top row: "Actual" legend + filled bar in `signal.positive/negative/neutral` (matched to the surprise sign) + value right-aligned. Bottom row: "Estimate" legend + outlined-fill bar (`bg.elevated` + 1px `border.default`) + value. Both rows share the same denominator `max(actual, estimate) × 1.05` for visual proportionality. No Skia — plain View + percent widths. Two instances (EPS + Revenue) sit inside one Card under the "ACTUAL vs ESTIMATE" section, between METRICS and GUIDANCE.
- **Files:** `src/features/event/compare-bar.js` (new); `src/features/event/event-screen.js`.
- **Verified:** Metro boots clean (port 8124, 20s).
- **Learnings:** none new (SVG / Skia not needed for a percent-width bar — saves dependency surface).
- **Next:** P4-4 — filing timeline strip showing EDGAR-to-push latency.

## 2026-05-22 · tick 35 · Event detail metrics + guidance + segments (P4-2)

- **Did:** event detail screen extended past the hero with three sections.
  - **METRICS:** new `<MetricTile label actual estimate surprisePct formatter>` component. Two tiles side-by-side via `gap: space[3]` and `flex: 1` — EPS (formatted `$1.98`) and Revenue (formatted `$124.3B`). Each tile: micro eyebrow label, mono headline actual, footnote `vs $est`, delta arrow+% in `signal.positive/negative/neutral`. Reusable for segments later.
  - **GUIDANCE:** Card with a coloured `<Pill>` ("Guidance raised/maintained/lowered") on top + body text with the specific detail.
  - **SEGMENTS:** dense list (Card padding=0) with hairline dividers — segment name + `vs $est` (left, 110pt), actual ($ billions) mono headline (mid), arrow + delta % (right) coloured by `signal.*`.
- **Files:** `src/features/event/metric-tile.js` (new); `src/features/event/event-screen.js`.
- **Verified:** Metro boots clean (port 8123, 20s).
- **Learnings:** none new (formatter prop is a tidy way to make a metric tile composable across $ / $B / unitless).
- **Next:** P4-3 — actual-vs-estimate horizontal bar viz. Skia-based.

## 2026-05-22 · tick 34 · Event detail hero (P4-1)

- **Did:** real event detail screen at `app/(app)/events/[event_id].js` (was a stub). Hero: coloured `<Pill>` carries the qualifier ("Reported beat" / "Reported miss" / "In line") with directional arrow and the `signal.positive/negative/neutral` palette. The big surprise % beneath uses `displayLg` mono in `text.primary` (NOT green/red — the focal number stays calm per the plan; chip carries the directional read). Subhead caption "EPS surprise vs estimate" + footnote with filing timestamp. New `getEventMock(id)` returns a sandbox AAPL Q4-25 event (regardless of id — handles both ticker-as-id mock routes and real event ids). Stack header shows e.g. "AAPL Q4 25".
- **Files:** `src/features/event/mock.js`, `src/features/event/event-screen.js` (new); `app/(app)/events/[event_id].js` (re-export — replaces the EmptyState stub).
- **Verified:** Metro boots clean (port 8122, 20s).
- **Learnings:** none new — codified the "directional colour on the chip, not on the focal number" pattern in the implementation.
- **Next:** P4-2 — parsed metrics grid (revenue / EPS / guidance / segments).

## 2026-05-22 · tick 33 · Methodology info sheet (P3-7) — Phase 3 complete

- **Did:** added `<Info>` icon button next to the beat-probability number on the UP NEXT card (hitSlop 10, `accessibilityLabel="How this prediction works"`). Tap fires `haptics.tap()` and expands an `<AppSheet>` at the 55% detent. Sheet content (three paragraphs): the inputs Sift's model uses (12 quarters + 30-day revisions + guidance language + sector momentum); what the percent IS — calibrated statistical probability, not personalised, not a forecast; and a closing footnote pointing to the Settings disclaimer. Inline qualifier under the metric row extended from "Model confidence based on prior 12 quarters" → "...· not a recommendation" for in-context compliance reinforcement.
- **Files:** `src/features/ticker/ticker-screen.js`.
- **Verified:** Metro boots clean (port 8121, background task, exit 0).
- **Phase 3 complete.** All seven items shipped: hero, Up Next, past briefings, past events, transcripts, sticky CTA, methodology sheet.
- **Learnings:** none new (gorhom + Reanimated 4 confirmed working again at sheet present time; no compat issues).
- **Next:** P4-1 — Event detail hero (the big surprise % with neutral styling per learnings § compliance).

## 2026-05-22 · tick 32 · UI review + frosted CTA bar

- **Reviewed:** ticker detail (substantially built — hero, UP NEXT, 3 briefings, 5 past events, 3 transcripts, sticky CTA, disclaimer). Home (already polished tick 26-27). Settings (polished tick 24-25). Watchlist/Events empty states (polished tick 28).
- **Logged for later:** B10 (hero metaRow sector pill + sparkline disconnect — defer, subjective), B11 (▲ on UP NEXT prediction might read directional — defer, qualifier line addresses), B13 (Watchlist "Add ticker" CTA is a noop — defer until P5-6 lands or stub a "Coming soon" sheet).
- **Fixed (polish):** ticker detail CTA bar now uses `<BlurView intensity={70} tint="dark">` on iOS for a frosted Apple-style material; the bar's bg dropped to `rgba(11,15,23,0.6)` so content scrolling underneath is faintly visible through the blur. Android keeps solid `bg.base` (BlurView falls back gracefully). Hairline top border stays. Compositional shift: ScrollView content can now visually "vanish" into the frosted area instead of cutting off at a hard line.
- **Files:** `src/features/ticker/ticker-screen.js`.
- **Verified:** Metro boots clean (port 8120, 20s). Visual verification on iOS device recommended — Expo Go's BlurView fidelity is usually good but worth confirming the material reads "dark frosted" not "milky".
- **Learnings:** none new.
- **Next:** P3-7 — disclaimer inline + info icon for model methodology.

## 2026-05-22 · tick 31 · Sticky watchlist CTA on ticker detail (P3-6)

- **Did:** wrapped ticker screen body in a flex `View` so ScrollView and a bottom-floating CTA bar are siblings. `ctaBar` is `position: absolute` at bottom, full width, `bg.base` solid with a 1px `border.subtle` top hairline. Inside: a `fullWidth` `<Button>` that toggles between `primary` "Add to watchlist" (+ `BookmarkPlus`) and `secondary` "On watchlist" (+ `BookmarkCheck`). `haptics.select()` fires on toggle (mock useState; real Supabase wiring later). `useSafeAreaInsets()` adds bottom-inset padding so the button sits above the iPhone home indicator. ScrollView's `paddingBottom` is set to `ctaHeight + space[6]` so last card isn't obscured.
- **Files:** `src/features/ticker/ticker-screen.js`.
- **Verified:** Metro boots clean (port 8119, 20s).
- **Learnings:** none new.
- **Next:** UI review pass per cadence (4 forward-build ticks since last review), then P3-7.

## 2026-05-22 · tick 30 · Transcripts accordion (P3-5)

- **Did:** `<TranscriptCard period date tone novelTopics snippet>` co-located in ticker feature. Same collapsible pattern as `<BriefingCard>` — chevron rotates 180°, `LayoutAnimation` for height (skipped under reduced motion), light haptic on toggle. Header row has the tone `<Pill>` (`bullish ▲` positive / `neutral ━` neutral / `bearish ▼` negative) — directional analysis of past calls is realised observation, so signal colours are compliance-OK. Expanded view reveals a NOVEL TOPICS eyebrow + chip row (border + `bg.elevated`). Three mock transcripts in `getTickerMock()` covering all three tones.
- **Files:** `src/features/ticker/transcript-card.js`, `src/features/ticker/mock.js`, `src/features/ticker/ticker-screen.js`.
- **Verified:** Metro boots clean (port 8118, 20s).
- **Learnings:** none new (reused the BriefingCard collapsible pattern).
- **Next:** P3-6 — sticky bottom CTA to add/remove from watchlist.
- **Cadence:** 3 forward-build ticks (P3-3, P3-4, P3-5) — the next-but-one tick should be a UI review pass per protocol.

## 2026-05-22 · tick 29 · Past events list on ticker detail (P3-4)

- **Did:** Past events section on ticker detail is now real. New `<PastEventRow period date epsActual epsEst surprisePct onPress last>` co-located in `src/features/ticker/`. Each row: period (headline) + date (footnote tertiary) on the left; actual EPS (`MonoNumber` headline) + "vs $est" (footnote tertiary) middle; arrow + signed surprise % (`MonoNumber` headline) right-aligned in `signal.positive`/`signal.negative`/`signal.neutral` (realized outcomes — directional colour is compliance-OK); chevron + tap routes to `/events/<id>`. Hairline divider between rows, suppressed on last. Whole list lives inside one `<Card padding={0}>` for that dense Apple Stocks "Earnings" panel feel. Five mock past events added to `getTickerMock()`.
- **Files:** `src/features/ticker/past-event-row.js` (new); `src/features/ticker/mock.js`, `src/features/ticker/ticker-screen.js`.
- **Verified:** Metro boots clean (port 8117, 20s).
- **Learnings:** none new (reused the hairline-row pattern from `<SettingsRow>`).
- **Next:** P3-5 — transcript snippets accordion (last 3 calls, tone-shift indicator).

## 2026-05-22 · tick 28 · UI review pass + placeholder polish (B8, B9) — FOCUS cleared

- **Reviewed:** Watchlist (clean), Events (clean), Ticker detail body (B8), Event detail stub (B9). Walked each in my head against the polish criteria from `learnings.md`. Two findings, both lazy placeholders.
- **Fixed B8 (PAST EVENTS placeholder):** Card now has Activity icon + "Coming soon" headline + description ("Past earnings here — actual vs estimate, surprise %, and transcript snippets per quarter"). Reads as intentional empty state, not a TODO.
- **Fixed B9 (event detail stub):** uses `<EmptyState>` with Activity icon, "Event detail coming soon" title, and a description naming what'll be there (parsed metrics, guidance changes, segment breakdown, actual-vs-estimate viz, EDGAR-to-push timeline). Centred via `flexGrow + minHeight`. Consistent with Watchlist/Events tab empty states.
- **Files:** `src/features/ticker/ticker-screen.js`, `app/(app)/events/[event_id].js`.
- **Verified:** Metro boots clean (port 8116, 20s).
- **FOCUS cleared.** Polish satisfied across every existing screen (B1–B9 all resolved). Loop resumes backlog at P3-4 (past events list on ticker detail) next tick.
- **Learnings:** none new.

## 2026-05-22 · tick 27 · B4 fix — NewEventsPill sticky-on-scroll

- **Did:** restructured home-screen so the ScrollView's first child is always a `pillSlot` View (transparent, `pointerEvents="box-none"`). Set `stickyHeaderIndices={[0]}`. Inside the slot, `<NewEventsPill>` renders when `!loading && !isEmpty && pending.length > 0`. Pill now pins to the top of the scroll viewport as the user scrolls; tap promotes pending into LIVE NOW (haptic + Reanimated fade-out unchanged). Always-rendered slot avoids the index-shift problem `stickyHeaderIndices` has with conditional children.
- **Files:** `src/features/home/home-screen.js`.
- **Verified:** Metro boots clean (port 8115, 20s).
- **Learnings:** added "Sticky-when-conditional via always-rendered slot" pattern.
- **Status:** Bug log is now empty (B1–B7 all resolved). Next tick should be a UI review pass over the screens not yet polished (Watchlist, Events, Ticker detail body, Event detail stub) — if nothing surfaces there either, clear FOCUS and resume backlog at P3-4.

## 2026-05-22 · tick 26 · B5 fix + LIVE NOW eyebrow polish

- **Did (B5):** ticker hero symbol now uses `text.displayLgMono` (proper token with mono medium + tabular-nums) instead of `text.displayLg` + a hardcoded `'JetBrainsMono_500Medium'` string. Same visual; lint-clean.
- **Did (eyebrow polish):** the `LIVE NOW` section label on the home screen now has a 6×6 `signal.negative` dot before it and the text itself uses `signal.negative` — instant "this is happening right now" recognition. `UPCOMING` and `RECENT` keep the neutral `text.tertiary` eyebrow. Static dot, no pulse (per learnings § real-time UX — pulsing badges banned).
- **Files:** `src/features/ticker/ticker-screen.js`, `src/features/home/home-screen.js`.
- **Verified:** Metro boots clean (port 8114, 20s).
- **Learnings:** none new.
- **Next:** B4 — `<NewEventsPill>` sticky/floating so a user scrolled past LIVE NOW still sees an arriving event surface a pill at the viewport top.

## 2026-05-22 · tick 25 · B3 fix — Settings Stack/large-title

- **Did:** converted Settings to the same nested-Stack pattern as the other three tabs. `app/(app)/settings.js` → `app/(app)/settings/{_layout,index}.js`. Layout uses identical screenOptions (large-title, transparent, blur). Stripped the inline `Settings` h1 and `<SafeAreaView edges={['top']}>` from `settings-screen.js` since the Stack now owns the safe area. All four tabs now have visually consistent large-title nav.
- **Files:** `app/(app)/settings/_layout.js`, `app/(app)/settings/index.js` (new); `app/(app)/settings.js` (deleted); `src/features/settings/settings-screen.js` (refactor).
- **Wasted time:** repeated `ConfigError: expected package.json path … (app)/package.json` on three start attempts. **Real cause:** I `cd`'d into `app/(app)` to delete a file and the bash session held that as cwd; Expo CLI read cwd as projectRoot. Wiping caches did nothing because the bug was in my shell state. `cd /Users/leroyngzz/FYP` fixed it. Logged as a learning.
- **Verified:** Metro boots clean (port 8113, 25s) after restoring cwd.
- **Learnings:** added "Bash cwd persists between tool calls" — never `cd` for one-off file ops; use absolute paths.
- **Next:** B5 — replace ticker hero hard-coded `'JetBrainsMono_500Medium'` string with `font.mono` token.

## 2026-05-22 · tick 24 · Polish pass 1 — Settings screen, tab tint, bug log

- **FOCUS set:** "Polish all existing screens before adding more" (set by user). Loop will work the polish lane and the Bug log before resuming the build backlog at P3-4.
- **Reviewed:** Today, Watchlist, Events, Settings, Ticker detail, Event detail stub. Logged five new findings as B3–B7.
- **Fixed B6:** tab bar inactive tint `text.tertiary` → `text.secondary` (#5C657A → #9CA3B5). Inactive labels/icons now readable; active accent contrast preserved.
- **Fixed B7:** Settings screen rebuilt. New `<SettingsGroup title footer>` and `<SettingsRow icon label value onPress destructive>` primitives — iOS-style grouped rows on `bg.surface` cards with hairline dividers between rows. Three groups (ACCOUNT / NOTIFICATIONS / ABOUT) with realistic mock rows (Email, Sign out destructive, four notification toggles, version + legal links). Rows are tappable stubs that fire a `select()` haptic.
- **Queued:** B3 (Settings needs Stack/large-title for consistency), B4 (NewEventsPill sticky), B5 (ticker hero font token).
- **Files:** `src/components/settings-row.js`, `src/components/settings-group.js` (new); `src/features/settings/settings-screen.js` (rewrite); `app/(app)/_layout.js` (tint bump); plan + changelog.
- **Verified:** Metro boots clean (port 8108, 20s).
- **Learnings:** none new.
- **Next:** B3 — give Settings the same Stack + large-title treatment the other tabs have.

## 2026-05-11 · tick 23 · Real fix for B1 — react-navigation dark theme

- **Did:** my tick-22 B1 "fix" didn't actually fix anything in Expo Go. The `userInterfaceStyle: "dark"` in app.json is metadata for the native shell; Expo Go ignores it. The real cause: `@react-navigation/native`'s `DefaultTheme` has `colors.background: 'white'`, and that white paints the navigator container — visible above transparent headers and around screen edges whenever the OS reports light mode. Wrapped root `app/_layout.js` in `<ThemeProvider value={SiftNavTheme}>` (extends `DarkTheme` with our palette tokens). Now navigators paint `bg.base` regardless of OS theme.
- **Files:** `app/_layout.js`.
- **Verified:** Metro boots clean after `--clear` (port 8107, 25s). User should reload Expo Go (shake → Reload, or `r` in Metro) to see the change.
- **Learnings:** added the "Dark theme for react-navigation" entry — this is the canonical fix for dark expo-router apps. Also reframed the tick-22 entry to flag that app.json changes don't apply in Expo Go.
- **Next:** if B1 is now visually resolved, resume backlog at P3-4. If white still showing, narrow down — could be `BlurView` rendering issue on iOS Expo Go (Apple Maps blur material can flake on iPhone simulators); fallback would be `headerTransparent: false` with a solid `bg.base` headerStyle.

## 2026-05-11 · tick 22 · UI review + fix B1, B2

- **Did:** added a "UI review cadence" step to the loop protocol — every 3 forward-build ticks, the loop should pause and walk the screens looking for bad-looking state, logging findings in a new Bug log. Did the first review now from user-reported issues:
  - **B1 (white top bar) fixed.** `app.json`: `userInterfaceStyle` `"light"` → `"dark"`; `splash.backgroundColor` `"#ffffff"` → `"#0B0F17"`; `android.adaptiveIcon.backgroundColor` `"#ffffff"` → `"#0B0F17"`. iOS now paints safe-area top in dark; cold-launch splash matches the app.
  - **B2 (tab bar cut off) fixed.** `(app)/_layout.js` uses `useSafeAreaInsets()`; tab bar height = `52 (ios) | 56 (android) + insets.bottom`, `paddingBottom = insets.bottom || 6`. Home indicator + Android edge-to-edge nav both honored.
- **Files:** `app.json`, `app/(app)/_layout.js`, `docs/design/iteration-plan.md` (protocol + bug log), `docs/design/learnings.md` (two new entries).
- **Verified:** Metro boots clean after `--clear` (port 8106, 25s). Visual verification still pending — user should reload Expo Go to see the fixes.
- **Learnings:** added "dark-app launch chrome" and "custom tabBarStyle breaks safe-area auto-handling" to `learnings.md`.
- **Next:** P3-4 — past events list. Loop stopped by user.

## 2026-05-11 · tick 21 · Past briefings (P3-3)

- **Did:** `<BriefingCard title date content>` — collapsed shows 2-line preview, expanded shows full text. Tap rotates the chevron 180° (Reanimated shared value) and `LayoutAnimation.easeInEaseOut` animates the height change (skipped under reduced motion). Light haptic on toggle. Three mock past briefings added to `getTickerMock()` covering pre-earnings + post-call summaries. Markdown rendering left as plain text for now — separate library decision.
- **Files:** `src/components/briefing-card.js` (new); `src/features/ticker/mock.js`, `src/features/ticker/ticker-screen.js`.
- **Verified:** Metro boots clean (port 8105, 20s).
- **Learnings:** none new — LayoutAnimation is the cheap path; if we get into nested animations, switch to Reanimated layout transitions.
- **Next:** P3-4 — past events list with surprise %.

## 2026-05-11 · tick 20 · Ticker detail hero + Up Next card (P3-1, P3-2)

- **Did:** built `<Sparkline data width height color>` (react-native-svg `Polyline`, no axes, ~20 lines). `getTickerMock(ticker)` produces deterministic 30-point series + name + sector. `TickerScreen` renders hero (big mono symbol, name, sector `<Pill>`, sparkline aligned right) + "UP NEXT" `<Card>` with period/when/EPS estimate/beat probability — accent-blue ▲ for the probability (NOT green, per compliance), with model-confidence qualifier line. Stack header switches to inline (`headerLargeTitle: false`) on detail screens since they have their own hero.
- **Files:** `src/components/sparkline.js`, `src/features/ticker/mock.js`, `src/features/ticker/ticker-screen.js` (new); `app/(app)/watchlist/[ticker].js` (re-export).
- **Verified:** Metro boots clean (port 8104, 20s).
- **Learnings:** none new — sparkline uses SVG instead of Skia per learnings § charts (cheaper for a 30-point line; can switch to Skia if perf demands).
- **Next:** P3-3 — past briefings list. Loop pausing here so user can validate before continuing.

## 2026-05-11 · tick 19 · Card tap → detail navigation (P2-7) — Phase 2 complete

- **Did:** wired card `onPress` on Today: `EarningsCard` → `/watchlist/<ticker>`, `EventCard` → `/events/<ticker>` (using ticker as event_id placeholder). Stub detail screens for both routes; `Stack.Screen options={{ headerLargeTitle: false }}` so deep screens get inline titles, not large titles. Pre-built haptic comes from `<Card>` press-in.
- **Files:** `app/(app)/watchlist/[ticker].js`, `app/(app)/events/[event_id].js` (new); `src/features/home/home-screen.js` (router + onPress wiring).
- **Verified:** Metro boots clean after `--clear` (port 8103, 25s).
- **Phase 2 done.** Three-section home with loading, empty, pull-to-refresh, real-time X-new pill, and tap-to-detail nav.
- **Next:** P3-1 — Ticker detail hero (real content in the stub).

## 2026-05-11 · tick 18 · "X new" pill (P2-6)

- **Did:** `<NewEventsPill count onTap>` (centred, accent-tinted bg + translucent border, callout-size text). FadeInDown on enter, FadeOutUp on exit. Single light haptic fires when `pending.length` flips 0→>0 (effect lives in `home-screen.js`). `useHomeData()` simulates an AMD beat arriving 5s after first load — tap promotes it into LIVE NOW. No auto-insert above scroll; user controls reveal per `learnings.md § real-time UX`.
- **Files:** `src/components/new-events-pill.js` (new); `src/features/home/use-home-data.js`, `src/features/home/home-screen.js` (state + haptic + pill render).
- **Verified:** Metro boots clean (port 8102, 20s).
- **Learnings:** none new (codifies the documented "X new" pattern).
- **Next:** P2-7 — card tap → detail navigation (stub ticker + event detail screens).

## 2026-05-11 · tick 17 · Pull-to-refresh (P2-5)

- **Did:** `useHomeData()` exposes `refresh()` + separate `refreshing` boolean (initial `loading` triggers skeleton, `refreshing` triggers RefreshControl spinner). Home ScrollView wires `<RefreshControl tintColor={text.tertiary} />` for a calm system-feel.
- **Files:** `src/features/home/use-home-data.js`, `src/features/home/home-screen.js`.
- **Verified:** Metro boots clean (port 8101, 20s).
- **Learnings:** none new.
- **Next:** P2-6 — "X new events" pill pattern.

## 2026-05-11 · tick 16 · Loading skeleton + empty state (P2-3, P2-4)

- **Did:** `useHomeData()` hook (`src/features/home/use-home-data.js`) returns `{ live, upcoming, recent, loading, error }` — fakes 800ms load so the skeleton path is exercised; swap for Supabase when schema lands. `<HomeSkeleton>` renders 3 skeleton cards matching `EarningsCard` shape (uses `<Skeleton>` primitive). Home screen now renders one of three states: loading skeleton, empty `<EmptyState>`, or populated sections. Empty state centres vertically via `flexGrow + justifyContent: 'center'`.
- **Files:** `src/features/home/use-home-data.js`, `src/features/home/home-skeleton.js` (new); `src/features/home/home-screen.js` (state machine).
- **Verified:** Metro boots clean (port 8100, 20s).
- **Learnings:** none new.
- **Next:** P2-5 — pull-to-refresh.

## 2026-05-11 · tick 15 · Three-section home + EventCard (P2-1, P2-2)

- **Did:** redesigned Today screen IA into three sections (LIVE NOW / UPCOMING / RECENT). New `<EventCard>` for realized events: actual EPS + estimate + surprise % with `signal.positive` (▲ green) or `signal.negative` (▼ red) — these ARE realized outcomes so directional color is compliance-OK. Optional `LIVE` red-dot label for events filed <60min ago. Mock data extracted to `src/features/home/mock.js` per convention. Sections only render if their data is non-empty.
- **Files:** `src/components/event-card.js`, `src/features/home/mock.js` (new); `src/features/home/home-screen.js` (rewrite).
- **Verified:** Metro boots clean (port 8099, 20s).
- **Learnings:** none new (extracted mock to `mock.js` per `learnings.md § mock data conventions`).
- **Next:** P2-3 — loading skeleton state for the home screen.

## 2026-05-11 · tick 14 · Today nested Stack + delete orphan Header (P1-3 finish)

- **Did:** moved Today screen to `app/(app)/today/` folder with its own `Stack` layout + native iOS large title (same screen options as Watchlist/Events). Renamed Tabs.Screen entry from `index` → `today`. Stripped the inline `<Header>` brand component from `home-screen.js` — Stack now provides "Today" title; brand presence is via the app icon + tab bar. Deleted orphan `src/components/header.js`. Section eyebrow text changed from "TODAY" to "UPCOMING" since the screen IS the today section now.
- **Files:** `app/(app)/today/_layout.js`, `app/(app)/today/index.js` (new); `app/(app)/index.js`, `src/components/header.js` (deleted); `app/(app)/_layout.js`, `src/features/home/home-screen.js` (edits).
- **Verified:** Metro boots clean after `--clear` (port 8098). Grep confirmed no remaining Header references.
- **Learnings:** none new.
- **Next:** Phase 2 — P2-1 IA redesign (Live now / Upcoming / Recent sections).

## 2026-05-11 · tick 13 · AppSheet (gorhom) (P1-4)

- **Did:** installed `@gorhom/bottom-sheet@5`; wrote `<AppSheet>` forwardRef wrapper — default snap `60%`, pan-down-to-close, `radius.xl` top corners, 4px handle bar in `border.strong`, dark backdrop at 0.6 opacity. Consumers pass `snapPoints` to override (e.g., `['25%', '60%', '90%']`).
- **Files:** `src/components/app-sheet.js` (new); `package.json` (+@gorhom/bottom-sheet).
- **Verified:** Metro boots clean (port 8097). gorhom v5 + Reanimated 4 in this project's tree works without the compat warning.
- **Learnings:** none new (reaffirmed: gorhom + Reanimated 4 is fine in 2026-Q2).
- **Next:** restructure Today into nested Stack (cleanup of P1-3 + P1-5), then Phase 2.

## 2026-05-11 · tick 12 · Per-tab Stacks + large titles (P1-3 partial + P1-5 partial)

- **Did:** converted Watchlist and Events tabs to folder-based routes with their own `Stack` layouts. iOS: `headerLargeTitle: true`, `headerTransparent: true`, `headerBlurEffect: 'systemUltraThinMaterialDark'`, accent tint for back button. Android: solid `bg.base` header. Screens use `ScrollView contentInsetAdjustmentBehavior="automatic"` so content insets respect the large title. Today + Settings remain flat (single-screen tabs).
- **Files:** `app/(app)/watchlist/_layout.js`, `app/(app)/watchlist/index.js`, `app/(app)/events/_layout.js`, `app/(app)/events/index.js` (new); `app/(app)/{watchlist,events}.js` (deleted); `src/features/watchlist/watchlist-screen.js`, `src/features/events/events-screen.js` (refactor — dropped `SafeAreaView` top, added inset behavior).
- **Verified:** Metro boots clean after `--clear` (port 8096). Hit a stale-cache `ConfigError` on first attempt — added learning.
- **Learnings:** route-group cache footgun (see `learnings.md`).
- **Next:** P1-4 — install `@gorhom/bottom-sheet@5`, write `<AppSheet>` wrapper.

## 2026-05-11 · tick 11 · Bottom tabs + 3 placeholder screens (P1-1 + P1-2)

- **Did:** restructured to expo-router route group `(app)` for authenticated routes. Built `<Tabs>` with 4 tabs (Today / Watchlist / Events / Settings), `bg.surface` bar, accent active tint, lucide icons. Created placeholder screens for Watchlist (with empty-state CTA), Events (empty state), and Settings (long disclaimer). Home screen moved to `(app)/index.js`.
- **Files:** `app/(app)/_layout.js`, `app/(app)/{index,watchlist,events,settings}.js` (new); `src/features/{watchlist,events,settings}/*-screen.js` (new). Removed top-level `app/index.js`.
- **Verified:** Metro boots clean (port 8094, 20s).
- **Decisions:** 4 tabs (no Learn). Native `unstable-native-tabs` deferred — current JS tabs are sufficient for MVP; can upgrade in a polish pass.
- **Next:** P1-3 — large title in Stack screens. Will refactor each tab to live under its own Stack with `headerLargeTitle`.

## 2026-05-11 · tick 10 · BlurSurface (P0-6) — Phase 0 complete

- **Did:** installed `expo-blur`; wrote `<BlurSurface intensity tint>` that uses `BlurView` on iOS + Android ≥31, falls back to a translucent `bg.elevated` view elsewhere. Designed for tab bars and large-title nav backgrounds in Phase 1.
- **Files:** `src/components/blur-surface.js`.
- **Verified:** Metro boots clean (port 8093, 18s).
- **Phase 0 done:** all 13 foundation items shipped — web frame, type scale, 8 primitives, 2 utilities (haptics, useReducedMotion), 1 material (BlurSurface).
- **Next:** Phase 1. P1-1 (decision: 4 tabs — Today / Watchlist / Events / Settings) + P1-2 (build tab shell).

## 2026-05-11 · tick 9 · DisclaimerFooter variants (P0-3h)

- **Did:** added `variant="short"|"long"` and `align` props to `<DisclaimerFooter>`. Long-form uses the canonical text from `palette.md § compliance hooks` (Sift v1 disclaimer). Default still the short form.
- **Files:** `src/components/disclaimer-footer.js`.
- **Verified:** Metro boots clean (port 8092, 18s).
- **Learnings:** none new.
- **Next:** P0-6 — `<BlurSurface>` (installed `expo-blur`).

## 2026-05-11 · tick 8 · EmptyState + InlineError (P0-3f + P0-3g)

- **Did:** `<EmptyState title description icon cta>` centred, max-width on description (280px) for line-length hygiene; CTA delegates to `<Button>`. `<InlineError message code onRetry>` translucent red bg + 1px translucent red border, alert role for VoiceOver, monospace error code at footnote size, optional retry icon button. Skipped corporate illustrations per learnings.
- **Files:** `src/components/empty-state.js`, `src/components/inline-error.js` (new).
- **Verified:** Metro boots clean (port 8091, 18s).
- **Learnings:** none new.
- **Next:** P0-3h — audit `<DisclaimerFooter>` and add short/long-form prop per spec.

## 2026-05-11 · tick 7 · Skeleton + useReducedMotion (P0-3e + P0-5)

- **Did:** `<Skeleton width height radius circle>` using Reanimated opacity pulse 0.5↔1 over 800ms each leg (1.6s loop); `useReducedMotion()` hook in `src/lib/` subscribes to `AccessibilityInfo.reduceMotionChanged`. When reduced motion is on, Skeleton pins at 0.5 — visible block, no animation. Skeleton is `accessibilityElementsHidden` so VoiceOver skips it.
- **Files:** `src/components/skeleton.js`, `src/lib/use-reduced-motion.js` (new).
- **Verified:** Metro boots clean (port 8090, 18s).
- **Learnings:** none new — pattern follows `learnings.md § accessibility`.
- **Next:** P0-3f — `<EmptyState>` + P0-3g `<InlineError>` together (both small).

## 2026-05-11 · tick 6 · MonoNumber primitive (P0-3d)

- **Did:** `<MonoNumber value size>` consumes the mono variant matching the size token; auto-generates VoiceOver-friendly `accessibilityLabel` that replaces `▲ / ▼ / ━ / + / − / %` with words ("up", "down", "unchanged", "percent"). Refactored `earnings-card.js` to use it for EPS and beat-probability; also added ticker spell-out a11y label.
- **Files:** `src/components/mono-number.js` (new), `src/components/earnings-card.js` (refactor).
- **Verified:** Metro boots clean (port 8089, 18s).
- **Learnings:** none new (this codifies the a11y rules already in `learnings.md § accessibility`).
- **Next:** P0-3e — `<Skeleton>` + likely P0-5 `useReducedMotion()` together.

## 2026-05-11 · tick 5 · Pill primitive (P0-3c)

- **Did:** `<Pill>` with six variants (`accent`/`neutral`/`positive`/`negative`/`warning`/`info`) and two sizes (`sm`/`md`). Signal variants use translucent fills (`rgba(...,0.12)`) over fg color — calmer than solid bg. Migrated `header.js` "3 new" pill to consume.
- **Files:** `src/components/pill.js` (new), `src/components/header.js` (refactor — dropped inline pill style).
- **Verified:** Metro boots clean (port 8088, 18s).
- **Learnings:** none new.
- **Next:** P0-3d — `<MonoNumber>`.

## 2026-05-11 · tick 4 · Card primitive (P0-3b)

- **Did:** `<Card>` with `bg.surface` + 1px border + `radius.lg`, `padding` prop defaults to space[4]; optional `onPress` makes the card pressable with the same scale-to-0.98 + haptic pattern. Refactored `earnings-card.js` to consume `<Card>` (removed local card style + import of `View`/`radius`).
- **Files:** `src/components/card.js` (new), `src/components/earnings-card.js` (refactor).
- **Verified:** Metro boots clean (port 8087, 18s). `EarningsCard` now accepts `onPress` — wires up in P2-7 (tap → ticker detail).
- **Learnings:** none new — press-scale pattern is the same as Button; will extract to `usePressScale()` hook when a 3rd consumer lands.
- **Next:** P0-3c — `<Pill>` primitive. Replaces the inline pill style in `header.js`.

## 2026-05-11 · tick 3 · Button primitive + haptics wrapper (P0-3a + P0-4)

- **Did:** installed `expo-haptics`; wrote `src/lib/haptics.js` (5 named functions); built `<Button>` with `primary`/`secondary`/`ghost` variants, loading state via `ActivityIndicator`, optional icon, `fullWidth`, scale-to-0.98 on press via Reanimated shared value + `tap` haptic, proper a11y (`accessibilityRole`, `accessibilityState`).
- **Files:** `src/lib/haptics.js`, `src/components/button.js` (new); `package.json` (+expo-haptics).
- **Verified:** Metro boots clean (port 8086, 18s). Visual verification deferred — Button isn't rendered on any screen yet (will land when Watchlist add flow or onboarding lands).
- **Learnings:** added press-scale pattern to `learnings.md` — reusable for cards, list rows, chips.
- **Next:** P0-3b — `<Card>` primitive. Refactor `earnings-card.js` to consume it.

## 2026-05-11 · tick 2 · iOS-aligned typography scale (P0-2)

- **Did:** rewrote `text.*` tokens in `src/theme/index.js` to iOS-baseline scale (body=17pt) with 10 sans + 6 mono variants. Mono variants include `fontVariant: ['tabular-nums']` for column alignment. Migrated `earnings-card.js` (`bodyMonoMed`→`headlineMono`, `bodySm`→`subhead`) and `header.js` (replaced hard-coded `'Inter_500Medium'` string with `font.sansMed` token). Synced `palette.md § type scale` to match.
- **Files:** `src/theme/index.js`, `src/components/earnings-card.js`, `src/components/header.js`, `docs/design/palette.md`.
- **Verified:** grep confirmed no leftover references to removed token names; Metro boots clean (port 8085, 18s).
- **Learnings:** none new — typography table in `learnings.md` was already the target, this tick brought code into alignment.
- **Next:** P0-3a — `<Button>` primitive. Will need haptic wrapper sooner rather than later (P0-4); consider building both together if scope allows.

## 2026-05-11 · tick 1 · web max-width wrapper (P0-1)

- **Did:** added `<WebFrame>` component; `Platform.OS === 'web'` renders the app inside a 430pt centred container with `bg.inset` outside, iOS/Android pass-through.
- **Files:** `src/components/web-frame.js` (new), `app/_layout.js` (wrapped Stack).
- **Verified:** Metro boots clean (port 8084, 18s).
- **Learnings:** none added — pattern already documented in `learnings.md § web build`.
- **Next:** P0-2 — refine type scale to iOS-aligned tokens (`displayLg/displaySm/title/headline/body/callout/subhead/footnote/caption`), migrate `app/index.js` + components.
