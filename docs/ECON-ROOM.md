# The Economics Room — design competition & build record

A four-firm design competition, judged by a three-person expert panel, to design
the app's third Training Room. This document is the record: the brief, the four
pitches, the scored verdicts, the winner, and what shipped. The one-year content /
roadmap / design-experiment simulation is in **ECON-YEAR.md**.

## The brief

Design an **Economics** training room for a calibration app: learners answer,
stake 25–99% conviction, get Brier-scored, and watch a reliability curve reveal
whether their confidence matches their accuracy. Each room has a level ladder,
badges recomputed from the learner's own attempt rows, and runs of ~8 calls. The
engine grades server-side and hides the answer until commit; the proven pattern
is **hidden truth → user parameter → live consequence → numeric tolerance grade**
(shipped for `flood` and `estimate`). Each firm was a real collaboration of a
bleeding-edge designer, a leading economist, and an award-winning teacher.

## The four firms

| Firm | Signature interaction | One-line thesis |
|---|---|---|
| **A · Atelier Marginal** | **The Wedge** — drag the consumer-price node on a live supply/demand chart until the market clears under a stated tax; hidden truth = post-tax consumer price. | Economics is learned by dragging the market until it clears; incidence is physics. |
| **B · The Nudge Unit** | **Standoff** — a payoff matrix vs a rational opponent; predict its equilibrium play *and* best-respond; a server game-solver grades both gates. | Economics is incentives and equilibrium; solve the opponent before you move. |
| **C · Misconception Lab** | **The Lever** — predict one headline number under a policy lever, stake conviction; the reveal animates the adjustment path and lands on the true equilibrium beside a **naive-intuition marker** (`naive_trap`). | Economics is a minefield of seductive first answers; overwrite them under a staked, confident commitment. |
| **D · Macro Observatory** | **The Stance** — drag a policy lever on a tradeoff frontier; a public transfer function backfires in both directions; hidden truth = the loss-minimizing interior optimum. | Macro is no-free-lunch; there's an interior optimum, and confidence belongs only near it. |

## The judging panel (scores out of 40)

Three judges — an **economist** (rigor), a **teacher/learning-scientist**
(learning outcomes), and a **designer-engineer** (craft + buildability, who read
the actual codebase). Each scored all four firms on four lenses.

| Firm | Economist | Teacher | Designer | **Total** |
|---|---:|---:|---:|---:|
| **C · The Lever** | 32 | 34 | 37 | **103** 🏆 |
| A · The Wedge | 36 | 22 | 33 | 91 |
| B · Standoff | 26 | 29 | 23 | 78 |
| D · The Stance | 23 | 23 | 28 | 74 |

**Key verdicts.**
- *Economist:* ranked **A ≻ C ≻ B ≻ D**. The Wedge's hidden truth is uniquely
  defined and its grader can't be gamed. Flagged real correctness holes elsewhere:
  Standoff's mixed-strategy equilibria have **no unique best-response to grade**,
  and The Stance dresses an **arbitrary loss function** as "the truth." Called The
  Lever's economics "as sound as A's."
- *Teacher:* ranked **C ▸ B ▸ D ▸ A**. The Lever is the only design built *around*
  calibration — its `naive_trap` flag separates *confidently wrong* from *unsure*,
  exactly the signal a reliability curve needs. Gentlest on-ramp (predict ONE
  number). Dinged A for overload and mobile pain.
- *Designer-engineer:* ranked **C ▸ A ▸ D ▸ B**. The Lever has the smallest
  new-code footprint — it *subtracts* from the shipped `estimate` (one marker, no
  interval band) — and the best touch story. Standoff last: the only design needing
  a new correctness-critical subsystem (a general game solver).

## The winner & the synthesis

**Winner: Misconception Lab's "The Lever."** It won two panels outright and placed
second on the third, and it is the design built around the app's north star rather
than bolting conviction onto a charting task. The panel converged on three grafts,
all of which shipped:

1. **Atelier Marginal's rigorous linear market model + iconic reveal chart** — the
   truth is the closed-form solution of `Qd = a − bP`, `Qs = c + dP` (± a tax
   wedge or a binding ceiling), and the supply/demand chart with the wedge is the
   *reveal*, where it teaches, not a live-drag overload.
2. **The naive-intuition ghost marker** (economist + teacher both asked for it) —
   the seductive first-order answer (the pre-tax price; "everyone who wants one
   gets one") is dropped beside the truth, and landing on it fires `naive_trap`
   into the reliability signal.
3. **Macro Observatory's distance-based partial shading** (designer's pick) — the
   grade caliper renders *how close and which way you erred*, not a binary
   pass/fail.

## What shipped in v1 (this release)

- **A third track, `economics`** — "THE MARKET ROOM" — added to the registry with
  six misconception-first topics (opportunity cost, sunk costs, nominal vs real,
  the unseen / secondary effects, tax incidence, gains from trade), an
  econ-flavored ladder (Folk Economist → Price-Taker → Marginalist → Equilibrium
  Thinker → The Invisible Hand), and badges (Second-Order Sight, Killed a Darling,
  …) recomputed from attempt rows like every room.
- **A new interaction kind, `market`** — the winning "Lever": predict one headline
  number (a post-tax consumer price, or the quantity a binding ceiling actually
  clears), stake conviction, and the reveal shows the supply/demand chart, the
  free equilibrium, the policy outcome, and a **you / intuition / market** caliper
  with distance shading. The curves and the answer never cross the wire before
  commit, so it stays a calibration of intuition. `naive_trap` telemetry feeds the
  reliability curve.
- **26 items** — 18 misconception MCQs (three per topic) + 8 market items (four
  tax-incidence, four price-ceiling). Every market truth is re-derived from the
  linear model and asserted at authoring time and in `quiz-content.test.ts`.

Verified end-to-end against the live API: all 8 market items serve without leaking
the curves/answer, grade consistently with the revealed truth + tolerance, fire
`naive_trap` on the intuition (4/4), and grade the true value correct (4/4). Full
suite (134 items · ALL PASS) + bundle-guard (blinding PASS) + build green;
Playwright confirmed the dashboard and the market reveal render on mobile.

The two-gate commitment (the teacher's graft from Standoff — also name the trap you
feel pulled toward) is scoped into the v2 plan in ECON-YEAR.md.
