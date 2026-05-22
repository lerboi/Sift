# Sift — Project Context for Claude

**Sift** is a mobile earnings intelligence app for self-directed US-equity investors (Russell 1000). It detects new SEC 8-K earnings filings in near real-time, generates LLM briefings, predicts beat/meet/miss via a supervised classifier, and pushes structured insights to the user's phone. **Framed as research/education, never as investment advice** — this framing is load-bearing for FCA/SEC compliance.

It is also the user's University of London CM3020 AI final-year project (template 4.2 "Financial Advisor Bot"), intended to ship as a commercial SaaS after graduation. **Every architecture decision is made for both audiences.**

## Where to read, in order

| If you need… | Read |
| --- | --- |
| Product spec (authoritative) | [`SETUP.md`](SETUP.md) |
| One-page mental model | [`docs/architecture/overview.md`](docs/architecture/overview.md) |
| What's actually built today | [`docs/setup/current-state.md`](docs/setup/current-state.md) |
| How to run locally | [`docs/setup/local-dev.md`](docs/setup/local-dev.md) |
| Specific area (frontend / backend / ml / data / realtime / compliance) | [`docs/architecture/*.md`](docs/architecture/) |
| Why we chose X over Y | [`docs/decisions/`](docs/decisions/) (5 ADRs) |
| What's intentionally undecided | [`docs/open-questions.md`](docs/open-questions.md) |
| Docs map / index | [`docs/README.md`](docs/README.md) |

When SETUP.md and `docs/` disagree, **SETUP.md wins** — the docs explain *how* we build what SETUP.md specifies.

## Stack at a glance

- **Frontend:** React Native (Expo SDK 54+, JavaScript) with expo-router. Plain AsyncStorage session today; PKCE + encrypted storage when auth screens land.
- **Backend:** Supabase (Postgres + auth + storage + edge functions + realtime). All AI/ML runs **server-side**, not on-device — see [ADR-0003](docs/decisions/0003-backend-ai-not-ondevice.md).
- **Workers:** Python on Modal — EDGAR poller, briefing generator, transcript analyser, surprise classifier (XGBoost or small NN — TBD).
- **LLMs:** Claude (Anthropic) primary, GPT-4o-mini fallback. Structured-output (tool use / `response_format`). No FinBERT — see [ADR-0005](docs/decisions/0005-llm-over-finbert.md).
- **Push:** Expo Push, fanned out by Supabase Edge Function (provisional) or Modal (alternative).
- **Subscriptions (later):** RevenueCat.

## What's done

- Expo project scaffolded; `expo-doctor` 17/17; expo-router wired; Supabase client in `lib/supabase.js`.
- Deep-link scheme `sift://`, bundle id `com.sift.app`, plugins for expo-router + expo-secure-store.
- `.env` pattern with `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY`; user's Supabase project hooked up.
- Full engineering documentation tree (this file + `docs/`).

## What's next (in rough order)

1. **Auth flow** — sign-in/sign-up screens, PKCE config, deep-link handler, route groups, encrypted session storage.
2. **Supabase schema migration** — write SQL for the schema in [`docs/architecture/backend.md`](docs/architecture/backend.md), RLS on every table.
3. **First Modal worker** — `edgar_poller` end-to-end test with one ticker.
4. **Push notifications** — install `expo-notifications`, run `expo prebuild`, write the fan-out function.

Live status table is in [`docs/README.md`](docs/README.md). Update it when something ships.

## Working agreements

- **Compliance copy is non-negotiable.** Never write "advice", "recommend buy/sell", "should buy", or any directive language in user-facing strings. See [`docs/architecture/compliance.md`](docs/architecture/compliance.md) for the forbidden-word list and disclaimer text.
- **The publishable Supabase key ships with the app; the `sb_secret_...` key never leaves Modal.** RLS is what actually protects data — design schema with that assumption.
- **Don't reintroduce on-device ML.** That decision was reversed for substantive reasons ([ADR-0003](docs/decisions/0003-backend-ai-not-ondevice.md)).
- **JavaScript, not TypeScript** — per SETUP.md. Revisit only if type errors become frequent.
- **No commits without explicit request.** The user runs git themselves unless they ask.

## Code comment style

Default to **no comment**. Well-named identifiers explain *what*; only add a comment when the *why* is non-obvious.

When a comment is warranted:

- **One line. Lowercase. Short.** Treat it like a sticky-note to your future self, not documentation.
- **No block comments, no multi-line explanations, no docstring paragraphs.** If you feel the need to write more than one line, the code probably needs to change, not the comment.
- **No "this function does X" preambles.** The function name does that.
- **No `// added for Y` / `// fix for issue #123` / `// used by Z`** — that rots fast and belongs in the commit message.
- **No emojis, no decoration banners** (`// ====== Helpers ======`).

The bar: a comment should look like something a tired human typed while coding, not something an AI wrote to look thorough.

```js
// good
// edgar lags ~10 min on rss, latest-filings json is fresher
const FEED = 'https://www.sec.gov/...';

// bad
/**
 * Fetches the latest filings from the SEC EDGAR API endpoint.
 * This function is used by the EDGAR poller to detect new 8-K filings.
 * Returns a list of filing objects with accession numbers.
 * @returns {Promise<Filing[]>}
 */
```

## Repo layout (top level)

```
FYP/
├── SETUP.md                 product spec (authoritative)
├── CLAUDE.md                this file
├── app/                     expo-router routes
├── lib/                     supabase client (will move under src/ when src/ exists)
├── assets/                  icons, splash
├── docs/                    engineering documentation (16 files)
├── test/                    user's scratch space (proposal drafts, transcripts) — not source
├── .agents/                 Claude skills lock
├── app.json package.json    Expo + npm config
├── .env / .env.example      Supabase credentials pattern (.env is gitignored)
└── node_modules/
```

`ios/` and `android/` will be generated by `expo prebuild` when we add the first native module; both are gitignored.
