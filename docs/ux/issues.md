# UX issue log

Running tally of polish issues across the UX sweep. Updated per tick.

## Status legend

- `open` — identified, not yet fixed
- `fixed` — code changed; awaiting on-device verification
- `verified` — user confirmed fixed on-device
- `wontfix` — out of scope (rationale in entry)

## Severity

- `blocker` — surface is broken or unusable
- `major` — surface works but feels meaningfully bad
- `minor` — small refinement
- `polish` — nice-to-have

---

## Active issues

| ID | Severity | Status | Surface | Summary |
| --- | --- | --- | --- | --- |
| UX-001 | blocker | open | Welcome carousel | Tap Next → nothing visible advances. Slide layout broken in Expo Go. |

---

## Entries

### UX-001 — Welcome carousel doesn't advance on Next

- **Severity:** blocker
- **Status:** open
- **Surface:** `src/features/onboarding/welcome-screen.js` — horizontal ScrollView slide layout
- **User report:** "i dont see anything when i click on next, i dont think its positioned well"
- **Suspect cause:** the slide uses `flex: 1` + `width: width` inside a horizontal `pagingEnabled` ScrollView. The flex: 1 on horizontal child can collapse cross-axis sizing on some configs. Even though `scrollRef.current?.scrollTo({ x: (page + 1) * width })` runs, the slide width may not match what was rendered, so the scroll lands somewhere visually empty.
- **Suggested fix in UX1:** rewrite with `FlatList horizontal pagingEnabled` (more reliable for paged carousels in RN) OR switch slide style to explicit `width: width, height: '100%'` without flex.
