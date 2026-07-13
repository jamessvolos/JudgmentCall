# The Architecture Room — a simulated year

A twelve-month simulation of the Architecture room after the REDLINE 10x: four
quarterly content editions, a feature roadmap, and the design experiments run
each quarter with their (simulated) outcomes and ship/kill decisions. Q1 is real
— it shipped with this release; Q2–Q4 are the planned arc, written as if the year
has run. Metrics reference the Training-Rooms funnel on `/admin`
(`entered → staked → n≥30 → credential`) and the `naive_trap` rate.

North star: **calibration**. Every edition is judged by whether it makes an
engineer's confidence match their accuracy — and whether the reliability curve
and `naive_trap` rate improve.

---

## Q1 — REDLINE ships (real)

**Content (+10).** 8 `redline` items (knees 7.9%→88.5%) + 2 queueing MCQs
(Little's Law, the ρ/(1−ρ) hockey-stick).

**Feature.** The `redline` interaction: predict max-safe utilization → reveal the
p99 hockey-stick, SLA line, knee, you/≈full caliper, distance shading, `naive_trap`.

**Design experiments.**
- *E1 — Curve on reveal vs live-drag.* Hypothesis: a live curve you drag until it
  crosses the SLA is procedural and leaks the answer; predict-then-reveal is
  calibration-native. **Result (sim):** predict-then-reveal produced a `naive_trap`
  rate of **44%** on first-attempt low-knee items (the real overconfidence signal
  the live version hid). **Shipped predict-then-reveal.**
- *E2 — Utilization vs throughput as the predicted quantity.* Hypothesis:
  utilization (%) is more intuitive and comparable across items than req/s.
  **Result:** utilization cut confusion and made the ~54% gut-punch legible.
  **Shipped utilization.**

**Metric read (sim).** First cohort: `naive_trap` fired on **44%** of
first-attempt redline items — the "you can run it at 90%" reflex, caught and
scored. Median guess 87%; median knee 62%.

---

## Q2 — The Scan Meter (the strong runner-up)

**Content edition "The Bill" (+18).** Ship **Data Gravity's `scan`** interaction
(the competition's #2): predict bytes scanned for a query over a columnar layout;
a partition grid lights scanned-vs-pruned; `naive_trap` on the "surely it pruned"
value. 10 scan items + 8 MCQs (LIMIT doesn't cut bytes; SELECT * defeats
projection; storage/compute separation). **The architect's correction is folded
in**: items explicitly model zone-map / micro-partition pruning where it applies,
so the lesson is "a non-partition filter *usually* scans the column" — not the
false absolute "pruning never happens."

**Design experiments.**
- *E3 — Log vs linear slider for bytes.* **Result (sim):** a log slider let learners
  express 0.3 GB and 700 GB on one control without the small values collapsing to
  zero; **shipped log**.
- *E4 — $ vs GB as the headline.* **Result:** dollars stung harder and shared
  better (the "$400 query" screenshot); **shipped $ headline, GB secondary**.

---

## Q3 — Failure & sizing, done as calibration

**Content edition "The 3am Page" (+20).** Fold in the best of the two remaining
firms as *bounded* additions rather than full new kinds:
- **Sizing** (Sizing Bureau) as a `redline`-family variant: predict the *minimum
  node count* to meet an SLA — one slider, one hidden truth, reusing the redline
  reveal — sidestepping the two-meter mobile overload the panel flagged. 8 items.
- **Quorum** (Fault Line) as MCQ/`duel` content (where its crisp math belongs,
  the panel's read that it's "a quiz, not an instrument"): W+R>N, RF=F+1, survive
  F faults. 12 items across the reliability topic.

**Design experiments.**
- *E5 — Sizing as a slider vs the dial.* **Result (sim):** the single-slider sizing
  variant kept mobile completion **+14%** vs a two-meter dial prototype; **shipped
  the slider variant**.
- *E6 — Quorum as manipulable vs MCQ.* **Result:** the integer-exact "manipulable"
  tested as a disguised pick with no calibration lift; **shipped it as MCQ/duel**,
  as the panel predicted.

---

## Q4 — Cases & the Gauntlet

**Content edition "Incident" (+16).** Multi-step **case files** that thread a
redline + a scan + a quorum call around one incident (a service browns out under
load → predict the knee → predict the scan cost of the debug query → pick the
replication fix). +6 MCQs to round every topic to double digits.

**Feature — the Daily Gauntlet** (shared with the other rooms): a shared-seed
daily run ranked by Brier skill, not raw correctness, over the newest interactions.

**Design experiments.**
- *E7 — Knee spread in a run.* Hypothesis: mixing extreme knees (7.9% and 88.5%)
  in one run teaches the *ratio* lesson faster than clustering similar items.
  **Result (sim):** spread runs cut the same-item `naive_trap` rate on second
  encounter from 44%→22%. **Shipped spread ordering.**
- *E8 — Reveal explanation length.* Short formula-only vs formula + intuition.
  **Result:** formula + one-line intuition beat formula-only on retention;
  **shipped the current length.**

---

## Year-end state (simulated)

- **Interactions:** the room now carries mcq, duel, bakeoff, **redline**, **scan**,
  and a redline-family **sizing** variant — five ways to be wrong made visible.
- **Content:** ~10 → **~74 new/updated items** across the six topics.
- **Calibration signal:** same-item `naive_trap` on second encounter down 44%→~22%
  (the room is overwriting the "run it hot / it surely pruned" reflexes); n≥30
  score-eligibility the headline `/admin` metric.

## Guardrails held all year

- **Blinding:** the room never leaks the hidden study's fidelity vocabulary; the
  bundle-guard stays PASS.
- **Nothing stored that can lie:** every level, badge, and calibration number is a
  pure fold over attempt rows.
- **Honest models:** each manipulable states its idealization (M/M/1 Poisson;
  where columnar pruning does and doesn't apply) rather than teaching a false
  absolute — the architect judge's standing note.

*Q1 is shipped and verified. Q2–Q4 are the roadmap; each edition follows the loop
that built REDLINE — author with asserted invariants, verify against the live
API, gate on the blinding guard, deploy green.*
