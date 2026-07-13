# The Statistics Room — a simulated year

Twelve months after the POOLING MACHINE 10x: four quarterly content editions, a
feature roadmap, and the design experiments run each quarter with (simulated)
outcomes and ship/kill decisions. Q1 is real — it shipped with this release;
Q2–Q4 are the planned arc. Metrics reference the `/admin` Training-Rooms funnel
(`entered → staked → n≥30 → credential`) and the `naive_trap` rate. North star:
**calibration** — every edition is judged by whether confidence comes to match
accuracy, and whether the reliability curve and `naive_trap` rate improve.

---

## Q1 — POOLING MACHINE ships (real)

**Content (+8).** 6 `pool` items (genuine reversals across medicine, admissions,
sports, hospitals, ads, education) + 2 aggregation MCQs.

**Feature.** The `pool` interaction: predict the size-weighted pooled rate → the
reversal banner + you/simple-avg/weighted caliper with the sliding weighted dot.

**Design experiments.**
- *E1 — Show the subgroup sizes vs hide them.* Hypothesis: hiding the sizes makes
  it a guess; showing them makes it a *weighting* skill. **Result (sim):** showing
  sizes cut pure-guess variance and raised the `naive_trap` signal cleanly (people
  who ignore the sizes land on the simple average). **Shipped: sizes shown.**
- *E2 — Animate the weighted dot vs static caliper.* **Result:** the slide from
  simple-average to weighted position lifted explanation dwell +16% and made the
  "the big group drags it" lesson legible. **Shipped the animation** (reduced-
  motion-safe).

**Metric read (sim).** First cohort: `naive_trap` (the unweighted average) fired
on **38%** of first-attempt pool items — the size-blind reflex, caught and scored.

---

## Q2 — FALSE ALARM (the runner-up), done right

**Content edition "The Fishing Trip" (+18).** Ship **Forking Paths' `false_alarm`**
(the competition's #2): predict P(≥1 false positive) = 1−(1−α)^m across m tests,
with a distinct reveal that is NOT a flood-grid clone — a **compounding ladder**
(each added test nudges a single probability bar rightward), sidestepping the one
knock that cost it the top spot. 8 items + 6 MCQs. It is the most probability-
native interaction in the app (predict a probability, Brier-score it against a
probability question), so it sharpens the reliability curve.

**Design experiments.**
- *E3 — Ladder vs grid reveal.* **Result (sim):** the compounding ladder tested as
  distinct-from-flood and clearer on mobile than the m-cell grid; **shipped the
  ladder.**
- *E4 — Independent-tests labelling.* The statistician's standing note: label it
  the *independent-tests* case. **Result:** an explicit "assumes independent
  tests" caption kept the lesson honest without softening the punch. **Shipped.**

---

## Q3 — Regression to the mean, safely

**Content edition "No False Cause" (+16).** Bring in **The Mean Reverters'
regression-to-the-mean** — the teacher's favorite — but resolve the
statistician's correctness objection: grade against the theoretical E[Y|X] =
μ_Y + r·(σ_Y/σ_X)·(x̄_sel − μ_X) and render the reveal as the **population
regression line + expected snap**, NOT a noisy finite scatter whose sample mean
would disagree with the truth. Delivered as a `pool`-family predict-a-number
variant (`snapback`) reusing the same caliper. 8 items (sophomore slump, pre/post
medicine, speed cameras, manager superstition) + MCQs.

**Design experiments.**
- *E5 — Population line vs seeded scatter.* **Result (sim):** the population-line
  reveal removed the truth-vs-picture disagreement the statistician flagged and
  was simpler on mobile; **shipped the population line.**
- *E6 — Probability-native second gate (the teacher's graft).* Also ask "how
  likely is the follow-up to move *toward* the mean?" **Result:** the second
  probability stake tightened the reliability curve; **shipped** on difficulty ≥2.

---

## Q4 — √n, cases & the Gauntlet

**Content edition "Sample Size" (+14).** Add **Law of Large Numbers' `converge`**
(√n margin-of-error) as a predict-a-number interaction, rounding out the room's
uncertainty coverage. Plus multi-step **case files** threading a pool + a
false_alarm + a converge call around one dataset. The Daily Gauntlet (shared
seed, Brier-ranked) extends to the new interactions.

**Design experiments.**
- *E7 — Interleaving the four manipulables.* Hypothesis: mixing pool / false_alarm
  / snapback / converge in one run teaches "which trap is this?" discrimination.
  **Result (sim):** interleaved runs beat blocked runs on a transfer post-test.
  **Shipped interleaving.**
- *E8 — Credential-at-recap prompt** (shared with the other rooms). **Result:**
  +2.1× credential publishes. **Shipped.**

---

## Year-end state (simulated)

- **Interactions:** the room now carries mcq, estimate, flood, **pool**,
  **false_alarm**, **snapback**, and **converge** — seven ways to be fooled by
  data made visible, staked, and scored.
- **Content:** ~8 → **~70 new/updated items** across the six topics.
- **Calibration signal:** same-item `naive_trap` on second encounter falling as
  the reflexes (unweighted average, "just 5%", "they stay extreme") get
  overwritten; n≥30 score-eligibility the headline `/admin` metric.

## Guardrails held all year

- **Blinding:** the room never leaks the hidden study's fidelity vocabulary; the
  bundle-guard stays PASS.
- **Nothing stored that can lie:** every level, badge, and calibration number is a
  pure fold over attempt rows.
- **Honest models:** each interaction states its idealization (independent tests;
  the population regression line, not a noisy sample) rather than teaching a false
  absolute — the statistician judge's standing note.

*Q1 is shipped and verified. Q2–Q4 are the roadmap; each edition follows the loop
that built POOLING MACHINE — author with asserted invariants, verify against the
live API, gate on the blinding guard, deploy green.*
