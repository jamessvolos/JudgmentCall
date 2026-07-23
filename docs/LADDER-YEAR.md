# THE LADDER — a simulated year

Twelve months after the seniority read shipped across all six rooms: four
quarterly editions, a feature roadmap, and the design experiments run each
quarter with (simulated) outcomes and ship/kill decisions. Q1 is real — it
shipped with this release; Q2–Q4 are the planned arc. North star: **altitude
gain** — the share of active learners whose windowed read climbs a rung and
holds it for two windows, without their calibration (Brier/ECE) degrading.

---

## Q1 — THE LADDER ships (real)

**What shipped.** The per-call rung + why on every reveal, the SCALE IT UP
line (computed sensitivity or kind template), the recap strip with a
binding-constraint next step, the dashboard windowed read, the stored `level`
fact, and the drill chip — plus the four user-test fixes (the 85-boundary
alignment, the neutral drill Entry line, the no-filler Principal rung, the
detached dashboard read).

**Design experiments.**
- *E1 — Show the why, or just the rung?* **Result (sim):** the one-line why cut
  "why am I Entry?" support taps to near zero and made disputed reads
  re-derivable on screen. **Shipped the why.**
- *E2 — "ENTRY" vs "ENTRY LEVEL" on a miss.* **Result:** the single word on a
  three-stop rail read as a position, not an insult; the sting lives in the why
  where it can teach. **Shipped the single word.**

**Metric read (sim).** First cohort: 61% of first-session calls read Entry;
by session five the modal read was Senior — and the confident-miss why ("the
expensive kind") was the most screenshot-shared line in the app.

---

## Q2 — The calibration-aware Principal gate

**The headline fix** (flagged by the user test's staff-engineer persona): the
≥85 conviction gate invites flat-85 staking on subtle picks — the exact
behavior the calibration panel penalizes. Q2 makes the gate calibration-aware:
Principal on conviction-gated kinds requires staked ≥85 **and** the session's
recent staking not flat (the sharpness fold the calibration card already
computes). The rule stays a pure fold; the why explains it: "committed — and
your stakes have been earning their spread."

**Design experiments.**
- *E3 — Gate on sharpness vs gate on recent ECE.* **Result (sim):** sharpness
  tested as legible ("vary your stakes") where ECE read as a black box.
  **Shipped sharpness.**
- *E4 — Does the gate suppress honest 85s?* Guardrail experiment. **Result:**
  no measurable drop in honest high stakes; flat-85 farming fell to noise.
  **Kept.**

---

## Q3 — The arc surfaces (the year's cut list ships)

**Features.** The hub cards gain each room's read as one mono line — the
"Principal in Stats, Entry in GTO" sentence emerges from the page without a new
page. The **/train/career** profile ships: the read-over-time ribbon per room,
the level history, and the confident-miss ledger. The credential card gains the
seniority line. The drill room gains its NextRung block (quantify THIS chart,
complementing Carry-it-forward's spot-next-time).

**Design experiments.**
- *E5 — Ribbon vs sparkline for read history.* **Result (sim):** the stepped
  ribbon (a read per window) beat a per-call sparkline — the read is a fold,
  and the display should move like one. **Shipped the ribbon.**
- *E6 — Career moments.* A quiet "first Principal window in a second room" note
  at recap. **Result:** the single highest share-tap surface after the
  credential. **Shipped.**

---

## Q4 — Topic probes & the cross-room story

**Content.** The 36 authored topic probes land (one line per topic, slotted
into SCALE IT UP on mcq where nothing is computable — a question per topic, so
the top rung never reads filler). Case files thread a Principal-only variant:
answer the same item family at half-tolerance across three rooms. The Gauntlet
gains a seniority track (Brier-ranked AND altitude-ranked).

**Design experiments.**
- *E7 — Probe-as-question vs probe-as-fact.* **Result (sim):** questions held
  attention at Principal where facts skimmed; consistent with the year's rule —
  at the top rung, teach transfer or ask, never assert filler. **Shipped
  questions.**
- *E8 — Does the ladder cannibalize the room Levels?* Guardrail. **Result:**
  no — Levels kept their meaning as tenure; the read moved as form. The two
  vocabularies stayed distinct in user language ("I'm Level III but reading
  Senior"). **No change.**

---

## Year-end state (simulated)

- **Every graded surface** carries the read; every read is re-derivable from
  the card it appears on; every stored rung is the same species of fact as
  `correct`.
- **The arc is complete:** call → run strip → windowed read → hub line →
  career ribbon — five altitudes of the same fold, no stored number that can
  drift.
- **Calibration held:** the Q2 gate kept conviction honest; altitude gain and
  Brier improved together, which was the whole bet.

## Guardrails held all year

- **Nothing stored that can lie:** the rung is graded once, stored as a fact,
  and every aggregate above it is a pure fold.
- **Blinding:** the ladder never touches the hidden study's vocabulary; the
  bundle-guard stays PASS every quarter.
- **No LLM in the loop:** every read, why, and scale-up line is a closed-form
  function of the graded exchange — disputable only by re-deriving it, which
  is the point.

*Q1 is shipped and verified. Q2–Q4 follow the loop that built v1 — spec against
the code, verify against the live API, user-test the screens, fix before
shipping, gate on the guard, deploy green.*
