# Open Questions

Things that are deliberately unresolved. Each entry has a **trigger** — what would make us decide. Don't decide these prematurely.

## Product / scope

### Q1. Surprise-classifier algorithm: XGBoost vs small NN
**State:** SETUP.md flags this as open. Both are viable.
**Why not decide now:** the right answer depends on data we don't have yet (cleaned training set + holdout metrics).
**Trigger:** once we've assembled the training data and run a baseline. **Decision rule:** pick the higher test-set log loss; if within 5%, pick XGBoost for interpretability via SHAP — easier to defend in a viva.
**Lives in:** [ml-pipeline.md § surprise classifier](architecture/ml-pipeline.md#surprise-classifier-the-fyp-advanced-algorithm).

### Q2. Should we add an LLM Q&A layer over transcripts in v2?
**State:** flagged in SETUP.md as v2 idea.
**Why not decide now:** depends on whether the MVP gets users who want to "ask AAPL's last call a question".
**Trigger:** post-launch user feedback. Pre-launch: skip.

### Q3. Charting library
**Options:** `victory-native`, `react-native-skia` + custom, `lightweight-charts` in a WebView.
**State:** SETUP.md flags as open.
**Why not decide now:** we don't have any chart-bearing screen yet.
**Trigger:** building the first chart screen. **Decision rule:** start with `victory-native` (most documented); switch to a WebView wrapper only if performance demands it.

### Q4. Pricing tiers for SaaS launch
**State:** open.
**Trigger:** after MVP shipping + 1-3 weeks of usage data. Decide pricing with a retention/willingness-to-pay signal, not in a vacuum.

### Q5. Geographic launch strategy
**State:** unaddressed.
**Why it matters:** UK + US both regulated heavily; some EEA states stricter; Singapore lighter.
**Trigger:** before App Store submission. **Decision rule:** launch with App Store availability restricted to UK + US initially; expand by jurisdiction after solicitor review.

## Architecture

### Q6. Edge Function or Modal for push fan-out
**State:** documented in [realtime-and-push.md](architecture/realtime-and-push.md#edge-function-notify_user_event).
**Provisional pick:** Modal (Option B), because we're already Python-on-Modal end-to-end.
**Why not finalise:** trivially reversible; latency budget gives slack either way.
**Trigger:** writing the first version. The author of that PR makes the final call and updates this entry.

### Q7. Session storage strategy
**Options:** plain AsyncStorage (current), encrypted AsyncStorage + SecureStore-held key (recommended), MMKV with built-in encryption.
**State:** plain AsyncStorage in `lib/supabase.js` because we're pre-auth.
**Trigger:** when auth screens land. **Decision rule:** implement encrypted AsyncStorage + SecureStore key; revisit MMKV when we add it for other reasons.
**Lives in:** [frontend.md § session storage](architecture/frontend.md#session-storage--the-2kb-problem).

### Q8. JavaScript or TypeScript
**State:** SETUP.md says JavaScript. We are following that.
**Why it could change:** at >5 features, TS catches bugs JS doesn't. The user's prior JS experience makes this a non-trivial pivot.
**Trigger:** the third runtime type error that would have been caught at compile time. Migrate one feature folder at a time with `// @ts-check` first.

### Q9. State management library
**State:** none. Component state + React Query (planned) covers MVP.
**Trigger:** when we have cross-screen UI state that React Context makes ugly. Default to **Zustand** if needed — Redux is overkill for the domain.

### Q10. Styling library
**State:** `StyleSheet.create` + a `theme/` module.
**Trigger:** ≥5 screens and palpable pain. **Default:** NativeWind (TailwindCSS for RN). Migration is per-component; no big-bang.

### Q11. ESLint / Prettier / pre-commit hooks
**State:** none configured.
**Trigger:** the first time a stylistic mismatch shows up in a code review (i.e. once we add a second human or a serious agent).

### Q12. Observability — Sentry / OpenTelemetry
**State:** none.
**Trigger:** before public TestFlight. Crash-free user rate is required for SaaS and useful for FYP write-up evidence. Default: Sentry on RN + Sentry on Modal. Free tier suffices at our scale.

## ML / data

### Q13. Training-data assembly strategy
**Options:** scrape & cache, buy a historical dataset, use a public dataset (Compustat, but expensive academic license).
**State:** unstarted.
**Trigger:** when we begin classifier training. **Decision rule:** build a one-off Modal function that batches Finnhub historical + EDGAR archive into a Postgres training table; rerun monthly. Avoid a paid dataset for the FYP.

### Q14. Transcript provider primary/secondary order
**State:** earningscalls.dev primary, API Ninjas secondary, Motley Fool scrape tertiary.
**Trigger:** if primary's reliability drops below 90% in production. Swap based on `transcripts.source` distribution in production logs.

### Q15. Prompt voice for briefings
**State:** unwritten. Versioned via `model_versions.kind='briefing_prompt'`.
**Trigger:** first cohort of briefings. Plan for ~5 prompt iterations before launch. Spot-check 20 briefings per iteration.

### Q16. How aggressive to be on press-wire detection
**State:** documented as a polling pattern in [data-sources.md](architecture/data-sources.md#press-wires-pre-market-detection); not implemented.
**Trade-off:** earlier alerts vs higher false-positive rate.
**Trigger:** post-MVP. Pre-MVP, EDGAR-only is fine.

## Ops / commercial

### Q17. Where the production database lives
**State:** Supabase free tier.
**Trigger:** any of (a) database >450MB, (b) >40k MAU, (c) consistent egress >1.5GB/day. **Decision rule:** upgrade to Supabase Pro ($25/mo). Self-hosting Postgres is a distraction we don't need for years.

### Q18. Modal credit burn
**State:** under free tier currently (nothing deployed).
**Trigger:** monthly check. If consistently >free credit, audit the EDGAR poller cold-start frequency first — that's the biggest variable.

### Q19. Apple Developer Program enrollment ($99)
**State:** deferred.
**Trigger:** ready to push to TestFlight for FYP demo or external users. **Note:** RevenueCat Test Store covers IAP testing without enrollment for development.

### Q20. Solicitor review of disclaimers, T&Cs, marketing copy
**State:** deferred.
**Trigger:** before public TestFlight or any marketing. Budget £1–3k.

## Documentation

### Q21. When to write tests
**State:** none.
**Trigger:** before any non-trivial migration / refactor. **Minimum coverage for FYP:** auth happy-path, schema migration up/down, classifier evaluation harness, snapshot test for disclaimer presence on every signal screen.

### Q22. When to draw a "real" architecture diagram
**State:** ASCII diagrams in docs.
**Trigger:** academic submission. Convert the SETUP.md + overview.md ASCII to an Excalidraw / Mermaid export. Don't make the diagrams the source of truth — keep ASCII as canon.

---

## How to use this file

- When you finalise an open question, **delete** its entry from this list and write the resolution into the relevant doc (linked above) + an ADR if it's a substantive architectural call.
- When something new becomes uncertain, **add** it here rather than letting it haunt slack/git/issues. The cost of explicit uncertainty is low; the cost of buried assumptions is high.
- This file is part of the project's "where are we" status alongside [setup/current-state.md](setup/current-state.md). Keep both fresh.
