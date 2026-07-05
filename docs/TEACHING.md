# The teaching function

Judgment Call is two products sharing one interface. The **study** measures
taste and is scrupulously blinded — it never tells a voter they were "right."
The **teaching function** is the opposite: a clearly-separated training room
where the app *does* say right and wrong, and its whole job is to leave the
learner able to catch an overclaim in the wild. This document is the charter
for that second product — what it teaches, how it knows a learner is improving,
and the rules that keep it from leaking into the study.

The intellectual source is `INSIGHT-PRINCIPLES.md` (what makes an insight great,
and the faithful-vs-overclaimed fault line). This doc is how those principles
become a *curriculum* a person can climb.

---

## What it teaches

One skill, stated sharply: **notice when a telling asserts more than its data
holds, and name how.** Every number can be accurate and the sentence can still
lie — in the grammar, not the figures. The learner is training the reflex that
a hurried domain reader lacks: to feel the exact step where the words went past
the numbers.

Teaching happens at two levels, always together:

1. **The device** — the precise, item-specific move ("treating a noisy point
   estimate as settled"). Concrete, tied to the finding in front of them.
2. **The family** — the recognizable *pattern* the device belongs to, with a
   transferable tell they carry to the next drill. This is what turns a
   guessing game into a skill.

### The overclaim families (`src/lib/teaching.ts`)

| Family | The pattern | The tell (how to catch it) |
|---|---|---|
| **Cause from correlation** | Co-movement promoted to causation | What else changed in the same window — and did anything rule the alternatives out? |
| **One cause of many** | Several drivers moved; one gets the credit | Look for the drivers that got quietly dropped. |
| **Projecting past the data** | A line through one or two points, or a narrow sample generalized | How many observations are there — would they hold outside the slice measured? |
| **Certainty inflation** | A noisy or provisional reading spoken as settled | Watch for "is / will / guarantees" where the data supports "so far / may". |
| **Base-rate neglect** | A raw count with no denominator | Ask "out of how many?" — the rate can move opposite the count. |

The families are the study's five overclaim devices (`INSIGHT-PRINCIPLES.md` /
`ATTRIBUTES.md`: causal, single-cause, extrapolation, certainty inflation,
base-rate neglect) — study and teaching share ONE vocabulary, so a learner who
gets fluent in the drill is fluent in exactly what the generator can plant.
`overclaimFamily(device)` classifies any free-form device string into a family
(keyword rules, `other` fallback, never throws) — so richer, item-specific
device wording still teaches a stable pattern.

---

## How it knows a learner is improving

- **Drill rating** (`progression.ts`, IRT-style): each item has a difficulty;
  a correct call on a hard item moves the rating more than an easy one. This is
  a *skill* estimate, separate from study XP, and is the headline the drill
  surfaces.
- **Immediate, honest feedback**: right/wrong, the device, the family + its
  tell, and the claims-ledger explanation — safe *only here*, because the drill
  is outside the study.
- **Coverage across families** (roadmap): a learner who only ever catches
  certainty inflation hasn't learned the skill, they've learned one family. The
  teaching function should track which families a session has faced and caught,
  and steer drills toward the unpracticed ones — the same "sample the starved
  cell" logic the study uses for contrasts, applied to a learner's blind spots.

## Mastery model (target state)

A learner is "fluent" in a family when they catch it reliably above chance on
items at or above their current rating. The drill should:
1. cover all families before repeating one,
2. spend extra reps on the families a learner misses,
3. escalate difficulty only once the easy items in a family are reliably caught.

Round-by-round, the loop moves the product toward this. The first rounds are
about *teaching depth per drill* (families + tells, shipped); later rounds add
the *curriculum* (family coverage tracking, targeted item selection, a
per-family progress read on the "you've cleared every drill" screen).

---

## Blinding rules (non-negotiable)

The teaching function is where fidelity vocabulary is *allowed* — and the wall
that keeps it from the study is absolute:

1. Fidelity/overclaim vocabulary and `src/lib/teaching.ts` ship to the **drill
   client only**. Never import teaching content from swipe, results, review, or
   any voting/study surface. (The drill chunk is already isolated; keep it so.)
2. Drill attempts never enter analytics; drill items never serve in the voting
   pool. Training right/wrong can never touch a published preference number.
3. Nothing the learner does in the drill changes what the study generates or
   how it scores taste. The two products share an interface, never a signal.

## How this doc is load-bearing

- **Drill verdict** (`src/app/drill/page.tsx`) renders the family name + tell
  from `teaching.ts` beside the item device + explanation.
- **`teaching.ts`** is the single source of the families and the classifier.
- **`progression.ts`** owns the rating/XP math (volume + skill, never taste).
- When a family or tell here changes, change it in `teaching.ts` too; don't let
  the charter and the code drift.

## Amendment log

- **2026-07-04** — First articulation. Shipped the overclaim-family taxonomy +
  `overclaimFamily()` classifier and surfaced the family name + transferable
  tell in the drill verdict (teaching depth per drill). Curriculum-level family
  coverage tracking is the next round.
- **2026-07-04** — Curriculum, part 1: **per-family progress read**. Added
  `getDrillFamilyProgress(sessionId)` (server; classifies each attempted item's
  device into its family at read time — no schema change, works on existing
  data) and an "overclaim radar" on the "you've cleared every drill" screen:
  the five families, caught/attempted pips, and which to come back to. This is
  the visible skill map the mastery model calls for. Still open in the arc:
  targeted item *selection* (steer the next drill toward a learner's weak
  families) and difficulty escalation — deferred because meaningful selection
  wants a deeper item pool than the current six (new drill items are blocked on
  generation credits). Blinding held: `teaching.ts` is imported server-side via
  `repo.ts` (Prisma-bound, never client) + the drill client only; the bundle
  guard enforces it.
- **2026-07-04** — Curriculum, part 2: **family-diverse ordering**.
  `getNextDrillItem` (`repo.ts`) no longer picks uniformly at random — it
  prefers a pool item whose overclaim family the session hasn't faced yet
  (random within that preferred set), implementing mastery-model bullet 1
  ("cover all families before repeating one"). Because the current six items
  already span all five families, a partial session now touches distinct
  families before any repeat — directly countering the "learned one family, not
  the skill" failure the charter warns about. No schema change, no deeper pool,
  no new credits: it reuses `overclaimFamily` (already imported server-side for
  `getDrillFamilyProgress`) to classify each attempted + candidate item's device
  at read time. This covers *unseen* families only; it deliberately does **not**
  yet steer toward a learner's *missed* (weak) families, and difficulty
  escalation stays deferred — both still want a deeper pool (with one item per
  family except extrapolation's two, there is no within-family ladder to climb).
  Blinding held: change is entirely inside `getNextDrillItem`; the `/api/drill`
  response shape is untouched and no fidelity vocabulary leaves the server.
- **2026-07-04** — Curriculum, part 3: **missed-family reinforcement**. The
  completion screen's "overclaim radar" was a scoreboard (caught/attempted
  pips); it now adds a **"Patterns to carry forward"** block that re-teaches the
  transferable *tell* for exactly the families the learner MISSED (`caught <
  attempted`), reusing the per-drill verdict's "Carry it forward" styling. This
  is the credit-free realization of mastery-model bullet 2 ("spend extra
  attention on the families a learner misses"): the ~6-item pool is too shallow
  to re-serve those families as extra *reps* (still deferred on a deeper pool /
  generation credits), so instead we reinforce the *pattern* at the reflective
  consolidation moment — turning the radar from a score into a study aid.
  Clean sweep gets an affirmation instead. How it advances the arc: bullet 1
  (cover all families) shipped last round; this delivers the reinforcement half
  of bullet 2 that does not need more items. Feasible now — the tells already
  live in `teaching.ts` (`OVERCLAIM_FAMILIES`), imported drill-client-only.
  Blinding held: change is confined to the `/drill` completion screen; canonical
  grep clean, bundle guard confirms the teaching chunk stays drill-only,
  screenshotted complete-with-misses in light + dark. Open / next candidates:
  the *selection* half of bullet 2 (re-serve missed families as extra reps) and
  bullet 3 (difficulty escalation) both still want a deeper item pool; an
  active-recall "name the family before the reveal" beat is a credit-free
  candidate for a future round.
- **2026-07-04** — **Critical fix: drill grading was inverted** + **active-recall
  beat**. While screenshot-verifying the recall beat (below), the drill's spot
  grading was found inverted since launch (commit 8d3ba6d, no test): the item
  asks "Which telling exceeds the data?" but grading was `picked === faithfulSide`
  — it rewarded picking the FAITHFUL telling. A learner who correctly caught the
  overclaim was told "It got you," lost rating, and (with the new recall beat)
  would have been "taught" about a miss they didn't make. The drill was training
  the *inverse* of its purpose. Fixed to reward the OVERCLAIMED (non-faithful)
  side; extracted the side-derivation + grading into a pure, tested module
  (`src/lib/drill-grade.ts`, shared by the GET serving path and the POST grading
  path so they can't drift) with `scripts/drill-grade.test.ts` (wired into
  `npm test`) locking the direction. Drill rating/XP are training-only (never in
  analytics), so fixing forward is safe. Verified end-to-end: drove 8 sessions
  (both hash branches) — picking the overclaim now grades correct, zero
  violations.

  Alongside it, shipped the **active-recall "name the move" beat** (the next
  credit-free candidate named last round). After the spot verdict, the pattern
  is no longer revealed passively — the learner first attempts to NAME the
  overclaim family from chips (the device/explanation/tell stay hidden until
  they answer or hit "just show me"), then the reveal marks their guess ✓/✗.
  This is retrieval practice on the charter's core "spot it AND name how" goal —
  attempting recall before the answer is what makes the pattern stick. The
  naming is formative: the drill rating stays settled on the spot, never
  re-graded, so a correct spotter is never penalised for mis-naming. Items whose
  device classifies as "other" (not a nameable family) skip the recall. All in
  `/drill`; blinding held (canonical grep clean, guard confirms teaching chunk
  drill-only), screenshotted both phases in light + dark. Open / next: an
  active-recall unit could later feed a per-family *naming* accuracy read
  (separate from the spot rating) once the item pool deepens; the selection half
  of mastery bullet 2 + difficulty escalation still wait on that pool.
- **2026-07-04** — Curriculum, part 4: **measure the "name how" half**. Last
  round added the active-recall "name the move" beat (the learner names the
  overclaim family before the reveal) but nothing *measured* naming skill — the
  charter's "How it knows a learner is improving" section covered only the SPOT
  dimension (drill rating + the radar's caught/attempted). Added a session-local
  **"Named the pattern: X of Y"** read on the completion screen, tallied from the
  recall guesses already collected in-session (chip clicks; "just show me"
  doesn't count). Now the end screen reports both halves of the skill: the drill
  rating + radar for *spotting*, and naming accuracy for *naming how*. These are
  genuinely independent — a learner can catch an overclaim yet misname the
  pattern (verified: a blind-guess run caught 4/5 families but named 0/6). No
  schema change, no credits: it's a client tally accumulated across the mounted
  drill session (a mid-session refresh just restarts it — acceptable for a
  formative read). Deepens the existing recall beat rather than adding surface.
  Blinding held: confined to the `/drill` completion screen; canonical grep
  clean, guard confirms teaching chunk drill-only, screenshotted light + dark.
  Remaining arc: bullet-2 *selection* (re-serve missed families) + bullet-3
  difficulty escalation still wait on a deeper item pool (generation credits);
  persisting naming accuracy into a durable per-family read also waits on that
  pool to be non-noisy. The credit-free improvements to the current drill are
  now largely exhausted — expect this loop to converge until the pool deepens.
