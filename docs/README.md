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
│   ├── backend.md               Supabase: one-page overview (detail in ../backend/)
│   ├── ml-pipeline.md           backend ML: surprise classifier + LLM briefings
│   ├── data-sources.md          EDGAR, Finnhub, transcripts, press wires — limits & fallbacks
│   ├── realtime-and-push.md     "filing hits → device buzzes" latency budget
│   ├── compliance.md            FCA / SEC framing, language conventions, anti-patterns
│   └── live-activities.md       post-MVP stub spec: lock-screen + Dynamic Island
├── backend/                     backend working detail — read for Phase 12 build
│   ├── README.md                folder map + naming conventions
│   ├── conventions.md           Supabase + Postgres best practices
│   ├── schema.md                every table, column, constraint, index
│   ├── rls-policies.md          every row-level-security policy
│   ├── triggers-and-functions.md  DB triggers + edge functions
│   ├── realtime.md              channel patterns
│   ├── views-and-rpcs.md        derived data (Home feed, Discover rails, ticker detail)
│   ├── migrations.md            ordered migration plan + setup
│   ├── frontend-wiring.md       surface-by-surface query map
│   └── iteration-plan.md        per-tick build sequence (loop contract)
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

## Status (as of 2026-05-25)

| Area | Status |
| --- | --- |
| Mobile shell scaffolded (Expo + expo-router + Supabase client) | ✅ done |
| UI / UX iteration loop (Phase R + Phases 0–10) | ✅ shipped over 77 ticks; see `design/changelog.md` |
| Auth — client-side (sign in / sign up / Google OAuth PKCE / encrypted session storage) | ✅ shipped (Phase 10, ticks 65–68) |
| Compliance copy / disclaimers / ack flow | ✅ shipped in onboarding (P9-3) + Settings disclaimer screen (P7-4) |
| Backend plan documented | ✅ in `backend/` — 9 detailed docs ready for Phase 12 loop |
| Supabase schema (migrations applied) | ⏳ next — Phase 12 (B1–B15 in `backend/iteration-plan.md`) |
| Supabase dashboard config (providers, redirect URLs, runtime params) | ⏳ user action — see `backend/iteration-plan.md` § Pre-loop checklist |
| Modal workers (EDGAR poller, briefings, classifier) | ⏳ Phase 13 (M1–M9) — after Phase 12 |
| Push notifications via Expo Push | ⏳ Phase 12 (B10 + B12) |
| RevenueCat / subscriptions | 🅿️ parked until post-MVP |

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
