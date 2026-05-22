# ADR-0001: Expo (managed) with dev client over bare React Native

**Date:** 2026-05-09
**Status:** Accepted

## Context

We need cross-platform iOS + Android with JavaScript. Three plausible options:

1. **Expo managed + Expo Go.** Easiest start, no native toolchain. Limits: no custom native modules.
2. **Expo managed + dev client** (`expo prebuild` + EAS Build). Native modules supported, still get Expo's managed APIs.
3. **Bare React Native CLI.** Full native control. Requires Xcode + Android Studio.

The user is new to React Native, has only Command Line Tools (no Xcode) installed, and the architecture needs native modules later (`expo-notifications`, `expo-secure-store` for crypto keys, possibly RevenueCat post-MVP).

## Decision

**Expo managed workflow with dev client when native modules are required.** Build dev clients via EAS Build (cloud). Generate `ios/`/`android/` only when needed via `expo prebuild`.

## Consequences

**Positive:**
- No Xcode/Android Studio install until much later. EAS Build does cloud builds; first one consumes 1 of 15 free monthly iOS builds.
- Expo's managed APIs (`expo-router`, `expo-notifications`, `expo-secure-store`, EAS Update OTA) accelerate scaffolding by weeks.
- SDK upgrades are dramatically less painful — `expo prebuild` regenerates native dirs from config.
- Same toolchain works for FYP demo and SaaS launch. No migration debt.

**Negative:**
- Expo Go cannot load native modules. Once we add `expo-notifications` etc., everyone testing needs a dev-client build.
- EAS free tier caps at 15 iOS + 15 Android builds/month. Plenty for steady-state, but a native-config-thrashing week can burn it. Mitigation: `eas build --local` for free local builds (needs Xcode + Android Studio if reached for).
- Expo abstractions occasionally hide behaviour that's easier to debug in a bare RN setup. Worth knowing; not common in practice.

## What would invalidate this

- Expo's roadmap dropping support for a critical native API we need.
- A native module we must use that Expo explicitly forbids (extremely rare; the config-plugin system handles 99% of cases).
- Performance issue specifically attributable to Expo's runtime — would investigate the New Architecture before reverting to bare.

## Alternatives considered

- **Bare React Native CLI** — gives full control but pulls forward weeks of Xcode/Android Studio setup pain with no real benefit at our scope.
- **Flutter** — different language (Dart). Excluded by the JS preference and the user's prior JS experience.
- **Native iOS + Android separately** — out of scope for a solo-dev FYP.

## Implementation status

- Done: `npx create-expo-app` (blank JS template), Supabase client, `expo-router`, supporting native packages installed, scheme registered, `expo-doctor` 17/17.
- Pending: dev client build (deferred until first native module is needed — currently none).
