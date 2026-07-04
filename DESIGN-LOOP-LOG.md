# Design loop — round reflections

Round-by-round record of the DESIGN LOOP (bleeding-edge, hard-rules-first).
Each entry: the move attempted, why it was (or wasn't) a clear win, what was
learned, and current design momentum. Convergence rounds (no change justified)
are recorded here too — restraint is a valid outcome.

The hard rules are the constitution of the interface: no differentiation on/
between the two voting cards; the uniform collecting state never splits;
instruments stay disciplined; nothing loops (the DATUM language retired the
aurora — stillness = precision); everything blinding-safe.

---

## 2026-07-04 · Results §02 ranked by decisiveness

**Move.** The public /results attribute head-to-heads (§02) were ordered by
sample size (`n desc`, from `analytics.tallyToStats`), so the reader's eye
landed first on the most-*voted* contrasts — which happen to be `TOO CLOSE TO
CALL` straddlers — while the one contrast that actually **resolved** (its Wilson
interval clears the 50% null, carrying the red `ROOM OVERRULES` chip) was buried
sixth. The page's emotional core — the room deciding, and overruling the desk in
public — was scattered by accident of turnout. Re-ranked §02 by **how firmly the
room has settled each call**: tier 0 resolved (by how far the interval clears the
null), tier 1 sampled-but-straddling (most data first), tier 2 the suppressed /
un-voted block. Added the one missing section intro line naming the order.

**Why it's a win (medium leverage).** It amplifies an emotional beat that already
existed but was mis-ranked, at zero decorative cost — a pure information-hierarchy
fix in the page's own Wilson-first vocabulary. The decisive verdict + the
`ROOM OVERRULES` red chip now lead where the eye first lands; the §01 standing
tally becomes findable above the rows it describes. Tiny, safe diff (a `.sort`
plus a two-line helper; no new component, no new motion, no new token).

**Hard-rules + blinding pass.** Voting cards untouched (they live on /swipe).
The uniform collecting state is *strengthened*: every `n < MIN_N` row collapses
into one contiguous tier-2 block (stable-sorted, undifferentiated) instead of
trailing by coincidence of `n desc` — no suppressed row is split or restyled.
Instruments unchanged (reorder only, no flash, no position animation),
reduced-motion unaffected, nothing loops. The sort key reads only published
craft `rate / interval / n`; fidelity is dropped from `attributeStats`
(`analytics.ts`) before it can reach this section, so ranking craft contrasts by
craft decisiveness exposes nothing about the hidden experiment. Verified: tsc 0,
lint clean, build OK; re-screenshotted /results dark+light at 1280 — the
resolved `ROOM OVERRULES` row now leads, the two `COLLECTING` rows sit together
as one uniform block at the bottom.

**Learned / momentum.** On an instrument-dense surface, "bleeding edge" means
*clarity*, not effects — the highest-leverage move was surfacing drama the data
already held, not adding any. The restraint elsewhere on /results is right and
was left alone. Rejected as lower-leverage or rule-violating: a "drama sort"
floating overrules above concurrences (makes the instrument editorialize —
violates instrument discipline); promoting the §01 tally into a hero readout
(decorative duplication, downstream of this fix). Momentum: strong; the public
surfaces (landing just reimagined as the Live Console, results now self-ranking)
cohere around earned-light + Wilson-honest instruments.
