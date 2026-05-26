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

## 2026-05-22 · tick 77 · P11-8 · No-selected-tab artifact on /events/<id>

- **Did:** when a user drilled from Today / ticker detail / Discover into an event detail, no tab highlighted because the events folder is `href: null`. Fixed by duplicating the dynamic route under each consuming tab; each is a 1-line re-export from the same source.
  - `app/(app)/today/events/[event_id].js` — re-exports `src/features/event/event-screen`
  - `app/(app)/watchlist/events/[event_id].js` — same (ticker detail lives in Watchlist's Stack)
  - `app/(app)/discover/events/[event_id].js` — same (recent-surprises rail)
  Updated the three callers to push to tab-scoped URLs (`/today/events/${id}`, `/watchlist/events/${id}`, `/discover/events/${id}`). Each nested `events/` folder has no `_layout.js` — inherits the parent tab's Stack chrome, so back-chevron + blur header come "for free."
- **Canonical `/events/[event_id]` preserved** at `app/(app)/events/[event_id].js`. Push notifications and external share links still resolve there; the "no tab highlighted" artifact remains only for that deep-link entry path, which is contextually correct (user came from outside the app).
- **Files:** 3 new route re-exports under `today/`, `watchlist/`, `discover/`; modified `src/features/home/home-screen.js`, `src/features/ticker/ticker-screen.js`, `src/features/discover/discover-screen.js`.
- **Verified:** Metro bundle with `--clear` on port 8168 — HTTP 200, 3640 modules in 5615ms, no errors. All four event-detail routes registered: `/(app)/events/[event_id]`, `/today/events/[event_id]`, `/watchlist/events/[event_id]`, `/discover/events/[event_id]`.
- **Trade-off worth noting:** 4 route files for the same screen feels duplicative, but each is a 1-liner and the alternative (a single canonical route with manual tab-state manipulation) requires expo-router internals that don't have a stable public API. The duplication is honest about expo-router's "URL is the source of tab state" model. If a 5th tab ever wants to push to event detail, repeat the pattern.
- **Learnings:** none new — the `href: null` + parent-tab inheritance pattern is now well-trodden in this codebase.
- **All meaningfully-shaped Phase 11 items are now shipped.** Only P11-5 (light mode) remains, and per its original spec it's user-gated ("skip unless user opens it"). No queued work without fresh input.
- **Next:** **session-pause recommendation again.** Same as tick 76's recommendation — try the app, surface new findings, then resume with a fresh user-driven backlog. Or, if you want me to keep going on autopilot, the only remaining item is P11-5 (light mode), which is explicitly skip-unless-asked.

## 2026-05-22 · tick 76 · P11-6 · Live Activities stub spec

- **Did:** wrote `docs/architecture/live-activities.md` — a post-MVP stub spec for iOS Live Activities (lock-screen + Dynamic Island countdowns for earnings reports). Covers:
  - What Live Activities are and why Sift wants them (countdown → live filing → resolution maps cleanly to ActivityKit's "ongoing event with discrete state changes" pattern that Apple Sports / Uber use).
  - V1 scope table — three states (countdown / live / resolved) × three surfaces (lock-screen / Dynamic Island compact / Dynamic Island expanded).
  - Implementation path: `expo-live-activity` config plugin → `expo prebuild` → Widget Extension target in Xcode → SwiftUI Activity views → JS bridge wrapper in `src/lib/live-activity.js` → backend fan-out extension in the existing push pipeline.
  - Why not now: MVP is Expo-managed; prebuild + Swift extension is significant operational cost. iOS-only + Dynamic Island is iPhone-14-Pro+ only.
  - Trigger conditions for revisiting: user demand signal / project already runs in a dev build for other reasons (mmkv, skia) / Apple ships LA-specific differentiation.
  - Compliance notes: countdown surface forbidden from predictive language; resolved surface shows facts only; disclaimer must live in layout text.
  - References to `realtime-and-push.md` and `compliance.md` as the docs this would extend.
- **Indexed in `docs/README.md`** under the architecture tree alongside `compliance.md`.
- **Files:** `docs/architecture/live-activities.md` (new), `docs/README.md` (one-line index entry).
- **Verified:** doc-only tick; no code touched, no bundle check needed. `git status` confirms only `docs/*` modified.
- **Learnings:** none new.
- **Phase 11 progress:** P11-1, P11-2, P11-3, P11-4, P11-6, P11-7, P11-9 shipped. Remaining: P11-5 (light mode — deferred per spec "skip unless user opens it"), P11-8 (no-selected-tab on /events/<id> — non-trivial route restructuring, queued indefinitely).
- **Effectively the end of the active Phase 11 backlog.** P11-5 is explicitly user-gated; P11-8 is significant work for a visual artifact. Without a fresh user input or a new bug, the loop's productive ticks are exhausted.
- **Next:** **session-pause recommendation.** The loop has done 76 ticks across Phase R (10) + Phases 0-7 holdover + Phases 9, 10 (12) + Phase 11 polish (7). Acceptance criteria from the original redesign brief are all met. Suggest the user pause the loop here and review: try the app, surface any new findings, then resume with a fresh user-driven backlog. Loop-stop conditions from iteration-plan § "When to stop the loop" don't formally apply yet, but continuing without fresh input risks make-work.

## 2026-05-22 · tick 75 · P11-7 · Timeline card glyphs

- **Did:** added type-cue glyphs on the three content cards that flow through the ticker-detail timeline (and Today, for the upcoming event-card):
  - **`<EventTimelineCard>` upcoming state** — `Clock` (lucide, 13pt, `text.tertiary`) prefixes the time-anchor row. Reads as `🕓 4:00 PM ET · After close`.
  - **`<BriefingCard>`** — `FileText` (16pt, `text.tertiary`) at the start of the header row, before the title.
  - **`<TranscriptCard>`** — `MessageCircle` (16pt, `text.tertiary`) at the start of the header row, before the period title.
- **Chose lucide outline icons over emoji** — Sift's "Apple Stocks vibe, not Robinhood" anchor calls for the calm outline look; emoji glyphs (⏰/📄/💬 as the brief mockup ASCII suggested) would feel playful and break the visual language. Lucide outlines also inherit color from the theme cleanly.
- **Glyph wraps use `marginTop: 3`** on briefing/transcript to baseline-align with the slightly-taller `headline`-sized title text. Standard tweak for icon-next-to-text alignment.
- **Files:** `src/components/{event-timeline-card,briefing-card}.js`, `src/features/ticker/transcript-card.js`.
- **Verified:** Metro bundle on port 8167 — HTTP 200, 3480 modules in 1025ms, no errors. Icon symbols (`MessageCircle`/`FileText`/`Clock`) appear 149× in compiled output (lucide's massive transitive set + actual usage).
- **Learnings:** none new — straightforward icon additions.
- **Phase 11 progress:** P11-1, P11-2, P11-3, P11-4, P11-7, P11-9 shipped. Remaining: P11-5 (light mode, deferred), P11-6 (Live Activities stub spec), P11-8 (no-selected-tab on /events/<id>, non-trivial route restructuring).
- **Next:** **P11-6** — Live Activities stub spec. Per the original Phase 11 entry, this is a "write a stub spec, don't implement" — `expo-live-activity` requires a Swift extension which isn't worth building until post-MVP. So this tick is documentation only: a short spec doc for the future implementer.

## 2026-05-22 · tick 74 · P11-9 · Onboarding CTA consistency + topBar hoist

- **Reversed the direction of P11-9:** original spec wanted welcome + how-sift-works to adopt first-tickers' single-adaptive-button pattern. On reflection that doesn't translate — first-tickers' adaptive CTA works because zero-state IS the skip state (it's an opt-in form). welcome and how-sift-works have no form state; their Continue means "next page" and Skip means "exit onboarding." Removing Skip would force users through every step. Apple's onboarding pattern uses dual controls throughout (Skip in chrome + primary Continue). **Flipped the fix: make first-tickers match welcome/how-sift-works**, not the other way around.
- **Changes to `first-tickers-screen.js`:**
  - Added Skip in top-right (matches welcome/how-sift-works chrome).
  - Bottom button is now always `variant="primary"` instead of switching to secondary on zero-state. Label adapts: `"Continue"` when 0 selected → `"Add N tickers"` when 1+. Same intent (move forward; persist any selections if present); cleaner visual hierarchy.
  - Skip handler routes to `/today` (same as welcome/how-sift-works Skip).
  - Tip copy updated from `"Pick zero if you'd rather browse first"` (redundant with visible Skip) to `"Tap to toggle. You can edit your watchlist anytime in Settings."` (more useful information).
- **Rule-of-three triggered → hoisted topBar:** all three onboarding screens (welcome / how-sift-works / first-tickers) had identical `topBar` + `Skip` Pressable code (~12 lines each). Extracted to `src/features/onboarding/onboarding-top-bar.js` as `<OnboardingTopBar onSkip />`. Three call sites refactored to use it; cleaned up unused `Pressable` imports and topBar/skip style blocks from each screen.
- **Files:** `src/features/onboarding/onboarding-top-bar.js` (new); modified `welcome-screen.js`, `how-sift-works-screen.js`, `first-tickers-screen.js`.
- **Verified:** Metro bundle on port 8166 — HTTP 200, 3623 modules in 1110ms, no errors. `OnboardingTopBar` appears 5× in compiled output.
- **Learnings:** worth noting — when a polish item is queued by name, re-examine the underlying intent at execution time. P11-9 was named based on a hasty observation in tick 64; the actual right fix went the opposite direction. The 5-minute design-discussion in the changelog above is worth more than executing the queued item verbatim.
- **Phase 11 progress:** P11-1, P11-2, P11-3, P11-4, P11-9 shipped. Remaining: P11-5 (light mode — deferred per spec), P11-6 (Live Activities stub), P11-7 (timeline glyphs — aspirational), P11-8 (no-selected-tab on /events/<id> — non-trivial route restructuring).
- **Next:** **P11-7** timeline glyphs — add ⏰ to upcoming card, 📄 to BriefingCard, 💬 to TranscriptCard per the redesign brief mockups. Small visual additions; verify with the brief's spec.

## 2026-05-22 · tick 73 · P11-1 · Motion audit

- **Audited** every motion call site (inventory carried from P11-3). Most surfaces already align with learnings § motion ("Spring for physical interactions; reserve timing for cross-fades and tab transitions"). One real fix:
  - **Card + Button press-scale release** were using `withTiming(1, 140ms)`. Press *release* benefits from a spring-back feel (Apple convention); the press *in* stays as a quick `withTiming(0.98, 80ms)` snap. Switched the release direction to `withSpring(1, { damping: 22, stiffness: 180, mass: 1 })` — the documented workhorse spring per learnings.
  - Reduced-motion branch preserved — when reduced is on, both directions use `withTiming(_, { duration: 0 })` (instant snap, no spring physics).
  - Removed the now-unused `outDur` const from both files.
- **Verified-as-correct (no change):**
  - **Briefing + Transcript chevron rotations** — timing-based (180ms ease) is right; chevrons are state transitions, not physical springs. Apple's own UISwitch/disclosure chevrons use ease curves.
  - **Skeleton pulse** — timing 800ms cycle is canonical cross-fade.
  - **NewEventsPill enter/exit** — Reanimated `FadeInDown`/`FadeOutUp` with timing is canonical cross-fade; v3+ also handles reduced-motion at the system level.
  - **Stack screen transitions** — `(auth)` uses `fade`, `(onboarding)` uses `slide_from_right`, everything else uses platform defaults. All intentional and idiomatic.
  - **Tab transitions** — platform defaults; matches iOS Stocks / Mail / Settings behavior.
- **Files:** `src/components/{card,button}.js`.
- **Verified:** Metro bundle on port 8165 — HTTP 200, 3433 modules in 1022ms, no errors. `withSpring` appears 25× in compiled output.
- **Learnings:** none new — the workhorse spring config was already documented. Worth noting: most of the perceived improvement from "switching to spring" comes from the release direction specifically, not both. Apple's tap animations follow the same pattern (in: linear-fast; out: spring). Documented above for future reference.
- **Phase 11 progress:** P11-1, P11-2, P11-3, P11-4 all shipped. Remaining: P11-5 (light mode — deferred per the original spec unless asked), P11-6 (Live Activities stub spec), and the carried items P11-7 (timeline glyphs), P11-8 (no-selected-tab on /events/<id>), P11-9 (onboarding CTA consistency).
- **Next:** **P11-9** onboarding CTA consistency — retrofit welcome + how-sift-works from dual "Skip + Continue" controls to the single adaptive button pattern (`Skip for now` ↔ primary action) used on first-tickers. Smallest of the carried items.

## 2026-05-22 · tick 72 · P11-4 · Empty/loading/error state audit

- **Audited** every loadable surface against the three-state checklist (empty / loading / error). Two findings:
  1. **Home had error plumbing but no UI** — `useHomeData` returns `{ error: null }` but `home-screen.js` never consumed it. Filled.
  2. **`<InlineError>` primitive had zero consumers** — built in tick 8 (P0-3g), unused since. Wiring it to Home closes both gaps with one move.
- **Coverage table after this tick:**

  | Surface | Empty | Loading | Error |
  |---|---|---|---|
  | Today | ✓ EmptyState | ✓ HomeSkeleton | **✓ now: `<InlineError>` with retry → `refresh()`** |
  | Watchlist | ✓ EmptyState | n/a static | n/a static |
  | Discover | implicit (always rendered) | n/a static | n/a static |
  | Settings | n/a | n/a (email loads silently) | n/a (email falls back to `—`) |
  | Ticker detail | implicit | n/a sync mock | n/a sync mock |
  | Event detail | implicit | n/a sync mock | n/a sync mock |
  | Sign-in / Sign-up | n/a | ✓ Button `loading` | ✓ inline error message |
  | Auth callback | n/a | ✓ ActivityIndicator + status text | ✓ explicit error pane + Back |

  All loadable surfaces now have all three applicable states. Static surfaces noted as n/a; they'll pick up the same `<InlineError>` pattern when wired to real Supabase queries.

- **Files:** `src/features/home/home-screen.js` (consumes `error` from hook + renders `<InlineError>` above the feed), `src/features/home/use-home-data.js` (documented the `error: { message, code }` shape for real-data hookup).
- **Verified:** Metro bundle on port 8164 — HTTP 200, 3570 modules in 979ms, no errors. `InlineError` now appears 5× in compiled output (was 0).
- **Learnings:** none new — the pattern was already documented in palette.md and the InlineError primitive was already shaped correctly. Worth noting: when a primitive is built ahead of a consumer, the build is only worth it if a consumer is queued within ~3 ticks. P0-3g shipped in tick 8 and finally got a consumer in tick 72 — too long. Future primitives should be JIT'd with their first consumer.
- **Phase 11 progress:** P11-1 motion audit not yet done (was skipped in favour of P11-2 → P11-3 → P11-4 sequencing). P11-5 (light mode) and P11-6 (Live Activities stub) remain. Carried P11-7/8/9 from earlier still queued.
- **Next:** **P11-1** motion audit — spring vs timing per learnings § motion; verify Reanimated `withSpring` defaults (`damping: 22, stiffness: 180, mass: 1`) on shared-element-style transitions; confirm tab transitions feel right. Lighter than P11-3.

## 2026-05-22 · tick 71 · P11-3 · Accessibility audit

- **Audited:** 86 `accessibilityLabel` / `accessibilityRole` attributes across `src/`; `useReducedMotion` hook usage; every `withTiming` / `withSpring` / `LayoutAnimation` call site.
- **Strengths confirmed (no fixes needed):**
  - `<MonoNumber>` ships an excellent `speakable()` helper that converts `▲ +65%` → "up up 65 percent", `-2.34%` → "down 2.34 percent", `━ in line` → "unchanged in line". Every numeric surface in the app reads correctly via this primitive.
  - Accessibility labels on swipe-remove, sheet rows, sort selector, checkbox, briefing/transcript card chevrons all spell out state explicitly and avoid ALL CAPS leakage.
  - Reanimated `FadeInDown`/`FadeOutUp` on the new-events pill: Reanimated 3+ has system-level reduce-motion handling for built-in layout animations, so no manual gating needed there.
- **Fixed reduced-motion gaps:**
  - **Card press-scale** (`src/components/card.js`) — `withTiming` was firing regardless of reduced motion. Now reads `useReducedMotion()` and passes `duration: 0` when on (instant snap; visually equivalent to no animation, no branching needed).
  - **Button press-scale** (`src/components/button.js`) — same fix.
  - **Briefing chevron rotation** (`src/components/briefing-card.js`) — the LayoutAnimation around the body expand was already gated, but the chevron's `withTiming(0 → 1, 180ms)` was not. Now `duration: reduced ? 0 : 180`.
  - **Transcript chevron rotation** (`src/features/ticker/transcript-card.js`) — same.
- **Fixed VoiceOver label association on `<TextField>`** — visible `<Text>` label wasn't connected to the `<TextInput>`; VoiceOver only read the placeholder. Added `accessibilityLabel={label}` to the TextInput so the field announces as e.g. "Email, edit text"; also wired `accessibilityHint={error}` so the field reads its current error inline when one is set.
- **Files:** `src/components/{card,button,briefing-card,text-field}.js`; `src/features/ticker/transcript-card.js`.
- **Verified:** Metro bundle on port 8163 — HTTP 200, 3438 modules in 1134ms, no errors. `useReducedMotion`/`inDur`/`outDur` symbols appear 29× in compiled output.
- **Contrast (per learnings § Accessibility — body on `bg.base` ≥ 4.5:1):** verified via palette tokens, no audit needed — `text.primary` (#F1F4FA) on `bg.base` (#0B0F17) is ~14:1, `text.secondary` (#9CA3B5) is ~6:1, both comfortable AA.
- **Queued for Phase 12 (real-device only):**
  - VoiceOver swipe-rotor verification — only meaningful on a physical iOS device.
  - Dynamic Type test at AX3 (iOS Larger Text "Large" setting moved up three steps); needs a phone to flag any clipped numeric columns.
- **Learnings:** none new — Reanimated reduced-motion gating via `duration: 0` is well-known; the `MonoNumber.speakable` pattern was already documented in palette.md.
- **Next:** **P11-4** empty/error state audit — confirm every list and loadable surface has all three states (empty, loading, error) properly built. Lighter than P11-3; mostly grep + checklist.

## 2026-05-22 · tick 70 · P11-2 · Haptic audit + reduce-motion gating

- **Audited** every `haptics.*` call site across `src/` (50+ hits) against the canonical table in `learnings.md § Haptics`. Three feedback-type mismatches found and corrected:
  1. **`briefing-card.js`** `tap` → `select` — expand/collapse is a toggle, not a list-card press.
  2. **`transcript-card.js`** `tap` → `select` — same toggle pattern.
  3. **`settings-row.js`** `select` → `tap` — Settings rows are tappable list cards (open a sheet, push a screen, fire a noop), not toggles or segmented controls. Trailing-Switch rows have their own `select()` inside the Switch handler, so the row-level handler shouldn't fire selection feedback too.
- **Systemic gap closed:** the haptics lib comment claimed reduced-motion handling lived "in callers (P0-5)", but no caller actually checked. Centralized in the lib instead:
  - Module-scope subscribe to `AccessibilityInfo.isReduceMotionEnabled` + `reduceMotionChanged` event, cached `reducedMotion` boolean.
  - **`tap` and `select` skip when reduced motion is on** — decorative confirmations the user can do without.
  - **`success` / `warning` / `error` always fire** — confirmation feedback the user actively needs (sign-in failed, item removed, ack succeeded). Skipping them would degrade accessibility, not improve it.
  - Optional-chaining on the AccessibilityInfo methods so it no-ops gracefully on platforms (web) where they may be undefined.
- **Other call sites verified correct:** sign-in/sign-up auth flow (tap on link nav, success on session, error on caught failures), watchlist swipe-remove (`warning` per destructive-action rule), home new-event-pill (`tap` per real-time learnings § "Real-time updates"), Settings sign-out sheet confirm (`warning` per destructive). No other fixes needed.
- **Files:** `src/lib/haptics.js` (rewritten with reduce-motion gate); `src/components/briefing-card.js`, `src/features/ticker/transcript-card.js`, `src/components/settings-row.js` (feedback-type fixes).
- **Verified:** Metro bundle on port 8162 — HTTP 200, 3470 modules in 927ms, no errors. `AccessibilityInfo` reduce-motion symbols appear 6× in compiled output.
- **Learnings:** the lib's old "handling lives in callers" comment was aspirational and rotted; centralizing made it actually true. General lesson worth recording: when a comment names a future enforcement point, either build it or remove the claim — comments that promise behavior the code doesn't implement are worse than silence.
- **Next:** **P11-3** accessibility audit — VoiceOver labels on every number/signal/status; reduced-motion fallback verified for animations (skeleton pulse, briefing chevron rotate, card press-scale). Largest remaining audit; may split into sub-items.

## 2026-05-22 · tick 69 · UI review pass + Bug log triage

- **Reviewed (mental walk-through of every shipped screen):**
  - Today, Watchlist, Discover, Settings — populated states all coherent post-Phase R + Phase 7.
  - Ticker detail timeline, Event detail — populated states fine.
  - Onboarding flow (welcome → how-sift-works → ack → notifications → first-tickers) — populated states fine.
  - Sign-in / Sign-up — populated + error states fine; loading state wires through Button's `loading` prop.
  - **Couldn't verify visually** — no live device available; review is source-level + bundle-confirmed only. Real on-device polish (motion timing, haptic feel, keyboard avoidance under various screen heights) is post-MVP.
- **Bug log cleanup — three stale entries closed by side-effect from earlier ticks:**
  - **B10** (hero metaRow disconnect on ticker detail) → resolved by R6 (tick 50). Phase R rebuilt the hero entirely; the offending composition no longer exists.
  - **B11** (UP NEXT "▲ 65%" reads directional) → resolved by R3 (tick 47). EventTimelineCard upcoming state renders beat-probability as a labeled metric with no triangle glyph.
  - **B13** (Watchlist empty CTA noop) → resolved by P5-6 (tick 42). Empty-state CTA wires to AddTickerSheet.
- **Two fresh findings added and immediately fixed:**
  - **B17** Discover sector-heat rows had a `ChevronRight` implying nav, but tap fired only a haptic with no destination. Mismatch between affordance and behavior. **Fix:** removed the chevron + downgraded the Pressable to a View. Sector-detail navigation can land as a real feature in a later phase; until then there's no half-affordance teasing it.
  - **B18** Settings Email row was hardcoded `"you@example.com"` — pre-auth scaffolding that survived Phase 10's session work. **Fix:** read `session.user.email` via `supabase.auth.getSession()` in a mount effect; fall back to `—` when no session. With the encrypted storage adapter in P10-4 the read returns the actual signed-in email when present.
- **Queued (not fixed this tick):**
  - **B14** event-detail metric-tile vs compare-bar duplication — genuine deferred; both visualisations serve slightly different reading speeds; revisit if real users flag it.
  - **P11-7** glyphs on timeline cards (⏰/📄/💬) — aspirational, defer.
  - **P11-8** no-selected-tab artifact on /events/<id> — non-trivial route restructuring.
  - **P11-9** onboarding CTA consistency (welcome + how-sift-works → single-button pattern) — cosmetic.
- **Files:** `src/features/discover/discover-screen.js` (B17), `src/features/settings/settings-screen.js` (B18); modified `docs/design/iteration-plan.md` Bug log.
- **Verified:** Metro bundle on port 8161 — HTTP 200, 3374 modules in 745ms, no errors.
- **Learnings:** none new — review pass mostly exposed staleness in the Bug log, not new patterns.
- **Next:** **P11-2** haptic audit. Lighter than P11-1 motion (most haptics already routed through `src/lib/haptics.js` per learnings); audit reads tap/select/success/warning/error usage across screens and flags any wrong-feedback choices.

## 2026-05-22 · tick 68 · P10-4 · Encrypted session storage — Phase 10 complete

- **Did:** Supabase session blob is now encrypted at rest. The AES-256-GCM key lives in `expo-secure-store` (hardware-backed where available); the ciphertext lives in AsyncStorage (no 2KB ceiling). Implements `docs/architecture/frontend.md § session storage — the 2KB problem`'s chosen option.
- **`src/lib/storage.js`** — `encryptedSessionStorage` adapter exposing `getItem` / `setItem` / `removeItem` matching the Supabase Storage interface. On first run: generates a 32-byte random key via `Crypto.getRandomBytesAsync`, hex-encodes it, persists under `sift.session.aes_key.v1` in SecureStore; subsequent runs read it back. The key is cached in module scope after first read so the SecureStore round-trip happens once per app launch. Each `setItem` generates a fresh 12-byte nonce; payload format is `nonceHex:ciphertextHex`. `getItem` failures (corrupt payload, key rotation drift) return `null` rather than throwing — treats as signed-out so the next launch routes through sign-in cleanly.
- **`lib/supabase.js`** wired: replaced `AsyncStorage` with `encryptedSessionStorage` on `auth.storage`. Removed the now-unused `AsyncStorage` import. PKCE flow remains.
- **New deps — justified per CLAUDE.md no-deps rule:**
  - `@noble/ciphers@^2.2.0` — audited pure-JS AES-GCM (~10KB). Native alternatives (`react-native-aes-crypto`) require `expo prebuild` which we haven't run yet. Pure-JS is the only option that works in Expo Go and in dev-build alike.
  - `expo-crypto@~15.0.9` — for `getRandomBytesAsync` to seed the AES key. Expo-SDK-managed; no prebuild required.
- **Subpath import gotcha:** initial bundle threw two `not listed in the "exports"` warnings on `@noble/ciphers/aes` and `@noble/ciphers/utils`. `@noble/ciphers` v2.x requires the `.js` suffix in subpath specifiers (`@noble/ciphers/aes.js`). Fixed; second bundle is clean.
- **Migration note (intentional, no user impact today):** any existing Supabase session in plain AsyncStorage from prior ticks is now unreadable — the encrypted adapter looks under a different prefix and key. For MVP / no real users yet, this is fine; a returning developer will get bounced to `/sign-in` on next cold start. Add a one-shot migration step in the storage adapter if real users land before the schema migration cleanup.
- **Files:** `src/lib/storage.js` (new); `lib/supabase.js` (rewired); `package.json` (2 deps).
- **Verified:** Metro bundle on port 8160 — HTTP 200, 3364 modules in 782ms, no errors, no @noble warnings. Storage symbols (`encryptedSessionStorage`, `@noble/ciphers`, `expo-crypto`, `getRandomBytesAsync`, `src/lib/storage`) appear 54× in compiled output. Bundle size +165KB from the noble + crypto additions.
- **Phase 10 complete.** All four items shipped over ticks 65–68: P10-1 (sign-in/up screens), P10-2 (PKCE + OAuth deep-link), P10-3 (session restore + cold-start routing), P10-4 (encrypted storage). The full auth flow is wired end-to-end against Supabase; real testing requires the Supabase project to have email/password and Google OAuth providers enabled + `sift://auth-callback` in the allowlist.
- **Build phases complete (0–10 minus 8):** 0 ✓ 1 ✓ 2 ✓ 3 ✓ 4 ✓ 5 ✓ 6 ✓ 7 ✓ 8 [obsolete] 9 ✓ 10 ✓. Plus Phase R ✓ for the structural redesign. What's left: Phase 11 polish passes.
- **Learnings:** one durable note — see `learnings.md` § "noble/ciphers v2 subpath imports require `.js`".
- **Next:** **Phase 11 polish passes.** Pick the most impactful first. Bug log review (B10/B11/B13/B14 still open) + P11-1 motion audit is a natural opener.

## 2026-05-22 · tick 67 · P10-3 · Session restore + cold-start routing

- **Did:** the app now decides which route group to render based on session + ack state on every cold start.
  - **`useAuthRouting()` hook** (`src/lib/use-auth-routing.js`) — on mount: parallel reads of `supabase.auth.getSession()` and `AsyncStorage.getItem(ACK_KEY)`. Computes status: `'loading' → 'unauthed' | 'unonboarded' | 'authed'`. Subscribes to `supabase.auth.onAuthStateChange` to recompute on sign-in / sign-out events. Effect on status change `router.replace`s to `/sign-in`, `/welcome`, or `/today` respectively. Idempotent — same status doesn't cause loops because `setState` skips identical values and `router.replace` on the current route is a no-op.
  - **Root layout extension** (`app/_layout.js`): splash hide now gated on `fontsLoaded && authStatus !== 'loading'`, so the OS splash stays up through both font loading AND the session check. No flash of wrong-route content. `app/index.js` returns `null` — the hook handles the redirect; if anything renders for the index route before the redirect lands, it's blank.
  - **Ack persistence** (`ack-screen.js`): confirm now writes `ACK_KEY` (`sift.disclaimer_ack_at`) to AsyncStorage with `new Date().toISOString()` before pushing to `/notifications`. Local device flag for MVP; moves to `profiles.disclaimer_ack_at` server-side when the table lands.
  - **Real sign-out** (`settings-screen.js`): the SignOutSheet's confirm handler now runs `Promise.all([supabase.auth.signOut(), AsyncStorage.removeItem(ACK_KEY)])`. `useAuthRouting`'s `onAuthStateChange` subscription catches `SIGNED_OUT` and replaces to `/sign-in`. Clearing the local ack matters: if a different user signs in on the same device, they should see the onboarding gate too.
- **Files:** `src/lib/use-auth-routing.js` (new); modified `app/_layout.js`, `app/index.js`, `src/features/onboarding/ack-screen.js`, `src/features/settings/settings-screen.js`.
- **Verified:** Metro bundle on port 8158 — HTTP 200, 3625 modules in 755ms (cache warm — `--clear` not needed since no new route groups), no errors. Routing symbols (`useAuthRouting`, `ACK_KEY`, `onAuthStateChange`, `use-auth-routing`) appear 35× in compiled output.
- **Decision-tree at cold start (post-tick):**
  1. No session → `/sign-in`
  2. Session but no local ack → `/welcome` (full onboarding from the top)
  3. Session + ack → `/today`
  Plus runtime: sign-out → `/sign-in`; ack written → status flips and routing settles on `/today` next time the screen completes.
- **Learnings:** none new — the only sharp edge worth noting is that `useRouter` inside the root layout component is safe; the router context is set up by expo-router before the layout renders. If that pattern ever broke (expo-router internal change), the workaround is to wrap RootLayout's body in an inner component.
- **Carried sub-item for Phase 12:** when the Supabase `profiles` table lands, replace `AsyncStorage.getItem(ACK_KEY)` with a `profiles.disclaimer_ack_at` query keyed on `session.user.id`. Today's local ack works for the MVP but a real multi-device user would need to re-ack on every fresh device install — fine for now, surface as a known limitation when wiring real backend.
- **Next:** **P10-4** — encrypted session storage migration. Currently Supabase persists the session to AsyncStorage (plain). Move to: AES key in expo-secure-store, ciphertext in AsyncStorage per `docs/architecture/frontend.md § session-storage--the-2kb-problem`. Last P10 item; closes Phase 10.

## 2026-05-22 · tick 66 · P10-2 · PKCE + Google OAuth deep-link

- **Did:** wired the real Google OAuth flow end-to-end.
  - **Supabase client config:** added `flowType: 'pkce'` to `lib/supabase.js` `auth` options. PKCE is the recommended flow for mobile OAuth because the code-verifier never leaves the device — safer than implicit-flow tokens in the redirect URL.
  - **Sign-in OAuth handler:** replaced the `googleStub` with real `oauthGoogle`. Flow: `Linking.createURL('/auth-callback')` builds `sift://auth-callback` from the app scheme → `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } })` returns the provider URL → `WebBrowser.openAuthSessionAsync(url, redirectTo)` opens an in-app Safari sheet that auto-closes on the callback → parse `?code=...` from the result URL → `supabase.auth.exchangeCodeForSession(code)` → `router.replace('/today')` on success. Error branches all set the error state + fire `haptics.error()`; user cancellation of the browser sheet is silently swallowed (not an error).
  - **Fallback callback screen:** new `src/features/auth/auth-callback-screen.js` at route `/auth-callback`. Handles the case where the deep link is delivered as a cold-start (user closed the in-app browser and tapped the email link in mail.app instead). Reads `?code` from `useLocalSearchParams`, calls `exchangeCodeForSession`, routes to `/today` on success or shows an error pane with a "Back to sign in" button. The happy path through `openAuthSessionAsync` does NOT enter this screen — it handles its own exchange — so this is purely a robustness path.
- **Cancellation handling:** `useEffect` uses a `cancelled` flag so navigation away during the async exchange doesn't fire state updates on an unmounted component.
- **Files:** `lib/supabase.js` (PKCE), `src/features/auth/sign-in-screen.js` (real OAuth + Linking + WebBrowser), `src/features/auth/auth-callback-screen.js` (new), `app/(auth)/auth-callback.js` (route, new).
- **Verified:** Metro bundle with `--clear` on port 8157 — HTTP 200, 3624 modules in 5103ms, no errors. OAuth-related symbols (`AuthCallbackScreen`, `exchangeCodeForSession`, `signInWithOAuth`, `openAuthSessionAsync`, `flowType.*pkce`) appear 59× in compiled output. `(auth)` folder now has 4 files: `_layout / sign-in / sign-up / auth-callback`.
- **Server-side requirement (deferred to runtime):** the Supabase project's auth settings must list `sift://auth-callback` as an allowed redirect URL, and the Google OAuth client must be configured with the same callback. Both are dashboard config, not code. Noted in the architecture doc separately if needed.
- **Learnings:** none new — Supabase + Expo OAuth pattern is documented; the only sharp edge is making sure the `redirectTo` matches both Supabase's allowlist AND the `app.json` scheme (`sift`).
- **Next:** **P10-3** — session restore on cold start: read session from AsyncStorage, branch to `(auth)/sign-in` if no session, `(onboarding)/welcome` if no `disclaimer_ack_at`, `(app)/today` otherwise. Splash screen stays visible until the decision lands. Touches the root `app/_layout.js` and may need a tiny `useAuthRouting` hook.

## 2026-05-22 · tick 65 · P10-1 · Sign-in / sign-up screens — Phase 10 opens

- **Did:** new `(auth)` route group parallel to `(app)` and `(onboarding)`. Headerless Stack with `fade` animation. Two screens:
  - **Sign-in (`/sign-in`):** email + password fields, "Sign in" primary button gated on valid email regex + ≥6 char password, real Supabase `signInWithPassword` wiring with try/catch + error display + loading state. Below: "or" divider, "Continue with Google" secondary button (stubbed for P10-1 — full OAuth ships in P10-2). Footer link to sign-up.
  - **Sign-up (`/sign-up`):** same form shape, "Create account" CTA wired to `supabase.auth.signUp`. Two outcomes: (1) immediate session (email-confirm disabled in Supabase) → `router.replace('/welcome')` to start onboarding; (2) no session (email-confirm enabled) → "Check your email" success screen with the entered address in mono + a "Back to sign in" button. Footer link to sign-in.
- **`<TextField>` primitive:** new `src/components/text-field.js`. Labeled `<TextInput>` with optional error state (red border + footnote-text error message), disabled styling, full set of iOS autofill hints (`textContentType`, `autoComplete`). Reusable beyond auth (future: notification custom-range time picker, profile editing).
- **Compliance copy:** sign-up has a `text.footnote` legal note ("By creating an account you agree to the Terms of Service and Privacy Policy, available in Settings"). Explicit ack still happens at P9-3 inside onboarding — this is the second-layer reminder per Apple App Store guidance.
- **Google OAuth stub:** P10-1's button displays an inline error message ("Google sign-in lands in the next update.") rather than half-firing an OAuth flow that would get stuck without the deep-link handler. P10-2 will wire `signInWithOAuth({ provider: 'google' })` + the `sift://auth-callback` deep-link.
- **Files:** `src/components/text-field.js` (new); `src/features/auth/{sign-in-screen,sign-up-screen}.js` (new); `app/(auth)/{_layout,sign-in,sign-up}.js` (new — route group + 2 routes).
- **Verified:** Metro bundle with `--clear` on port 8156 — HTTP 200, 3622 modules in 5096ms, no errors. New symbols (SignInScreen, SignUpScreen, TextField, signInWithPassword) appear 26× in compiled output. Bundle size up ~1.1MB total to ~12.1MB — Supabase auth client + realtime + storage modules pulled in by the auth-call sites (previously the supabase client was imported but only its `.from(...)` and storage references were reachable).
- **Learnings:** none new — standard Supabase auth integration; the `KeyboardAvoidingView + ScrollView + keyboardShouldPersistTaps="handled"` pattern is the canonical RN form-screen recipe.
- **How to test now:** navigate to `/sign-in` in the browser preview. Real session-restore + routing decision (where to send a returning user vs new) is P10-3.
- **Next:** **P10-2** — PKCE + Google OAuth deep-link handler. New `app/(auth)/auth-callback.js` route at `sift://auth-callback` that catches the OAuth redirect and exchanges the code with Supabase, then routes to /today (or /welcome if profile is new). Wire the sign-in Google button to fire the real `signInWithOAuth` flow.

## 2026-05-22 · tick 64 · P9-5 · First-ticker setup — Phase 9 complete

- **Did:** new push-screen at `/first-tickers` — multi-select for the 5 suggested large-caps (AAPL, MSFT, NVDA, GOOG, AMZN, sourced from `ticker-catalog` via `getCompanyName`). Card-padding-0 list of rows; each row is a Pressable with ticker (headlineMono) + name (footnote) on the left, and a 22pt circular tick on the right that fills with `accent.default` + Check glyph when selected. Tap toggles via a `Set` in state.
- **CTA polish:** the bottom button label is **adaptive** — `"Skip for now"` (secondary variant) when zero selected, `"Add N ticker[s]"` (primary variant) when one or more. Singular/plural correct. No separate Skip link needed — one button covers both intents which keeps the screen calm.
- **Wiring:** notifications screen's `finish()` now `router.push('/first-tickers')` instead of `replace('/today')`. First-tickers `router.replace('/today')` on finish (with `haptics.success()` if any selections, `haptics.tap()` otherwise). P10-3 will record the seed selections to `profiles.watchlist` server-side at this confirm step.
- **Files:** `src/features/onboarding/first-tickers-screen.js` (new); `app/(onboarding)/first-tickers.js` (route, new); modified `src/features/onboarding/notifications-screen.js` (finish → /first-tickers).
- **Verified:** Metro bundle with `--clear` on port 8155 — HTTP 200, 3562 modules in 5001ms, no errors. New symbols (FirstTickersScreen, SUGGESTED) appear 10× in compiled output. Onboarding folder now has 6 files: `_layout / welcome / how-sift-works / ack / notifications / first-tickers`.
- **Phase 9 complete.** Full onboarding sequence: welcome (3-slide carousel) → how-sift-works (4-bullet explainer) → ack (scroll-to-enable + 2 checkboxes) → notifications (primer + OS prompt) → first-tickers (5-row multi-select) → /today. All five P9 items shipped over ticks 60–64. Skip path on welcome exits directly to `/today`; each subsequent step has either a Skip link or an adaptive CTA that defaults to skip.
- **Learnings:** none new — multi-select Set state + adaptive CTA are well-trodden patterns. Worth noting: the single-button adaptive label (secondary skip ↔ primary add) feels cleaner than the dual-button "Continue + Skip" pattern used on earlier onboarding screens (welcome, how-sift-works) — could retrofit those for consistency in a polish pass.
- **Carried Phase 11 idea:** P11-9 — retrofit welcome + how-sift-works to use the adaptive single-CTA pattern from first-tickers (cleaner, less chrome).
- **Next:** **P10-1** — sign-in / sign-up screens (email/password + Google OAuth). Opens Phase 10 (Auth flow), the final functional phase before polish passes.

## 2026-05-22 · tick 63 · P9-4 · Notification permissions primer (+ expo-notifications install)

- **Did:** new push-screen at `/notifications` — primer that explains *what* Sift will send before the OS dialog fires. displaySm heading + lede + three icon-bulleted points (Three kinds of pushes / Throttled hard / Quiet hours respected) + a footnote that everything is changeable in Settings. Bottom controls: primary "Allow notifications" button + ghost-styled "Maybe later" link. Primary button shows `loading` state while the OS dialog is open; on response (allow or deny) → `haptics.success()` on grant, `haptics.tap()` otherwise → route forward. Skip routes forward without firing the OS prompt.
- **expo-notifications install — justification per CLAUDE.md no-deps rule:** notifications are *the* product mechanism — every push (pre-call briefing, 8-K detection, transcript highlight) flows through this surface. `expo-notifications@~0.32.17` is the only first-party way to request iOS/Android permissions and obtain push tokens in an Expo-managed app. Listed in CLAUDE.md "What's next" item 4. Added to `app.json` plugins list (`"expo-notifications"`); full native wiring requires `expo prebuild` which is a Phase 10 concern.
- **Expo Go caveat:** since SDK 53, expo-notifications removed remote-push support from Expo Go but local-notification permission APIs still work. The primer's `requestPermissionsAsync()` call is wrapped in try/catch so it gracefully no-ops if the API throws in any environment; real OS-dialog testing requires a dev build (post-prebuild).
- **Sequence wiring:** ack's Continue now pushes to `/notifications` (was `/today`). Notifications screen's allow/skip both `router.replace('/today')` for now — P9-5 will replace with a push to `/first-tickers`.
- **Files:** `src/features/onboarding/notifications-screen.js` (new); `app/(onboarding)/notifications.js` (route re-export, new); modified `src/features/onboarding/ack-screen.js` (Continue → /notifications), `app.json` (plugin), `package.json` (dep).
- **Verified:** Metro bundle with `--clear` on port 8154 — HTTP 200, 3560 modules in 5898ms, no errors. Module count jumped from 3426 (tick 62) to 3560 — the +134 is expo-notifications + transitives; bundle size up ~350KB. New symbols (NotificationsScreen, requestPermissionsAsync, expo-notifications) appear 44× in compiled output. Onboarding folder now has 5 files: `_layout / welcome / how-sift-works / ack / notifications`.
- **Learnings:** none new — permission-request UX pattern (primer before OS dialog) is well-established. Note for the next ticks: `expo install` warns about 16 moderate-severity vulns in transitive deps; not blocking, addressed when we run `npm audit` cleanup later.
- **Next:** **P9-5** — first-ticker setup. Suggested watchlist (AAPL/MSFT/NVDA/GOOG/AMZN) with multi-select; skip option. Closes Phase 9 onboarding flow. After P9-5, Phase 10 (Auth) opens.

## 2026-05-22 · tick 62 · P9-3 · Mandatory ack screen (scroll-to-enable + 2 checkboxes)

- **Did:** new push-screen at `/ack`. Apple Health Studies pattern: heading + lede above a bordered scrollable disclaimer block (lede + 5 LegalSections + reviewed-on footnote + visible scroll indicator), then a footer with a scroll-status hint, two checkboxes, and a gated Continue button.
- **Gating logic:** Continue is disabled until **three** conditions all true: `scrolled` (user reached within 20pt of `contentSize.height`), `educationalAck` checkbox, and `termsAck` checkbox. Both checkboxes are `disabled` until `scrolled` is true — communicates the order ("read first, then acknowledge"). Scroll hint flips from `signal.warning` ("Scroll to the end to enable the boxes") to `signal.positive` ("✓ Scrolled to the end") as a positive reinforcement.
- **Compliance content:** five LegalSections cover what you're agreeing to / what Sift will and will not do / predictions disclaimer / jurisdiction + data / changes-to-this-ack. All approved language only (`statistical`, `educational research`); zero forbidden words.
- **`<Checkbox>` primitive:** new `src/components/checkbox.js`. 22pt square with 1pt `border.strong` outline (filled to `accent.default` when checked), Check glyph in `accent.on`, baseline-aligned label. Supports `disabled` state. `accessibilityRole="checkbox"` + `accessibilityState.checked`. `haptics.select()` on toggle.
- **Wiring:** how-sift-works's Continue now `router.push('/ack')` (replacing the prior route-to-/today). On confirm, ack screen `router.replace('/today')` with a `haptics.success()` — P10-3 will record `disclaimer_ack_at` server-side at this point.
- **Files:** `src/components/checkbox.js` (new); `src/features/onboarding/ack-screen.js` (new); `app/(onboarding)/ack.js` (route re-export, new); modified `src/features/onboarding/how-sift-works-screen.js` (Continue → /ack).
- **Verified:** Metro bundle with `--clear` on port 8153 — HTTP 200, 3426 modules in 5055ms, no errors. New symbols (AckScreen, Checkbox, SCROLL_END_THRESHOLD) appear 12× in compiled output. Onboarding folder now has 4 files: `_layout`, `welcome`, `how-sift-works`, `ack`.
- **Learnings:** none new — scroll-to-end detection is a well-established RN pattern (`contentOffset + layoutMeasurement >= contentSize - threshold`); the 20pt threshold absorbs iOS bounce overshoot.
- **Onboarding sequence so far:** welcome → how-sift-works → ack → /today. P9-4 (notification permissions primer) and P9-5 (first-ticker setup) will slot between ack and /today eventually — needs IA decision on whether they're pre- or post-ack.
- **Next:** **P9-4** — notification permissions primer + system prompt. Educational pre-prompt screen ("here's what we'll send, here's how to control it") + button that triggers the OS permission dialog via `expo-notifications`. Requires the `expo-notifications` install — currently not in `package.json`, so this tick will need to install it and document the dep-add in the changelog per the no-deps-without-justification rule.

## 2026-05-22 · tick 61 · P9-2 · "How Sift works" 4-bullet explainer

- **Did:** new push-screen at `/how-sift-works` inside the `(onboarding)` route group. Single dense scrollable page — Skip in top right, displaySm heading + one-line lede, four icon-bulleted explainers, sticky Continue button at the bottom. Each bullet is icon-in-accent-muted-circle + headline-weight title + body paragraph. Content sourced from architecture docs:
  1. **Filings come from SEC EDGAR.** — 15s polling, parse on arrival, push target.
  2. **Briefings are LLM-generated.** — Claude with structured output, forbidden-word filter gate.
  3. **Predictions are statistical, not personal.** — calibrated model output, what "65%" means, not personalised.
  4. **What Sift isn't.** — not a broker / adviser / trading platform; doesn't know your positions or goals.
- **P9-1 wire-up:** Welcome's Get-started + Next-on-last-slide now `router.push('/how-sift-works')` instead of `replace('/today')`. The new `advance()` helper consolidates the "go to next onboarding step" path. Skip on welcome still replaces to `/today` (skip exits onboarding entirely). On how-sift-works, both Skip and Continue currently route to `/today` — P9-3 will replace Continue with the ack route.
- **Files:** `src/features/onboarding/how-sift-works-screen.js` (new); `app/(onboarding)/how-sift-works.js` (route re-export, new); modified `src/features/onboarding/welcome-screen.js` (added `advance()`).
- **Verified:** Metro bundle with `--clear` on port 8152 — HTTP 200, 3423 modules in 5074ms, no errors. New symbols (`HowSiftWorksScreen`, `BULLETS`, `ShieldAlert` icon) appear 20× in compiled output. Real routes (`_layout`, `welcome`, `how-sift-works`) all registered; the `ack` grep hit is from a code comment about P9-3's future destination.
- **Compliance copy gate:** all four bullets use approved language — "statistical", "calibrated", "educational research" — no "advice"/"recommend"/"should"/"will move". The forbidden-word filter mentioned in bullet 2 is real architecture (`compliance.md` § LLM output).
- **Learnings:** none new — same pattern as Phase 7 push-screens. Slight observation worth noting if it recurs: comment text leaks into the bundle and shows up under grep for route paths. False positive when verifying route registration; check the actual file exists before assuming a registration.
- **Next:** **P9-3** — mandatory legal acknowledgement screen. Scroll-to-enable button (Apple Health Studies pattern), two checkboxes ("I understand Sift is educational" + "I agree to Terms & Privacy"). Largest P9 item — needs scroll-end detection, two interactive checkboxes, disabled-button until both ack'd + scrolled, and replaces how-sift-works's Continue destination.

## 2026-05-22 · tick 60 · P9-1 · Welcome carousel + (onboarding) route group

- **Did:** new `(onboarding)` route group at `app/(onboarding)/` parallel to `(app)/`. Headerless Stack layout with `slide_from_right` push animation. First screen is `welcome.js` re-exporting the welcome carousel.
- **Carousel:** horizontal paging `<ScrollView>` (3 slides, `pagingEnabled`, `useWindowDimensions` for slide width). Each slide is a centered hero with a lucide icon (BarChart3 / Sparkles / BellOff) in an `accent.muted` circle, `displaySm` title, `body` description. Slides:
  1. **Earnings, structured.** — briefings before the call, parsed numbers on filing, plain-English surprises.
  2. **Predictions, calibrated.** — beat probabilities from 12-quarter priors, neutral colour, "what they mean and what they do not."
  3. **Quiet by default.** — 3 pushes per ticker per day max, quiet hours batch the rest.
  Copy is factual + descriptive — no `buy` / `should` / `recommend` (compliance per `compliance.md` § Forbidden words).
- **Chrome:** top bar with right-aligned `Skip` (accent.default text, `router.replace('/today')`). Bottom bar with `<PageDots>` (new primitive: row of 3 dots, active is 18×6 pill in `accent.default`, others 6×6 muted) + a primary Button. Button label flips from "Next" (advances pager via `scrollRef.current.scrollTo`) to "Get started" on the last slide (which also calls `finish()` → `/today`).
- **Finish behaviour:** `router.replace('/today')` — uses `replace` not `push` so onboarding doesn't sit in the back stack. P9-2 will replace this with a push to `(onboarding)/how-sift-works`.
- **Files:** `src/components/page-dots.js` (new); `src/features/onboarding/welcome-screen.js` (new); `app/(onboarding)/{_layout,welcome}.js` (route group + screen, new).
- **Verified:** Metro bundle with `--clear` on port 8151 (new route group → cache footgun per learnings tick 12). HTTP 200, 3421 modules in 5263ms, no errors. Welcome route registered (`(onboarding)/_layout` and `(onboarding)/welcome` both present in compiled bundle); new symbols (`WelcomeScreen`, `PageDots`, `OnboardingLayout`) appear 11× in compiled output.
- **How to test now (no auth flow yet):** navigate to `/welcome` in the browser preview or via `router.push('/welcome')`. Real session-restore integration (which decides whether to route a new user into `(onboarding)` vs `(app)`) lands in P10-3.
- **Learnings:** none new — route-group cache footgun pattern re-confirmed; carousel pattern (horizontal ScrollView + pagingEnabled + onMomentumScrollEnd) is the canonical RN approach and didn't need a new dep.
- **Next:** **P9-2** — "How Sift works" — 4 bullets explaining data sources + what predictions are/aren't. Same `(onboarding)` group; could either be a dense single screen or a second carousel. Single dense screen with 4 bullet rows is more honest about being explanatory (not aspirational marketing).

## 2026-05-22 · tick 59 · P7-5 · Subscription placeholder — Phase 7 complete

- **Did:** new PLAN group in Settings between ACCOUNT and NOTIFICATIONS — single row `Plan` value=`Free` with Sparkles icon; tap opens a coming-soon sheet. Group footer reads "Subscription tiers will be available before public launch." New `src/features/settings/subscription-sheet.js` (gorhom AppSheet 42% snap): title + two-paragraph explanation of what the free tier keeps and what the paid tier will add (deeper history, more concurrent tickers, earlier model predictions) + Got-it Button. Communicates intent without faking subscription state — every user is "Free" today until RevenueCat lands in Phase 12.
- **Files:** `src/features/settings/subscription-sheet.js` (new); modified `src/features/settings/settings-screen.js`.
- **Verified:** Metro bundle on port 8150 — HTTP 200, 3232 modules in 888ms, no errors. New symbols (SubscriptionSheet, Sparkles icon) appear 31× in compiled output.
- **Phase 7 complete.** All five items shipped: P7-1 (sign-out confirm sheet), P7-2 (notification toggles + quiet hours preset), P7-3 (Privacy + Terms screens), P7-4 (full disclaimer), P7-5 (subscription stub). Settings now has five SettingsGroups: ACCOUNT / PLAN / NOTIFICATIONS / ABOUT / [persistent disclaimer footer]. Five action sheets across Phase 7: QuietHours, SignOut, Subscription (plus pre-existing SortSelector and AddTickerSheet, and Methodology on ticker detail).
- **Phase 8 mark-obsolete:** Phase 8 (Learn — single placeholder for an eventual 5th tab) was authored before Phase R replaced the IA. Discover now occupies the third tab; there's no "Learn" tab to populate. Marking P8-1 as obsolete in iteration-plan rather than building a noop screen. If in-app educational content (explainers, model cards) is wanted later, it should be authored as a fresh phase tied to a real product decision, not P8-1.
- **Learnings:** none new — sheet pattern is fully canonical now.
- **Next:** **P9-1** — Welcome carousel (3 cards, skippable, value prop). First post-Phase-7 build; opens Phase 9 (Onboarding). Possible primitive: a horizontal-pager primitive with dots, or simpler: a 3-screen Stack inside an (onboarding) group.

## 2026-05-22 · tick 58 · P7-3 · Privacy + Terms screens + LegalSection primitive

- **Did:** two new push-screens under `/settings/privacy` and `/settings/terms`, both following the disclaimer pattern (Stack push + sectioned scroll). Each carries a **DRAFT — pre-launch review pending** pill at the top in `signal.warning` (left-border accent + amber-tinted bg) so it's visually unambiguous that this is placeholder copy, not the final published document. Content sketches the eventual structure: Privacy covers `WHAT WE COLLECT / WHAT WE DO NOT COLLECT / HOW WE USE IT / WHERE IT LIVES / YOUR RIGHTS / THIRD PARTIES / CHANGES / LAST UPDATED`. Terms covers `THE SERVICE / YOUR ACCOUNT / ACCEPTABLE USE / FEES / LIABILITY / TERMINATION / GOVERNING LAW / CHANGES / LAST UPDATED`. Final language goes through solicitor review pre-launch per `compliance.md`.
- **Rule of three:** with three legal-style screens (disclaimer + privacy + terms) sharing the same eyebrow + body section block, hoisted the local `Section` helper from `disclaimer-screen.js` into a new `src/components/legal-section.js` (`<LegalSection title body>`). Disclaimer refactored to consume it; both new screens use it from the start.
- **Wiring:** Settings ABOUT rows for Privacy + Terms now `router.push` to their routes. No more `onPress={noop}` in the ABOUT group except the static Version row.
- **Files:** `src/components/legal-section.js` (new); `src/features/settings/{privacy-screen,terms-screen}.js` (new); `app/(app)/settings/{privacy,terms}.js` (route re-exports, new); modified `src/features/settings/{disclaimer-screen,settings-screen}.js`.
- **Verified:** Metro bundle with `--clear` on port 8149 — HTTP 200, 3416 modules in 4899ms, no errors. New symbols (Privacy/Terms screens + LegalSection) appear 39× in compiled output. Route map confirms `/settings/disclaimer`, `/settings/privacy`, `/settings/terms` all registered.
- **Learnings:** none new — the DRAFT-pill pattern is reusable and lightweight; if/when a fourth pre-launch placeholder document appears (attribution, COPPA notice, etc.), the same shape applies.
- **Carried subitem for Phase 11:** add an "Attribution / Open source" row to the ABOUT group with a screen listing third-party deps + licenses. P7-3's original spec mentioned attribution; deferred to keep this tick scoped (real attribution lists are best generated from package.json automatically — that pipeline can land later).
- **Next:** **P7-5** — Subscription placeholder (RevenueCat ships later in Phase 12 per SETUP.md). For now, an inert "Subscription" row in ABOUT or a new GROUP that shows current plan ("Free" stub) with a "coming soon" sheet on tap. Smallest remaining P7 item. After P7-5, Phase 7 closes and we resume at Phase 8.

## 2026-05-22 · tick 57 · P7-1 · Sign-out confirmation sheet

- **Did:** added destructive-action friction for the ACCOUNT → Sign out row. New `src/features/settings/sign-out-sheet.js` — gorhom BottomSheet (38% snap) with title "Sign out?", explanation that watchlist/prefs are saved to the account, and two stacked buttons: a `destructive` Sign out (signal.negative bg, accent.on text) and a `ghost` Cancel. Confirm fires `haptics.warning()` then the consumer's stub (real sign-out wires in Phase 10 with the auth flow). Email row stays read-only — also Phase 10's territory.
- **`<Button>` extension:** new `destructive` variant (signal.negative container + accent.on text). Reusable beyond sign-out — delete account, remove watchlist, anywhere we need destructive-CTA primary affordance. Matches the existing `primary`/`secondary`/`ghost` shape; no other component changes.
- **Files:** `src/components/button.js` (extended), `src/features/settings/sign-out-sheet.js` (new), `src/features/settings/settings-screen.js` (wired sheet + handler).
- **Verified:** Metro bundle on port 8148 — HTTP 200, 3347 modules in 940ms, no errors. New symbols (`SignOutSheet`, `sign-out-sheet`, destructive variant) appear 5× in compiled output.
- **Learnings:** none new — bottom-sheet confirm pattern is standard (3rd in this style after `SortSelector` tick 49 and `QuietHoursSheet` tick 56). One thing worth flagging for future: when a third action-sheet pops up, consider whether they should converge into a single `<ActionSheet>` primitive rather than three near-identical implementations. Not yet — wait for the fourth.
- **Next:** **P7-3** — About: replace Privacy policy / Terms of service noops with stub navigation. Two routes (likely re-using the same pattern as `/settings/disclaimer`). Version row already shows static "0.1.0" — fine for MVP. Small tick.

## 2026-05-22 · tick 56 · P7-2 · Notifications group — toggles + quiet hours picker

- **Did:** wired real interactions for the NOTIFICATIONS group in Settings.
  - **Three Switch toggles** for `briefings` / `8-K alerts` / `transcripts`. Stateful via `useState` (mocked — `useState` placeholders for the eventual Supabase profile fields). Switch styled with `colors.accent.default` for the "on" track to match the accent system; `colors.bg.elevated` for the "off" track; `text.primary` thumb. `haptics.select()` fires on every toggle change via a shared `toggle(setter)` helper.
  - **Quiet hours picker** — new `src/features/settings/quiet-hours-sheet.js` with five presets (`Off` / `22:00 – 07:00` / `23:00 – 08:00` / `21:00 – 07:00` / `20:00 – 09:00`). Bottom-sheet pattern mirrors `SortSelector` (tick 49). Picker explanation: "During quiet hours, briefings and alerts are batched and delivered the next morning." Pick → `haptics.select()` + update state + close sheet. Presets shipped now; custom-range time picker is post-MVP polish — no time-picker dep added.
- **Component extension:** `<SettingsRow>` gained an optional `trailing` prop. When provided, it replaces the value-text + chevron block (used by the three notification rows to host the Switch). Existing `value`/`onPress` semantics unchanged for non-trailing usage.
- **Files:** `src/components/settings-row.js` (extended), `src/features/settings/{settings-screen,quiet-hours-sheet}.js` (rewritten / new).
- **Verified:** Metro bundle on port 8147 — HTTP 200, 3225 modules in 952ms, no errors. New symbols (`QuietHoursSheet`, `QUIET_HOURS_PRESETS`, `presetLabel`, `NotificationSwitch`, `quiet-hours-sheet`) appear 18× in compiled output.
- **Compliance reminder:** the throttling copy ("Pushes are throttled to a maximum of three per ticker per day.") aligns with the realtime budget per `docs/architecture/realtime-and-push.md`; the actual throttling lives server-side when Modal/Edge functions ship. The Settings copy describes the contract.
- **Learnings:** none new — preset-bottom-sheet pattern is the same as `SortSelector` from tick 49; only the option list and copy changed.
- **Next:** **P7-1** — Account section interactions: replace `Sign out` noop with a confirmation sheet (destructive action — needs friction); the `Email` row stays read-only until auth flow lands (Phase 10). Small tick.

## 2026-05-22 · tick 55 · P7-4 · Full disclaimer screen

- **Did:** new push-screen at `/settings/disclaimer` reached by tapping the "Disclaimer" row in Settings → ABOUT. Content is the canonical disclaimer text from `docs/architecture/compliance.md` § The disclaimer, broken into seven readable sections (lede + WHAT SIFT DOES / WHAT SIFT DOES NOT DO / PREDICTIONS AND PROBABILITIES / PAST PERFORMANCE / DATA SOURCES / JURISDICTION / LAST UPDATED). Sections use `text.micro` letter-spaced eyebrows + `text.body` paragraphs in `text.secondary`. The lede paragraph is `text.primary` for emphasis.
- **Wiring:** `useRouter().push('/settings/disclaimer')` on the ABOUT row's `onPress`. Inline `<DisclaimerFooter variant="long" />` at the bottom of Settings swapped to the short variant — the full text is now reachable behind the row, and the short footer continues to satisfy the persistent-footer compliance rule.
- **Files:** `src/features/settings/disclaimer-screen.js` (new), `app/(app)/settings/disclaimer.js` (route re-export, new); modified `src/features/settings/settings-screen.js`.
- **Verified:** Metro bundle with `--clear` on port 8146 (new route → cache safety per learnings tick 12). HTTP 200, 3409 modules in 4959ms, no errors. Disclaimer symbols appear 9× in compiled output. Stack header configured `headerLargeTitle: false` since this is a push, not a tab root.
- **Compliance text source-of-truth:** the screen explicitly notes its source (`compliance.md`) in a top-of-file comment so future refreshes keep both in sync (compliance.md says "Refresh annually").
- **Learnings:** none new — standard push-screen pattern; route-cache footgun re-confirmed (same pattern as R7's Discover route).
- **Next:** P7-1, P7-2, P7-3 — Account section (email + sign out stub already there), Notifications (toggles + quiet hours picker), About (version + attribution + T&C link). Per the Bug log entry from tick 24, much of this is already roughed in — these ticks will replace the stub `onPress={noop}` handlers with real interactions. Pick P7-2 next (highest-impact: notification preferences are a top user concern for an alert-driven product).

## 2026-05-22 · tick 54 · R10 · Phase R close-out (documentation)

- **Did:** doc-only tick to close Phase R.
  - **`palette.md`** — replaced the stale "Component implications (preview)" section (which described pre-Phase-R Home with "TODAY" section labels and green beat-probability arrows) with a new "Component implications — current (post-Phase R)" section: timeline IA intro, `<DayHeader>` shape table, `<EventTimelineCard>` three-state table (`upcoming` / `live` / `past`), live-ribbon colour decision (accent.default, not signal.negative — with reasoning), outcome-arrow table, prediction-display rules (compliance-mandatory), briefing-ready badge variants (tappable CTA vs informational), sparkline tint rule.
  - **`learnings.md`** — added a Phase R summary entry with four durable patterns: (1) date is the structural anchor for time-based lists, (2) one component multi-state for variant content of the same kind, (3) compliance copy is a primitive-layer constraint, (4) live state colour ≠ P&L colour.
  - **`iteration-plan.md`** — FOCUS cleared (replaced with a one-line summary noting Phase R closed and the four critiques addressed); R10 box checked; STATUS rewritten to point at **P7-4** as the next pick.
- **Acceptance criteria check (manual sweep against `redesign-2026-05-22.md` § Acceptance):**
  - ✅ No orphan `'in 2h'` / `'tomorrow'` / `'wed'` strings anywhere outside mocks, helpers, or tab titles.
  - ✅ Ticker detail has zero "UP NEXT" / "PAST BRIEFINGS" / "PAST EVENTS" / "TRANSCRIPTS" section labels — replaced by DayHeader-led timeline.
  - ✅ Tab bar order: `today` · `watchlist` · `discover` · `settings`; `events` retained as `href: null` for the `[event_id]` detail route.
  - ✅ Today and Watchlist render visibly different primary units (event-first day-grouped cards vs ticker-first sortable rows).
  - ✅ Metro bundler boots clean (last run tick 53: 3407 modules / 1008ms / no errors).
- **Phase R is closed.** Six ticks of build (R1–R8), one consistency sweep (R9), one doc close (R10). All four user critiques addressed at structural level. Carried sub-items: P11-7 (aspirational glyphs), P11-8 (no-selected-tab artifact on `/events/<id>`).
- **Files:** `docs/design/{palette,learnings,iteration-plan}.md`.
- **Verified:** doc-only tick — no code changes; `git status` confirms only docs/* modified beyond pre-existing untracked. Acceptance sweep above passes.
- **Learnings:** the Phase R summary IS the learnings update (one consolidated entry).
- **Next:** **P7-4** — full-disclaimer screen/sheet behind the Settings "Disclaimer" row. Resume Phase 7 backlog (P7-1, P7-2, P7-3, P7-5 also outstanding).

## 2026-05-22 · tick 53 · R9 · Cross-screen consistency pass

- **Sweep results:**
  - ✅ **No orphan `'in 2h'` / `'tomorrow'` / `'wed'` user-facing strings remain.** Every hit was in `dates.js` (the helper itself) or `_layout.js` tab titles ("Today" — correct copy, not a derived date).
  - ✅ **No consumer reads `.when` anymore** — R4 dropped Home's usage, R6 dropped ticker detail's usage. The strings stay in mocks for safety until the schema lands, but render-side they're dead code.
  - ⚠ **One real drift found and fixed:** on the ticker detail timeline, `<BriefingCard>` and `<TranscriptCard>` internally rendered their own `date` string under the title, duplicating the `<DayHeader>` rendered above each card. Fixed by adding an opt-out `showDate` prop (defaults `true`); ticker detail passes `showDate={false}`. The mocks keep the `date` field so non-ticker-detail consumers — none today, but possible later — still see the date.
  - ✅ **One orphan file deleted:** `src/features/ticker/past-event-row.js`. Zero callers since R6 swapped it out for `<EventTimelineCard>`.
  - ✅ **Glyph audit:** outcome arrows (▲ ▼ ━) used consistently across EventTimelineCard, Discover, event detail, metric-tile. Live `◐` + past `✓` ribbons used only in EventTimelineCard. The brief's ⏰ / 📄 / 💬 on upcoming / briefing / transcript cards were aspirational and weren't shipped — current visual identity (time anchor on upcoming, type-carrying title on briefing/transcript) works without them. Queued as a Phase 11 polish item.
- **R8a queued, not fixed.** The "no selected tab on /events/<id>" artifact requires duplicating the detail route under each originating tab (`today/events/[event_id].js`, `watchlist/events/[event_id].js`, both re-exporting from the same source) and updating callers. Too invasive for an R9 sweep — deferred to Phase 11. Behavior is functionally correct; the visual is the only artifact.
- **Files:** deleted `src/features/ticker/past-event-row.js`; modified `src/components/briefing-card.js`, `src/features/ticker/transcript-card.js`, `src/features/ticker/ticker-screen.js`.
- **Verified:** Metro bundle on port 8145 — HTTP 200, 3407 modules in 1008ms, no errors. `past-event-row` / `PastEventRow` absent (0 refs); `showDate` present (8 refs).
- **Learnings:** none new — drift was small and the fix is a routine opt-out prop pattern.
- **Next:** R10 — close out Phase R (update palette.md + learnings.md with Phase R conventions, clear FOCUS, hand off STATUS to Phase 7's P7-4 disclaimer screen).

## 2026-05-22 · tick 52 · R8 · Tab bar swap + Events deletion

- **Did:**
  - **Tab bar swap.** `app/(app)/_layout.js` — `events` Tabs.Screen replaced with `discover` (Compass icon, lucide, stroke 1.75). Tab order is now Today · Watchlist · Discover · Settings — matching the redesign brief. The `events` Tabs.Screen is kept as a registered route entry with `href: null` so the events folder's `[event_id]` route still resolves but doesn't appear in the tab bar.
  - **Deletions** (4 files): `app/(app)/events/_layout.js` (replaced with a smaller detail-only Stack), `app/(app)/events/index.js`, `src/features/events/events-screen.js`, `src/features/events/mock.js`. Plus 2 orphan components: `src/components/earnings-card.js`, `src/components/event-card.js` (zero remaining callers — confirmed via grep across `src/` and `app/`). Empty `src/features/events/` directory removed.
  - **Detail-route layout rewritten.** New `app/(app)/events/_layout.js` is a Stack-only layout (no `Tabs.Screen` ties, no index screen) — provides header chrome (back chevron, blur) for `[event_id]` reached from Today and ticker detail. Without this, the dynamic route would fall through to the parent Tabs layout and render without a header.
- **Files:** `app/(app)/_layout.js` (modified); `app/(app)/events/_layout.js` (rewritten); 4 + 2 deletions as listed.
- **Verified:** Metro bundle with `--clear` on port 8143 — HTTP 200, 3407 modules in 5040ms, no errors. Grep-confirmed: deleted symbols absent (EarningsCard 0, events-screen 0, events/mock 0); Discover + Compass present (29 refs); event detail still bundled (10 refs to `features/event/`); route map includes `/events/[event_id]` and `/events/_layout.js`. Both consumers of the detail route — Today's `openEvent` and ticker detail's `openEvent` — still navigate to `/events/${id}`.
- **Carried subitem queued for R9:** with `events` removed as a tab AND `href: null`, the tab bar shows no selected tab when a user drills into `/events/<id>` from Today or ticker detail. Visual artifact, not broken behavior. Fix in R9 polish: ideally the event detail renders inside the originating tab's Stack (Today or Watchlist), preserving tab highlight. Likely requires duplicating the dynamic route under both tabs or rethinking the navigation graph.
- **Learnings:** one durable note — see `learnings.md` § "expo-router: detail-only folder needs `href: null` parent registration to keep the route reachable".
- **Next:** R9 — cross-screen consistency pass. Sweep Today, Watchlist, Discover, ticker detail, event detail; verify `dates.js` helpers used everywhere; no orphan `"in 2h"` strings; check the open subitem above. Fix top 2 issues; queue the rest.

## 2026-05-22 · tick 51 · R7 · Discover screen + mocks (new tab content)

- **Did:** new tab content for the Discover surface. Top: search row (mirrors the Events tick 44 chip style) reusing `searchCatalog(query)` from `ticker-catalog` — instant in-place results when the user types, results render as a `<Card padding={0}>` of pressable rows that route to `/watchlist/<symbol>`. Three discovery rails below: **MODEL — BIGGEST EXPECTED MOVES THIS WEEK** (model-prefixed predictions for cross-market upcoming reports, each row showing ticker · period · weekday/date/time · `Model beat X% · ±N% expected`), **REPORTING THIS WEEK BY SECTOR** (count of reporters per sector, no predictions), **BIGGEST RECENT SURPRISES — MARKET** (actuals only, `▲/▼ ±N.N% beat/miss` in signal colours). Footer carries a compliance line above the standard `<DisclaimerFooter>`.
- **Compliance copy gate cleared.** Per redesign brief § "Open uncertainties": predictions for non-watchlisted tickers nudge close to recommendation framing. Mitigations applied — (1) every predictive eyebrow leads with "MODEL", (2) every prediction value carries "Model" prefix + "expected" qualifier ("Model beat 71% · ±5.2% expected"), (3) zero occurrences of `advice` / `recommend` / `should` / `likely` / `will move` / `buy now` / `sell now` in the screen, (4) the Recent Surprises rail is actuals-only with no predictive verbs, (5) an explicit "Model predictions are educational. Sift does not provide investment advice." line sits above the standard disclaimer.
- **Route registration:** new `app/(app)/discover/_layout.js` (Stack matching Events/Watchlist pattern — large title iOS, blur, dark contentStyle) + `app/(app)/discover/index.js` (one-line re-export from `src/features/discover/discover-screen.js`). Tab bar swap is R8 territory — Discover isn't yet reachable from a tab, but the route compiles and is navigable via deep link.
- **Files:** `src/features/discover/{discover-screen,mock}.js` (new); `app/(app)/discover/{_layout,index}.js` (new).
- **Verified:** Metro bundle on port 8142 with `--clear` (per learnings tick 12 — new route folders can trip the route-group cache footgun even when inside an existing group). HTTP 200, 3412 modules in 5161ms (cache rebuild), no errors. Discover-related symbols appear 20× in compiled output.
- **Learnings:** none new — Discover screen used existing patterns end-to-end (`<Card padding={0}>` with hairline rows, `searchCatalog`, `formatDayHeader`, `formatEventTime`).
- **Next:** R8 — tab bar swap (Events → Discover, Compass icon) + delete `events/{_layout,index}.js`, `src/features/events/{events-screen,mock}.js`. Event detail route at `events/[event_id].js` must survive. Delete `<EarningsCard>` / `<EventCard>` if no remaining callers.

## 2026-05-22 · tick 50 · R6 · Ticker detail timeline rewrite (closes R1a)

- **Did:** rewrote the ticker detail screen as a single chronological spine. Hero is now tighter — symbol (displayLgMono) + one-line `name · sector` + sparkline with `±N.N% 30d` change label derived from the series. A hairline divider separates the hero from the timeline. Below the divider, `buildTimeline(t)` merges `nextEarnings` + `pastEvents` + `pastBriefings` + `transcripts` into one stream; `groupByDay` from `dates.js` buckets per local day (future ascending → past descending — today pivots); each group renders a `<DayHeader>` plus the appropriate card per item kind (`earnings-upcoming` / `earnings-past` / `briefing` / `transcript`). Section labels (`UP NEXT` / `PAST BRIEFINGS` / `PAST EVENTS` / `TRANSCRIPTS`) gone — the date eyebrows do the structural work.
- **Component extension:** `<EventTimelineCard>` gained a `hideIdentity` prop. When true, the ticker+name identity row is suppressed and the verb line promotes to `text.headline` weight (instead of muted subhead) — this gives the verb the "what happened" prominence the brief calls for on ticker detail, where the ticker is already implied by the screen title.
- **CTA fix on the upcoming card:** previously the "Briefing ready" row was always a `<Pressable>` even when no `onBriefingPress` handler was wired, leading to taps that no-op. New behavior — render as an informational badge (View, no arrow, non-tappable) when no handler is passed; full CTA (Pressable + arrow + opacity press feedback) when a handler exists. Ticker detail consumes the badge form (no briefing-detail route exists yet); Home keeps the full CTA.
- **R1a closed:** added `publishedAt` to every entry in `pastBriefings` (e.g. `'2026-02-01T09:00:00'`) and `recordedAt` to every transcript (e.g. `'2025-11-01T17:00:00'`). Existing `date` display strings preserved verbatim.
- **Files:** `src/features/ticker/{ticker-screen,mock}.js`; `src/components/event-timeline-card.js`.
- **Verified:** Metro bundle on port 8141 — HTTP 200, 3408 modules in 948ms, no errors. New helpers (`buildTimeline`, `hideIdentity`, `publishedAt`, `recordedAt`, `percentChange`) appear 18× in compiled output.
- **Learnings:** none new — patterns from R4 (groupByDay + DayHeader on a screen) and R3 (Metro bundle verification) carried over cleanly. The one design call worth flagging — informational-vs-tappable CTA branching — is small enough not to merit a learnings entry.
- **Next:** R7 — Discover screen + mocks (search + this-week's-biggest-expected + sector heat + recent biggest surprises). Compliance copy gate per redesign brief § open uncertainties.

## 2026-05-22 · tick 49 · R5 · Watchlist row redesign + `<SortSelector>` (closes B16)

- **Did:**
  - **`<WatchlistRow>` redesign per redesign brief.** Two-line layout: top line is `SYMBOL  ╱╲╱╮  Q1 26  Nd` (mono ticker + sparkline + period + countdown), bottom line is `name + optional ● ready badge`. Sparkline is now muted to `text.secondary` by default — closes **B16** (the trend-tinted colour was implying a 30d direction we hadn't computed). `trend` prop preserved on the data shape so future real-data ticks can re-tint with intent. Briefing-ready is now a labelled badge (`● ready`) under the name rather than a corner dot — easier to scan as content.
  - **`<SortSelector>` primitive** — `src/components/sort-selector.js`. Pressable showing `Sort: Next earnings ⌄`, tap opens an `<AppSheet>` (35% snap) listing options with the selected one marked by `Check` icon in `accent.default`. Generic — accepts `options`, `value`, `onChange`, `prefix`. Haptics: `tap()` on open, `select()` on pick.
  - **Watchlist screen rewrite.** Dropped the `groupByWeek` THIS WEEK / NEXT WEEK / LATER bucketing in favour of a single flat sortable `<Card>` of rows with hairline dividers. `applySort(items, key)` covers three modes: `date` (ascending by `daysAway`, default), `alpha` (symbol asc), `recent` (insertion order — newer items prepended via add-sheet are naturally first). `groupByWeek` export retained in `mock.js` but no longer called.
- **Files:** `src/components/sort-selector.js` (new); `src/features/watchlist/{watchlist-row,watchlist-screen}.js`.
- **Verified:** Metro bundle on port 8140 — HTTP 200, 3409 modules in 1012ms, no errors. New symbols (`SortSelector`, `WatchlistRow`, `applySort`) present 9× in compiled output. Caught a buried mid-file `import` statement before final boot and hoisted it to the top.
- **Carried:** none queued out of this tick.
- **Learnings:** none new — patterns are stable now (bottom-sheet picker mirrors AddTickerSheet; muted sparkline was a known polish move).
- **Next:** R6 — Ticker detail timeline rewrite. Largest R-tick (touches a multi-section screen, mixes events + briefings + transcripts into one chronological spine, also closes R1a — add `publishedAt`/`recordedAt` timestamps to those collections). May split into sub-items mid-flight.

## 2026-05-22 · tick 48 · R4 · Today screen rewrite

- **Did:** rewrote Home as a chronological day-grouped timeline. Section labels (`LIVE NOW / UPCOMING / RECENT`) gone — replaced by `<DayHeader>` per day group, with `<EventTimelineCard>` rendered for every event. Date is now the primary visual anchor on Home (closes critique 2). Tap routing: upcoming → ticker detail; live/past → event detail; briefing CTA wired to the same primary handler so the row isn't a noop.
- **Mock + hook reshape:** `home/mock.js` is now one flat `MOCK_HOME_EVENTS` array (state per item: `upcoming` | `live` | `past`), with `name` injected via `getCompanyName(symbol)` from the watchlist ticker-catalog. `useHomeData` returns `{ events, loading, refreshing, pending, refresh, promotePending }` — no more `{live, upcoming, recent}` buckets. Pending event (mock "AMD arrives in 5s") promotes to a single live event prepended to `events`.
- **R3a closed:** `getCompanyName(symbol)` added to `src/features/watchlist/ticker-catalog.js`; falls back to `${SYMBOL} Corp.` for unknown tickers.
- **R1b closed:** MSFT `expectedAt` moved from Sat 2026-05-23 → Mon 2026-05-25 (the prior date was derived from `when: 'tomorrow'` ignoring business days). Other home dates verified business-day-aligned.
- **Skeleton:** dropped the `UPCOMING` label from `HomeSkeleton`; replaced with a two-block `<Skeleton>` row that suggests a DayHeader. Card-shape mismatch with the new EventTimelineCard isn't worth resolving now — skeleton flashes for 800ms then is replaced. R9 polish pass can revisit.
- **Files:** `src/features/home/{home-screen,home-skeleton,mock,use-home-data}.js`, `src/features/watchlist/ticker-catalog.js`.
- **Verified:** two Metro force-bundles on ports 8138/8139 — HTTP 200 each, 3261 modules in 868ms on the final pass, no errors. Bundle module count dropped from 3346 → 3261, consistent with EarningsCard no longer being reachable (still on disk per R3 instruction; R8 will delete).
- **Learnings:** one new — see `learnings.md` § "groupByDay returns date-only ISO keys" on the `T12:00:00` suffix dance.
- **Next:** R5 — Watchlist row redesign + sort selector (drop `groupByWeek`, mute sparkline by default per B16, add `<SortSelector>` in screen header).

## 2026-05-22 · tick 47 · R3 · `<EventTimelineCard>` primitive

- **Did:** new `src/components/event-timeline-card.js` — one component, three states (`upcoming` | `live` | `past`) driven by the `state` prop. Composition: shared `<Card>` wrapper + state-specific header (time anchor / live ribbon / past stamp) + shared identity row (ticker + name) + verb line (`"Q1 26 earnings expected"` / `"results"` / `"reported"`) + hairline divider + state-specific body (upcoming = EPS est + beat-prob with `ⓘ`; live/past = EPS actual vs est + surprise line with arrow + qualifier) + optional past-only guidance pill + optional CTA row. Live ribbon uses `accent.default` per redesign brief (not `signal.negative` — that conflated "live" with "bad"). Surprise tints: `signal.positive`/`negative`/`neutral` mapped via `classify(surprisePct)`. Guidance pill maps `raised`/`maintained`/`lowered` → `positive`/`neutral`/`negative` `<Pill>` variants. Card-level press hands off to `onPress` (consumer routes to ticker or event detail). Comprehensive `accessibilityLabel` composed per state.
- **Also:** extended `src/lib/dates.js` with `formatRelativePast(iso, {now})` → `"just now" | "Nm ago" | "Nh ago" | "Nd ago" | absolute`. Required by the live header's "filed Nm ago" string. Reusable for any past-recent metadata elsewhere. Belongs in the helper module, not the component.
- **Files:** `src/components/event-timeline-card.js` (new); `src/lib/dates.js` (extended).
- **Verified:** probe-import in `home-screen.js`, forced Metro bundle on port 8137 → HTTP 200, 3408 modules in 932ms, `EventTimelineCard` appears 4× in compiled output, no errors. Probe reverted. Same verification pattern from tick 46 — confirmed reliable.
- **Learnings:** none new — pattern from R2 (Metro bundle + grep for export name) worked cleanly. The `formatRelativePast` shape is unremarkable.
- **Subitem queued for R4 (consumer concern, not primitive):** Home mocks currently lack `name` (only `ticker`). R4 needs to join against a ticker→name lookup (could lift `NAMES` from `src/features/ticker/mock.js` to a shared `ticker-catalog`-style module, or add `name` to home mocks directly). Decision in R4.
- **Next:** R4 — Today screen rewrite consuming R1–R3. Drop `LIVE NOW / UPCOMING / RECENT` section labels; flow events through `groupByDay` + `<DayHeader>` + `<EventTimelineCard>`. Keep sticky pill slot, pull-to-refresh, empty state. Adjust `use-home-data` if needed to surface a single sorted list.

## 2026-05-22 · tick 46 · R2 · `<DayHeader>` primitive

- **Did:** new `src/components/day-header.js` — pure presentational primitive consuming `formatDayHeader(iso, {now})` from `src/lib/dates.js`. Renders three baseline-aligned `<Text>` nodes (`relative · weekday absolute`) and elides the weekday on the right when the relative IS the weekday (so `WED · MAY 27` not `WED · WED MAY 27`, but `TODAY · FRI MAY 22` keeps the weekday). Typography per spec: `text.micro` letter-spaced for relative + dot, `text.subhead` for absolute, both `colors.text.tertiary`. `accessibilityRole="header"` so VoiceOver chunks it as a section break. Accepts an optional `now` so callers can render deterministic group headers in fixtures.
- **Files:** `src/components/day-header.js` (new).
- **Verified:** added a no-op probe import to `home-screen.js`, booted Metro `--no-dev --offline` on port 8136, requested `/node_modules/expo-router/entry.bundle?platform=ios` → HTTP 200, ~10.5MB bundle, `DayHeader` appears 11 times in the compiled output. JSX compiles cleanly. Reverted the probe.
- **Learnings:** one tiny note worth keeping — `node --check` on a `.js` file with JSX silently passes without actually validating the JSX (Node's parser doesn't understand it). The reliable parse check for an RN component is to make Metro bundle it via `curl http://localhost:PORT/node_modules/expo-router/entry.bundle?platform=ios&dev=false` and grep the bundle for the export name. Added to `learnings.md`.
- **Next:** R3 — `<EventTimelineCard>` primitive. Single component, three states (`upcoming` | `live` | `past`). Larger than R2; may split into sub-items mid-flight.

## 2026-05-22 · tick 45 · R1 · data shape + dates.js helpers

- **Did:** added `expectedAt` and `actualAt` (ISO8601, unmarked-local) to every event across the four mock files. Shipped `src/lib/dates.js` with `formatDayHeader(iso, {now})` → `{ relative, absolute, weekday, diff }`, `formatEventTime(iso)` → `"4:02 PM ET"`, `formatMarketAnchor(iso)` → `"Pre-market" | "After close" | null`, and `groupByDay(events, {now})` that buckets by local day, sorts items within a day ascending by time, and orders groups future-ascending → past-descending with today pivoting. Helpers take an optional `now` so they're deterministic with mock fixtures. Existing `when`/`dateLabel`/`date`/`filedAt` strings preserved verbatim so every current consumer compiles unchanged; R4–R6 will migrate off them.
- **Files:** `src/lib/dates.js` (new); `src/features/home/mock.js`, `src/features/events/mock.js`, `src/features/ticker/mock.js`, `src/features/event/mock.js` (added timestamp fields).
- **Verified:** Node smoke harness against all five mock sources — `formatDayHeader` produces correct TODAY/YESTERDAY/TOMORROW/weekday for the five reference dates; `formatMarketAnchor` boundaries correct (9:30 sharp = intraday, 16:00 sharp = After close after a fix from `>` to `>=`); `groupByDay` returns the home feed in the right order (TODAY → TOMORROW → WED → THU → YESTERDAY). Metro boots clean (port 8133, exited cleanly). expo-doctor 17/18 — the one fail is a pre-existing false positive about a non-existent `metro.config.js`; not introduced by this tick.
- **Learnings:** one new — see `learnings.md` § "Mock timestamps: unmarked ISO parses local". No new heuristics about the helper API itself; the deterministic-`now` pattern is well-known.
- **Subitem queued for R6:** briefings and transcripts in `ticker/mock.js` need their own timestamp fields (`publishedAt`, `recordedAt`) when the ticker-detail timeline rewrite needs to interleave them with events. Out of R1 scope; flagged in `iteration-plan.md`.
- **Subitem queued for R4 (mock realism):** several `expectedAt` values place reports on weekends (TSLA Sat May 23, AAPL pastEvents Sat Nov 1) because they were derived from existing `when` strings that ignored business days. Cosmetic; fix when consumers migrate off the strings.
- **Next:** R2 — `<DayHeader>` primitive (`src/components/day-header.js`) consuming `formatDayHeader`. Two-line eyebrow per redesign brief mockup: `text.micro` for the relative label, `text.subhead` for the absolute, both `text.tertiary`.

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
