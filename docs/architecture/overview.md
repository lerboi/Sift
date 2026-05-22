# Architecture Overview

One-page mental model of how Sift fits together. Read this first.

## The product, in one sentence

Sift watches SEC EDGAR for earnings filings on a user's watchlist, parses them in real time, generates pre/post-earnings analysis with an LLM and a supervised classifier, and pushes structured insights to the user's phone — never as buy/sell advice.

## System diagram

```
┌─ React Native app (Expo, iOS + Android) ────────────────────────────┐
│                                                                     │
│  app/                — expo-router routes (thin, ≤20 lines each)    │
│  src/features/*      — feature code (auth, watchlist, briefings…)   │
│  src/lib/supabase.js — Supabase client (PKCE + AsyncStorage)        │
│                                                                     │
│  Reads its world from Supabase. Receives pushes via Expo Push.      │
│  NO on-device ML. NO direct calls to EDGAR or LLMs.                 │
│                                                                     │
└───────────────────────┬─────────────────────────────────────────────┘
                        │ Supabase JS client (HTTPS, PostgREST + Realtime)
                        ▼
┌─ Supabase ──────────────────────────────────────────────────────────┐
│                                                                     │
│  Auth ......... PKCE; sessions persisted on device                  │
│  Postgres ..... users, watchlists, tickers, briefings, events,      │
│                 transcripts, signals, model_versions, push_tokens   │
│  RLS .......... every row tagged by user_id; one user, one view     │
│  Storage ...... raw 8-K/exhibit HTML, transcript files (cold cache) │
│  Edge fns ..... `notify_user_event` — fans out push on insert       │
│  Realtime ..... optional channel for "you're in this screen and a   │
│                 fresh briefing just landed for a ticker you watch"  │
│                                                                     │
└───────────▲────────────────────────────────────────────────────────┘
            │ writes (via Modal service role / sb_secret key)
┌─ Modal — Python workers (scale-to-zero, GPU on demand) ─────────────┐
│                                                                     │
│  edgar_poller       always-on, polls latest-filings every 60s       │
│  briefing_generator cron @ */30 min — Finnhub calendar → LLM        │
│                     pre-earnings briefings                          │
│  transcript_worker  cron post-market — fetch transcripts → NLP      │
│                     summary, tone shifts, novelty vs prior calls    │
│  surprise_classifier offline training (weekly), online inference    │
│                     called by briefing_generator                    │
│  publish_artifact   ML model versioning → Postgres model_versions   │
│                                                                     │
└───────────▲────────────────────────────────────────────────────────┘
            │ HTTP fetches (rate-limited, polite User-Agent)
┌─ External data sources ─────────────────────────────────────────────┐
│                                                                     │
│  SEC EDGAR ........... 8-K filings, free, 10 req/s limit            │
│  Finnhub free tier ... earnings calendar + consensus, 60 calls/min  │
│  earningscalls.dev ... transcripts (~$20-50/mo, single-PoF)         │
│  PR Newswire RSS ..... pre-market press releases                    │
│  Alpha Vantage ....... price history (1-min bars for backtests)     │
│  Anthropic / OpenAI .. LLM for summarisation + structured extract   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## What lives where (quick reference)

| Concern | Lives in | Why |
| --- | --- | --- |
| User input (watchlists, settings) | App → Supabase Postgres | User-owned data, multi-device sync |
| Auth / session | App + Supabase Auth | One-tenant-per-user RLS |
| Real-time event detection | Modal `edgar_poller` | Long-running poll loop; can't run on user devices |
| LLM briefings | Modal cron | Per-ticker output is cached and re-used across all watchers |
| ML inference (surprise classifier) | Modal | Same — one prediction per ticker per earnings event |
| Push delivery | Supabase Edge Function → Expo Push | Edge fn fires on INSERT into `events`; FOSS Expo Push handles APNS/FCM |
| Static assets / model weights / raw filings | Supabase Storage | Cheap, versioned via Postgres rows |
| Build artifacts | EAS (Expo Application Services) | Cloud builds; no Xcode needed for FYP iteration |

## Data flow: pre-earnings briefing

```
T-7 days ─ Finnhub earnings calendar lists AAPL reporting Thursday
        │
        ▼
Modal briefing_generator (cron @ */30 min)
   1. find upcoming earnings in next 7 days, no briefing yet
   2. pull last 4 quarters of actuals + consensus from Finnhub
   3. pull last earnings call transcript snippets (transcript_worker cache)
   4. surprise_classifier.predict(features) → P(beat), P(meet), P(miss)
   5. LLM: synthesise 30-sec briefing (templated prompt, structured output)
   6. upsert into Postgres `briefings` (ticker, fiscal_period, content, model_version)
        │
        ▼
Supabase Edge Function `notify_user_event` (trigger on briefings INSERT)
   - find every user with AAPL in watchlist
   - INSERT row into `notifications` per user
   - send Expo Push
        │
        ▼
Device receives push → user taps → app deep-links to briefing screen
```

## Data flow: live release alert (the hard one)

```
T+0s    AAPL files 8-K Item 2.02 with Exhibit 99.1
        │
        ▼  ≤60s
Modal edgar_poller detects new filing in latest-filings JSON feed
        │
        ▼  ~2-4s
Fetch Exhibit 99.1 HTML → parse with LLM (structured extract):
   { revenue, eps, guidance, segment_breakdown, fiscal_period }
        │
        ▼  ~1s
Compare to Finnhub consensus → compute surprise %
        │
        ▼  <1s
Supabase: INSERT event row → Edge Function fans out push
        │
        ▼  ~2-5s (Expo Push + APNS/FCM)
Device buzzes with "AAPL EPS $2.14 vs $1.98 est (+8.1% beat)"
```

**End-to-end target latency:** under **15 seconds** filing → push. Acceptable upper bound: 60 seconds (still beats most consumer apps; serious traders use Bloomberg). See [`realtime-and-push.md`](realtime-and-push.md) for the per-stage budget and where the slack is.

## Things that are NOT in this architecture (deliberately)

- **On-device ML.** Earlier draft used TFLite; rejected because Sift's AI is per-ticker, not per-user, so backend caching is dramatically more economical. See [ADR-0003](../decisions/0003-backend-ai-not-ondevice.md).
- **A separate "API server."** Supabase + Edge Functions cover what a traditional Node/Python API would; one fewer service to host and secure.
- **Direct device → EDGAR.** Would burn rate limit, leak User-Agent, expose secrets. Always through Modal.
- **Multi-user model personalisation.** Sift's models are general; user data only filters/sorts. Important for the regulatory framing ([compliance.md](compliance.md)).

## Boundaries and contracts

| Boundary | Contract | Failure mode |
| --- | --- | --- |
| App ↔ Supabase | PostgREST + Realtime, JS SDK | Network down → app shows stale cache, no crash |
| Supabase ↔ Modal | Service-role key via `modal.Secret`, write-only patterns | Modal down → no new events; app keeps working with cached data |
| Modal ↔ EDGAR | HTTPS + polite User-Agent + 10 req/s | EDGAR rate-limit → exponential backoff, alert via logs |
| Modal ↔ LLM | API key in Modal secret | Rate-limit / outage → fall back from Claude → GPT-4o-mini → "briefing unavailable" |
| Supabase → Expo Push | Edge fn HTTP POST to exp.host/--/api/v2/push/send | Push fails → row stays in `notifications` with `status='failed'`, retried by cron |

## Scaling assumptions (for the FYP demo)

- Tens of users (yourself, marker, a few friends). No load concerns.
- ~500 Russell-1000 companies × 4 earnings per year = ~2,000 events/year. Workload is tiny.
- Real-time pressure is per-event, not aggregate: when AAPL drops, hundreds of watchers want a push within seconds.
- For SaaS launch (~1k paying users): nothing in this architecture has to change. See `cost picture` in SETUP.md.

## Where to go next

- Implementing a screen? → [`frontend.md`](frontend.md)
- Designing a table? → [`backend.md`](backend.md)
- Adding a model or LLM step? → [`ml-pipeline.md`](ml-pipeline.md)
- Wiring a new external source? → [`data-sources.md`](data-sources.md)
- Pushing a new event type? → [`realtime-and-push.md`](realtime-and-push.md)
- Writing copy? → [`compliance.md`](compliance.md) **before** typing the words.
