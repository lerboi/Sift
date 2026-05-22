# Current State

What is actually built in the repo as of **2026-05-11**. Update this when you ship.

## Repo layout

```
/Users/leroyngzz/FYP/
├── SETUP.md                    ← authoritative product spec
├── FinalProjectTemplates.pdf   ← CM3020 template doc (template 4.2)
├── app.json                    ← Expo config
├── package.json
├── .env                        ← Supabase URL + publishable key (gitignored)
├── .env.example                ← template
├── .gitignore
├── app/                        ← Expo Router routes
│   ├── _layout.js              ← root Stack, status bar
│   └── index.js                ← landing screen ("Sift")
├── lib/
│   └── supabase.js             ← Supabase client (AsyncStorage adapter)
├── assets/                     ← icon, splash, adaptive icon, favicon
├── test/                       ← scratch space; proposal + transcripts (not source)
├── docs/                       ← this folder
└── node_modules/
```

## What works today

- **Bundler.** `npm start` boots Metro cleanly. `npx expo-doctor` passes 17/17.
- **Routing.** expo-router v6 is wired. `app/_layout.js` defines a hidden-header Stack; `app/index.js` renders the landing screen.
- **Supabase client.** `lib/supabase.js` creates a singleton with AsyncStorage session persistence, throws clearly if env vars missing. PKCE flow is **not** yet configured (will be added with auth screens — see [frontend.md](../architecture/frontend.md)).
- **Env vars.** `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are in `.env`; pattern documented in `.env.example`. Anything not prefixed `EXPO_PUBLIC_` will NOT be bundled into the JS — by design.
- **Deep-link scheme.** `sift://` is registered in `app.json`. Auth callback path will be `sift://auth-callback`.
- **Bundle IDs.** `com.sift.app` for both iOS and Android.

## What does NOT work yet

- **Auth UI.** No sign-in / sign-up screens. `lib/supabase.js` can authenticate but nothing calls it.
- **Database.** No tables, no RLS policies, no migrations. The schema in `backend.md` is design-only.
- **Modal workers.** Nothing exists in `/modal/` yet — no `edgar_poller`, no `briefing_generator`. The Python project hasn't been initialised.
- **Push notifications.** No `expo-notifications` install, no Edge Function.
- **TFLite / on-device ML.** Deliberately not installed. ML is server-side. See ADR-0003.
- **RevenueCat.** Not installed. Parked until post-MVP.
- **CI / EAS.** No `eas.json`. No build profiles. No GitHub Actions.
- **Tests.** Zero. No Jest config.

## Dependencies installed

From `package.json`:

| Package | Version | Why |
| --- | --- | --- |
| `expo` | ~54.0.33 | Managed React Native runtime |
| `expo-router` | ~6.0.23 | File-based routing |
| `expo-linking` | ~8.0.12 | Deep links for auth callback |
| `expo-constants` | ~18.0.13 | Access manifest at runtime |
| `expo-secure-store` | ~15.0.8 | Encrypted KV — used later for crypto key (NOT JWTs) |
| `expo-status-bar` | ~3.0.9 | Status bar control |
| `@supabase/supabase-js` | ^2.105.4 | Supabase SDK |
| `@react-native-async-storage/async-storage` | 2.2.0 | Session persistence adapter |
| `react-native-url-polyfill` | ^3.0.0 | Required by supabase-js on RN |
| `react-native-safe-area-context` | ~5.6.0 | Safe-area insets |
| `react-native-screens` | ~4.16.0 | Native navigator screens |
| `react-native-gesture-handler` | ~2.28.0 | Gesture primitives |
| `react-native-reanimated` | ~4.1.1 | Animations (peer of router) |
| `react-native-worklets` | 0.5.1 | Peer of reanimated 4 |
| `react` | 19.1.0 | — |
| `react-native` | 0.81.5 | — |

## app.json — what to know

```json
{
  "name": "Sift",
  "slug": "sift",
  "scheme": "sift",                 ← deep links
  "newArchEnabled": true,           ← Fabric / TurboModules on
  "ios.bundleIdentifier": "com.sift.app",
  "android.package": "com.sift.app",
  "android.edgeToEdgeEnabled": true,
  "plugins": ["expo-router", "expo-secure-store"]
}
```

When you `expo prebuild` for the first time (needed before adding `expo-notifications` and other native modules), `ios/` and `android/` will be generated — they are `.gitignored` and regenerated from this config.

## .env — what you must have

```
EXPO_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

Both are safe to ship to clients (RLS protects data). The `sb_secret_...` service-role key must NEVER end up in this file or any app code. It lives in Modal secrets only.

After editing `.env`, you **must** stop and restart Metro — env vars are read at bundler startup, not at hot-reload.

## Known issues / quirks

- **react-dom version dance.** During scaffold, `expo install --fix` once tried to bump react-dom to 19.2.6 against react 19.1.0 — got resolved by pinning to 19.1.0. If `expo-doctor` ever complains, check this first.
- **react-native-worklets 0.5.1 → 0.8.x.** SDK 54's compat list expects 0.5.x; npm default would pull newer. We've pinned to 0.5.1. Don't bump unless reanimated changes its peer.
- **Expo Go won't load native modules.** Today the app works in Expo Go because nothing uses native code yet. Once we add `expo-notifications`, `expo-tracking-transparency`, or RevenueCat, Expo Go will refuse — we'll need a dev client (`eas build --profile development`).

## Next planned increments

1. **Auth flow** — sign-up / sign-in screens, PKCE config, deep-link handler, `(auth)` route group, redirect logic in `_layout.js`. ([frontend.md § auth](../architecture/frontend.md))
2. **Supabase schema migration** — write SQL for `profiles`, `watchlists`, `watchlist_tickers`, `tickers`, `briefings`, `events`, `notifications`, `push_tokens`, `model_versions`. RLS on every table. ([backend.md](../architecture/backend.md))
3. **First Modal worker** — `edgar_poller` with single-ticker hardcoded for end-to-end test. ([ml-pipeline.md](../architecture/ml-pipeline.md), [data-sources.md](../architecture/data-sources.md))
4. **Push notifications** — `expo-notifications` install, prebuild, Edge Function `notify_user_event`. ([realtime-and-push.md](../architecture/realtime-and-push.md))
