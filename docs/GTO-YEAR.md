# The Solver Room — a simulated year

Twelve months after THE MARGIN CALIPER shipped: four quarterly content editions,
a feature roadmap, and the design experiments run each quarter with (simulated)
outcomes and ship/kill decisions. Q1 is real — it shipped with this release;
Q2–Q4 are the planned arc, and the three runner-up firms are not discarded:
they are the roadmap. Metrics reference the `/admin` Training-Rooms funnel
(`entered → staked → n≥30 → credential`) and the `naive_trap` rate. North star:
**decision quality under uncertainty** — does the learner price the margin,
respect the odds, and stop being results-oriented.

---

## Q1 — THE MARGIN CALIPER ships (real)

**Content (+26).** 8 `gap` items (a validator-enforced mix of sign-flips,
mispriced same-sign calls, a quiet tail blowout, and one dead heat) + 18 MCQs
across all six topics with exact arithmetic (pot odds, MDF, bluff ratios,
Kelly, compounded legs, break-evens).

**Feature.** The `gap` interaction: the signed zero-crossing slider (naming the
winner and pricing it are one gesture), the felt-gap naive trap, the FLIPPED
banner, and the agony index.

**Design experiments.**
- *E1 — Signed slider vs pick-then-price (two steps).* **Result (sim):** the
  one-gesture commit produced cleaner data and a stronger "I said it, it flipped"
  sting than a two-step flow; **shipped one gesture.**
- *E2 — Show the agony index always vs only when |ΔEV| is small.* **Result:**
  always — on blowout items it teaches the mirror lesson ("this one deserved
  MORE agony than it got"). **Shipped always.**

**Metric read (sim).** First cohort: the felt-gap trap fired on **41%** of
first-attempt gap items — mode-anchoring caught and scored; the FLIPPED banner
was the most-screenshotted reveal in the app's history.

---

## Q2 — RAZOR (the rigorist's favorite), done right

**Content edition "The Other Seat" (+16).** Ship **Solver's `razor`** — the
indifference frequencies (defend: MDF = P/(P+B); attack: bluff share =
B/(P+2B)) — with the rigorist's mandatory fix honored: **every stem prints the
toy-game contract** (single street, polarized attacker vs bluff-catcher, no
raises, bluffs dead when called), so the closed forms are the unique defensible
answers. The reveal is the second-person inversion: the opponent's EV plotted
against YOUR slider, a dot pricing your leak per attempt. 8 items reskinned
past poker (settlements, audits, penalties) + 6 equilibrium MCQs.

**Design experiments.**
- *E3 — One chart component for both seats vs two.* The judge's flagged risk: a
  sign error ships silently when defend/attack share a chart. **Result (sim):**
  two thin components with a shared axis primitive; the seat-conditional bug
  class disappeared. **Shipped two.**
- *E4 — "Their EV" vs "your loss" axis labeling.* **Result:** "what they extract
  from you, per attempt" tested as the stickier framing. **Shipped.**

---

## Q3 — THE STAKE, with honest epistemology

**Content edition "How Much" (+14).** Ship **Stake's `stake`** (Kelly sizing)
with the rigorist's fix: the question is the mathematical fact — *"what fraction
maximizes long-run growth?"* — and the grading band is **asymmetric**,
accepting [½f\*, f\*] (fractional Kelly is defensible professional practice;
over-betting is not). The reveal keeps the growth hump with the "RUIN — still
+EV per bet" shaded zone, y-clamped so the plunge stays legible. 8 items
(runway, position sizing, ad budgets) + bankroll MCQs.

**Design experiments.**
- *E5 — Symmetric vs asymmetric tolerance.* **Result (sim):** the asymmetric
  band eliminated the false-wrong on half-Kelly answers and sharpened the
  confidence-accuracy signal; **shipped asymmetric** (a first for the house
  pattern, documented in the validator).
- *E6 — Hump distinctness vs redline.* Side-by-side test of the two charts.
  **Result:** the zero-growth dashed rule + shaded ruin zone + non-monotone
  shape read as its own instrument; no confusion reported. **Shipped.**

---

## Q4 — FLIP LINE, case files & the Gauntlet

**Content edition "The Chain" (+16).** Ship **Outs' `flip`** with the rigorist's
fixes: **independence declared in every stem** and every reskin audited for it
(correlated parlays rejected), plus the signature invariant (truth and naive on
opposite sides of the break-even, so the averaging reflex flips the action).
The decay staircase + FOLD/CALL-zoned beam + the DECISION FLIPPED stamp. Plus
multi-step **case files** threading a flip → a gap → a razor call around one
scenario, and the Daily Gauntlet (shared seed, Brier-ranked) extends to the
Solver Room.

**Design experiments.**
- *E7 — Commit clock on flip items.* The rigorist's "mental-arithmetic test"
  worry. **Result (sim):** a soft 20-second clock pushed learners from
  computing to estimating — the intended skill — without punishing readers.
  **Shipped soft clock, flip only.**
- *E8 — Interleaving the four manipulables.* **Result:** mixed gap/razor/stake/
  flip runs beat blocked runs on a "which trap is this?" transfer post-test.
  **Shipped interleaving.**

---

## Year-end state (simulated)

- **Interactions:** mcq, **gap**, **razor**, **stake**, **flip** — the margin,
  the indifference point, the sizing curve, and the compound chain: the four
  corners of the room's mandate, each with an exact answer key.
- **Content:** 26 → **~70 items**; every topic ≥6 with a manipulable anchor.
- **Calibration signal:** felt-gap trap rate falling on second encounters;
  the room's conviction stakes feeding the same Brier ledger as every other
  room — decision science and calibration, one discipline, one record.

## Guardrails held all year

- **Blinding:** the room never touches the hidden study's vocabulary; the
  bundle-guard stays PASS every quarter.
- **Nothing stored that can lie:** levels, badges, and calibration remain pure
  folds over attempt rows.
- **Honest answer keys:** every truth is an exact closed form a validator
  re-derives — and where the math is contested (Kelly's utility assumption),
  the question is rephrased or the band widened rather than grading a
  defensible answer wrong. The rigorist's standing condition, kept.

*Q1 is shipped and verified. Q2–Q4 follow the loop that built the caliper —
author with asserted invariants, verify against the live API, gate on the
blinding guard, deploy green.*
