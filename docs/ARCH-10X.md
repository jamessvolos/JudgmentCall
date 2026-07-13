# The Architecture Room 10x — design competition & build record

A four-firm competition, judged by a three-person expert panel, to add a NEW
signature interaction that 10x's the existing Data Architecture room (which
already had mcq, duel, and bakeoff). The new interaction had to teach a core
systems truth those kinds can't. This is the record; the one-year
content/roadmap/experiment simulation is in **ARCH-YEAR.md**.

## The brief

The Architecture room measures CALIBRATION (answer, stake 25–99% conviction,
Brier-scored, reliability curve). The proven manipulable pattern is *hidden
truth → user parameter → live consequence → numeric tolerance grade* (shipped:
`flood`, `estimate`, `market`). Each firm — a designer × systems-expert ×
teacher collaboration — proposed one new mechanic, distinct from mcq/duel/bakeoff.

## The four firms

| Firm | Signature interaction | Thesis |
|---|---|---|
| **A · Latency Physics** | **REDLINE** (`redline`) — predict the max utilization a queue can run at under a p99 SLA; the hidden truth is the M/M/1 knee. | Latency is non-linear in utilization; the safe knee sits far below intuition. |
| **B · The Sizing Bureau** | **The Provisioning Dial** (`provision`) — drag a node count between a red *SLA-risk* meter and an amber *overspend* meter to the green band. | Engineers mis-size in both directions; size to a utilization target, not raw capacity. |
| **C · Fault Line** | **BLAST RADIUS** (`quorum`) — set a replication/quorum parameter under a fault scenario; hidden truth = the min satisfying integer (F+1, N−W+1, N−F). | Systems are judged by how they fail; quorum/durability is arithmetic. |
| **D · Data Gravity** | **The Scan Meter** (`scan`) — predict bytes scanned for a query over a columnar layout; a partition grid lights scanned-vs-pruned. | The warehouse bill is bytes-scanned, not rows; engineers have no meter for it. |

## The judging panel (scores out of 40)

Three judges — a **principal systems architect** (rigor), a **teacher/learning
scientist** (learning outcomes), and a **designer-engineer** (craft +
buildability, who read the codebase).

| Firm | Architect | Teacher | Designer | **Total** |
|---|---:|---:|---:|---:|
| **A · REDLINE** | 35 | 34 | 33 | **102** 🏆 |
| D · Scan Meter | 32 | 33 | 35 | 100 |
| B · Provisioning Dial | 32 | 27 | 26 | 85 |
| C · Blast Radius | 30 | 21 | 24 | 75 |

**Key verdicts.**
- *Architect:* ranked **A ≻ B = D ≻ C**. Reproduced Redline's 54% knee himself; its
  only exposure is the honest M/M/1 idealization. Flagged D's headline lesson
  ("a non-partition filter never prunes") as **partly false** on modern engines
  (Parquet/ORC zone maps, Snowflake micro-partitions) — a real teaching risk;
  B's `+f` fault term and arbitrary `targetUtil`/slack as soft joints; and C as
  "the cleanest textbook math but a **quiz, not an instrument**."
- *Teacher:* ranked **A > D > B > C**. Redline targets the most-confidently-wrong
  intuition in systems (everyone stakes 85–90%; truth ~54% — the biggest
  possible calibration gap), gentlest on-ramp, most visceral. C is borderline-MCQ;
  B's two meters are mobile overload.
- *Designer-engineer:* ranked **D > A > B > C**. D is the smallest build (a near-
  literal `market` clone). A is the *craft champion* but its live p99 curve has a
  λ→μ singularity to guard. C breaks the tolerance-grade mold into a disguised pick.

## The winner & the synthesis

**Winner: Latency Physics's "REDLINE"** — the closest race in the program (102 vs
100), taking the rigor and learning panels; it is the only pitch pairing an
exact, uniquely-computable truth with a genuine live-consequence manipulable, on
the most transferable and counterintuitive systems truth on the board. Three
grafts the panel converged on, all shipped:

1. **The teacher's calibration-native reframe** — instead of "drag λ until the
   live curve crosses the SLA" (which is procedural and leaks the answer), the
   learner **predicts the max-safe utilization from the scenario and stakes
   conviction**, with a **`naive_trap`** on the seductive ~90%. The p99 curve is
   rendered on the **reveal** — which also neutralizes the designer's singularity
   warning, since the curve is drawn once with the knee already known.
2. **The architect's two-sided framing** — guessing *below* the knee isn't just
   "safe," it's idle capacity you're paying for; the reveal names it when you
   under-shoot. (A note, not a second live meter — respecting the mobile budget.)
3. **The distance-shaded caliper** carried from the economics build — a
   you / ≈full / knee strip shaded by how far and which way you erred.

## What shipped in v1

- **A new interaction kind, `redline`** in the Architecture room: predict the max
  utilization a single M/M/1 queue can run at while holding its p-th percentile
  latency under an SLA. Closed form: p99 = ln(1/(1−p))/(μ(1−ρ)) ⇒
  **ρ\* = 1 − ln(1/(1−p))/(μ·SLA)**. Serve sends only μ, the SLA, and the slider
  frame; the p99 hockey-stick, the SLA line, the knee, your guess, and the
  ≈full ghost are the reveal. `naive_trap` feeds the reliability curve.
- **8 redline items** spanning knees from **7.9%** (a slow backend with a tight
  tail SLA) to **88.5%** (a fast tier with a generous SLA) — teaching that the
  knee is set by the SLA-to-service-time ratio, not by "how loaded feels safe."
- **2 supporting MCQs** (Little's Law; the ρ/(1−ρ) queue-length hockey-stick).

Verified end-to-end against the live API: all 8 redline items serve without
leaking the knee/naive; the server truth matches the M/M/1 closed form (8/8);
submitting the true knee grades correct (5/5); submitting ~full fires
`naive_trap` (5/5). Full suite (144 items · ALL PASS) + bundle-guard (blinding
PASS) + build green; Playwright confirmed the reveal (p99 hockey-stick + SLA line
+ knee + caliper) renders on mobile.

The strong runner-up — Data Gravity's Scan Meter (`scan`, the "$400 query") — is
scoped as the v2 headliner in ARCH-YEAR.md, with the architect's zone-map/
compression correction folded in so its lesson is honest.
