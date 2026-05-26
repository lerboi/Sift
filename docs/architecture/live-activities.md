# Live Activities — stub spec (post-MVP)

Stub-only design doc. **Not implemented.** Sift's MVP ships Expo-managed; Live Activities require a Swift extension and `expo prebuild`. This doc captures what a v1 Live Activity for Sift would look like so a future implementer doesn't start from zero.

## What

Live Activities are iOS 16.1+ widgets that live on the lock screen and (on iPhone 14 Pro and later) the Dynamic Island. They update via ActivityKit pushes — separate from the regular push notification system but using the same APNs token. A Live Activity has up to ~8 hours of lifetime per spawn; the user can stop it at any time.

Apple Sports, Uber, and DoorDash use them well; the pattern is "ongoing event with discrete state changes."

## Why Sift wants them

Earnings reports have a clean "ongoing event" shape:

- **Anticipation:** a countdown to the scheduled filing time (T-12h → T-1h → T-10m → T-30s).
- **Live moment:** the 8-K hits EDGAR; Sift detects it within ~15s (per `realtime-and-push.md`).
- **Resolution:** EPS/revenue parsed, surprise computed, briefing rendered.

This pattern is identical to "match in progress → final score → highlight reel" for Sports. Live Activities are the right surface for it.

The Dynamic Island variant is especially good: a small ticker symbol + countdown that expands on long-press to show the latest parsed numbers.

## Scope for v1

Minimum viable Live Activity:

| State | Lock-screen | Dynamic Island compact | Dynamic Island expanded |
| --- | --- | --- | --- |
| **T-Xh / T-Xm countdown** | Ticker + period + `Reports in 12:34` | Ticker + countdown | Ticker + period + countdown + "Expected EPS $X.XX" |
| **Live / just filed** | Ticker + `◐ Filing detected` | Ticker + `◐` glyph | Ticker + period + EPS actual vs est + surprise % (signal-tinted) |
| **Resolved (15 min after)** | Ticker + `✓ Reported · ±N.N% surprise` | Ticker + arrow + % | Ticker + period + full metrics line + "Open briefing" CTA |

User-initiated: tap the ticker's "Add to Live Activity" button on the upcoming card (post-MVP UI affordance, not built today). The Activity auto-dismisses 15 minutes after resolution or at 8h whichever comes first.

System-initiated (post-v2 stretch): for any watchlisted ticker reporting today, spawn a Live Activity ~1h before scheduled time. Risks user surprise; gate behind an explicit Settings toggle.

## Implementation path

1. **Native side:**
   - Add `expo-live-activity` (or `@expo/config-plugins`-compatible equivalent — verify maintained package at implementation time; ecosystem moves).
   - Run `expo prebuild` to generate `ios/`. Add a Widget Extension target manually in Xcode (or via config plugin if available).
   - In Swift: declare an `ActivityAttributes` struct with the ticker payload (symbol, period, scheduledAt, latestState).
   - Implement the lock-screen + Dynamic Island layouts as SwiftUI views (`ActivityConfiguration`).

2. **JS side:**
   - Wrap the JS bridge in `src/lib/live-activity.js` — `start({ ticker, period, scheduledAt })`, `update(id, state)`, `end(id)`.
   - Trigger `start` from the upcoming card's "Add to Live Activity" button.
   - Trigger `update` from the existing 8-K-detection push pipeline (Modal → Edge Function → APNs). The push payload routes to the Live Activity ID instead of (or in addition to) a regular notification.

3. **Backend:**
   - `realtime-and-push.md`'s fan-out function needs a branch: if the event has an active Live Activity ID, send an ActivityKit push (`apns-push-type: liveactivity`) with the updated state, in addition to the regular push.
   - Keep the regular push — Live Activities are supplementary, not a replacement.

## Why not now

- **MVP is Expo-managed.** Adding Live Activities means `expo prebuild`, committing `ios/`, and maintaining a Swift extension. That's a significant operational cost (the `ios/` folder breaks the "managed" simplicity; native deps now require dev-build for every change).
- **Adoption is iOS-only and iPhone-14-Pro-and-later for Dynamic Island.** Roughly two-thirds of Sift's likely audience won't see the Dynamic Island variant. Lock-screen Live Activities work on iPhone X+ since iOS 16.1, broader reach.
- **No Android equivalent.** Android has its own ongoing-notification surfaces but they don't map cleanly to ActivityKit; would need a separate design.
- **Compliance copy doesn't fit cleanly.** Lock-screen Live Activity space is ~4 lines; the persistent disclaimer footer ("Educational use only. Not investment advice.") would have to live as a small caption — verify with compliance before shipping.

## Trigger conditions for revisiting

Build this when **any** of:

- User demand signal — direct user requests, App Store reviews mentioning "lock screen", competitor analyses showing Live Activities as table stakes.
- Sift already runs in a dev build for other reasons (e.g. adopting `react-native-mmkv` per the storage option in `frontend.md`, or `react-native-skia` for richer charts) — the prebuild cost is sunk.
- A Live-Activity-specific Apple feature (e.g. iOS 27 Always-On display integration) ships and creates differentiation pressure.

## Compliance notes

- The countdown surface must not contain any predictive language. "Reports in 12:34" is fine; "AAPL likely to beat in 12:34" is forbidden.
- The resolved surface shows actuals (EPS, surprise %) — facts, no model output. Beat-probability % stays in-app where the methodology sheet is one tap away.
- Any disclaimer copy must be in the layout itself, not the metadata.

## References

- [Apple — ActivityKit](https://developer.apple.com/documentation/activitykit) — official API surface.
- [`software-mansion-labs/expo-live-activity`](https://github.com/software-mansion-labs/expo-live-activity) — current best-known Expo wrapper (verify maintained at implementation time).
- `docs/architecture/realtime-and-push.md` — the existing push pipeline this would extend.
- `docs/architecture/compliance.md` § "The disclaimer" — copy constraints.
