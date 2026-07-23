# THE LADDER — competition, synthesis, user test & build record

The cross-room experience: after every graded call in every training room, the
reveal reads the answer at a seniority rung — **ENTRY · SENIOR · PRINCIPAL** —
with a one-line why, and shows how to scale the answer up on that very item.
This is the record; the simulated year is in **LADDER-YEAR.md**.

## The three firms

Three firms — each a designer × specialist × teacher — pitched complementary
halves of the experience:

| Firm | Lens | Core contribution |
|---|---|---|
| A · Rubric | assessment science | The exact per-kind level rules over real reveal fields; the anti-gaming argument; re-derivability as the design goal. |
| B · Next Rung | pedagogy | The two-layer scale-up model: one template per kind + a **computed sensitivity line** derived from the served payload — O(kinds), not O(items); zero API changes. |
| C · Arc | progression | The accumulating identity: recap strip, the windowed dashboard read ("answering at ~SENIOR lately"), and the tenure-vs-form distinction against the room Levels. |

## The synthesis ruling (code-verified)

A synthesis judge audited all three against the codebase and ruled:

1. **Store the level.** The one-truth conflict (A's rubric needs reveal fields;
   C's windowed fold needs row data) resolves by computing the rung at grade
   time and storing it on the attempt row — `correct` is itself a stored
   grade-time derivation, and `level` is the identical species of fact, printed
   with its why so the learner can re-derive it. One nullable column, one
   migration; legacy null rows are excluded from the fold and absorbed by the
   cold-start gate.
2. **The canonical rule table** — A's rubric with one amendment: the
   conviction-gated Principals (picks, payback-NEVER) require **difficulty ≥ 2**,
   because conviction is free to state and a foundation-tier gimme could be
   farmed; precision, band-sharpness, and naming are unstakeable and need no
   gate. Foundation picks cap at Senior: "conviction on a gimme isn't the
   principal signal."

| Kind family | ENTRY | SENIOR | PRINCIPAL |
|---|---|---|---|
| mcq / duel / bakeoff | wrong | right (hedged, or committed on a gimme) | right · staked ≥85 · subtle tier |
| market / redline / pool / gap / flood | wrong (trap named) | inside tolerance | half-tolerance tight |
| payback (finite) | wrong | inside the dex band | half-band tight in log-space |
| payback (NEVER) | committed a number | latched NEVER, hedged | latched · staked ≥85 · subtle tier |
| estimate | escaped band, or barn-door capture | captured, working band | captured at desk sharpness |
| drill (six modes) | missed | caught, unnamed | caught **and named the move** |

3. **v1 surfaces:** the reveal rail + why + SCALE IT UP line; the run recap
   strip with a binding-constraint next step; the dashboard windowed read (last
   12 leveled rows, thresholds break downward, no read under 6); the stored
   level column; the drill chip gated on the naming beat. **Cut to the year:**
   hub-card read lines, /train/career, drill NextRung, topic probes.
4. **The computed lines verified:** payback's flip premium
   (pLong+out)/(pShort+out); market's incidence split d/(b+d) (tax lever only);
   redline's halved-SLA knee; flood's two-test prevalence ((1−spec)/sens)²;
   estimate's sharpness ratio; gap's tie-shift; duel's alsoFits flip constraint.
   mcq keeps the template — a question, because questions don't rot.
5. **Naming:** THE LADDER; rungs printed ENTRY · SENIOR · PRINCIPAL; the word
   "Level" stays reserved for the earned room Levels I–V.

## The simulated user test — and what it changed

Three personas reviewed the real screens (a first-session analyst, a
competitive staff engineer at 40 sessions, a 5-minute-phone exec). Findings
that shipped as fixes before deploy:

1. **The same-screen contradiction (worst bug).** The stake echo said "STAKED
   85% · LANDED IT WHILE HEDGING" while the ladder awarded PRINCIPAL for ≥85 —
   two systems disagreeing about the same stake on one card. **Fixed:** the
   echo's thresholds now share the ladder's 85 boundary; at ≥85 it reads
   "Committed — and right."
2. **The drill's Entry why mis-diagnosed under-claims.** A learner who
   deliberately under-claimed in calibrate mode was scolded for
   headline-chasing. **Fixed:** the drill's Entry line is now neutral — "Senior
   answers stake the strongest claim the data supports — no more, no less."
3. **The Principal aphorism read as filler.** On mcq, the top rung saw a
   kind-generic transfer line every time. **Fixed:** at Principal the block now
   shows the computed sensitivity or nothing — a generic aphorism is worse than
   silence at the top rung.
4. **The dashboard read parsed as a level-up requirement.** It sat flush under
   the Level II progress gates. **Fixed:** detached into its own quiet bordered
   card; the copy ("Your Level is what you've earned; the read is how you're
   answering right now") was tested as good and kept verbatim.

**Flagged beyond v1** (now the year roadmap's headline experiment): the ≥85
conviction gate invites flat-85 staking on subtle picks, which the calibration
panel itself penalizes — a calibration-aware Principal gate is Q2's work.

## What shipped

- `src/lib/level.ts` — the pure rubric + next-rung content, imported by the
  server grader and both room clients; `scripts/level.test.ts` locks every
  rubric row, the computed formulas, and the windowed fold.
- `QuizAttempt.level` (migration) · grader computes/stores/returns rung + why ·
  the standing fold returns the windowed read.
- One `postReveal` mount covers all ten kinds in the five track rooms; the
  drill renders its chip after the naming beat resolves, so the rail can never
  leak the "name the move" answer.

Verified: 11/11 suites ALL PASS · live API returns rung/why on every graded
call with the rubric's exact semantics · the standing fold reads the window ·
guard PASS · build green · Playwright confirmed the reveal rail (PRINCIPAL on
an 85-staked subtle call), the recap strip (YOU RAN ENTRY, 5·0·3, ties broken
downward), the detached dashboard read, and the drill chip.
