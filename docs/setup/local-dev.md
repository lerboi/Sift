# Local Development

How to run Sift locally. Aimed at a fresh clone, or you returning after a few weeks away.

## Prerequisites

- **Node 22+** (current dev machine is on 24.14.1).
- **npm 11+** (or pnpm/yarn — `package-lock.json` is npm-flavoured, switch carefully).
- **Expo Go** on your phone for fast iteration — or a dev client (later).
- **Supabase project** you own, with publishable + secret API keys.
- (Later) **Modal account** (free tier) and **Anthropic / OpenAI** API key.
- (Much later) **Xcode** + **Android Studio** for prebuild / native debugging. Not needed for day-to-day work.

## First-time setup

```bash
git clone <repo>
cd FYP
npm install                # 700+ packages, 30s on a warm cache
cp .env.example .env       # then fill in your Supabase URL + publishable key
```

Open Supabase dashboard → **Project Settings → API**. Copy:

- **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
- **Publishable key** (or legacy `anon` key) → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Do **not** copy the `secret` (or legacy `service_role`) key into `.env`. That stays in Modal secrets only — putting it in `.env` puts it in the app bundle and gives every user God-mode on your database.

## Daily commands

| What you want | Command |
| --- | --- |
| Start Metro and pick a target | `npm start` |
| Force iOS simulator (needs Xcode) | `npm run ios` |
| Force Android emulator (needs Android Studio) | `npm run android` |
| Open in browser | `npm run web` |
| Sanity-check project health | `npx expo-doctor` |
| Refresh native deps to SDK-compatible versions | `npx expo install --fix` |

## Running on a phone via Expo Go

1. Install **Expo Go** from App Store / Play Store.
2. `npm start`
3. Wait for the QR code in the terminal.
4. iPhone: open **Camera**, point at QR, tap banner → opens Expo Go.
   Android: open **Expo Go**, hit "Scan QR code".
5. Phone + laptop must be on **the same Wi-Fi**. If not (university Wi-Fi often blocks device-to-device): press `s` in the terminal to switch to tunnel mode. Slower but works anywhere.

**Caveat:** Expo Go cannot load custom native modules. The moment we add `expo-notifications`, RevenueCat, or anything else not in Expo Go's bundle, you'll need a dev client. Today (no native modules yet), Expo Go is fine.

## Running on a phone via dev client (later)

When Expo Go stops being enough:

```bash
# one-time: generate native projects
npx expo prebuild

# build a dev client in the cloud (free tier: 15 iOS + 15 Android / month)
eas build --profile development --platform ios
eas build --profile development --platform android
```

EAS gives you an install link / QR — install on your device once. From then on you `npm start --dev-client` and your dev client app loads your local JS bundle, native modules included.

Alternative: `eas build --local` builds on your own machine — uses no EAS credits but requires Xcode / Android Studio installed.

## Environment variables — the rules

- Variables prefixed `EXPO_PUBLIC_` are inlined into the JS bundle at build time. **Visible to anyone who unzips your app.** Use only for genuinely-public values (Supabase URL, publishable key).
- Variables without the prefix are **not** available in the app's JS. They can be read by build-time tooling (`app.config.js`, EAS scripts).
- **Secrets** (Supabase service-role key, Anthropic API key, Finnhub key) live in:
  - **Modal:** `modal.Secret.from_name("...")` for worker functions.
  - **Supabase Edge Functions:** the project's "Edge Function secrets" panel.
  - **Never in `.env`.**
- **Restart Metro after editing `.env`.** Env values are read once at bundler startup; hot reload will not pick them up. Ctrl+C, `npm start`.

## Common things that break and how to fix

**"Unable to resolve module ..."** — usually after adding a dep. Stop Metro, `npm start --clear` (clears Metro cache).

**"Network request failed" in Supabase calls** — three usual suspects:
1. Wrong URL/key in `.env` — confirm by logging `process.env.EXPO_PUBLIC_SUPABASE_URL` early in `lib/supabase.js`.
2. Forgot to restart Metro after editing `.env`.
3. RLS denying the request — check Supabase logs (Dashboard → Logs → API). Authenticated requests need a session; anonymous requests are blocked by default once RLS is enabled.

**`expo-doctor` complains about package versions** — `npx expo install --fix`. If it tries to bump react / react-dom and breaks peer resolution, pin manually (see [`current-state.md`](current-state.md) § known issues).

**Reanimated errors at runtime** — confirm `react-native-worklets` is installed at the SDK-compatible version (0.5.1 for SDK 54). Restart Metro with `--clear`.

**Native module errors in Expo Go** — Expo Go cannot load custom native code. Either remove the offending module, or move to a dev client.

**Tunneling fails** — `npx expo start --tunnel` sometimes needs `@expo/ngrok` installed. The CLI will prompt.

## Where logs land

- **Bundler / Metro:** terminal where you ran `npm start`.
- **Device JS:** inline in Metro, or press `j` to open Chrome DevTools, or shake the device for the dev menu.
- **Supabase:** Dashboard → Logs → split by Auth / API / Edge Functions / DB.
- **Modal:** `modal app logs sift-workers` (later, once we have an app).
- **Expo Push delivery:** receipts available via the Expo Push receipts endpoint; check `notifications` table for our own status mirror.

## Editor setup (recommended)

- VS Code or Cursor.
- Extensions: ESLint, Prettier, React Native Tools, Expo Tools.
- Format on save. Prettier defaults are fine; no team to argue with.
- The skill at `.agents/skills/` exists if you want Claude-assisted work — outside the scope of this doc.

## Deploying (eventually)

Out of scope until we have something to deploy. The path will be:

1. `eas build --profile production` for iOS + Android binaries.
2. `eas submit` to push to TestFlight + Play Console internal track.
3. EAS Update for OTA JS-only updates between native builds.

See ADR-0001 for why we bet on EAS.
