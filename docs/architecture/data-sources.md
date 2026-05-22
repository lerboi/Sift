# External Data Sources

Sift's value comes from being **fast** and **right** about earnings. Both depend on the upstream feeds. Every source is described here with limits, costs, and what fails when it breaks.

| Source | Used for | Cost | Hard limit | Failure plan |
| --- | --- | --- | --- | --- |
| SEC EDGAR | 8-K detection, filing fetch | free | 10 req/s per IP, polite UA mandatory | Exponential backoff; nothing replaces EDGAR |
| Finnhub (free tier) | Earnings calendar, consensus | free | 60 calls/min | Alpha Vantage fallback (lower-quality consensus) |
| earningscalls.dev | Transcript primary | ~$20–50/mo | varies | API Ninjas → Motley Fool scrape |
| API Ninjas | Transcript secondary | ~$10–30/mo | free tier 50/mo, then paid | Motley Fool scrape |
| Motley Fool free | Transcript tertiary | free | rate-limited, scraped | Manual gap-fill |
| PR Newswire / BusinessWire RSS | Pre-market release detection | free | RSS polling | Multiple wires polled in parallel |
| Alpha Vantage | Price history, intraday | free tier | 25 req/day free, 75/min on $50/mo | Finnhub price endpoint |
| Anthropic / OpenAI | LLM (briefings, extraction) | usage-based | tier-based RPM | Failover between vendors |

---

## SEC EDGAR

The single most important data source. **Earnings releases hit EDGAR before they hit any aggregator.** Anything we can shave off our EDGAR detection time is competitive moat.

### Endpoints we use

| Endpoint | Purpose | Refresh cadence |
| --- | --- | --- |
| `https://www.sec.gov/cgi-bin/browse-edgar?...&type=8-K&output=atom` | RSS firehose (per-issuer or all) | ~10 min during market hours |
| `https://www.sec.gov/Archives/edgar/data/{cik}/...index.json` | Index of filings per issuer | seconds |
| `https://efts.sec.gov/LATEST/search-index?q=...` | EDGAR full-text search | seconds (real-time-ish) |
| `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=8-K&dateb=&owner=include&count=40&action=getcompany` | Latest filings list | refresh every few seconds |

**The detection trick:** RSS lags. The "latest filings" page and the `efts.sec.gov` index are much fresher (~seconds vs ~10 minutes). The cost is they're not officially documented as APIs. Sift polls the latest-filings index every 60s — fast enough, well under rate limit, doesn't depend on documented behaviour we'd regret relying on.

### Compliance with SEC fair access

Non-negotiable, and EDGAR will block your IP if you ignore them:

1. **`User-Agent` must include contact info.** Format: `Sift FYP / leroyzzng@gmail.com`. They've banned generic UAs like `python-requests/2.x`.
2. **Rate limit: 10 requests/second per IP.** Token bucket in `utils/rate_limit.py`. Plan for 1–3 req per poll cycle; we're nowhere near the ceiling.
3. **No scraping during outage windows** (rare; SEC publishes maintenance notices).
4. **Be a good citizen.** If your job fails 10x in a row, back off — don't hammer.

If EDGAR blocks the Modal egress IP, the entire app stops working. Modal does NOT offer static IPs by default; this is a real risk if our request pattern looks abusive. Mitigation: respect the limit, log everything, alert on 403/429.

### 8-K Item 2.02 specifics

- Earnings releases are filed as **8-K with Item 2.02** ("Results of Operations and Financial Condition").
- The actual press release is **Exhibit 99.1**, a separate HTML/PDF file linked from the 8-K index.
- Some issuers file a 10-Q or 10-K simultaneously — those are the full financials. The 8-K Exhibit 99.1 is the digestible summary we extract.
- After-hours releases: 4:00pm–6:00pm ET is the bulk. Pre-market: 7:00am–9:30am ET.

### What to cache

- **Raw 8-K index page** → Supabase Storage `raw-filings/edgar/8K/{accession}.html`. Lets us replay parses without re-hitting EDGAR.
- **Exhibit 99.1** → `raw-filings/edgar/exhibits/{accession}/99.1.html`.
- **Cursor state** (`last_accession_seen`) in `modal.Dict` so restarts don't reprocess.

---

## Finnhub (earnings calendar + consensus)

Free tier: 60 calls/minute. Adequate for MVP — we poll the calendar maybe every 30 minutes.

| Endpoint | Purpose |
| --- | --- |
| `/calendar/earnings` | Next 30 days of expected releases, consensus EPS + revenue |
| `/stock/earnings` | Historical actuals + estimates per ticker |
| `/quote` | Real-time-ish prices |

**Watch out for:**
- Consensus values can change as analysts revise. Snapshot the consensus at briefing-generation time into `briefings.consensus_eps`; don't compute surprise from a moving target.
- Free tier excludes some endpoints (real-time WebSocket, sentiment). We don't need them at MVP.
- Quality drops outside US large-caps. Fine for Russell 1000.

**Fallback:** Alpha Vantage has an `EARNINGS_CALENDAR` and `EARNINGS` endpoint. Different format, lower coverage, but free tier (25/day) is enough for emergency use.

---

## Transcripts (the wobbliest leg)

Earnings call transcripts are the single point of failure in this architecture. No free, comprehensive source exists.

### Primary: earningscalls.dev

- Costs ~$20–50/month depending on volume.
- API key auth. JSON response with speaker tags.
- Coverage: most large/mid-cap US equities, transcripts available 1–6 hours post-call.
- **Don't rely on freshness within minutes** — these are human-transcribed with a delay.

### Secondary: API Ninjas

- Free tier 50/month, paid tiers cheap.
- Lower coverage, less complete transcripts.
- Useful as a smoke check: if primary fails, this often has at least the prepared-remarks portion.

### Tertiary: Motley Fool transcript scrape

- Free, but **respect their robots.txt and ToS**. Light, polite scraping. Cache aggressively.
- Coverage is excellent for S&P 500.
- Quality varies — some transcripts are summaries, not verbatim.
- Use as a gap-filler, not a routine source. Don't make this primary.

### Avoid at MVP

- **Financial Modeling Prep** — $200/month is a non-starter for an FYP solo dev. Excellent quality, but not while we're not making revenue.
- **Bloomberg / Refinitiv** — enterprise pricing.

### Source-switching pattern

```python
TRANSCRIPT_SOURCES = [
    ("earningscalls_dev", fetch_earningscalls),
    ("api_ninjas", fetch_api_ninjas),
    ("motley_fool", fetch_motley_fool),
]

def fetch_transcript(ticker, fiscal_period):
    for name, fetcher in TRANSCRIPT_SOURCES:
        try:
            text = fetcher(ticker, fiscal_period)
            if is_valid_transcript(text):
                return text, name
        except Exception as e:
            log.warning("source failed", source=name, exc_info=e)
    raise NoTranscriptAvailable(ticker, fiscal_period)
```

Persist the winning source in `transcripts.source` for traceability — useful when investigating quality drift.

---

## Press wires (pre-market detection)

Some companies issue earnings via press wire **minutes before** the 8-K hits EDGAR. Catching this gives us a head start.

**Sources to poll:**
- PR Newswire RSS — `https://www.prnewswire.com/rss/news-releases-list.rss`
- Business Wire — `https://www.businesswire.com/portal/site/home/news/`
- GlobeNewswire — `https://www.globenewswire.com/rssfeed/`
- Cision PR — `https://www.cision.com/us/news/`

**Strategy:**
- Poll each every 30–60s pre-market (6:30am–9:30am ET) and post-close (4:00pm–8:00pm ET).
- Filter for headlines matching `[ticker symbol] AND (earnings|results|quarterly|Q[1-4])`.
- If a match is found before EDGAR sees the 8-K, generate a *provisional* event and revise when the 8-K lands.

**Risk:** false positives. Pre-announcements ≠ earnings releases. Stage these as `events.status='wire_detected'` separately from EDGAR-confirmed.

---

## Alpha Vantage (price history)

Used for:
- Reaction analysis: how did the stock move in the 30 minutes after a release?
- Backtests of the surprise classifier's economic value.
- Charts in the UI (sparkline next to the briefing).

Free tier: 25 req/day, 5/min. Bad for production but fine for batch backtests overnight.

Paid tier ($50/mo) lifts to 75/min, 1 year of intraday history. Not needed at MVP.

**Alternative:** Finnhub also has prices. Use whichever is freshest at the moment.

---

## LLM providers

Two vendors for resilience and prompt-comparison:

### Anthropic (Claude family)
- Strongest on structured output via tool-use.
- Haiku tier is the cheap workhorse: ~$0.25/MTok in, ~$1.25/MTok out.
- Sonnet/Opus for prompt iteration validation only.
- Rate limits: tier-based, plenty for our volume.

### OpenAI
- GPT-4o-mini: comparable to Haiku on price/quality.
- `response_format: json_schema` for guaranteed-valid JSON.
- Good fallback when Anthropic has an outage (yes, both providers have outages).

### Routing pattern

```python
@retry(stop=stop_after_attempt(3))
def llm_extract(html, schema):
    try:
        return anthropic_call(html, schema, model="claude-haiku-4-5")
    except (RateLimitError, APIStatusError):
        return openai_call(html, schema, model="gpt-4o-mini")
```

The user-facing failure mode: briefing marked `pending`, retried by the next cron tick. Event extractions retry inside the parse function with exponential backoff (latency-critical path).

### What we DON'T do

- **No FinBERT or other financial-domain BERT models.** A 2024–2025 research thread (cited in SETUP.md) consistently shows GPT-4-class models beat FinBERT on financial sentiment + extraction at comparable or lower cost. See ADR-0005.
- **No fine-tuning** at MVP. Prompt-engineering reaches "good enough" for these tasks; fine-tuning is months of work that we'd have to redo when models update.

---

## Where each source plugs into the architecture

```
EDGAR        → Modal.edgar_poller        → events table
Finnhub      → Modal.briefing_generator  → briefings, event_metrics.consensus_*
Transcripts  → Modal.transcript_fetcher  → transcripts (text + Storage cache)
Press wires  → Modal.wire_poller         → events (status='wire_detected', upgraded by EDGAR)
Alpha Vantage→ Modal.price_fetcher       → events.reaction_30min, classifier training set
LLMs         → Modal.* (briefings, extraction, transcript summary, novelty)
```

Every source has its own Modal Secret. Rotating any one key is a single command.

---

## Operational concerns

- **Cost monitoring:** log token counts per LLM call to Postgres (`llm_calls` audit table, optional). Cheap insurance against a runaway prompt.
- **Provider health:** a `data_source_status` table with last-success-at and last-error-at per source, scraped by a 5-minute heartbeat. Surface in an admin screen when we build one.
- **Backups:** the cold cache in Supabase Storage is the safety net. If a provider deletes content, we still have it. Configure Storage versioning when available.
