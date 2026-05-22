# Sift — UI/UX Learnings

Accumulated heuristics, library quirks, and design patterns the loop discovers and adopts. Seeded from the May 2026 research pass (see [`references.md`](references.md) for sources); grows with each iteration.

**How to use this file:** read the top sections before starting any tick. Add to the bottom when you discover something genuinely new and reusable. Don't fluff — quality over quantity. If a learning becomes wrong, edit it; don't accumulate stale rules.

---

## Design principles (Sift-specific, non-negotiable)

1. **Educational, not advisory.** Every UI decision must reinforce the publisher's-exclusion framing ([compliance.md](../architecture/compliance.md)). When in doubt: more boring, more factual.
2. **Numbers are the product.** Mono font, tabular figures, generous spacing. If a number is unreadable, the rest of the design failed.
3. **Calm over excitement.** No confetti, no bright gradients, no pulsing badges, no auto-play sound. Apple Stocks vibe, not Robinhood.
4. **Chrome defers to content.** Translucent navs / tabs over solid; thin dividers; restrained accents.
5. **Real-time without disruption.** User initiates the reveal of new content; we surface it (pill, dot, count) but never auto-insert above their scroll position.
6. **Compliance is a design constraint, not an overlay.** Disclaimers belong inline; "buy/sell" CTAs don't exist. Probability colours are neutral, never green/red.
7. **Mobile only, mobile shape.** Web build is dev convenience; max-width on web, full-bleed native.

---

## Apple HIG — what we're actually channelling (2026)

Apple's current design language (as of iOS 26 — there is no "iOS 19"; the numbering jumped) is **Liquid Glass**: translucent materials, refraction over depth, semantic colours. We can't fully clone it on RN (Android lacks the refraction shaders, RN can't render animated SF Symbols), but we channel the *intent*:

- **Translucent navigation chrome** via `expo-blur` BlurView with intensity 60–80 over the tab bar and large-title nav. This is the visible Liquid Glass analogue.
- **Content on opaque surfaces, controls on glass.** HIG rule. Don't put body text directly on a blurred surface — it shimmers as you scroll.
- **Large titles + inline-after-scroll** is the canonical iOS pattern. `expo-router` Stack `headerLargeTitle: true, headerTransparent: true, headerBlurEffect: 'regular'`.
- **Semantic SF Symbols** — we approximate with `lucide-react-native`. Stroke 1.5px default, 2px on selected. Never raster icons.
- **Spring motion, gentle defaults.** Apple uses iOS spring physics universally; we map this to Reanimated `withSpring` with `damping: 22, stiffness: 180, mass: 1` as the workhorse spring. Reserve timing curves for cross-fades and tab transitions.
- **Haptics on every meaningful action.** Selection, success, error — Apple users feel an absence of haptics as cheapness. See § haptics below.

What we **don't** channel: animated SF Symbols (RN-impossible), full Liquid Glass refraction shaders (Android can't), Dynamic Island (Swift extension territory — flagged for post-MVP).

---

## Typography — final scale (iOS-baseline)

Inter for UI text, JetBrains Mono for numbers and tickers. iOS body size baseline is 17pt — we follow it. All numeric text gets `fontVariant: ['tabular-nums']` so columns align.

| Token | Size / Line | Weight | Use |
|---|---|---|---|
| `displayLg` | 34 / 41 | 700 | Hero number on event detail (e.g., big surprise %) |
| `displaySm` | 28 / 34 | 600 | Large title in nav headers |
| `title` | 22 / 28 | 600 | Section headers within screens |
| `headline` | 17 / 22 | 600 | List row primary text (the strong line) |
| `body` | 17 / 24 | 400 | Long-form (transcript snippets, briefings) |
| `callout` | 15 / 20 | 500 | Status chip / pill text |
| `subhead` | 14 / 20 | 400 | List row secondary text |
| `footnote` | 13 / 18 | 400 | Timestamps, captions under cards |
| `caption` | 12 / 16 | 400 | Disclaimer, legal |

**Mono variants** at body and headline sizes (`bodyMono`, `headlineMono`) for tickers, prices, percentages. Never use mono for prose.

**Honour Dynamic Type.** `allowFontScaling` defaults true; don't disable globally. Test at AX3 (iOS Larger Text setting moved to large) — numeric columns must not break.

---

## Information density on a 6.1" iPhone

Usable height after status + tab bar ≈ 720pt. Above-the-fold targets:

| Screen | Items | Row height |
|---|---|---|
| Today / Upcoming | 6–8 cards | 96–112pt |
| Watchlist | 7–9 rows | 64pt |
| Events feed | 8–10 rows | 72pt |

Rule: a list row that needs more than two lines of text means the design is wrong. Use chips, icons, secondary metadata in the right rail instead of stacking copy.

Spacing rhythm:
- 4pt baseline grid.
- Page horizontal padding: 16pt (never below 12).
- Vertical rhythm between cards: 12pt.
- Section gaps: 24pt.

---

## Real-time updates — the "X new" pattern

When a new event arrives while the user is on the home / events screen, the **wrong** pattern is to auto-insert it (causes scroll position to lose meaning). The right pattern:

```
┌────────────────────────────────┐
│ ◀  Today                       │  large title (blurred)
│                                │
│   1 new event · tap to view  ▲ │  ← floating pill at top of list
│ ┌──────────────────────────┐   │     accent-tinted, light haptic
│ │ AAPL  Q1 26  in 2h       │   │     dismisses on tap or scroll
│ │ EPS est $1.98  •  ▲ 65%  │   │
│ └──────────────────────────┘   │
```

- Pill: accent-tinted bg, headline text, mono for the count, dismisses on tap or on user scrolling past it.
- Light haptic (`Haptics.ImpactFeedbackStyle.Light`) once per arrival when user is foregrounded **and** the event is for a watchlisted ticker. Never haptic-spam.
- On tap: insert the row via Reanimated `entering` transition + brief 200ms accent border flash on the new card. No scroll-to-top by default — let the user choose.

If the user is on the ticker detail screen for the affected ticker when the event arrives, replace skeleton/old content in place with a brief border flash. No toast.

**Never:** sound effects, toasts that overlap nav, pulsing "LIVE" badges, auto-insert above scroll position.

---

## Loading / empty / error patterns

| State | Use |
|---|---|
| Skeleton | Known-shape content arriving < 2s. Always for list and detail screens. |
| Spinner | Unknown-duration / non-content actions (login submit, RefreshControl native indicator). |
| Optimistic | Watchlist add/remove. Animate in immediately, reconcile on response. |
| Progressive disclosure | Event detail screen — render parsed numbers first, defer chart and transcript a frame. |

**Empty state copy** (one sentence + one CTA):
- Watchlist empty: *"No tickers tracked yet. Add one to see upcoming earnings and 8-K filings."* + "Add ticker".
- No upcoming events: *"Nothing on the calendar this week. Check back Monday."*
- Search empty: *"No matches for `XYZQ`. Try a ticker symbol like AAPL."*

**Error state:** inline error chip at top of affected card (never full-screen unless network total loss). Always retry. Never blame the user. `[ERR-EDGAR-503]` mono code at bottom for support.

**Skip:** corporate empty-state illustrations (robots, plants, paper planes). Single monochrome lucide icon only if it adds meaning.

---

## Compliance UI patterns

Displaying a "65% beat probability" without crossing into recommendation:

```
EPS BEAT PROBABILITY
65%                            ← displayLg, mono, neutral colour (not green!)
Model confidence based on 12 prior quarters
                               ← subhead, dim
[───────────●────────]         ← horizontal bar, neutral fill
Low            Mid           High
```

- **Never green/red on the probability number itself.** That's P&L colour code and implies directionality. Use neutral (`accent.default` or `text.primary`).
- Always pair the percent with a qualifier (`"Model confidence"`, `"Historical base rate"`) in the same visual unit. Above the fold.
- Inputs visible: tap-to-reveal `"Based on: prior beats, guidance revisions, options skew"`.
- Frequency framing for the curious: `"In 20 similar setups, the company beat 13 times"`. Tap to reveal.
- Forbidden words anywhere user-facing: `"advice"`, `"recommend"`, `"should"`, `"will rise"`, `"buy now"`, `"sell now"`. Approved: `"signal"`, `"indicator"`, `"prediction"`, `"model output"`.

**Disclaimer placement:**
- **Onboarding gate:** scrollable consent, "Continue" disabled until scroll-to-bottom (Apple Health Studies pattern). Two checkboxes: educational + T&Cs.
- **Persistent:** thin `caption` footer on any screen showing a probability.
- **Inline:** info icon next to predictions opens methodology sheet.

Never: launch-screen disclaimer modals that auto-dismiss (user-hostile and legally weaker than explicit ack).

---

## RN library shortlist (May 2026)

| Need | Pick | Notes |
|---|---|---|
| Bottom sheets | `@gorhom/bottom-sheet@^5` | Watch [issue #2600](https://github.com/gorhom/react-native-bottom-sheet/issues/2600) for Reanimated 4 compat. Should work via the v3 compat layer. Verify on first use. |
| Tabs (iOS native blur) | `expo-router/unstable-native-tabs` with `blurEffect` | `unstable-` prefix is real; API may drift. Worth the fidelity for iOS. Plain JS tabs (`BlurSurface` bg + `position: absolute`) for Android fallback. |
| Haptics | `expo-haptics` | Wrap in `src/lib/haptics.js` so the audit is one file. |
| Blur / materials | `expo-blur` | SDK 55+ requires `BlurTarget` wrapper. Verify current SDK before assuming. Android falls back to translucent view below SDK 31. |
| Skeleton | `moti/skeleton` or hand-rolled with `react-native-reanimated` `useAnimatedStyle` | Both ~30 lines for a custom rect. Hand-roll if we don't otherwise need Moti. |
| Pull-to-refresh | Built-in `RefreshControl` on `FlatList` / `FlashList` | Native UIRefreshControl. No library needed. |
| Swipe actions | `ReanimatedSwipeable` from `react-native-gesture-handler` | Old `Swipeable` is deprecated — do NOT use. |
| Animated lists | Reanimated 4 layout animations with `FlashList` + `prepareForLayoutAnimationRender()` | Single inserts work; bulk diffs have known glitches. |
| Charts / sparklines | `@shopify/react-native-skia` direct for sparklines; `victory-native-xl` v40+ for full charts with axes | Skia direct = ~20 lines and fast for a 60-point sparkline. |
| Shared element transitions | Reanimated 4.2+ `sharedTransitionTag` (Fabric, feature-flag) | Known issues moving between tabs and stack. Don't bet UX on this for cross-tab. |
| Draggable lists | `react-native-draggable-flatlist` | Single-purpose dep; justify per the no-deps-without-justification rule. |

**Currently installed:** `expo-router`, `expo-secure-store`, `expo-constants`, `expo-linking`, `expo-status-bar`, `expo-splash-screen`, `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill`, `react-native-safe-area-context`, `react-native-screens`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets`, `@expo-google-fonts/inter`, `@expo-google-fonts/jetbrains-mono`, `lucide-react-native`, `react-native-svg`.

---

## Haptics — when to fire what

| Surface | Function | When |
|---|---|---|
| Pressable list card | `tap()` (light impact) | on press-in |
| Toggle, segmented control | `select()` (selection feedback) | on change |
| Form submit success | `success()` (notification) | on success |
| Validation / network error | `error()` (notification) | on failure |
| Optimistic destructive action (swipe delete) | `warning()` (notification) | on action |

**Don't:** haptic spam (scrolling, repeated taps). Don't fire haptics during list refresh — the system already does. Always respect `useReducedMotion()` — when on, skip non-critical haptics.

---

## Accessibility — financial-app specifics

- VoiceOver labels for numbers: `+2.34%` → `"up 2.34 percent"`. `$143.21` → `"143 dollars 21 cents"`. `65%` (prediction) → `"65 percent estimated probability of beating estimates"`.
- VoiceOver labels for chips: `"BEAT"` → `"reported a beat"`. Avoid ALL CAPS in labels (VoiceOver spells them).
- Don't duplicate visible text in `accessibilityLabel`. RN concatenates → "Save Save" disasters.
- Contrast: body on `bg.base` ≥ 4.5:1 (WCAG AA). Inter 17pt at `text.primary` is ~14:1; subhead at `text.secondary` is ~6:1. Don't use `accent.default` as body text — passes large but not body on `bg.base`.
- Reduced motion: substitute fades for slides; disable shared element transitions; cut motion duration to 0 for non-essential animations.

---

## Mock data conventions

Each feature folder gets a `mock.js`. Example:

```js
// src/features/home/mock.js
export const MOCK_UPCOMING = [
  { ticker: 'AAPL', period: 'Q1 26', when: 'in 2h', epsEst: 1.98, beatProb: 0.65, briefingReady: true },
  // ...
];
```

Naming: `MOCK_<entity>` constants. Delete the whole file when real APIs land. Don't sprinkle mock data inline in components.

---

## Web build for a mobile-only app

`Platform.OS === 'web'` wraps the root in a 430pt centred frame with `bg.inset` outside. No phone bezel illustration unless the user asks. Don't try to make web a real desktop UI — dilutes effort and complicates a hypothetical future Mac Catalyst submission.

---

## Open uncertainties (verify when relevant)

- `@gorhom/bottom-sheet` v5 + Reanimated 4: GitHub issue #2600 status (verify when implementing P1-4).
- `expo-router/unstable-native-tabs` `blurEffect` API stability for SDK 54 (verify when implementing P1-2).
- Live Activities for earnings countdowns — `software-mansion-labs/expo-live-activity` looks like the path, but requires a Swift extension. Defer until post-MVP.

---

## Iteration learnings log

- **tick 3 — Press-scale pattern.** Wrap `Pressable` in `Animated.View` with a `useSharedValue(1)` scale; `onPressIn` → `withTiming(0.98, 80ms)`, `onPressOut` → `withTiming(1, 140ms)`. Fire `haptics.tap()` in the same `onPressIn`. Reusable for any tappable surface (cards, list rows, chips). Implementation reference: `src/components/button.js`.
- **tick 12 — Route-group cache footgun.** Adding a new route group `(name)/` mid-session can leave Metro with a stale cache that throws `ConfigError: expected package.json path … (name)/package.json does not exist`. Always `npx expo start --clear` (or delete `.expo/`) when introducing or restructuring route groups. Not a code bug — purely cache.
- **tick 22 — Dark-app launch chrome (cosmetic only in Expo Go).** Set `userInterfaceStyle: "dark"`, `splash.backgroundColor`, and `android.adaptiveIcon.backgroundColor` to dark in `app.json` so a future native dev build cold-launches dark. **Caveat:** these are metadata read by the native shell — they do nothing inside Expo Go, which uses its own Info.plist. Don't confuse "I changed app.json" with "the bug is fixed" unless you've rebuilt the dev client.
- **tick 23 — Dark theme for react-navigation (the actual fix for white-navigator-bg).** expo-router uses `@react-navigation/native`'s default `ThemeProvider`, and `DefaultTheme.colors.background` is `'white'`. When the OS reports light mode (Expo Go on a phone in light mode, or web with a default user agent), every navigator container paints white — visible above transparent headers, between Stack screens, in the safe-area top zone. **Fix:** at the root layout, wrap children in `<ThemeProvider value={SiftNavTheme}>` where `SiftNavTheme` spreads `DarkTheme` and overrides `colors.{background, card, text, border, primary, notification}` with our palette. Do this **once at the project root** — don't repeat per layout. Without it, every dark-themed expo-router app shows white slivers.
- **tick 25 — Bash cwd persists between tool calls.** If a Bash command runs `cd /some/subdir`, every subsequent Bash call in the same session starts from that subdir. The Expo CLI reads its `projectRoot` from `process.cwd()`; if cwd is `app/(app)/`, the CLI looks for `app/(app)/package.json` and fails with a misleading `ConfigError: expected package.json path … does not exist`. **Rule:** never `cd` for one-off file ops — use absolute paths in `rm`, `mkdir`, `cp`. If you must `cd`, follow up with `cd /Users/leroyngzz/FYP` before the next project-rooted command. This is also called out in the Bash tool description; the failure mode is easy to mistake for a code/cache bug.
- **tick 27 — Sticky-when-conditional via always-rendered slot.** RN's `ScrollView stickyHeaderIndices` pins children at exact indices; if a sticky element renders conditionally, the index shifts and the wrong child gets pinned (or sticky behavior breaks). **Pattern:** always render an outer slot `View` at the fixed index; put the conditional child INSIDE it. Style the slot `backgroundColor: 'transparent'` + `pointerEvents="box-none"` so the slot is invisible and tap-passthrough when its child is null. The slot's height collapses to 0 when empty. Used for `<NewEventsPill>` in `home-screen.js`.
- **tick 22 — Custom tabBarStyle breaks safe-area auto-handling.** When you override `tabBarStyle` (background, border, etc.), react-navigation's automatic bottom-inset padding is replaced with whatever you set. Pull `insets.bottom` from `useSafeAreaInsets()` and add it to `height` and `paddingBottom` of the tab bar style. Otherwise iPhones without a home button and Android edge-to-edge apps draw the tab icons under the home indicator.
