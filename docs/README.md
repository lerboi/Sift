# Sift — Engineering Documentation

This folder holds the engineering-side documentation for **Sift**, the earnings intelligence app being built as a University of London CM3020 final-year project and intended for commercial SaaS launch after graduation.

The authoritative **product spec** lives in [`/SETUP.md`](../SETUP.md). When it conflicts with anything here, SETUP.md wins. These docs explain *how* we are building what SETUP.md describes.

## How the docs are organised

```
docs/
├── README.md                    you are here
├── architecture/                how the system is put together
│   ├── overview.md              one-page mental model + diagrams
│   ├── frontend.md              React Native + Expo Router, auth on device
│   ├── backend.md               Supabase: schema, RLS, edge functions
│   ├── ml-pipeline.md           backend ML: surprise classifier + LLM briefings
│   ├── data-sources.md          EDGAR, Finnhub, transcripts, press wires — limits & fallbacks
│   ├── realtime-and-push.md     "filing hits → device buzzes" latency budget
│   └── compliance.md            FCA / SEC framing, language conventions, anti-patterns
├── decisions/                   architecture decision records (ADRs)
│   ├── 0001-expo-managed-with-dev-client.md
│   ├── 0002-supabase-backend.md
│   ├── 0003-backend-ai-not-ondevice.md
│   ├── 0004-modal-for-workers.md
│   └── 0005-llm-over-finbert.md
├── setup/
│   ├── current-state.md         what's been built so far, file-by-file
│   └── local-dev.md             how to run, env vars, Expo Go limits
├── design/                      UI/UX iteration loop (see iteration-plan.md)
│   ├── palette.md               color/typography/spacing tokens
│   ├── iteration-plan.md        protocol + phased backlog for /loop
│   ├── learnings.md             accumulated heuristics + library quirks
│   ├── changelog.md             one entry per loop tick
│   └── references.md            apps + articles informing the design
└── open-questions.md            TBDs blocking deeper design
```

## How to read this

- **New to the project?** Start with [`architecture/overview.md`](architecture/overview.md), then [`setup/current-state.md`](setup/current-state.md) to see what's actually built today.
- **Need to extend a specific area?** Jump to the corresponding `architecture/*.md`.
- **Wondering why we chose X over Y?** Check `decisions/` — short ADRs documenting the call and what would invalidate it.
- **Stuck on what to do next?** [`open-questions.md`](open-questions.md) lists what's unresolved.

## Status (as of 2026-05-11)

| Area | Status |
| --- | --- |
| Mobile shell scaffolded (Expo + expo-router + Supabase client) | ✅ done |
| Auth (sign in / sign up / session persistence) | ⏳ next |
| Supabase schema (users, watchlists, briefings, events) | 📝 designed in `backend.md`, not migrated yet |
| Modal workers (EDGAR poller, briefings, classifier) | ⏳ not started |
| Push notifications via Expo Push | ⏳ not started |
| Compliance copy / disclaimers | 📝 patterns documented, not in UI yet |
| RevenueCat | 🅿️ parked until post-MVP |

Update this table when you ship something — it's the single fastest indicator of where the project is.

## Conventions

- **Diagrams are ASCII.** GitHub renders them in monospace and they survive copy-paste into reviews. Avoid Mermaid for anything load-bearing.
- **ADRs are short** (<300 lines). Title, status, context, decision, consequences, what would invalidate this.
- **"TBD" is a first-class word.** Better to mark something explicitly TBD than to write speculative architecture and have it rot.
- **No marketing language in engineering docs.** This isn't the place to talk about "delighting users." Save it for the pitch deck.

## What's NOT in here

- Product spec, market positioning, monetisation strategy — those belong in SETUP.md / the academic proposal in `/test/`.
- Legal advice — the compliance doc documents *product patterns*, not legal opinions. Budget for a solicitor review pre-launch.
- Detailed UI mocks — Figma / whatever-you-pick later.
