# Frontend Architecture

React Native (Expo SDK 54+) with expo-router. JavaScript, not TypeScript (FYP-scope choice — see ADR if revisited).

## Mental model

The frontend is a **thin read-mostly client** of Supabase. It does not:

- Call EDGAR, Finnhub, transcript APIs, or LLMs directly.
- Run any ML inference.
- Hold complex business logic about earnings.

It does:

- Authenticate the user.
- Render briefings, events, transcripts that Modal pre-computed and Supabase stores.
- Let the user manage watchlists and notification preferences.
- Receive push notifications via Expo Push and deep-link into the relevant screen.

## Folder structure (target, not yet built)

```
app/                                expo-router — routes only
  _layout.js                        root: providers, auth gate, status bar
  +not-found.js                     404 fallback
  (auth)/                           ── auth route group
    _layout.js                      modal-style stack, hide tabs
    sign-in.js
    sign-up.js
    auth-callback.js                deep-link receiver for PKCE
  (app)/                            ── authenticated route group
    _layout.js                      bottom tabs
    index.js                        Today (upcoming + just-released)
    watchlist/
      index.js                      list view
      [ticker].js                   ticker detail (briefing + events)
    events/
      index.js                      filterable event feed
      [event_id].js                 single 8-K with parsed numbers
    learn/
      index.js                      educational content (compliance buffer)
    settings/
      index.js
      notifications.js
      subscription.js               (later)
src/
  features/                         ── feature code lives here
    auth/
      components/
      hooks/use-session.js
      api.js                        sign-in/up/out wrappers
    watchlist/
      components/
      hooks/use-watchlist.js
      api.js
    briefings/
      components/briefing-card.js
      hooks/use-briefing.js
      api.js
    events/
    transcripts/
    notifications/
      register-push-token.js
  components/                       ── shared UI primitives
    button.js
    card.js
    disclaimer-banner.js            ← reused on every signal screen
  lib/
    supabase.js                     (currently at /lib/supabase.js, will move)
    expo-push.js
    format.js                       money, percent, dates, fiscal-period
    storage.js                      encrypted-session helper (AES + SecureStore key)
  hooks/
    use-color-scheme.js
  theme/
    colors.js
    typography.js
    spacing.js
assets/
```

**Convention:** files under `app/` are *router glue only*. Aim ≤20 lines each. They import a screen component from `src/features/.../screens/`. This keeps Expo Router's routing concerns separate from feature logic and means co-located tests don't end up in a route tree.

**Path alias:** add to `jsconfig.json`:
```json
{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }
```
Imports become `import { supabase } from '@/lib/supabase'` rather than `../../../../lib/supabase`.

**Why feature folders, not type folders?** A `screens/`+`components/`+`hooks/` tree fragments at 5 features and is impossible at 20. Feature folders co-locate everything for a domain — easier to delete an experiment, easier to onboard.

## Auth flow

Supabase PKCE on a mobile device, using `expo-web-browser` + `expo-linking`.

```
1. User taps "Continue with Google" / submits email
        │
        ▼
2. App calls supabase.auth.signInWithOAuth({
     provider: 'google',
     options: {
       redirectTo: 'sift://auth-callback',
       skipBrowserRedirect: true     ← critical on mobile
     }
   })
        │  returns { data: { url } }
        ▼
3. WebBrowser.openAuthSessionAsync(data.url, 'sift://auth-callback')
        │  opens system browser sheet
        │
4. User authenticates with provider → redirected to sift://auth-callback?code=...
        │
        ▼
5. app/(auth)/auth-callback.js reads code from useLocalSearchParams()
   → supabase.auth.exchangeCodeForSession(code)
        │
        ▼
6. Session persisted via custom storage adapter (see § Storage below)
   → router.replace('/(app)/')
```

**Email/password fallback:** simpler — `signInWithPassword({ email, password })`. No deep link needed. Worth supporting for FYP demo; users running on a dev client won't always have Google sign-in configured.

**Magic links** require PKCE on mobile. The flow is identical to OAuth except the email contains the redirect URL, not Google.

### Session storage — the 2KB problem

Supabase JWT sessions can exceed 2KB. `expo-secure-store` rejects values >2048 bytes. Three options:

| Option | Verdict |
| --- | --- |
| AsyncStorage (plain) | What Supabase's quickstart uses. Sessions in plaintext in app sandbox. Acceptable, but session theft is one rooted device away. |
| Encrypted session in AsyncStorage + AES key in SecureStore | ✅ **Sift's choice.** Best balance — key is hardware-backed, ciphertext is unbounded. Well-known idiom (Ignite Cookbook recipe). |
| `react-native-mmkv` with `encryptionKey` | Faster than AsyncStorage, native encryption. Needs dev client. Worth migrating to when we add it for other reasons. |

Implementation lives in `src/lib/storage.js`. Wire it into the supabase client:

```js
import { createClient } from '@supabase/supabase-js';
import { encryptedSessionStorage } from '@/lib/storage';

export const supabase = createClient(url, key, {
  auth: {
    storage: encryptedSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
```

Today (`lib/supabase.js`) uses plain AsyncStorage with `flowType` not set. That's fine for the empty-app stage; swap to encrypted + PKCE when auth screens land.

## Routing patterns

Two route groups: `(auth)` and `(app)`. The root `_layout.js` reads the session and renders one or the other:

```jsx
// app/_layout.js — outline
export default function RootLayout() {
  const { session, loading } = useSession();
  if (loading) return <Splash />;
  return (
    <Stack>
      {session ? (
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      ) : (
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      )}
    </Stack>
  );
}
```

Expo Router's `Redirect` + protected routes work too; both are acceptable. The single source of truth is `useSession()` in `src/features/auth/hooks/use-session.js`.

## Data fetching pattern

Standardise on **TanStack Query (React Query)** when we add it. Why:

- Built-in caching, retries, focus-refetch.
- Works cleanly with Supabase realtime: query fetches initial state, channel updates the cache.
- Tiny — under 15KB gzipped.

Convention:

```jsx
// src/features/briefings/hooks/use-briefing.js
export function useBriefing(ticker) {
  return useQuery({
    queryKey: ['briefing', ticker],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('briefings')
        .select('*')
        .eq('ticker', ticker)
        .order('fiscal_period', { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

Mutations follow the same pattern with `useMutation`. Subscribe to realtime channels in a `useEffect` near the top of the screen; `queryClient.setQueryData()` to merge incoming events.

## Push token registration

On first sign-in or first app-open after sign-in, call `Notifications.getExpoPushTokenAsync()` and upsert it to `push_tokens` keyed on `(user_id, token)`. The Edge Function `notify_user_event` reads from this table when fanning out. Implementation: `src/features/notifications/register-push-token.js`.

iOS quirks: must call `Notifications.requestPermissionsAsync()` first; the OS prompt appears once. Store user preference in `profiles.notification_pref` so you can re-prompt thoughtfully later.

## Compliance hooks at the UI layer

Three things the frontend has to enforce regardless of backend behaviour. See [compliance.md](compliance.md) for the full set.

1. **`<DisclaimerBanner />`** component (`src/components/disclaimer-banner.js`) — must appear on every screen that shows a briefing, an event with surprise %, or any forward-looking number. Not in T&Cs. **Standalone-compliant** — screenshots taken of a single screen must contain the disclaimer.
2. **Word filter** — a small lint rule (or runtime warning in dev) flags forbidden strings: `"advice"`, `"recommend"`, `"should buy"`, `"should sell"`, `"will go up"`. We can wire this as a Jest snapshot test of rendered strings, or as a Vite/ESLint plugin scanning source.
3. **No "buy now" buttons.** Even if a future v2 brokerage integration is on the table — keep it out of any "signal → action" flow. See compliance doc.

## Styling

No CSS-in-JS library yet. `StyleSheet.create` is fine for the MVP. If complexity grows, options in rough order of preference:

1. **NativeWind / TailwindCSS** — best for design-system productivity, large community.
2. **Restyle** (Shopify) — theme-aware, TS-friendly, more verbose than Tailwind.
3. **StyleSheet + a `theme/` module** — what we have. Works at the current scope.

Don't add a styling library until you have ≥5 screens and feel the pain. Premature design system = wasted hours.

## State management

Avoid global state until you have a reason. The boundaries today:

- **Server state** → React Query (when added).
- **Auth session** → `useSession()` hook; one source of truth.
- **Form state** → local component state, or React Hook Form when forms get complex.
- **Cross-screen UI state** (modals, toasts) → React Context, scoped narrowly.

Don't reach for Redux / Zustand until you have a concrete scenario. The earnings domain is mostly read-only; a global store is solving a problem you don't have.

## Performance baselines

Three things to keep an eye on:

1. **List rendering** — earnings feeds will be 100s of items. Use `FlatList` (or `FlashList` from Shopify when scale hurts). Never `ScrollView` for long lists.
2. **Date-heavy screens** — moment.js is banned; use `date-fns` (smaller, tree-shakeable) or `Intl` directly.
3. **Re-renders on realtime updates** — when a channel fires, only invalidate the affected query, not the whole tree.

Profile with the React DevTools profiler before optimising.

## Testing strategy (later)

Out of scope for the FYP MVP, but worth recording the intent:

- Unit: Jest + React Native Testing Library for hooks and pure logic.
- Integration: Detox or Maestro for the auth → watchlist → briefing happy path.
- Snapshot the rendered disclaimer text — non-negotiable compliance check.

The CM3020 rubric weights "testing and evaluation". The MVP test surface should at minimum cover:
- Auth happy path
- Schema migration up/down
- The surprise classifier's evaluation harness (in `/modal/`)
- A snapshot of every "signal" screen confirming a disclaimer is present.
