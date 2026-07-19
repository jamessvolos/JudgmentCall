# The Solver Room — design competition & build record

The app's fourth training track, commissioned as a specialist room for the
combination of **probability, expected value, incremental (marginal) difference,
and GTO outcomes**: `decision` — **THE SOLVER ROOM** ("Play the odds, not the
outcome"). Four firms — each a bleeding-edge interaction designer × a leading
game-theorist/decision-scientist × an award-winning teacher — competed to design
its signature interaction. This is the record; the simulated year is in
**GTO-YEAR.md**.

## The room

Six topics: **Compound Odds** (multiply, don't average), **Expected Value**
(price the bet at its break-even), **The Margin** (decisions are made at the
increment), **Unexploitable** (equilibrium frequencies), **Sizing & Ruin**
(Kelly and the over-bet), **The Deviation** (exploit vs GTO). Level ladder from
*Results-Oriented* (everyone starts guilty) to *The Solver*. Badges include
THIN VALUE and OFF TILT; the shared calibration badges apply — this room's
subject and the app's calibration engine are the same discipline.

## The four firms

| Firm | Pitch | The truth it teaches |
|---|---|---|
| A · Solver | **RAZOR** (`razor`) — set the indifference frequency | At equilibrium your frequency prices the *opponent's* options: MDF = P/(P+B), bluff share = B/(P+2B). |
| **B · Margin** | **THE MARGIN CALIPER** (`gap`) — commit the signed ΔEV between two lines | Decisions consume only the *difference* between the two best lines; close calls feel enormous, blowouts feel close. |
| C · Stake | **THE STAKE** (`stake`) — set the Kelly fraction | Knowing a bet is +EV is half the skill; over-betting a winning edge compounds to ruin. |
| D · Outs | **FLIP LINE** (`flip`) — compound the legs, cross the break-even | Independent chances multiply; a price is a probability in disguise (b\* = B/(B+W)). |

## The judging panel (scores out of 40)

A **rigorist** (game theory / assessment design), a **teacher** (learning
science), and a **designer-engineer** (craft + buildability, who read the code).

| Firm | Rigorist | Teacher | Designer | **Total** |
|---|---:|---:|---:|---:|
| **B · GAP** | 31 | 34 | 34 | **99** 🏆 |
| D · FLIP | 30 | 31 | 32 | 93 |
| A · RAZOR | 35 | 24 | 29 | 88 |
| C · STAKE | 26 | 26 | 24 | 76 |

**B · THE MARGIN CALIPER won** — two of three panels outright and the aggregate,
no tiebreak required. The decisive findings:

- *Teacher:* GAP and FLIP embed System-1 traps that **re-fire on every fresh
  item** (mode-anchoring; leg-averaging), while RAZOR and STAKE deliver their
  aha once and degrade into closed-form lookup. GAP wins on mandate coverage —
  its core quantity *is* the incremental difference the room is named for, and
  computing it forces probability weighting and EV construction simultaneously.
- *Designer-engineer:* the house already owns "slider → hidden curve → caliper"
  three times over, so the ninth kind must be distinct **at the commit** — and
  GAP is the only pitch that is: a zero-crossing **signed slider** where naming
  the winner and pricing it are one gesture. RAZOR's reveal would sit on the
  shelf next to redline's; STAKE is self-admittedly redline's pipeline with a
  hump.
- *Rigorist* (who ranked RAZOR first for exactness): GAP's ΔEV is uncontested
  arithmetic and its naive is a **declared, validator-recomputed rule**, not
  hand-tuning; his objections became build grafts (below). STAKE placed last on
  epistemology — full Kelly presumes log utility, so a well-trained learner can
  *correctly* dispute the answer key, which poisons the grade.

## The synthesis (grafts shipped in v1)

1. **The teacher's mix invariant** — if every item were a sign-flip, learners
   would train a contrarian reflex instead of the skill. The gen-quiz validator
   *enforces* the authored mix: ≥2 sign-flip items (the felt winner loses) AND
   ≥2 same-sign items (the felt winner is right but wildly mispriced), plus a
   dead-heat item (the margin is zero — knowing a tie is knowing something).
2. **The rigorist's recomputed naive** — each item declares its reflex rule
   (`mode` = compare most-likely outcomes / `best` / `worst`); the validator
   re-derives the naive from the rule and rejects hand-tuned traps. Mode
   branches must be unique (no ambiguity).
3. **The designer's restraint** — no unprecedented collapse animation; the
   reveal reuses the proven caliper grammar (you / felt / true on a signed axis
   with the zero line marked, the truth sliding in from the felt position via
   the existing reduced-motion-safe `pool-slide`), plus one new instrument line:
   **the agony index** — |ΔEV| against the headline swing ("a $500k-swing
   decision worth $2k").

## What shipped in v1

- **The `decision` track** — registry, curriculum, levels, badges — live at
  `/train/decision`, wired into the hub, the landing copy, and the sibling-room
  links.
- **The `gap` interaction**: both lines' full branch tables are shown (the
  skill is weighing them, not guessing hidden data — the pool precedent); the
  learner commits a **signed margin** on a zero-crossing slider and stakes
  conviction. Serve never sends the truth, the naive, or the reflex rule.
  Grade: |value − ΔEV| ≤ tol; the naive trap fires on the felt gap. The reveal
  prints both EVs, flags **FLIPPED · the felt winner is the loser** when the
  sign inverts, draws the signed caliper, and prices the agony.
- **8 gap items** (launch timing, job offers, warranties, vendor tails, a
  bluff-catch, runway sizing, a rebate-vs-drawing, a dead-heat hire) + **18
  supporting MCQs** across all six topics (3 per topic, difficulty-spread,
  arithmetic verified exactly — pot-odds, MDF, bluff ratios, Kelly, base rates,
  break-evens) → **178 items** in the total pool.
- Validators in `gen-quiz.mjs` (ΔEV recompute, Σp=1, naive-rule recompute,
  zero-crossing range, 2·tol trap distance, the mix invariant) and a matching
  branch in `quiz-content.test.ts`.

Verified end-to-end against the live API: all 8 gap items serve without leaking
truth/naive/rule (8/8); the server truth matches the re-derived ΔEV (8/8); the
exact margin grades correct (8/8); the felt gap fires `naive_trap` (8/8). Full
suite (178 items · ALL PASS), blinding guard PASS, build green; Playwright
confirmed the Solver Room dashboard and the signed-caliper reveal on mobile.
