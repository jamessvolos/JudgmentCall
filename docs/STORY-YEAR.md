# The Data Storytelling room — a simulated year

Twelve months after the COMPOSE 10x and the rebrand from "Spot the overreach":
four quarterly content editions, a feature roadmap, and the design experiments
run each quarter with (simulated) outcomes and ship/kill decisions. Q1 is real —
it shipped with this release; Q2–Q4 are the planned arc. Metrics reference the
room's grade ladder, the per-skill mastery map, the checkpoint exam pass rate,
and the `/admin` funnel. North star: **calibrated authorship** — every edition is
judged by whether learners write the strongest claim the data supports without
overreaching *and* without going timid.

---

## Q1 — COMPOSE ships (real)

**Content (+6).** 6 `compose` items across single_cause, extrapolation,
certainty, base_rate, buried_lede, and missing_sowhat — the two storyteller sins
(overreach and timidity) trained on the same artifact.

**Feature.** The `compose` mode: build the lede from tagged fragments, live serif
assembly, and a reveal that stamps each fragment held·strong / went soft /
overreach beside the strongest-safe lede.

**Design experiments.**
- *E1 — Grade timidity, or only overreach?* Hypothesis: grading a fully in-bounds
  but timid lede as *wrong* teaches the harder half of the skill. **Result (sim):**
  the went-soft stamp drove the biggest "aha" in session replays; learners who
  only ever avoided overreach started pushing to the safe ceiling. **Shipped:
  timidity fails.**
- *E2 — Single-select rows vs a chip cloud.* **Result:** full-width single-select
  option rows beat wrapped chips on phone legibility for sentence-length
  fragments. **Shipped rows.**

**Metric read (sim).** First cohort: on first attempts, **~34%** of failures were
*went soft* (not overreach) — the previously-invisible half of the skill, now
caught and scored.

---

## Q2 — THREAD (the runner-up), done right

**Content edition "Sequence" (+16).** Ship **Throughline's `thread`** (the
competition's #2): order 4–6 individually-true findings into the faithful telling
— lead with what moved, demote nulls to context, land on the supported decision.
Tap-to-place (no drag), graded by a lead-exact + close-exact gate plus a
Kendall-tau tolerance on the middle. It is the one interaction that stages "a lie
made only of truths," where every sentence would pass `field` and only the order
lies. The rigorist's standing note is honored: interchangeable context cards are
scored as a partial order, not laundered through an arbitrary tolerance.

**Design experiments.**
- *E3 — Lead/close gate vs whole-order distance.* **Result (sim):** gating on the
  two genuinely-defensible positions (the lede and the landing) and forgiving the
  middle tested clearer and fairer than a single global distance. **Shipped the
  gate.**
- *E4 — Tap-to-place vs drag.* **Result:** tap-to-place won decisively on mobile.
  **Shipped tap.**

---

## Q3 — LEVEL: the chart enters the room

**Content edition "Level with me" (+14).** Bring in **Axis's `level`** — the
room's first *visual* interaction. Predict/repair the honest encoding: drag a
truncated y-axis back to where the trend reads straight, or pick the honest chart
among a truncated bar, a dual-axis coincidence, and a base-hiding pie. Resolves
the rigorist's objection by shipping the discrete **PICK** variant as the graded
core (exact, no tolerance) and keeping the **DIAL** as a guided warm-up, and by
guaranteeing a stated share of non-trivial honest-floor items so "drag to zero"
never games it. Inline SVG in DATUM style, reduced-motion safe.

**Design experiments.**
- *E5 — Dial (continuous) vs pick (discrete) as the graded item.* **Result (sim):**
  pick produced a cleaner confidence-accuracy signal; dial taught the *feel* but
  was gameable. **Shipped pick as graded, dial as practice.**
- *E6 — Chart-first vs caption-first.* **Result:** showing the chart before the
  caption made the distortion land before the words explained it away. **Shipped
  chart-first.**

---

## Q4 — BRIEF, cases & the Gauntlet

**Content edition "Who's it for" (+14).** Add **Reader's `brief`** — a stated
audience + decision above the data, and the learner picks the telling that is
both in-bounds AND decision-useful for that reader, with a consequence reveal.
Operationalized to defeat the rigorist's "it's tasted" objection: a fitting
telling must **carry the decision-relevant quantity in the reader's units and
frame without overclaiming**, each distractor fails on one named axis, and the
winning choice's surface features are randomized so elimination heuristics don't
win. Plus multi-step **case files** threading a compose → a thread → a brief
around one dataset, and the Daily Docket extends to the new modes.

**Design experiments.**
- *E7 — Interleaving the authoring modes.* Hypothesis: mixing compose / thread /
  level / brief in one run teaches "what does honest telling need *here*?"
  discrimination. **Result (sim):** interleaved runs beat blocked runs on a
  transfer post-test. **Shipped interleaving.**
- *E8 — Consequence reveal vs verdict-only** (shared with the other rooms).
  **Result:** naming what the reader would *do* with each telling lifted recall of
  the lesson. **Shipped the consequence line.**

---

## Year-end state (simulated)

- **Modes:** the room now carries spot, fix, calibrate, field, ledger, **compose**,
  **thread**, **level**, and **brief** — from *judging* a telling to *authoring*
  one, *sequencing* one, *drawing* one honestly, and *fitting* one to a reader.
- **Content:** ~6 → **~60 new/updated items** across the two skill families.
- **Calibration signal:** the *went-soft* rate falling as learners stop hedging;
  the checkpoint exam re-weighted to sample the authoring modes; grade ladders and
  credentials still pure folds over attempt rows.

## Guardrails held all year

- **Blinding:** the room is the sanctioned home for teaching vocabulary, but the
  raw study fidelity tags never ship in any client string, and the teaching chunk
  stays reachable only from `/drill`. The bundle-guard stays PASS every quarter.
- **Nothing stored that can lie:** every grade, badge, and credential is a pure
  recomputation of attempt rows.
- **Honest targets:** each authoring mode has an exact, defensible answer key —
  the max-safe assembly, the lead/close-gated order, the discrete honest
  encoding, the one telling that fits the brief — never a tasted judgment dressed
  as a grade. The rigorist judge's standing condition, kept.

*Q1 is shipped and verified. Q2–Q4 are the roadmap; each edition follows the loop
that built COMPOSE — author with asserted invariants, verify against the live
API, gate on the blinding guard, deploy green. The three runners-up are not
discarded; they are the plan.*
