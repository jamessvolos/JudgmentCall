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

## v2 roadmap — from simulated user testing

Four personas stress-tested v1 (a busy analyst, a staff data engineer, a
career-switcher, and a calibration scientist). Their findings, prioritised:

**Tier 1 — correctness (the score was teaching the wrong lesson):**
1. *Proper scoring.* The headline score was ECE, which is **not** a proper
   rule — staking your base rate on every call drives ECE→0 and wins, rewarding
   timidity. Replace with a **Brier skill score** (`1 − Brier/Brier_ref` vs. an
   always-base-rate reference); keep ECE as a diagnostic; raise the score floor
   from n=5 to n≥30 (5 fixed bins at n=5 is noise).
2. *Conviction floor 1/k.* Chance on a 4-option MCQ is 25%, but the slider
   floored at 50% — building a structural 25-point overconfidence artifact into
   every honest guess. Floor conviction at `1/k` per item (25% for 4 options,
   50% for duels); start the reliability x-axis there.
3. *Duels can leak the answer.* "Writable during partitions" *is* CAP's A — a
   keyword match, not a tradeoff. (Backlog: re-author so both designs satisfy the
   headline constraint and a secondary pressure decides; add an "also defensible
   when…" line.)

**Tier 2 — badges & signals:**
4. Knows-What-They-Know required only 85% at 90% conviction — certifies
   overconfidence; raise to ≥90%. Calibration badges latched on the first lucky
   prefix; evaluate them on the sustained ledger instead.
5. "The Room" showed n=1 as crowd wisdom; gate it behind a real sample with an
   empty state.

**Tier 3 — onboarding & mobile (analyst + newcomer converged):**
6. Trim/de-jargon the dashboard: "Start a run" higher, caption the bare rating,
   rename cryptic gate chips, a "what's this?" on the calibration graph.
7. First-run hint explaining conviction + calibration (taught only by grading now).
8. Estimate band: bigger touch handles + a value label above the dragged handle.

**Shipped in v2:** 1, 2, 4, 5, 6, 7, 8.

## v3 — shipped

- **Duel content-hardening (roadmap #3):** all 12 duels re-authored so both
  designs satisfy the headline constraint and a secondary pressure decides; each
  carries an "also defensible when…" line, shown on the reveal. The keyword-match
  strawmen are gone.
- **Interval-coverage calibration:** Estimate bands now feed a coverage track —
  a stored `captured` flag folds into "your 90% bands caught the truth X% of the
  time," the purest calibration signal (previously discarded).
- **Brier decomposition:** the calibration card now nudges on low *resolution*
  ("you're staking one flat number — vary your conviction"), teaching calibrated
  AND sharp, not just calibrated.
- **Partition-Key Bake-Off (new interaction, Fault Line):** a fourth call kind —
  pick a shard key under a stated access pattern, then load histograms reveal the
  hot shard for each candidate. The invisible tradeoff (skew) made visible; the
  key never leaks its shard loads before you commit. 8 items.

## v4 backlog

Brier decomposition *viz* with bootstrap bands; adaptive (equal-mass) ECE bins;
the Descent roguelike (bank/push, Composure, boss, Daily Gauntlet + leaderboard);
more Observable-Field manipulables (Base-Rate Flood, Simpson's Rotor); the
verifiable credential OG card; Attack-Surface + Constraint-Flip architecture modes.
