# Training Rooms — the 10x reimagining

Six firms pitched (three per room). Selection and the build plan below. Full
pitches archived in the design log; this is the shipping spec.

## The shared thesis

Both rooms stop asking *"do you know the answer"* and start measuring
**calibration** — the match between how sure you are and how right you turn out
to be — and both break the multiple-choice mold with a signature interaction.
Calibration is the one meta-skill that governs every real decision, it's
invisible until you plot it, and no quiz can surface it.

## Selections

**Statistics — Halftone (lead) × Kelvin & Rose × Observable Field.**
- *The Conviction Wager* (Halftone / K&R both chose it build-first): every call
  carries a conviction (50–99%). A proper scoring rule (Brier) means the only way
  to win over time is to report your true probability — bluster loses by math.
- *The Calibration Ledger* (K&R): a reliability diagram of conviction-vs-accuracy,
  a calibration score (ECE), and badges for honesty, not just correctness.
- *Estimate-with-a-band* (Observable Field): drag a point + a 90% interval;
  graded on capture AND width — false precision punished like overconfidence.

**Architecture — Null Hypothesis (lead) × Fault Line × Proof & Guild.**
- *The Design Duel* (Null Hypothesis): two designs for one constraint, blind,
  pick the fit — then three verdicts stack: YOU / THE ROOM (live crowd tally) /
  THE DESK (a preregistered rationale). You can be popular and wrong; the screen
  shows you which. Reuses the parent app's pairwise+Elo+desk soul.
- *Partition-Key Bake-Off* (Fault Line): pick a shard key, watch the load
  histogram reveal the hot shard — an invisible tradeoff made visible. (v2)
- *Verifiable credential* (Proof & Guild): a ledger-derived, shareable proof. (v2)

## v1 — the calibration core (this release)

The shared spine + one new interaction type per room, layered on the existing
level/badge system without destabilising it:

1. **Conviction on every call.** A slider (50–99%) with a live payoff preview,
   captured on every attempt. Elo stays correctness-based (the level ladder is
   unchanged); conviction feeds a NEW calibration track.
2. **The Calibration Ledger.** A reliability diagram (inline SVG), a calibration
   score (expected calibration error), and three calibration badges
   (Honest Broker, Knows What They Know, No Bluff). Pure folds over rows.
3. **New interaction type — Statistics: Estimate-with-a-band.** Drag a point and
   a 90% interval; graded on capture + calibration-appropriate width.
4. **New interaction type — Architecture: Design Duel.** Two designs + a
   constraint header; pick the fit + conviction; reveal YOU / THE ROOM (live
   tally) / THE DESK (preregistered rationale + the failure mode).
5. Content for both new types; a recap and dashboard that show the calibration
   readout.

## v2 — engagement + depth (after user testing drives the roadmap)

- **The Descent** (Halftone): roguelike run — bank or push, a Composure resource,
  a boss scenario, a Daily Gauntlet with a shared seed + leaderboard.
- **More manipulables** (Observable Field): Base-Rate Flood, Regression Rink,
  Simpson's Rotor — hidden truth → user-driven parameter → live consequence.
- **Partition-Key Bake-Off + Constraint Flip + Attack Surface** (Fault Line /
  Null Hypothesis) for architecture.
- **Verifiable credential card** (Proof & Guild): OG-image proof, ledger-hashed.
- Whatever the simulated user testing surfaces as highest-value.
