# The home page — a simulated year

Twelve months after THE FORK IN THE LAMP shipped: four quarterly editions of the
front door, a feature roadmap, and the design experiments run each quarter with
(simulated) outcomes and ship/kill decisions. Q1 is real — it shipped with this
release; Q2–Q4 are the planned arc. Metrics reference the two funnels the landing
feeds: **study starts** (`/api/session` → `/swipe`) and **rooms starts**
(`/train` entries), plus the `/admin` Training-Rooms funnel
(`entered → staked → n≥30 → credential`). North star: **total activated visitors
across BOTH experiences** — never one at the other's expense.

---

## Q1 — THE FORK ships (real)

**What shipped.** The two-lane landing: one unifying thesis ("How good is your
judgment, really?"), the shared live heartbeat, and two equal lit lanes — "I'm
curious" (study) and "I'm training" (rooms) — over a two-group surface index.

**Design experiments.**
- *E1 — Outcome-named lanes vs mechanic-named.* Hypothesis: naming what the
  visitor *walks away with* ("Find out what your taste is" / "Get better at
  knowing when you're right") beats naming the mechanic ("vote on pairs" / "stake
  confidence"). **Result (sim):** outcome lanes lifted second-lane (rooms)
  comprehension and did not cost study starts. **Shipped outcome-first.**
- *E2 — Two-equal lanes vs one-primary + ghost secondary.* The runner-up (B)
  demoted the rooms. **Result:** the equal-weight, earned-light layout raised
  *total* starts (study held, rooms up sharply) — the anti-burial mandate paid
  off. **Shipped the fork.**

**Metric read (sim).** Rooms starts from the home page rose from a buried tile-#03
trickle to a co-equal lane — the previously-invisible half of the product, now a
front-door choice.

---

## Q2 — The returning-visitor two-sided memory

**Edition "Welcome back, both sides."** Today the landing only remembers study
runs (`/api/results` → voteCount). Q2 adds a **rooms-side memory**: a small
`/api/train` standing read so a returner who has been *training* sees Lane B lead
with "Continue in the Statistics room — Grade II" the way study-returners see
"Continue your run." The smart-default becomes honestly two-sided — the lane you
last used leads, the other stays fully present.

**Design experiments.**
- *E3 — Which lane leads for a two-history returner?* **Result (sim):** leading
  with the *most recently active* lane beat always-study-first for returners.
  **Shipped recency-led ordering** (new visitors keep curious-first).
- *E4 — A live calibration read on Lane B.* Show the rooms lane a quiet "your
  calibration: 0.71 Brier" for returners. **Result:** lifted rooms re-entry.
  **Shipped for returners only** (cold visitors keep the clean promise).

---

## Q3 — The cross-sell moment

**Edition "The other door."** The two experiences teach each other: a study run
ends by revealing where your taste diverges — the natural next question is *why*,
which the rooms answer. Q3 adds a **contextual bridge** at the end of a study
recap ("You and the crowd split on 3 of 10 — sharpen the call in the Data
Storytelling room →") and, symmetrically, a room recap that points back to the
live study. The home page stays the hub; the bridges make the fork a loop.

**Design experiments.**
- *E5 — Bridge at recap vs bridge on the home page only.* **Result (sim):**
  in-context bridges at the recap moment converted far better than another home
  tile. **Shipped recap bridges**, home page unchanged.
- *E6 — One bridge or a menu.* **Result:** a single, specific next-step beat a
  menu of rooms. **Shipped the single contextual bridge.**

---

## Q4 — Proof, polish, and the shared credential

**Edition "One record."** A unified **judgment profile** the home page can greet
you with: your study taste-divergence and your rooms calibration on one small
card ("your judgment, so far"), gated behind real activity, every number a pure
fold over attempt rows. Plus a first-paint performance pass (the count and lanes
render without layout shift) and an a11y sweep of the two-lane focus order.

**Design experiments.**
- *E7 — Greet returners with the profile card vs the plain fork.* **Result (sim):**
  the profile card lifted returner re-engagement without hurting new-visitor
  clarity (shown only when there's activity to show). **Shipped for returners.**
- *E8 — Live count placement.* Heartbeat above the fork vs inside Lane A.
  **Result:** above-the-fork (shared) read as belonging to the whole product and
  tested cleaner. **Kept it shared.**

---

## Year-end state (simulated)

- **The front door** greets three visitors well: the cold newcomer (two clear
  outcome lanes), the study-returner (Continue your run), and the rooms-returner
  (Continue in your room) — none buried, one lit primary by earned light.
- **Both funnels fed:** study starts held; rooms starts became a first-class,
  front-door outcome; the recap bridges made the two a loop.
- **One record:** a shared judgment profile, every figure recomputed from
  attempts — nothing stored that can inflate.

## Guardrails held all year

- **Blinding:** the landing stays craft-only — no fidelity vocabulary, no hint of
  the hidden experiment. The bundle-guard stays PASS every quarter.
- **One earned accent:** across every edition, exactly one action glows (the
  study's live CTA); the rooms lane keeps equal size and a full ink CTA. The
  DATUM law holds; the rooms are co-present, never demoted.
- **No new backend on the front door:** Q1 ships on existing endpoints; Q2–Q4's
  reads (`/api/train` standing, the shared profile) are thin, cached, and pure.

*Q1 is shipped and verified. Q2–Q4 are the roadmap; each edition follows the loop
that built the fork — reuse the reduced-motion-guarded design system, keep both
experiences lit, gate on the blinding guard, deploy green.*
