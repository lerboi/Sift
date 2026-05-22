# ADR-0004: Modal for Python workers

**Date:** 2026-05-11
**Status:** Accepted

## Context

We need a place to run:
- An always-listening EDGAR poller
- Scheduled cron jobs (briefings every 30 min, transcripts post-market, classifier retrain weekly)
- On-demand LLM extraction triggered by new filings
- Weekly model training (potentially with a GPU)

Options:
1. **Modal** (serverless Python, scale-to-zero, native cron + GPU)
2. **AWS Lambda + EventBridge** (but Python with heavy ML deps is awkward)
3. **A VPS running cron + a Python process** (cheap, manual)
4. **Cloudflare Workers** (no Python, deal-breaker)
5. **Render / Railway / Fly background workers** (paid 24/7 even when idle)
6. **Supabase Edge Functions** (Deno only, no Python, can't run heavy ML)

## Decision

**Modal** for all Python workers, including cron and event-driven jobs.

## Why Modal specifically

- **Scale-to-zero economics.** Idle costs ~$0. Pay only for execution seconds. Perfect for an FYP that's mostly idle.
- **First-class cron.** `@app.function(schedule=modal.Cron("..."))` deploys schedules with the code. No EventBridge / SQS / Step Functions plumbing.
- **GPU on demand.** `gpu="T4"` for the classifier retrain. No persistent GPU spend.
- **Long-running functions.** EDGAR poller can run as a `Period(seconds=60)` job; we don't need a fragile keep-alive on a VPS.
- **Python-first.** Our ML stack (xgboost, scikit-learn, pandas, anthropic, openai, sec-edgar tools) is Python. No language hop.
- **Secrets.** `modal.Secret.from_name("supabase-secret")` makes the service-role key safe — never in git, never in env files.
- **Free credits.** Historically $30/month free credit, more than enough for FYP-scale workloads.

## Consequences

**Positive:**
- Single deploy command (`modal deploy`). Modal's scheduler takes over.
- Cold-start tolerable for cron jobs; `keep_warm=1` for latency-critical (EDGAR poller).
- Easy to add a one-off `modal run app.py::function_name` for ad-hoc backfills.
- Mostly fits in free credits at MVP; cost grows linearly with usage.

**Negative:**
- **Modal-specific code shape.** `@app.function` decorators, `modal.Image`, `modal.Secret` couple our code to Modal. Migration cost if we leave: medium.
- **Vendor risk.** Modal is a startup. If they raise prices significantly or shut down, we replan. Risk is real but acceptable for FYP-scale.
- **Egress IP rotates.** SEC EDGAR sees different IPs across function invocations. Should not be a problem given polite rate-limiting + UA, but if SEC ever wants to IP-whitelist us we'd need Modal Static IPs (paid add-on).
- **No easy local dev story for the always-on poller.** Running it locally requires Modal CLI's `modal serve` (dev mode).

**Neutral:**
- Logs live in Modal's UI. Adequate. Real production monitoring would add Sentry / OpenTelemetry; out of MVP scope.

## What would invalidate this

- Modal's free tier shrinks below our usage.
- Modal as a company changes hands and the product direction shifts.
- We need a feature only available in another platform (e.g. tight-loop, sub-second cron — currently no plan for this).

## Alternatives — why not

- **AWS Lambda.** Python possible with layers, but heavy ML deps make package size painful; EventBridge cron is a separate service; cold starts on Python-with-numpy are slow. The combined config is unfun.
- **VPS (DigitalOcean $5/mo).** Cheapest in steady state, but every "ops" task (deploys, secrets, log retention, restarts after OOM) is yours. Two evenings/month of toil at minimum. Modal removes all of that.
- **Render / Fly background workers.** Pay 24/7 even when idle. ~$7-15/month/worker. Multiple workers add up.

## Implementation status

- Nothing built yet. The Modal project will live at `/modal/` per the design in [ml-pipeline.md](../architecture/ml-pipeline.md).
- Decision recorded ahead of implementation so the file structure and Modal-specific patterns are intentional, not accidental.
