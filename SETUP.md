# FYP Setup

**Name:** Sift
**Project:** Financial Advisor Bot (CM3020 AI, template 4.2) — also planned as a commercial SaaS post-graduation.
**Market focus:** US-listed equities (Russell 1000 for MVP).

## What Sift is

A mobile earnings intelligence app for self-directed retail investors. User picks a watchlist + sectors, and Sift delivers:

1. **Pre-earnings briefing** — 30-second AI-generated summary for each upcoming report: consensus estimates, beat/miss history, last call's guidance, what to watch for.
2. **Live release alert** — the moment an 8-K Item 2.02 hits SEC EDGAR, Sift parses Exhibit 99.1, extracts headline numbers, compares to estimates, pushes a structured notification.
3. **Post-call transcript analysis** — once the transcript is available, Sift flags tone shifts, novel topics, and guidance-language changes vs. prior calls.
4. **Earnings surprise classifier** — supervised ML predicting beat/meet/miss from pre-earnings features (the FYP rubric's "advanced algorithm" centrepiece).

Framed and marketed as a **research / education tool**, never as advice. No buy/sell recommendations.

## Stack

- **Frontend:** React Native (iOS + Android), JavaScript. Expo dev-client (not Expo Go), New Architecture.
- **Backend:** Supabase — Postgres, auth, storage, edge functions, realtime.
- **AI/data workers:** Python on Modal (scales to zero). Cron jobs + always-listening EDGAR poller.
- **LLM:** Claude / GPT-4o-mini API for briefings and structured extraction. (Outperforms FinBERT per recent research.)
- **Subscriptions (later):** RevenueCat wrapping Stripe + Apple/Google IAP.
- **Push notifications:** Expo Push.

## Architecture (high-level)

```
┌─ React Native app ──────────────────────────────────────────┐
│ Reads from Supabase. No on-device ML. Push notifications    │
│ delivered via Expo Push.                                    │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTPS (Supabase client SDK)
                 ▼
┌─ Supabase ──────────────────────────────────────────────────┐
│ ─ Auth (users, watchlists, subscriptions)                   │
│ ─ Postgres (briefings, filings, transcripts, signals)       │
│ ─ Row-level security for multi-tenant SaaS                  │
│ ─ Edge functions trigger push notifications on new events   │
└────────────────▲────────────────────────────────────────────┘
                 │ writes
┌─ Modal (Python workers) ────────────────────────────────────┐
│                                                             │
│  Cron — every 30 min:                                       │
│    Pull Finnhub earnings calendar → generate pre-earnings   │
│    briefings (LLM) → cache in Supabase.                     │
│                                                             │
│  Always-listening EDGAR poller:                             │
│    Poll latest-filings feed every 60s → filter for 8-K      │
│    Item 2.02 → fetch Exhibit 99.1 → LLM structured          │
│    extraction of revenue/EPS/guidance → write event +       │
│    trigger push.                                            │
│                                                             │
│  Cron — post-market:                                        │
│    Check transcript provider for new transcripts → NLP      │
│    analysis (embeddings, tone shift, novelty vs prior call) │
│    → store summary → trigger push.                          │
│                                                             │
│  Surprise classifier (offline training, online inference):  │
│    XGBoost/NN trained on historical earnings → predicts     │
│    beat/meet/miss before each release.                      │
└─────────────────────────────────────────────────────────────┘
                 ▲
                 │ pulls
┌─ External data sources ─────────────────────────────────────┐
│ SEC EDGAR RSS + JSON ............... 8-K filings (free)     │
│ Finnhub free tier .................. earnings calendar +    │
│                                      consensus estimates    │
│                                      (60 calls/min free)    │
│ earningscalls.dev / API Ninjas ..... transcripts (~$20-50/mo)│
│ Press wire RSS feeds ............... pre-market releases    │
│ Alpha Vantage / Finnhub ............ price data             │
└─────────────────────────────────────────────────────────────┘
```

**Why backend AI, not on-device:** earlier we'd discussed on-device TFLite. That fits a personal-strategy app where each user has their own model. Sift's AI is per-ticker (one Apple briefing serves every Apple watcher), so backend generation + caching is the right call — better economics, better consistency, no app-store re-review when models change.

## Cost picture

- **MVP / FYP:** ~$50–110/month (transcripts API + LLM API; everything else on free tiers).
- **At ~1k paying users:** ~$600–800/month. Healthy margins at $5–10/mo subscription.

## Key constraints to remember

- **SEC EDGAR rate limit:** 10 req/s per IP. Must include contact email in `User-Agent` (SEC fair-access policy).
- **EDGAR RSS refresh:** every 10 min Mon–Fri 6am–10pm EST; latest-filings endpoint closer to real-time.
- **Earnings releases = 8-K Item 2.02, with the actual press release in Exhibit 99.1.**
- **Transcript provider is a single point of failure** — keep two fallbacks wired.
- **Regulatory framing is non-negotiable.** All UI copy, ToS, push wording, App Store listing must stay on the educational/research side. Never use the words "advice," "recommend buy/sell," "should buy."

## Open

- AI technique mix for the surprise classifier (XGBoost vs small NN — TBD during build).
- Whether to add an LLM-based Q&A layer over earnings transcripts in v2.
- Charting library choice (likely `victory-native` or a `lightweight-charts` WebView).
- Pricing tiers for SaaS launch.
