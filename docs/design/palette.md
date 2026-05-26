# Sift — Design Palette

Refined dark-theme system. Calm, serious, monospace-for-numbers. Aesthetic anchor: Linear / Vercel / Arc — not Bloomberg, not Robinhood.

The palette deliberately leans **muted**. Financial-adjacent apps default to bright, blinking color; the educational/research framing benefits from the opposite. Less visual noise, less "trading floor", more "reading room".

## Color tokens

All tokens have a **semantic name** (use this in code) and a **raw value** (hex). Never reference raw hex in component code — always go through the theme.

### Backgrounds

| Token | Hex | Use |
| --- | --- | --- |
| `bg.base` | `#0B0F17` | App background. Deep blue-gray, almost black with a cool tint. |
| `bg.surface` | `#131825` | Cards, list rows, anything one level up from base. |
| `bg.elevated` | `#1B2030` | Modals, bottom sheets, popovers. |
| `bg.inset` | `#080B11` | "Sunken" areas — input fields, empty states. |

The hierarchy is intentional: each step is ~5% lighter. Avoid `#000` pure black — reads as cheap on OLED and crushes detail.

### Borders & dividers

| Token | Hex | Use |
| --- | --- | --- |
| `border.subtle` | `#1F2433` | Barely-there dividers, card outlines. |
| `border.default` | `#2A3142` | Form fields, more visible separation. |
| `border.strong` | `#3D4458` | Focus rings, emphasis. |

### Text

| Token | Hex | Use |
| --- | --- | --- |
| `text.primary` | `#F1F4FA` | Headlines, primary body. Off-white, not pure white. |
| `text.secondary` | `#9CA3B5` | Supporting copy, labels. |
| `text.tertiary` | `#5C657A` | Captions, disclaimers, timestamps. |
| `text.disabled` | `#3D4458` | Disabled controls. |
| `text.inverse` | `#0B0F17` | Text on a light/accent surface (rare in dark UI). |

### Accent (single)

Soft blue. Used for active state, primary CTAs, "fresh" indicators. **One accent only** — resist the urge to add a second.

| Token | Hex | Use |
| --- | --- | --- |
| `accent.default` | `#5B8DEF` | Primary actions, links, active tab. |
| `accent.hover` | `#7AA3F5` | Hover/pressed (web/iPad mostly). |
| `accent.muted` | `#1A2B4D` | Tinted background for accented chips/pills. |
| `accent.on` | `#FFFFFF` | Text/icon on top of `accent.default`. |

### Semantic — earnings outcomes

The high-stakes tokens. **Always pair with a shape, never color alone** — accessibility (~8% of male users have red/green deficiency).

| Token | Hex | Shape | Use |
| --- | --- | --- | --- |
| `signal.positive` | `#4ADE80` | `▲` | Beat, upside, raised guidance. Calm green, not neon. |
| `signal.negative` | `#F87171` | `▼` | Miss, downside, lowered guidance. Calm red. |
| `signal.neutral` | `#94A3B8` | `━` | In-line / met estimate. Gray, not a third color. |
| `signal.warning` | `#FBBF24` | `⚠` | Data issue, stale, degraded source. |
| `signal.info` | `#5B8DEF` | `●` | Same as accent — "new briefing ready", "filing detected". |

Component examples:
```
▲ +8.1% beat        signal.positive + mono digits
▼ -2.3% miss        signal.negative
━ in line           signal.neutral
⚠ data delayed      signal.warning
```

### Status — operational

For pipeline status (briefing generation, push delivery, model versions).

| Token | Hex | Use |
| --- | --- | --- |
| `status.pending` | `#9CA3B5` | Same as `text.secondary`. |
| `status.active` | `#4ADE80` | Same as `signal.positive`. |
| `status.failed` | `#F87171` | Same as `signal.negative`. |
| `status.retired` | `#5C657A` | Same as `text.tertiary`. |

## Typography

Two families. Sans-serif for everything UI; mono for **all numbers** (prices, EPS, percentages, timestamps in tables).

| Family | Stack | Use |
| --- | --- | --- |
| `font.sans` | `Inter`, `-apple-system`, `Segoe UI`, system | UI text |
| `font.mono` | `JetBrains Mono`, `SF Mono`, `Menlo`, `monospace` | Numbers, tickers, dates in tables |

**Why mono for numbers:** tabular figures align vertically in lists. `$1,234.56` vs `$98.20` are scannable in a column. Without mono, the eye has to recompare per row.

Both fonts already available via Expo Google Fonts (`@expo-google-fonts/inter`, `@expo-google-fonts/jetbrains-mono`) — install when wiring the theme.

### Type scale

iOS-aligned (body=17pt baseline). Use the named token, not the raw number.

| Token | Size | Line height | Weight | Use |
| --- | --- | --- | --- | --- |
| `text.displayLg` | 34 | 41 | 600 | Hero number on event detail (big surprise %) |
| `text.displaySm` | 28 | 34 | 600 | Large title in nav headers |
| `text.title` | 22 | 28 | 600 | Section headers within screens |
| `text.headline` | 17 | 22 | 600 | List row primary, card titles |
| `text.body` | 17 | 24 | 400 | Long-form (briefings, transcript snippets) |
| `text.callout` | 15 | 20 | 500 | Status chip text |
| `text.subhead` | 14 | 20 | 400 | List row secondary, metric labels |
| `text.footnote` | 13 | 18 | 400 | Timestamps, captions under cards |
| `text.caption` | 12 | 16 | 400 | Disclaimer, legal |
| `text.micro` | 10 | 14 | 500 | Eyebrow labels (uppercase + letter-spacing). Use sparingly. |

**Mono variants** for all numeric/tabular contexts: `displayLgMono`, `headlineMono`, `bodyMono`, `calloutMono`, `subheadMono`, `footnoteMono`. All include `fontVariant: ['tabular-nums']` so column figures align. Never use mono for prose.

## Spacing

4pt base. Multiples only.

| Token | px |
| --- | --- |
| `space.0` | 0 |
| `space.1` | 4 |
| `space.2` | 8 |
| `space.3` | 12 |
| `space.4` | 16 |
| `space.5` | 20 |
| `space.6` | 24 |
| `space.8` | 32 |
| `space.10` | 40 |
| `space.12` | 48 |
| `space.16` | 64 |

Most cards: padding `space.4` (16). Most screens: horizontal padding `space.4` (16). Vertical rhythm between cards: `space.3` (12).

## Radius

| Token | px | Use |
| --- | --- | --- |
| `radius.sm` | 4 | Tags, pills inside cards |
| `radius.md` | 8 | Buttons, inputs |
| `radius.lg` | 12 | Cards, list rows |
| `radius.xl` | 16 | Sheets, hero containers |
| `radius.pill` | 999 | Status chips |

No `radius.none` — squared corners are deliberate and rare.

## Elevation

Dark UI shouldn't lean on drop shadows — they don't read. Use **background lift + 1px border** instead.

| Level | Effect |
| --- | --- |
| `elevation.0` | `bg.base`, no border |
| `elevation.1` | `bg.surface`, `border.subtle` 1px |
| `elevation.2` | `bg.elevated`, `border.default` 1px |
| `elevation.3` | `bg.elevated`, `border.strong` 1px, subtle inner glow on focus only |

If a real shadow is needed (e.g. bottom sheet over content): `shadowColor: '#000'`, `shadowOpacity: 0.4`, `shadowOffset: { 0, -4 }`, `shadowRadius: 12`. Use rarely.

## Motion

Default to **calm**. Spring physics feel toy-like for finance.

| Token | Duration | Easing | Use |
| --- | --- | --- | --- |
| `motion.fast` | 120ms | ease-out | Hover, tap feedback |
| `motion.default` | 200ms | ease-out | Most transitions |
| `motion.slow` | 320ms | ease-in-out | Modal in/out, screen transitions |

Reanimated's `withTiming` over `withSpring` by default. Reserve springs for explicit physical metaphors (pull-to-refresh, swipe-to-dismiss).

## Iconography

- **Library:** `lucide-react-native` (free, consistent stroke). `@expo/vector-icons` (already in tree via Expo) as fallback for specific glyphs.
- **Stroke:** 1.5px default. 2px for selected/emphasis.
- **Sizes:** 16, 20, 24. No in-between.
- **Color:** `text.secondary` for default, `text.primary` for active, `accent.default` for selected.
- **Never use emoji as UI iconography** — they render differently per OS and look unserious.

## Numbers — formatting rules

Tabular data is the bulk of the app. Be consistent.

- **Currency:** `$1,234.56` — symbol, comma thousands, 2 decimals. Use `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`.
- **Large currency:** `$92.4B`, `$1.2T` — abbreviate above $10M for revenue. `$1.50` for EPS. Different format per context.
- **Percentages:** `+8.1%`, `-2.3%` — always signed, one decimal. Pair with `▲` / `▼` / `━`.
- **Probabilities:** `65%` — no decimals, no sign.
- **Tickers:** `AAPL` — always uppercase, mono font.
- **Dates in tables:** `May 12` for current year, `May 12 '25` for past, ISO-ish `2026-05-12` only in admin/debug screens.
- **Times:** `4:30 PM ET` for user-facing, `16:30 UTC` for technical.

## Compliance hooks at the design layer

These are non-negotiable, baked into the palette:

1. **Disclaimer footer** — every signal screen uses `text.caption` + `text.tertiary` for the standing disclaimer. Visible but not flashy. Reusable as `<DisclaimerFooter />`.

2. **No bright red CTAs.** "Buy" / "Sell" / "Trade" don't exist in this product. But even adjacent verbs ("View on broker") would never be in `signal.negative` or `accent.default` — keep them muted.

3. **Surprise probability never gets `signal.positive` styling.** A "65% chance of beat" is information, not a recommendation. Show the number in `text.primary`, the bar/chip in `accent.muted`. Save `signal.positive` for *realized* outcomes, never predictions.

4. **No "winner" emphasis on watchlist.** Don't sort or color-code by which tickers are "best" — alphabetical or by earnings date only.

5. **Push body styling implication:** since pushes must be standalone-compliant (see [compliance.md](../architecture/compliance.md)), the in-app rendering of a notification should reuse the same factual tone. No emojis, no exclamation marks, no `signal.positive` color on predictions.

## Accessibility

- **Contrast minimum:** WCAG AA (4.5:1 for body, 3:1 for large text). All `text.primary` over `bg.base` is 14.8:1 — comfortable.
- **Don't rely on color.** Every up/down/neutral signal has a shape companion (`▲▼━`).
- **Touch targets:** minimum 44×44 pt (Apple HIG) / 48×48 dp (Material).
- **System font scaling:** `allowFontScaling` defaults to true. Don't disable globally; only on tabular figures where reflow would break.
- **Reduce motion:** respect `useReducedMotion()` from `react-native-reanimated` — collapse 200ms transitions to 0ms.

## The theme module (target — not yet wired)

This is the shape the JS theme will take. Lives at `src/theme/index.js`.

```js
// src/theme/index.js — target
export const colors = {
  bg: {
    base:     '#0B0F17',
    surface:  '#131825',
    elevated: '#1B2030',
    inset:    '#080B11',
  },
  border: {
    subtle:  '#1F2433',
    default: '#2A3142',
    strong:  '#3D4458',
  },
  text: {
    primary:   '#F1F4FA',
    secondary: '#9CA3B5',
    tertiary:  '#5C657A',
    disabled:  '#3D4458',
    inverse:   '#0B0F17',
  },
  accent: {
    default: '#5B8DEF',
    hover:   '#7AA3F5',
    muted:   '#1A2B4D',
    on:      '#FFFFFF',
  },
  signal: {
    positive: '#4ADE80',
    negative: '#F87171',
    neutral:  '#94A3B8',
    warning:  '#FBBF24',
    info:     '#5B8DEF',
  },
};

export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 };
export const radius = { sm: 4, md: 8, lg: 12, xl: 16, pill: 999 };

export const font = {
  sans: 'Inter_400Regular',
  sansMed: 'Inter_500Medium',
  sansBold: 'Inter_600SemiBold',
  mono: 'JetBrainsMono_400Regular',
  monoMed: 'JetBrainsMono_500Medium',
};

export const text = {
  display:   { fontFamily: font.sansBold, fontSize: 32, lineHeight: 40 },
  title:     { fontFamily: font.sansBold, fontSize: 24, lineHeight: 32 },
  subtitle:  { fontFamily: font.sansMed,  fontSize: 18, lineHeight: 26 },
  body:      { fontFamily: font.sans,     fontSize: 16, lineHeight: 24 },
  bodySm:    { fontFamily: font.sans,     fontSize: 14, lineHeight: 20 },
  caption:   { fontFamily: font.sans,     fontSize: 12, lineHeight: 16 },
  micro:     { fontFamily: font.sansMed,  fontSize: 10, lineHeight: 14 },
  bodyMono:  { fontFamily: font.mono,     fontSize: 16, lineHeight: 24 },
  titleMono: { fontFamily: font.mono,     fontSize: 24, lineHeight: 32 },
};

export const motion = {
  fast:    { duration: 120 },
  default: { duration: 200 },
  slow:    { duration: 320 },
};
```

`src/theme/use-theme.js` will export a hook returning this object — keep it static for now, leave room for a light theme later (don't build it; remember it).

## Component implications — current (post-Phase R, 2026-05-22)

### Timeline IA

Today, Discover, ticker detail and event detail are all day-anchored timelines. The structural device is `<DayHeader>` over a flat list of cards; no more bucket section labels like `LIVE NOW` / `UPCOMING` / `RECENT` / `PAST EVENTS`. Date is the primary anchor, content is secondary.

### `<DayHeader>` shape

| Element | Token |
| --- | --- |
| Container | row, `alignItems: baseline`, `gap: space[2]`, `marginBottom: space[3]` |
| Relative label (`TODAY` / `YESTERDAY` / `TOMORROW` / `WED`) | `text.micro`, `text.tertiary`, `letterSpacing: 0.6` |
| Dot separator (`·`) | `text.micro`, `text.tertiary` |
| Absolute (`MAY 26` or `WED MAY 27`) | `text.subhead`, `text.tertiary` |

When the relative label IS the weekday (`WED`), the weekday is elided from the right side. When the relative is `TODAY/YESTERDAY/TOMORROW`, the weekday joins the absolute side for context.

### Event card states (`<EventTimelineCard>`)

One component, three states. All wrap `<Card>` (`bg.surface` + `border.subtle` + `radius.lg`).

| State | Header | Body | CTA |
| --- | --- | --- | --- |
| `upcoming` | Time anchor: `4:00 PM ET · After close` (`text.subhead` secondary, anchor in tertiary) | EPS est + Beat probability % with `ⓘ` info button | "● Briefing ready →" (`accent.default`) when handler + briefingReady |
| `live` | `◐ LIVE · filed Nm ago` — **`accent.default`** (NOT `signal.negative` — see below) | EPS actual vs est + signal-tinted surprise % + qualifier | "Read briefing →" |
| `past` | `✓ Reported · time` — `text.tertiary` | Same as live | "Open event detail →" + optional `<Pill>` for guidance |

### Live ribbon colour decision

The pre-Phase-R `<EventCard>` used `signal.negative` (red) for the LIVE label. That conflated two semantically different things: "live event happening now" and "negative P&L outcome." Red is the P&L colour and only ever means "down/miss." Post-Phase R: **live state uses `accent.default`**, the same accent used for active tabs and primary CTAs. Pairs with the `◐` glyph (filled half-circle) for unmistakable identity.

### Outcome arrows

Used identically across `<EventTimelineCard>` (past + live), `<DiscoverScreen>` recent-surprises rail, event detail hero + metric tiles.

| Outcome | Arrow | Color |
| --- | --- | --- |
| Beat (`surprisePct > 0.005`) | `▲` | `signal.positive` |
| Miss (`surprisePct < -0.005`) | `▼` | `signal.negative` |
| In line | `━` | `signal.neutral` |

### Prediction display — compliance-mandatory

| Element | Treatment |
| --- | --- |
| Beat probability % (watchlist context) | Mono number, `text.primary` (never green/red), paired with `ⓘ` info button opening the methodology sheet |
| Beat probability % (cross-market — Discover) | Same neutral colour + "Model" prefix on the label ("Model beat 71% · ±5.2% expected"). The "MODEL —" eyebrow on the section header reinforces. |
| Forbidden in any user-facing copy | "advice", "recommend", "should", "likely", "will rise", "will move", "buy now", "sell now" |
| Always-present footer | `<DisclaimerFooter>` + on Discover an extra "Model predictions are educational. Sift does not provide investment advice." line above it |

### Briefing-ready badge

Two variants of the same indicator on upcoming cards:

| Variant | When | Render |
| --- | --- | --- |
| Tappable CTA | `onBriefingPress` handler provided (e.g. Home) | `<Pressable>` with `● Briefing ready` + spacer + `→` arrow |
| Informational badge | No handler (e.g. ticker detail — no briefing-detail route yet) | `<View>` with `● Briefing ready` only (no arrow, non-tappable) |

### Sparkline tint

Default: `text.secondary` (muted). The trend-coloured variant was retired in tick 49 (B16) because mock data doesn't carry real 30-day direction. Real-data ticks may re-tint with intent later — `trend` prop is preserved on the row data shape.

## What this doc deliberately does NOT cover

- **Light theme tokens** — out of scope until the user asks. Will inherit the same structure when added.
- **Component library** (Button, Card, ListRow) — design tokens come first, components later. Track in `docs/design/components.md` when we start writing them.
- **Brand identity** (logo, app icon, marketing) — different problem space.
- **Animations beyond duration tokens** — specific motion choreography is per-component.
- **Print/email styles** — irrelevant for mobile.

## Process for changes

- Adding a new color: add a token first, justify it here (one sentence), then use it in code. **Never hex literals in components.**
- Tweaking an existing token's value: keep the name, change the hex, restart Metro. Components don't need to change.
- Adding a font: don't, unless you can justify a third family. Two is plenty.
