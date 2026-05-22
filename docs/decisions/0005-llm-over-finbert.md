# ADR-0005: LLM (Claude / GPT-4o-mini) over FinBERT for extraction & summarisation

**Date:** 2026-05-11
**Status:** Accepted

## Context

Two core NLP tasks:
1. **Structured extraction** from 8-K Exhibit 99.1 press releases (revenue, EPS, guidance, segments, fiscal period).
2. **Summarisation** of earnings calls — tone, novel topics, guidance change vs prior call — and **synthesis** of pre-earnings briefings.

Options:
1. **General-purpose LLMs** — Claude (Anthropic), GPT-4o-mini (OpenAI).
2. **Financial-domain pretrained models** — FinBERT (Yiyang Liu et al.), FinGPT, BloombergGPT.
3. **Classical NLP + regex/template extraction** — spaCy + custom parsers, plus rule-based summarisation.

## Decision

**General-purpose LLMs (Claude family + GPT-4o-mini), used with structured output (tool use / `response_format`).** Never FinBERT or other domain BERTs.

## Why

### Quality
Recent (2024–2025) work compares FinBERT against GPT-class models on financial NLP benchmarks (sentiment, named-entity, structured extraction). Across multiple papers and benchmarks, **GPT-4-class models match or exceed FinBERT** on most downstream tasks — and dramatically outperform on tasks requiring world knowledge or instruction-following. FinBERT was state-of-the-art in 2019; the field has lapped it.

Specifically for our tasks:

| Task | FinBERT | LLM with structured prompt |
| --- | --- | --- |
| Extract `{revenue, eps, guidance, segments}` from messy HTML | Not its job — would need a separate pipeline | Single call with JSON schema |
| Detect tone shift across two transcripts | Reasonable | Better, with explicit rubric in prompt |
| Spot novel topics not in prior call | Poor (no comparison reasoning) | Strong (in-context comparison) |
| Synthesise a 200-word pre-earnings briefing | Cannot | Native task |

### Cost
- Claude Haiku / GPT-4o-mini: ~$0.25/MTok in, ~$1.25/MTok out. A briefing is ~2k tokens in, ~500 out → ~$0.001 each. 500 briefings/week ≈ $0.50/week.
- Self-hosting FinBERT would require a persistent GPU or CPU process (~$15-50/mo minimum) plus dev time to build extraction pipelines around it that the LLM gets for free via prompting.

LLM API cost is lower than the alternative's infra cost, before counting the time saved.

### Speed of iteration
- LLM behaviour changes via **prompt edits** — minutes, no retraining, versioned in `model_versions.kind='briefing_prompt'`.
- FinBERT changes require fine-tuning runs — hours-to-days, GPU-attached, data-labelling overhead.

For an FYP timeline, prompt iteration is the right granularity.

### Structured-output safety
Both providers now offer first-class structured output:
- Anthropic: tool use with a JSON schema; model is forced to produce valid arguments.
- OpenAI: `response_format: { type: "json_schema", strict: true }`.

This was the historical knock on LLMs for extraction ("they hallucinate fields"). Strict-mode schema enforcement closed that gap. We still validate output post-receipt as defence-in-depth.

## Consequences

**Positive:**
- Single API call covers extraction + summary + reasoning. No multi-stage pipeline.
- Easy to A/B prompts (versioned in `model_versions`).
- Both Anthropic and OpenAI are routable — failover when one has an outage.

**Negative:**
- API dependency. If both providers have a coordinated outage, briefings stall (events still happen because LLM extraction is retried). Acceptable.
- Per-call cost grows linearly with usage. At 10k paying users that's a real number; check pricing math before assuming current ratios hold.
- Some users (paranoia about "AI hallucinations") may distrust LLM-generated briefings. Mitigation: cite the source filing inline, link to the raw Exhibit 99.1 from every briefing screen.

**Neutral:**
- Forbidden-word filter (compliance) is the same regardless of model — LLMs occasionally emit recommendation-style language. See [compliance.md § LLM output](../architecture/compliance.md#llm-output--additional-risk).

## What would invalidate this

- LLM API pricing increases by 5–10× without commensurate alternatives.
- A domain-specific model emerges with materially better extraction *and* a free/self-hostable license. FinGPT 7B might get there; not today.
- A specific failure mode (e.g. consistent misreading of segment-breakdown tables) where a small finetuned model would do better — would build that as a *fallback* for the specific failure, not as a replacement for the main pipeline.

## Alternatives — why not

- **FinBERT.** Sentiment-tuned, not extraction-capable, smaller world knowledge. Wrong tool for our jobs.
- **Self-hosted Llama 3 / Mistral.** Possible to match cost at scale, but operational burden (GPU hosting, queueing, version pinning) isn't worth it at FYP scale. Reconsider at >100k MAU.
- **Classical NLP + regex.** Tried-and-true for predictable formats. Earnings press releases are not predictable — issuers vary table structure, terminology, formatting wildly. We tested this informally on 10 sample 8-Ks; regex/template extraction was ~60% accurate before any tuning; LLM with schema was ~95%.
- **BloombergGPT.** Not publicly available.

## Implementation status

- Nothing built. The routing pattern and structured-output approach are sketched in [ml-pipeline.md](../architecture/ml-pipeline.md) and [data-sources.md § LLM providers](../architecture/data-sources.md#llm-providers).

## Connection to the FYP

The CM3020 rubric values "advanced algorithm" — the **surprise classifier** (supervised ML) is the rubric-centrepiece advanced algorithm, not the LLM. The LLM is plumbing. Make this clear in the write-up: classifier = the rubric's "AI", LLM = production glue for content generation.

This separation also matters for evaluation: the classifier has a holdout, metrics, baselines. The LLM has prompt-versioning, output filtering, and spot-check sampling — different rigour, different rubric category.
