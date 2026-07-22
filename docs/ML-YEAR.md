# The Tuning Room — a simulated year

Twelve months after THE PAYBACK DIAL shipped: four quarterly content editions, a
feature roadmap, and the design experiments run each quarter with (simulated)
outcomes and ship/kill decisions. Q1 is real — it shipped with this release;
Q2–Q4 are the planned arc. The three runners-up are not discarded; each ships
in the quarter that fixes its judge-mandated flaw. Metrics reference the
`/admin` Training-Rooms funnel (`entered → staked → n≥30 → credential`) and the
`naive_trap` rate. North star: **calibration** — does confidence come to match
accuracy on tuning judgments?

---

## Q1 — THE PAYBACK DIAL ships (real)

**Content (+26).** 8 `payback` items (6 finite, 2 NEVER; both reflex rules) + 18
MCQs across all six topics, arithmetic hand-verified.

**Feature.** The `payback` interaction: the workload card, the log-decade dial
with the NEVER PAYS latch, the meter ledger + decade-rail reveal, dex-graded.

**Design experiments.**
- *E1 — NEVER latch vs "0 calls" convention.* Hypothesis: a first-class terminal
  answer beats overloading the dial's floor. **Result (sim):** the latch made
  "decide whether a number exists" an explicit act; learners who latched wrongly
  remembered why. **Shipped the latch.**
- *E2 — Multiplier verdict vs absolute error.* "You called it 3.3× early" vs
  "off by 567k calls." **Result:** the multiplier framing matched how learners
  re-told the miss; absolute error read as noise. **Shipped the multiplier.**

**Metric read (sim).** First cohort: **41%** of first payback attempts landed in
a naive trap — 29% headline amortization, 12% premium-blindness — the
highest first-trap rate of any room, confirming the reflex is live.

---

## Q2 — THE SPLIT, with the rigorist's fix

**Content edition "The Grant" (+14).** Ship **Chinchilla's `split`** (the
competition's #2): size the model under a fixed compute budget. The rigorist's
mandatory fix is honored: **the complete law — E, A, B, α, β, and C = 6ND — is
printed verbatim on the item card**, and α ≠ β varies across items so no single
tokens-per-param constant can be cached. 8 items (the 100× grant, the
labeling-budget reskin, a vision backbone-vs-epochs variant) + 6 scaling MCQs.

**Design experiments.**
- *E3 — Coupled readout (params up, tokens drain) vs plain slider.* **Result
  (sim):** watching the token counter drain cut "all params" commits by a third
  before the reveal ever fired; the constraint belongs in the control. **Shipped
  the coupling.**
- *E4 — The compute-torched index.* "Your split spends the budget of a lab 9×
  your size." **Result:** the money framing out-taught the loss-delta framing.
  **Shipped.**

---

## Q3 — THE CUTOFF, de-templated

**Content edition "The Deployment" (+14).** Ship **Cutoff's `cutoff`** with the
rigorist's structural-variation fix so the cached ratio can't absorb it: items
add **per-flag review costs hitting both branches** and **partial interception**
(flagging catches only a fraction r of true positives), so t\* must be
re-derived each time, not recalled. The two-sided mix invariant holds (≥2 items
where misses are dear, ≥2 where false alarms are — including an LLM safety
filter over-refusing paying users). The scissor + priced-burn reveal ships as
pitched.

**Design experiments.**
- *E5 — Burn priced in $/day vs error counts.* **Result (sim):** "$8,400/day"
  moved the post-reveal re-commit distribution twice as far as "42 extra
  misses." **Shipped money.**
- *E6 — Interleaving payback + cutoff in one run.* **Result:** interleaved runs
  beat blocked runs on a transfer post-test — "which economics does this
  decision run on?" is itself the skill. **Shipped interleaving.**

---

## Q4 — THE VALLEY, made inferable — and the Gauntlet

**Content edition "The Checkpoint" (+16).** Ship **Holdout's `valley`** only
after repairing the fatal flaw both judges named: the answer must be
**inferable-in-principle from what is served**. The fix: serve the train curve
AND a **short leaked prefix of the val curve** (the first third, through its
visible flattening), with scenario statistics (data size, capacity, noise) that
parameterize the rise. The commit becomes extrapolation from evidence — where
does a curve you can see bending actually bottom — not a prior draw. The
two-curve reveal and the overshoot bill ship as pitched. Plus **case files**
threading a payback → split → cutoff → valley around one product launch, and
the Daily Gauntlet extends to all four.

**Design experiments.**
- *E7 — Val-prefix length.* A third vs a half. **Result (sim):** the one-third
  prefix kept commits spread (judgment) while the half made t\* readable off the
  screen (lookup). **Shipped one-third.**
- *E8 — Credential-at-recap prompt* (shared with the other rooms). **Result:**
  consistent with prior rooms. **Shipped.**

---

## Year-end state (simulated)

- **Interactions:** mcq + **payback**, **split**, **cutoff**, **valley** — the
  four tuning economies (when to tune, how to size, where to threshold, when to
  stop), each with an exact, served-premise answer key.
- **Content:** 26 → **~70 items** across the six topics.
- **Calibration signal:** second-encounter `naive_trap` falling as the reflexes
  (headline amortization, bigger-model, 0.5 default, train-watching) get
  overwritten; n≥30 score-eligibility the headline `/admin` metric.

## Guardrails held all year

- **Blinding:** the room never touches the hidden study's vocabulary; the
  bundle-guard stays PASS every quarter.
- **Nothing stored that can lie:** levels, badges, and calibration remain pure
  folds over attempt rows.
- **Exact keys only:** every truth is entailed by served premises — the
  declared law, the printed costs, the leaked prefix — never an empirical fit
  the learner could correctly dispute. The rigorist's standing condition, kept.

*Q1 is shipped and verified. Q2–Q4 follow the loop that built THE PAYBACK DIAL —
author with asserted invariants, verify against the live API, gate on the
blinding guard, deploy green.*
