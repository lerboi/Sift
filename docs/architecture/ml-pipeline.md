# ML & LLM Pipeline

Everything "intelligent" Sift does runs on Modal (Python, scale-to-zero). The app fetches finished output from Supabase. No ML on the device — see [ADR-0003](../decisions/0003-backend-ai-not-ondevice.md) for why.

There are four AI/ML components:

| Component | Type | Trigger | Latency budget |
| --- | --- | --- | --- |
| Pre-earnings briefing | LLM (Claude / GPT-4o-mini) | cron every 30 min | ≤2 min per briefing |
| 8-K extraction | LLM, structured output | event-driven (poller) | **≤10s per filing** |
| Surprise classifier | Supervised ML (XGBoost or small NN) | called by briefing generator | <100ms/inference |
| Transcript analysis | NLP (embeddings + LLM) | cron post-market | ≤5 min per transcript |

## Modal project layout (target — not yet created)

```
modal/
  sift_workers.py             ← entrypoint, `app = modal.App("sift")`
  image.py                    ← shared `modal.Image`
  secrets.py                  ← Supabase + LLM keys via `modal.Secret`
  storage/
    supabase_client.py        ← server-side client (sb_secret_...)
  edgar/
    poller.py                 ← always-on listener
    parser.py                 ← extracts Exhibit 99.1 fields with LLM
  briefings/
    generator.py              ← cron, builds + writes briefings
    prompts/
      v1.md                   ← prompt templates (versioned)
  classifier/
    train.py                  ← weekly cron
    predict.py                ← loaded on-demand by generator.py
    features.py               ← feature engineering, shared train/predict
  transcripts/
    fetcher.py                ← post-market cron, source switching
    analyser.py               ← embeddings, tone, novelty
  push/
    fanout.py                 ← optional: replaces Edge Function
  utils/
    rate_limit.py             ← polite SEC EDGAR limiter
    versioning.py             ← writes model_versions rows
```

One Modal app (`sift`), many functions. Deploy with `modal deploy modal/sift_workers.py`. Each function declares its own `image=`, `secrets=`, `schedule=`, `gpu=` as needed.

## EDGAR poller (the latency-critical one)

```python
@app.function(
    schedule=modal.Period(seconds=60),     # always-on tick
    image=light_image,
    secrets=[supabase_secret, edgar_secret],
    timeout=120,
)
def edgar_poll():
    last_seen = state.get("last_accession")
    feed = fetch_latest_filings_json()      # 1 req
    new_filings = filter_8k_item_2_02(feed, since=last_seen)
    for filing in new_filings:
        parse_and_publish.spawn(filing)     # fan out, non-blocking
    state.set("last_accession", feed.cursor)
```

- `Period(seconds=60)` is the minimum Modal cron granularity. Acceptable: EDGAR's `latest-filings` JSON refreshes every few seconds during market hours, and we want to be polite. Sub-minute polling is overkill.
- **`User-Agent` is mandatory**: SEC bans IPs without a contact email. Use `Sift FYP / contact@yourdomain.example`.
- **10 req/s rate limit** — `utils/rate_limit.py` wraps `httpx` with a token bucket. Plenty of headroom: one poll burns 1–3 reqs.
- **Single-instance:** `concurrency_limit=1`, `keep_warm=1` so we don't double-poll.

State is a `modal.Dict` keyed on `"last_accession"`. Surviving a restart matters — without it we'd re-process old filings on every cold start.

## 8-K parser

Triggered per filing by `parse_and_publish.spawn()`. Each call is independent (idempotent on `accession_number`).

```python
@app.function(image=parser_image, secrets=[supabase_secret, llm_secret])
def parse_and_publish(filing: Filing):
    html = fetch_exhibit_99_1(filing.exhibit_url)
    # cache raw to Supabase Storage for replay / debugging
    upload_to_storage(f"raw-filings/edgar/exhibits/{filing.accession}/99.1.html", html)

    extracted = llm_extract(html, schema=EXHIBIT_SCHEMA)   # JSON mode
    if not extracted.is_valid():
        mark_event(filing, status="failed", error=extracted.error)
        return

    insert_event(filing, extracted)
    insert_event_metrics(filing.id, extracted, surprise=compute_surprise(...))
    # → notifications fan out via Edge Function trigger on events insert
```

**Why LLM, not regex / FinBERT?** Press release format varies wildly between issuers. Earnings tables vs prose, sometimes embedded in PDFs, sometimes with parenthetical YoY noise. A constrained-output LLM call (~1k tokens in, ~300 tokens out, structured JSON) is more robust than a parser library and cheaper than building one. See [ADR-0005](../decisions/0005-llm-over-finbert.md).

**Structured output:** use Anthropic's [tool-use schema] or OpenAI's `response_format: json_schema`. Specify the exact schema in `EXHIBIT_SCHEMA` — revenue, EPS, guidance, segment_breakdown, fiscal_period. Reject and retry on schema-violating output.

**Latency:** the LLM call is the bottleneck (~3–6s with Claude 4.x Haiku, ~2–4s with GPT-4o-mini). Total filing → event row: ~8–12s p50. End-to-end push budget is 15s (see [realtime-and-push.md](realtime-and-push.md)).

## Briefing generator (cron, batch)

```python
@app.function(schedule=modal.Cron("*/30 * * * *"), image=briefing_image)
def generate_pending_briefings():
    upcoming = supabase.from_("upcoming_earnings_view").select("*").limit(50).execute()
    for row in upcoming.data:
        if not briefing_exists(row.ticker, row.fiscal_period):
            features = build_features(row.ticker, row.fiscal_period)
            prediction = surprise_predict(features)         # local model
            content = llm_synthesise(features, prediction, prompt=load_prompt("v1"))
            upsert_briefing(row.ticker, row.fiscal_period, content, prediction)
```

Idempotency comes from the unique `(ticker_symbol, fiscal_period)` index on `briefings`. Re-running is safe.

`load_prompt("v1")` reads the active prompt version from `model_versions` where `kind='briefing_prompt' AND status='active'`. Prompt iteration without a deploy is a feature, not gold-plating — you'll iterate on the briefing voice constantly.

## Surprise classifier (the FYP "advanced algorithm")

This is the **CM3020 rubric centrepiece**. Treat with corresponding rigour.

**Task:** given features known *before* an earnings release, predict probability distribution over { beat (>0%), meet (±0%), miss (<0%) } on EPS surprise. Multi-class with calibrated probabilities.

**Candidate features (no leakage — only data available pre-release):**
- Consensus EPS + revenue, 30/60/90 day estimate revisions
- Last 4 quarters: actual vs consensus, surprise %, stock reaction
- Beat-streak / miss-streak length
- Sector aggregates: average sector surprise this quarter so far
- Macro context: VIX level, sector ETF momentum
- Guidance from last call (LLM-extracted directional sentiment from `transcript_analysis`)
- Days since IPO (proxy for analyst coverage maturity)
- Insider transactions in the prior quarter

**Algorithm — TBD:**
- **XGBoost** — likely default. Strong on tabular, calibrated probabilities via `predict_proba`, fast to train, interpretable via SHAP, robust to mixed scales.
- **Small NN (PyTorch / Keras)** — 2-3 hidden layers, would let us cite "neural network" in the FYP write-up. More overhead, marginal accuracy gain on tabular financial data per literature.

A defensible FYP plan: implement both, train on the same dataset, compare on holdout, write up the comparison. The rubric rewards methodology more than the absolute number.

**Training cadence:**
```python
@app.function(
    schedule=modal.Cron("0 6 * * SUN"),     # weekly, Sunday 6am UTC
    gpu="T4",                                 # only for the NN variant
    image=training_image,
    secrets=[supabase_secret],
)
def retrain_classifier():
    df = load_training_data()
    train, val, test = time_split(df, val=0.1, test=0.1)
    model = fit_xgboost(train)   # or fit_nn(train)
    metrics = evaluate(model, val, test)
    if metrics["test_logloss"] < current_active_metrics()["test_logloss"]:
        artifact_path = save(model, version=next_version())
        register_model(kind="surprise_classifier", version=...,
                       storage_path=artifact_path, metrics=metrics,
                       status="staged")
    # promotion is a manual step or a separate `promote()` function
```

**Inference:** the generator loads the active model into memory once per container, calls `.predict_proba(features)` per ticker. Caching the model across invocations is automatic with Modal — `keep_warm=1` keeps a hot container during peak earnings days.

**Evaluation harness — required for FYP:**
- Time-respecting train/val/test split (never random — would leak future into past).
- Baselines: predict-always-beat, predict-prior-quarter-surprise, simple-logistic.
- Metrics: log loss (calibration), Brier score, top-class accuracy, **economic backtest** (would acting on these predictions have made simulated money — for academic value, with explicit "not investment advice" disclaimers).
- Confusion matrix per sector.

Write this up in the proposal. It's the bit that elevates the FYP from "a CRUD app with an LLM" to "AI project".

## Transcript analyser

```python
@app.function(schedule=modal.Cron("0 22 * * MON-FRI"), gpu=None)
def analyse_recent_transcripts():
    fresh = find_unanalysed_transcripts()
    for t in fresh:
        segments = split_to_segments(t.text)
        embeddings = embed_batch([s.text for s in segments])    # OpenAI or Cohere
        save_segments_with_embeddings(t.id, segments, embeddings)

        # tone: zero-shot via LLM with rubric prompt
        tone = classify_tone(segments)
        # novelty: cosine distance vs nearest neighbour in last 4 transcripts
        novelty = compute_novelty(t.id, embeddings)
        # guidance changes: LLM diff vs prior transcript's guidance section
        guidance_changes = diff_guidance(t.id)

        summary = llm_summarise(segments, tone, novelty, guidance_changes)
        upsert_transcript_analysis(t.id, summary, tone, novelty, guidance_changes)
```

Embeddings stored in pgvector (see [backend.md](backend.md)). Cosine similarity for novelty detection is a one-line SQL with `<=>` operator.

**Fallback strategy** for transcript sources is documented in [data-sources.md](data-sources.md) — single-point-of-failure mitigation.

## Versioning + the `model_versions` table

Every ML/LLM artefact gets a row:

```
kind                  version   status    metrics
surprise_classifier   1.0.0     retired   {logloss: 0.97}
surprise_classifier   1.1.0     active    {logloss: 0.91}
surprise_classifier   1.2.0     staged    {logloss: 0.89}    -- newer but unpromoted
briefing_prompt       1.0       active    {}
briefing_prompt       1.1       staged    {}
```

`status='active'` is what production reads. Promotion is intentionally manual (or a separate `promote(version)` function) so a regression caught in staged doesn't immediately hit users.

Storage paths point into the `models` bucket in Supabase Storage. Hashes prove integrity. See [backend.md § model_versions](backend.md).

## Cost picture

Per SETUP.md:
- LLM is the biggest spend. Briefings (~2k tokens each, ~500 briefings/week) + extractions (~1.5k each, varies) ≈ $20–50/month at MVP.
- Modal: scale-to-zero means most hours cost nothing. EDGAR poller costs ~$5–10/month idle. Training jobs are pennies.
- Embeddings: ~$5/month for transcripts.

Stay under the SETUP.md MVP ceiling of $50–110/month by:
- Routing to cheap models (Claude Haiku, GPT-4o-mini) for high-volume work; Sonnet/Opus for hand-validation of prompt iterations only.
- Caching extraction results — never re-call the LLM on the same `accession_number`.
- Embeddings only on transcript segments, not on every utterance.

## What this doc deliberately leaves open

- **XGBoost vs small NN.** Decide during build with a real holdout comparison.
- **Edge Function vs Modal-side push fan-out.** Either works; pick when implementing.
- **Transcript provider order.** Documented in [data-sources.md](data-sources.md), priorities will adjust as we learn each provider's reliability.
- **Prompt voice for briefings.** Will iterate constantly. Versioned prompts make this safe.
