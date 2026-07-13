# The Statistics Room 10x — design competition & build record

A four-firm competition, judged by a three-person expert panel, to add a NEW
signature interaction to the Statistics room (which already had mcq, estimate,
and flood). The new interaction had to teach a core statistical truth those
kinds can't. This is the record; the simulated year is in **STATS-YEAR.md**.

## The four firms

| Firm | Signature interaction | The truth it teaches |
|---|---|---|
| A · Law of Large Numbers Studio | **CONVERGE** (`converge`) — predict the margin of error at n | Sampling error shrinks as 1/√n; halving the margin costs 4× the data. |
| B · The Mean Reverters | **SNAP-BACK** (`snapback`) — predict the follow-up of an extreme group | Regression to the mean; extremes are part luck and drift back, and people invent causes. |
| C · Rotor | **POOLING MACHINE** (`pool`) — predict the size-weighted pooled rate | Simpson's paradox; an arm ahead in every subgroup can lose overall. |
| D · Forking Paths | **FALSE ALARM** (`false_alarm`) — predict P(≥1 false positive) across m tests | Multiplicity; significance is a family property, 20 tests → ~64% false alarm. |

## The judging panel (scores out of 40)

Three judges — a **statistician** (rigor), a **teacher/learning scientist**
(learning outcomes), and a **designer-engineer** (craft + buildability, who read
the codebase).

| Firm | Statistician | Teacher | Designer | **Total** |
|---|---:|---:|---:|---:|
| **C · Pooling Machine** | 38 | 24 | 35 | **97** 🏆 |
| D · False Alarm | 33 | 34 | 31 | 98 |
| B · Snap-Back | 32 | 35 | 26 | 93 |
| A · Converge | 33 | 24 | 32 | 89 |

**The decision — and an honest note on it.** The raw aggregate put **D (False
Alarm)** one point ahead of **C (Pooling Machine)**, 98–97. But the single
hardest constraint in this brief is "distinct from the room's existing
mcq/estimate/**flood**," and the designer flagged D's reveal — an m-cell grid
lighting up red — as a near-literal clone of flood's 1024-cell grid, which
*already lives in this room*. Two grid-scrub interactions side by side is exactly
the confusion the mandate exists to prevent. **C won two of the three panels
outright** (rigor and buildability), has the only truth that is exact,
assumption-free, and uniquely computable (a size-weighted mean — no distributional
assumption, no convention), and is maximally distinct from every existing kind.
On the principled tiebreak — distinctness, which is decisive *for this room* — the
winner is **C, POOLING MACHINE**. (D's probability-native idea is preserved as a
v2 headliner in STATS-YEAR.md.)

**Key panel notes.**
- *Statistician:* ranked **C ≻ A ≈ D ≻ B**. C is "the only pitch whose hidden
  truth is exact, unique, assumption-free." He ranked **B last** for a real
  reason: its E[Y|selection] holds exactly only under bivariate normality, and a
  seeded finite scatter's mean would disagree with the theoretical truth by
  sampling noise — "the truth and the picture can disagree." A and D each buy
  their lesson with an idealization (fixed p / normal approx; test independence).
- *Teacher:* ranked **B ≻ D ≻ C ≻ A** — loved regression-to-the-mean's infinite
  reskin retention, but flagged C's mobile cognitive load (holding four numbers).
- *Designer:* ranked **C ≻ A ≻ D ≻ B** — C is "the market skeleton with a chart
  that's *easier* than the one market already ships"; B is the best idea but the
  worst buildability/mobile profile.

## The winner & the synthesis

**Winner: Rotor's "POOLING MACHINE."** Grafts the panel converged on, shipped:

1. **The statistician's three-marker caliper** (you / naive / truth on one axis)
   — already standard in the market/redline builds, so it comes for free.
2. **The designer's animated dots** — on reveal, the pooled (weighted) marker
   *slides* from the naive unweighted-average position to its true size-weighted
   position, so you watch the big subgroup physically drag the aggregate across
   the reversal line (a `pool-slide` keyframe, reduced-motion-safe).
3. **Mobile-legibility mitigation** for the teacher's concern — the subgroup
   inputs render as labelled rate-bars with sizes, not a dense table.

## What shipped in v1

- **A new interaction kind, `pool`** in the Statistics room: the subgroup table
  (both arms' rates + sizes) is shown so the learner can reason; the task is to
  predict the **size-weighted pooled rate** of the arm that leads every subgroup —
  and discover it *loses* overall. Truth = Σ nᵢ·rateᵢ / Σ nᵢ. Serve sends the
  table but never the pooled truth or the unweighted-average `naive_trap`. The
  reveal shows the reversal banner, the you/simple-avg/weighted caliper with the
  sliding dot, and both arms' pooled rates.
- **6 pool items** with genuine numeric reversals — kidney-stone treatments,
  Berkeley-style admissions, batting averages, hospital recovery, ad CTR,
  graduation rates — plus **2 supporting MCQs** (report the stratified effect;
  weighted vs simple mean). Every truth and reversal is re-derived and asserted
  at authoring time and in `quiz-content.test.ts`.

Verified end-to-end against the live API: all 6 pool items serve the table
without leaking the truth; the server truth matches the size-weighted mean (6/6);
the weighted answer grades correct (4/4); the unweighted simple average fires
`naive_trap` (4/4). Full suite (152 items · ALL PASS) + bundle-guard (blinding
PASS) + build green; Playwright confirmed the reversal reveal renders on mobile.
