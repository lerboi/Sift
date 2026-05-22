# ADR-0003: Backend AI instead of on-device TFLite

**Date:** 2026-05-11
**Status:** Accepted — reverses an earlier draft decision

## Context

The original FYP plan (early `SETUP.md`) called for **on-device ML inference via TFLite**. The model would be trained in Python (later on Modal), exported to `.tflite`, shipped via Supabase Storage, downloaded by the app on first launch and cached on device. `react-native-fast-tflite` would handle inference.

That plan suited a personal-strategy app (per-user model: train against the user's preferences / history, predict things only relevant to that user).

The product, as it now stands in `SETUP.md`, is **not that**. Sift's ML output is **per-ticker**, not per-user:

- A pre-earnings briefing for AAPL is identical for every user who watches AAPL.
- A surprise classifier prediction for AAPL Q1-2026 has one correct output, shared by all watchers.
- 8-K extractions and transcript analyses are per-filing, per-transcript — not per-user.

## Decision

**All AI / ML runs server-side on Modal. The app reads finished output from Supabase. No on-device inference.**

## Why this is now obviously correct

| Dimension | On-device | Backend |
| --- | --- | --- |
| Compute cost | Free per inference, but per-user duplication | One inference per ticker per event, shared by all watchers. Massively cheaper. |
| Latency | <100ms once cached | Network round-trip + cache hit ≈ 100-300ms total. Same order. |
| Battery / device size | TFLite runtime adds ~10-20MB + memory pressure | Zero device cost |
| Model updates | Ship via Storage → new bundle, possibly App Store re-review for breaking changes | Update server, every user benefits immediately |
| Privacy story | Strong — no user data leaves device | Neutral — we never had identifiable user data anyway (per-ticker shared compute) |
| Regulatory fit | "On-device" is sometimes marketed as more compliant; here it doesn't change the publisher's-exclusion analysis | Backend, **impersonal** computation actively reinforces the *impersonal* prong of SEC § 202(a)(11)(D) |
| Operational complexity | Two ML paths (training in Python, inference in JS/TFLite) | One language end-to-end (Python) |

The clincher: **per-ticker AI means caching is free** (Postgres rows). Every watcher of AAPL hits the same cached briefing. On-device computation would have every user's phone recompute the same answer.

## Consequences

**Positive:**
- Lower bill (LLM calls per ticker, not per user × ticker).
- Single-language ML stack (Python on Modal).
- No `react-native-fast-tflite` integration work, no app-store re-review when models change.
- Stronger compliance argument: the AI is *literally impersonal* — same compute, same output, every user.
- Simpler dependency tree on the app side.

**Negative:**
- App is useless without network — but it was anyway (data lives in Supabase).
- We pay ongoing LLM costs (was: free per inference after model ship). Quantified in [ml-pipeline.md § cost picture](../architecture/ml-pipeline.md#cost-picture).
- Modal is now load-bearing operationally. Mitigation: scale-to-zero economics, easy redeploys, multi-region option later.

**Neutral:**
- Loses an "on-device AI" marketing angle. Not material — we're not selling to a privacy-focused niche.

## What would invalidate this

- The product pivots to personal-strategy AI (user provides preferences, model adapts per-user). Would re-open this decision.
- Supabase Realtime / Postgres reads become a bottleneck for ML inference cache (years away, fixable by other means before reverting to on-device).
- LLM costs balloon out of proportion to revenue. Even then, the answer would be cheaper models + caching, not on-device — because the per-user duplication problem is intrinsic to the architecture.

## Alternatives considered (briefly)

- **Hybrid:** on-device classifier, backend LLM. Compromises both — adds the TFLite runtime cost without solving anything our backend-only plan doesn't already solve.
- **ExecuTorch (PyTorch) on-device.** Same arguments apply; this is about *where* the model runs, not the runtime.
- **On-device for users who opt in to "privacy mode".** Premature feature; revisit if we ever get a regulatory or marketing reason.

## Implementation status

- The frontend has **no** TFLite-related dependencies. Earlier scaffold instructions mentioned `react-native-fast-tflite`; none was installed.
- Modal ML pipeline design lives in [ml-pipeline.md](../architecture/ml-pipeline.md).
- The `model_versions` table in Postgres still exists — it tracks server-side model artefacts now, not on-device downloads.

## Note for the FYP write-up

The CM3020 proposal should reference this decision and connect it to:
1. The economic argument (per-ticker not per-user).
2. The regulatory argument (impersonal compute → publisher's exclusion).

Both are substantive engineering decisions, not just preferences — exactly the kind of analysis the rubric rewards.
