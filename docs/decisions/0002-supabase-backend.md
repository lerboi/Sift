# ADR-0002: Supabase as backend

**Date:** 2026-05-09
**Status:** Accepted

## Context

Sift needs:
- Auth (email/password, OAuth)
- Postgres for user data + ML/LLM-produced catalog data
- Object storage for raw filings, transcripts, model artefacts
- Real-time updates pushed to the app
- Server-side functions to fan out push notifications
- A path to multi-tenant SaaS without re-platforming

Options considered:
1. **Supabase** (Postgres + auth + storage + edge functions + realtime)
2. **Firebase** (Firestore + auth + cloud functions + storage)
3. **Custom backend** (Node/Python + Postgres + S3 + own auth)
4. **AWS Amplify**

## Decision

**Supabase.**

## Consequences

**Positive:**
- **Postgres, not Firestore.** Earnings data is relational (tickers ↔ briefings ↔ events ↔ users). Joins, transactions, foreign keys, RLS, `pgvector` for transcript embeddings — Firestore would force NoSQL contortions for the same shape.
- **RLS = built-in multi-tenancy.** One policy per table replaces 200 lines of API authorisation code. Audit-friendly.
- **Single SDK** for auth + DB + storage + realtime, well-supported on React Native.
- **`pgvector` extension** is a click. Needed for transcript novelty detection.
- **Free tier is generous** for FYP-scale (500MB DB, 1GB storage, 50k MAU, 2GB egress). MVP fits inside it.
- **Owned data.** Postgres + open formats. Migration off Supabase = `pg_dump`, not a vendor extraction project.

**Negative:**
- **Edge Functions run on Deno**, not Node. Different ecosystem; some npm packages don't work. We've routed around this by keeping heavy logic in Modal (Python) and using Edge Functions only for the notification fan-out.
- **Realtime has limits.** Channel count and message rate caps on the free tier are fine at MVP but would need monitoring at SaaS scale.
- **Cold-start latency** on Edge Functions (~100-400ms). Tolerable for our use cases; would be a problem for sub-100ms API responses (we don't have those).

## What would invalidate this

- Postgres can't keep up with our query load (years away).
- Auth provider lock-in becomes painful (export path exists: `auth.users` is just a Postgres table — could migrate to a self-hosted GoTrue or Auth0 with some friction).
- A pricing change that makes the Pro tier (~$25/mo) untenable at our user scale.

## Alternatives considered

- **Firebase.** Strong DX but Firestore's data model is wrong for relational earnings data; auth is fine but coupling to Google ecosystem is heavier. RLS-equivalent (security rules) is more limited.
- **Custom backend.** Maximum flexibility, but solo-dev time tax is brutal. Two months of plumbing before any product work.
- **AWS Amplify.** Powerful but the cognitive overhead of AWS dwarfs Supabase. Justifiable at 100k users, not at 10.

## Implementation status

- Done: client wired in `lib/supabase.js`; AsyncStorage session adapter; URL polyfill; `.env` pattern.
- Pending: schema migrations (designed in [backend.md](../architecture/backend.md)), RLS policies, Edge Function for push fan-out.

## Cross-cutting note

The **publishable / secret** key split (new Supabase API key system) maps cleanly to our trust model:

- **Publishable** ships in the app bundle. Safe by design.
- **Secret** stays in **Modal** (`modal.Secret`) and never enters the app or any environment Modal doesn't control.

This separation is reflected in `.env` patterns and the [backend.md § RLS](../architecture/backend.md#row-level-security-rls-principles) policies (only service-role writes catalog data; users can only read).
