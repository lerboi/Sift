# UX loop — polish + improvement pass

Same shape as `docs/qa/iteration-plan.md` but the focus is **visual quality, interaction quality, and consistency** rather than correctness bugs. Each tick lands a polish pass on one surface or one cross-cutting concern. Run on top of QA loop output — assumes QA-tier bugs are already fixed.

---

## Per-tick protocol

1. **Read every file in scope** for the tick (screen + components used + parent layout).
2. **Walk the user flow** — slow down, imagine each tap, swipe, scroll. Where does it feel cheap, jarring, or off-center?
3. **List specific issues** in `docs/ux/issues.md` with `UX-NN` id, surface (file:line), and what's wrong from the user's perspective.
4. **Apply minimal-but-decisive fixes** — don't refactor unrelated code. Prefer small additive components over invasive rewrites unless the existing structure is the bug (e.g. carousel).
5. **Update `docs/ux/changelog.md`** — paragraph per tick, listing concrete before/after.
6. **Mark issues fixed** in `issues.md` status table.
7. **Check box** in this file + update STATUS.
8. **`ScheduleWakeup` 270s for the next tick.**

### Rules

- **Compliance copy is still non-negotiable.** No "advice", "recommend", "should buy", "guaranteed". When refining copy, stay factual.
- **Don't add features.** A polish tick doesn't introduce a new screen or capability — just refines what's there.
- **Don't redesign the schema.** UX is frontend-only territory.
- **Respect existing design tokens** — `src/theme/index.js`. If you need a new color/size/font, add it to the theme rather than inline literals.
- **Mobile-first.** Web is dev convenience; iOS/Android are the targets. Don't break web but don't optimise for it.
- **Reduced-motion preference.** Anywhere with animation, check `useReducedMotion()` (already used in Button).

---

## STATUS

**Last tick:** none yet (loop not started).
**Next:** **UX1** — Welcome carousel rewrite (known broken: Next button shows nothing).
**Mode:** code-review + minimal patches. No DB ops.
**Blockers:** none.
**Issue log:** see `docs/ux/issues.md`.

---

## Backlog

Legend: `[ ]` to do · `[x]` done · `[~]` partial · `[!]` blocked

### Highest priority (known broken)

- [ ] **UX1** — **Welcome carousel rewrite.** User reports: tap Next, nothing visible happens. Investigate `src/features/onboarding/welcome-screen.js`. The current ScrollView+horizontal+pagingEnabled+flex:1 pattern is flaky on Expo Go; rewrite using FlatList-horizontal or fixed-height slide layout. Verify: page dots track, swipe works, Next animates to next slide, "Get started" on last slide advances to /how-sift-works.

### Per-screen polish (one tick per surface)

- [ ] **UX2** — Onboarding flow polish (welcome handled in UX1). Audit how-sift-works, ack, notifications, first-tickers for: visual hierarchy, button placement consistency, scroll behavior, micro-copy precision, empty/edge states.
- [ ] **UX3** — Auth screens (sign-in, sign-up, auth-callback). Touch targets, keyboard handling, error display, OAuth button styling, link-to-other-flow placement.
- [ ] **UX4** — Today screen. Pill animation polish, EventTimelineCard tap affordance, day header treatment, pull-to-refresh feedback, empty state messaging.
- [ ] **UX5** — Watchlist screen. Add a WatchlistSkeleton for initial load (kill the ~200ms flicker). Refine swipe-to-remove feel. Sparkline visual weight. Sort selector ergonomics.
- [ ] **UX6** — Discover screen. Rail spacing, search bar focus state, empty-rail copy tone, sector-heat row visual density, surprise-rail color accents.
- [ ] **UX7** — Ticker detail. Hero density (symbol/name/sector layout), sparkline interaction, timeline group spacing, sticky CTA bar feel, methodology sheet copy.
- [ ] **UX8** — Event detail. Hero scale, metric tiles, compare-bar polish, filing-timeline visual rhythm, segments table density, source row treatment.
- [ ] **UX9** — Settings + sub-screens (disclaimer/privacy/terms). Group spacing, row icon alignment, footer copy, link affordance on legal text.
- [ ] **UX10** — Sheets (add-ticker, subscription, sign-out, quiet-hours, methodology). Open animation, snap-point sizing, close affordance, content padding, scroll behavior inside sheets.

### Cross-cutting

- [ ] **UX11** — Shared components pass. Button (loading state visibility, disabled contrast, icon spacing), TextField (focus state, error styling), Card (radius/shadow consistency), Pill (variant clarity), MonoNumber (alignment), Sparkline (overflow handling).
- [ ] **UX12** — Typography + spacing audit. Walk every screen with the design-token lens: are all text styles from `src/theme/text`? Spacing from `src/theme/space`? Any inline hex colors or magic numbers to replace.
- [ ] **UX13** — Accessibility pass. Minimum 44pt touch targets, accessibilityLabels on every Pressable, contrast checks against WCAG AA, screen-reader narrative flow for the headline screens.
- [ ] **UX14** — Motion + haptics audit. Every animation respects `useReducedMotion()`. Haptic feedback at the right moments (select on toggle, tap on navigate, success on commit, warning on destructive, error on failed). Nothing over-fires.
- [ ] **UX15** — Final UX smoke checklist for the user (separate doc, mirrors QA23). Each surface gets a `[ ]` line to verify on-device.

---

## After the loop ends

User walks the UX15 smoke checklist on-device. Any "feels off but I can't articulate it" notes become new `UX-NN` items for a round 2.

---

## What NOT to do

- **No new screens or features** — only refine what exists.
- **No schema changes** — purely frontend.
- **No commits without explicit request** — user manages git.
- **Don't replace `@gorhom/bottom-sheet` or any major dep** — refine usage, don't swap.
- **Don't introduce a CSS-in-JS library, design framework, or new theming system.** Use the existing `src/theme/`.
- **Don't redesign the brand or color palette.** The dark theme + accent blue stay.
- **Don't translate copy.** English-only.
