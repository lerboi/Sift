# Compliance & Product Framing

**Not legal advice.** This doc captures the product patterns and language conventions that keep Sift on the educational/research side of FCA (UK) and SEC (US) lines. A solicitor / securities lawyer review before commercial launch is non-negotiable. For the FYP itself, this framing matters because the regulators have been actively scoping "information provider" apps and the academic graders will check for it.

## The bright line

The legal concepts we orbit are:

- **FCA — Personal Recommendation** (PERG 8.30B). Advice that is *presented as suitable* for a specific person, or based on their circumstances. Triggers regulated activity (advising on investments). **We never cross this.**
- **SEC — Investment Adviser** (Investment Advisers Act 1940 § 202(a)(11)). Anyone who, for compensation, advises others as to the value of securities or the advisability of investing/buying/selling, **unless** the publisher's exclusion applies.
- **Publisher's exclusion** (§ 202(a)(11)(D)). Carves out *bona fide, regular-circulation, non-personalised* commentary. **Sift's framing depends on staying inside this exclusion.**

The three conditions of the publisher's exclusion, restated:
1. **Bona fide commentary.** Not a wrapper around stock-touting.
2. **Impersonal.** Not tailored to individual subscriber portfolios or circumstances.
3. **Regular, public circulation.** A subscription model is fine; selectively pushing different content to different users is not.

## What this means for Sift's design

### ✅ Product patterns we use

| Pattern | Why it's fine |
| --- | --- |
| Generic factual signals ("AAPL beat consensus by 8.1%") | Information, not recommendation |
| User-curated watchlists, app reports facts about them | User chose what to watch; we report, we don't suggest |
| Educational content ("how to read a 10-Q") | Outside the scope of personal recommendation |
| Hypothetical backtests, clearly labelled hypothetical | Not personalised, not actionable |
| Surprise probability ("65% chance of beat") with explicit caveat that this is a model prediction | Information about a forecast |
| Per-ticker briefings — every watcher of AAPL gets the same briefing | Impersonal by construction |

### ❌ Patterns we never adopt

| Pattern | Why it's a problem |
| --- | --- |
| "You should buy / sell X" | Pure personal recommendation |
| "AAPL is a good fit for *your* portfolio" | Personalised |
| "Based on your risk profile, we suggest…" | Personalised + suitability framing |
| One-tap brokerage execution from a signal | Defeats publisher's exclusion (action follows recommendation) |
| "Guaranteed return", "can't lose", "sure thing" | Apple App Store ban + FCA "misleading" |
| Different signals to different users for the same ticker | Defeats *impersonal* prong of exclusion |
| Hiding the disclaimer in T&Cs only | FCA wants prominence; Apple wants disclosure |

## The disclaimer

**Where it must appear:**

1. **First-launch modal**, requires explicit acknowledgement. Stores acknowledgement in `profiles.disclaimer_ack_at`.
2. **Persistent footer** on every screen showing a forward-looking number, signal, or briefing.
3. **Standalone on screenshots / shares.** If a user screenshots a briefing and posts it on social, the disclaimer must be in the image. Build it into the rendered briefing markdown, not as a UI-only chrome element.
4. **Inside push body where possible.** When the body is too long, the **fact-only framing** in the push itself serves as compliance ("X beat estimates" is not advice; "X is a buy" is).
5. **App Store listing.** First line of the description.

**The canonical text (Sift v1):**

> Sift provides general market information and educational content. Nothing in this app constitutes investment, financial, legal, or tax advice, or a personal recommendation. You are solely responsible for your investment decisions. Past performance is not indicative of future results. Backtest results are hypothetical and do not represent real trading. Sift is not registered as an investment adviser in any jurisdiction.

Short form (footer, screenshot watermark):

> Educational use only. Not investment advice. See full disclaimer in app.

Tone is plain English, US/UK-neutral. Refresh annually.

## Forbidden words

These never appear in any user-facing string. Catch them with a Jest snapshot test that scans rendered strings or a custom ESLint rule:

```
advice           recommend(s|ation)?
should buy       should sell
will (rise|fall|moon|tank)
guaranteed       sure thing
risk-free        can't lose
buy now (CTA)    sell now (CTA)
your stock(s)    your portfolio recommendation
```

Allowed in **descriptive** contexts ("the analyst recommended…" describing news), banned in **directive** contexts ("Sift recommends…").

## LLM output — additional risk

Briefings and transcript summaries come from an LLM. Models occasionally generate recommendation-style language unprompted. Mitigations:

1. **Prompt rules.** Every prompt template has a hard-coded section: *"You are summarising for educational purposes. Do not include directive language such as 'should buy', 'recommend', 'is a good investment'. Use neutral, factual phrasing."*
2. **Output filter.** Pipe LLM output through a regex/keyword filter before persisting to `briefings.content_md`. If a forbidden term appears, retry the prompt with a stronger instruction. After 2 retries, surface as `briefing.status='needs_review'` and don't notify.
3. **Spot checks.** Weekly cron samples 20 briefings randomly and writes them to a review queue. Manual eyeball, build trust in the prompt.
4. **Versioned prompts.** Every prompt change goes through `model_versions` so we can roll back when a "safer" wording inadvertently makes briefings useless.

## App Store policies

### Apple

Relevant guidelines (App Store Review Guidelines, current as of 2026):

- **5.0 Legal — Financial Services:** apps offering "financial-trading and money-management services" must be submitted by a licensed financial institution. *Information-only* apps are fine. Sift's framing puts us in the information-only bucket.
- **3.1 Business — Crypto/Trading:** secondary; we're not transacting.
- **2.3 Performance — Accurate Metadata:** App Store listing must accurately describe what the app does. "Earnings intelligence for self-directed investors" works; "Stock picks that make you money" does not.
- **No guaranteed-return language** — explicit App Store ban, also FCA misleading-promotion violation.

Set Sift's App Store category to **Finance** (acceptable) and avoid the **Investing** sub-category unless we add a regulatory affiliation.

### Google Play

- **Financial Services policy.** If we offered regulated services, we'd need country-of-operation disclosure and licence info. Pure info/education doesn't require this declaration.
- **Misrepresentation policy.** Backtests and predictions must be clearly labelled as such.

## Suitability framing — avoid even by accident

A subtle trap: the app must not even *imply* it's filtering signals based on the user's profile. So:

- Do **not** ask "what's your risk tolerance" in onboarding. We don't use the answer; asking for it implies we tailor output.
- Do **not** ask about portfolio holdings. (Even though it'd improve UX — the cost is regulatory exposure.)
- Do **not** sort the watchlist by "best fit for you" — sort by recency, alphabetical, or earnings date.
- "Personalised" can be okay in narrow senses (the user's watchlist *is* personalised — but they constructed it). Don't generalise.

## When the v2 / SaaS launch comes

Things that become harder when Sift is being paid for:

- **Cooling-off rights** under UK Consumer Contracts Regulations 2013.
- **VAT/sales tax** for subscriptions (RevenueCat handles most of it).
- **Marketing copy review** — anything pushed via App Store, ads, social must be FCA-compliant *as a financial promotion*. This is stricter than the app's own copy.
- **Geo-fencing.** Easier to launch in jurisdictions with lighter regimes (UK = strict; US = strict; Singapore/EEA = case-by-case). Restrict by App Store availability if unsure.
- **Solicitor review.** Budget £1–3k for a pre-launch review of disclaimer, T&Cs, marketing copy. Worth it.

## Evidence for the FYP write-up

Things to include in the academic proposal / write-up that mark the project as compliance-aware:

- Reference to FCA PERG 8 and SEC § 202(a)(11)(D).
- Explicit acknowledgement that AI/ML outputs require disclaimer overlay.
- Discussion of why backend (impersonal, shared) AI fits the publisher's exclusion better than personalised on-device models — connects to ADR-0003.
- Discussion of how the LLM output filter mitigates "model-generated advice" risk.

Graders for CM3020 (an AI module, but with a professional-skills emphasis) will look favourably on a project that's thought about deployment risk.

## What this doc deliberately doesn't cover

- Tax treatment, GDPR specifics, data residency. Out of MVP scope.
- Anti-money-laundering / Know-Your-Customer — we don't transact, so we don't trigger these.
- Marketing law in non-launch jurisdictions.

When in doubt: **err on the boring side of copy.** A factual, dry tone is the safest tone in financial-adjacent products.
