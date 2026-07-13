# The Market Room — a simulated year

A twelve-month simulation of the Economics room after launch: four quarterly
content editions, a feature roadmap, and the design experiments run each quarter
with their (simulated) outcomes and ship/kill decisions. Q1 is real — it shipped
with this release; Q2–Q4 are the planned arc, written as if the year has run so
the roadmap is concrete rather than aspirational. Metrics reference the
Training-Rooms funnel already on `/admin` (`entered → staked → n≥30 → credential`).

The north star never moves: **calibration**. Every edition and experiment is
judged by whether it makes a learner's confidence match their accuracy — and
whether the reliability curve, `naive_trap` rate, and n≥30 conversion improve.

---

## Q1 — Launch (shipped) · "The Lever"

**Content (26 items).** Six misconception-first topics; 18 MCQs + 8 `market`
items (4 tax-incidence, 4 price-ceiling). Every market truth closed-form-verified.

**Features.** The `economics` track; the `market` interaction (predict one number
→ reveal chart + you/intuition/market caliper + distance shading + `naive_trap`).

**Design experiments.**
- *E1 — Reveal order.* Show the chart before vs after the number verdict.
  Hypothesis: leading with the verdict line ("the market settles at X") before the
  chart lands the correction harder. **Result (sim):** verdict-first lifted
  explanation dwell +18%; **shipped verdict-first** (the current order).
- *E2 — Conviction floor.* Floor `market` conviction at 50 vs let it float to 25.
  Hypothesis: a point-prediction within tolerance is ~binary, so 50 is the honest
  chance ceiling. **Result:** 25-floor produced a spurious over-confidence artifact
  on the reliability curve; **kept the 50 floor.**

**Metric read (sim).** First cohort: `naive_trap` fired on **41%** of first-attempt
tax-incidence market items — confirming the misconception is real and the room
catches it. Median run length 8; n≥30 conversion too early to read.

---

## Q2 — Depth & the second gate

**Content edition "Frictions" (+22).** Add `subsidy` and `price_floor` levers to
the market solver (both closed-form), 6 new market items; +10 MCQs extending
`comparative_advantage` (Ricardo numerics) and `nominal_vs_real` (real interest,
indexation); 6 items on a new sub-theme, **elasticity intuition**, reusing the
`estimate` interaction (drag a point + band for "how much does quantity move?").

**Feature — the two-gate commitment (the Standoff graft the teacher asked for).**
Before the reveal, the learner also commits *which way their intuition pulls*
(e.g. "who do you think bears the tax?" or "will the ceiling help or shrink
access?"). The number stays the graded gate; the direction gate is logged and
folds into a richer reliability signal (confident-and-wrong-direction is the
sharpest teachable state). Hypothesis: naming the trap before seeing the truth
deepens the overwrite.

**Design experiments.**
- *E3 — Two-gate vs one-gate (A/B).* **Result (sim):** two-gate raised repeat-run
  rate +12% and cut the same-topic `naive_trap` rate on the *second* encounter
  from 41%→24% (faster overwrite). **Shipped**, gated to difficulty ≥2 so the
  on-ramp stays gentle.
- *E4 — Ghost-marker labeling.* "intuition" vs "the trap" vs "most people say."
  **Result:** "most people say N" (descriptive-norm framing) tested best on
  perceived fairness without softening the correction. **Shipped** the norm
  framing on tax-incidence items only.

---

## Q3 — The Desk & The Room for policy

**Content edition "Trade-offs" (+24).** 12 `duel` items for economics — two
policy designs under one constraint (e.g. "reduce emissions at least cost" →
carbon tax vs cap-and-trade; "help low-wage workers" → minimum wage vs EITC),
each with both options genuinely viable and a secondary pressure that decides,
plus an "also defensible when…" line. +12 MCQs across the two thinnest topics.

**Feature — YOU / THE ROOM / THE DESK for economics.** Policy duels get the
architecture room's three-verdict reveal: your pick, the live crowd tally (n≥5
gated), and a preregistered "desk" rationale + the failure mode. Economics is
where "popular but wrong" is most instructive, so the crowd-vs-desk gap is the
lesson.

**Design experiments.**
- *E5 — Desk tone.* Neutral explainer vs opinionated verdict. **Result (sim):**
  opinionated-but-caveated verdicts drove +9% share-card publishes (people share
  a take, not a textbook). **Shipped.**
- *E6 — Crowd anchoring risk.* Show the room tally before vs after the learner
  commits. **Result:** showing it *before* collapsed independent judgment and
  flattened the calibration signal. **Locked**: the tally is always post-commit.

---

## Q4 — Retention & the Gauntlet

**Content edition "Cases" (+20).** Multi-step "case files" — a scenario that
threads 3 linked market/duel calls (a rent-control case: impose the ceiling →
predict the shortage → judge the policy alternative), so the second-order lesson
compounds. +8 MCQs to round every topic to double digits.

**Feature — the Daily Gauntlet.** A shared-seed daily run (same items for
everyone that day) with a calibration-scored leaderboard — ranked by Brier skill,
not raw correctness, so the honest calibrator beats the lucky guesser. Extends the
existing Descent run-mode plumbing.

**Design experiments.**
- *E7 — Leaderboard metric.* Rank by accuracy vs Brier skill. **Result (sim):**
  Brier-skill ranking cut high-conviction reckless guessing −15% (you can't top
  the board by bluffing). **Shipped** Brier-skill ranking.
- *E8 — Credential-at-recap prompt.* Prompt the calibration-credential publish at
  the Gauntlet recap vs only on the dashboard. **Result:** recap prompt +2.3×
  credential publishes. **Shipped.**

---

## Year-end state (simulated)

- **Content:** 26 → **~112 items** across 6 topics and 4 interaction kinds
  (mcq, market, estimate, duel), with case-file threads and a daily seed.
- **Calibration signal:** same-topic `naive_trap` rate on second encounter down
  41% → ~24% (the room is overwriting misconceptions, not just testing them);
  n≥30 score-eligibility the headline funnel metric to watch on `/admin`.
- **Interaction depth:** the `market` solver covers tax, ceiling, floor, subsidy;
  policy `duel`s carry the you/room/desk verdict; the two-gate commitment turns
  each call into an explicit act of catching your own intuition.

## Guardrails held all year

- **Blinding:** the room never leaks the hidden study's fidelity vocabulary; the
  bundle-guard stays PASS.
- **Nothing stored that can lie:** every level, badge, and calibration number
  remains a pure fold over attempt rows.
- **Proper scoring only:** the leaderboard and every score use Brier skill, never
  a rule that rewards hedging or bluffing.

*Q1 is shipped and verified. Q2–Q4 are the roadmap; each edition follows the same
loop that built the room — author with asserted invariants, verify against the
live API, gate on the blinding guard, deploy green.*
