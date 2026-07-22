# The Tuning Room — competition & build record

The sixth training track: **Machine Learning** (`ml`, THE TUNING ROOM) — the
specialist room for LLM tuning plus classic and advanced ML judgment. Four
firms — each a bleeding-edge interaction designer × a leading ML researcher ×
an award-winning teacher — competed to design the room's signature interaction.
This is the record; the simulated year is in **ML-YEAR.md**.

## The room

Six topics: **The Gap** (generalization), **Honest Measurement** (evaluation),
**Learning Dynamics** (optimization), **The Leash** (regularization), **Tuning
the LLM**, and **Scale & Compute** (scaling laws). The ladder runs *Curve
Fitter → Baseline Beater → Regularizer → Ablationist → The Bitter Lesson*, with
HELD OUT and CONVERGED among the themed badges. The organizing enemy is the
curve fitter's reflex — more training, more parameters, the default threshold,
the metric that flatters.

## The four firms

| Firm | Pitch | The truth it teaches |
|---|---|---|
| A · Chinchilla | THE SPLIT (`split`) — set the params/data split at fixed compute | At a fixed budget the loss-minimizing split is a closed form; "bigger model" starves the data. |
| B · Holdout | THE VALLEY (`valley`) — pick the checkpoint to ship | Train loss falls forever; val loss turns back up; the skill is stopping. |
| C · Cutoff | THE CUTOFF (`cutoff`) — set the deployment threshold | The cost-optimal threshold is c_fp/(c_fp+c_fn); 0.5 is the most-shipped bug in ML. |
| **D · Adapter** | **THE PAYBACK DIAL (`payback`)** — when has the finetune paid for itself? | **Fixed costs are repaid by marginal savings, never by headline spend — and sometimes never.** |

## The judging panel (scores out of 40)

| Firm | Rigorist | Teacher | Designer | **Total** |
|---|---:|---:|---:|---:|
| **D · PAYBACK** | 30 | 34 | 34 | **98** 🏆 |
| A · SPLIT | 33 | 27 | 27 | 87 |
| C · CUTOFF | 24 | 24 | 30 | 78 |
| B · VALLEY | 17 | 30 | 25 | 72 |

**D · THE PAYBACK DIAL won two of three panels and the aggregate by eleven — no
tiebreak needed.** Why each judge landed where they did:

- *Rigorist (A ≻ D ≻ C ≻ B):* SPLIT's declared-law move genuinely cures the
  contestable-key failure, but **VALLEY fails the entailment condition outright**
  — its answer key is exact yet *unknowable in principle* from what is served
  ("the commit is a prior draw... the tolerance band grades luck"). PAYBACK's
  algebra is exact, both naive strains are documented reflexes, and dex-grading
  is principled because payback errors are inherently multiplicative.
- *Teacher (D ≻ B ≻ A ≻ C):* the GAP test applied without sentiment — does item
  five still demand judgment, or has it degraded to retrieval? **PAYBACK is the
  only design where the trap re-fires as production**: every item forces
  reconstructing the marginal saving while the seductive headline number sits in
  view, and the NEVER items convert "compute a number" into "decide whether a
  number exists — a categorically different and rarer skill." CUTOFF decays to
  one division (the RAZOR failure); SPLIT to one recipe.
- *Designer (D ≻ C ≻ A ≻ B), auditing the code:* every existing commit is a
  linear slider and every caliper strip is linear — **the log-decade dial with
  0.05-dex snapping and a danger-latched NEVER detent has no ancestor in the
  file**, and the null-truth grade is a new shape the route absorbs cleanly.
  B's "first two-curve chart" claim is falsified by MarketChart; A's coupled
  readout is FloodCall's live-recompute gesture; C's gate is a shaded slider.

## The winner & the synthesis

**Winner: Adapter's "THE PAYBACK DIAL."** Every judge's mandatory graft shipped:

1. **The rigorist's ε-bounds.** The validator requires |saving| ≥ 5% of today's
   per-call bill on every item — NEVER is strictly a sign judgment on the
   marginal saving, never a numerical knife-edge — and finite truths must sit
   inside the rail (≤ 10^7.5), so NEVER can never be a euphemism for "past the
   end of the dial."
2. **The teacher's arithmetic + camouflage rules.** Workload-card numbers are
   round enough that the saving is two mental steps (2,400 → 150 tokens, ×2.0,
   900k bill); NEVER items are visually indistinguishable at serve — same card,
   unremarkable premiums (1.5×, 1.8× sit inside the finite items' 1.5–3.0×
   range) — so the latch never becomes a tell.
3. **The designer's new-answer-type branches.** `never` is a first-class commit
   end-to-end: the UI latch disables the dial, the API grades a null truth, the
   naive trap fires on a finite commit when the truth is NEVER, and a NEVER
   commit on a finite item is wrong without a spurious trap.
4. **The mix invariant** (the house graft from GAP): ≥2 NEVER, ≥3 finite, ≥2
   items per naive rule — validator-enforced, so neither latching NEVER
   habitually nor never latching it can game the set.

## What shipped in v1

- **The `ml` track** — six topics, ladder, badges — wired into the hub, the
  landing (six rooms), and the track cross-links.
- **The `payback` interaction**: the workload card (prompt today / tuned prompt /
  output / price / the serving premium lit in accent / the training bill), the
  log-decade dial 10³→10⁸ with the NEVER PAYS latch, conviction staking, and a
  reveal built of the meter ledger (per-call today · per-call tuned · the saving
  sliver that must repay the bill), the decade-rail caliper (you / felt / true,
  with the truth pool-sliding from the felt position), the NEVER marquee ("the
  serving premium eats the prompt saving"), the reflex-specific trap line, and
  the multiplier verdict ("You called it 3.3× early").
- **Truths and naives are never authored** — `truthN = trainCost / s` with
  s = price·[(pLong+out) − premium·(pShort+out)]/1000, and both reflex rules
  (headline amortization; premium-blindness) are recomputed by the validator,
  the content test, and the grader from the same params.
- **26 items**: 8 payback calls (6 finite, 2 NEVER; 5 headline-rule, 3
  blind-rule) + 18 MCQs across all six topics with hand-verified arithmetic
  (the 99% all-negative baseline, LoRA rank-8 = 0.39% of a 4096² matrix,
  leakage via full-dataset normalization, double descent) → **204 total**.

Verified end-to-end against the live API: serve-clean 8/8 (truth, naive, rule,
and tolerance never cross the wire; NEVER items are undetectable at serve);
truth-or-NEVER committed → correct 8/8; the naive committed → wrong with the
trap firing 8/8; NEVER committed everywhere → correct on exactly the 2 NEVER
items with zero spurious traps. Full suite (204 quiz items · ALL PASS), bundle
guard (blinding PASS), build green; Playwright confirmed the dashboard, the
dial, and the reveal on mobile.
