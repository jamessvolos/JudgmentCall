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
| **Single-cause story** | Several drivers moved; one gets the credit | Look for the drivers that got quietly dropped. |
| **Overreach** | A line through one or two points, or a narrow sample generalized | How many observations are there — would they hold outside the slice measured? |
| **Certainty inflation** | A noisy or provisional reading spoken as settled | Watch for "is / will / guarantees" where the data supports "so far / may". |
| **Base-rate neglect** | A raw count with no denominator | Ask "out of how many?" — the rate can move opposite the count. |

The families are the study's five overclaim devices (`INSIGHT-PRINCIPLES.md` /
`ATTRIBUTES.md`: causal, single-cause, extrapolation, certainty inflation,
base-rate neglect) — study and teaching share ONE vocabulary, so a learner who
gets fluent in the drill is fluent in exactly what the generator can plant.
`overclaimFamily(device)` classifies any free-form device string into a family
(keyword rules, `other` fallback, never throws) — so richer, item-specific
device wording still teaches a stable pattern.

### Two skill families, three exercise modes (the Training Room)

The drill is now **the Training Room** (`src/app/drill/page.tsx`) — a skills
studio, not a single quiz. The five overclaim families above are the **FIDELITY**
family ("is the claim honest?"). Alongside them sits a **CRAFT** family ("is the
insight *well told*?") drawn from `INSIGHT-PRINCIPLES.md`'s failure taxonomy —
buried lede, false precision, missing so-what, absent caveat, padding. Both live
in the `SKILLS` registry in `src/lib/teaching.ts` (each with an id, family, name,
transferable `tell`, and a curriculum `concept` blurb), drill-client-only.

The learner practices across **three modes**, each a different kind of retrieval:

- **Spot** — which of two tellings exceeds the data (the original task).
- **Fix** — pick the repair that stays true without going soft (multiple choice,
  each option with a rationale on reveal).
- **Calibrate** — pick the strongest claim the data actually supports (a
  timid→overreaching ladder; teaches uncertainty calibration).

The pool (`prisma/drills.ts` + `prisma/drills-pool.ts`, authored + adversarially
reviewed) is **35 items** across the three modes, all ten skills, and three
difficulty tiers. Items carry `mode` / `skill` / `difficulty` columns and sync to
production idempotently on every build; grading for all modes is locked in
`drill-grade.ts` (+ `drill-content.test.ts`, which asserts every choice item has
exactly one correct answer).

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

Status after the Training Room build (the deeper pool that gated this arc now
exists — 35 items, multiple per skill):
1. **Cover all skills before repeating** — DONE: `getNextDrillItem` prefers an
   item whose *skill* the session hasn't faced yet.
2. **Extra reps on missed skills** — DONE: once every skill has been faced,
   `getNextDrillItem` enters a *weak tier* — it serves only skills the learner
   MISSED (caught < attempted), biased toward the most-missed skills, before it
   will re-serve a mastered one. Verified: after a session faced all ten skills
   and missed two, 100% of the next draws landed on those two (vs 20% uniform).
3. **Escalate difficulty** — DONE: `getNextDrillItem` now ramps a *target
   difficulty tier* with the learner's drill rating (tier 1 below 1240, tier 2
   below 1340, tier 3 above) and weights candidates by how close their AUTHORED
   difficulty (1 obvious .. 3 subtle) sits to it. Since the rating rises ~16 per
   catch and falls ~16 per miss, the climb self-gates — a struggling learner
   stays on obvious items, a reliable one advances to subtle ones. Verified: the
   difficulty-3 share of draws climbs 28% → 30% → 30% → 52% as the modelled
   learner's rating rises from 1150 to 1420, and the difficulty-1 share falls
   27% → 12% → 11%. (Previously selection keyed only off the item Elo `rating`,
   which sits near its 1200 default until items accrue attempts — so the authored
   difficulty tiers were effectively ignored and the ramp was inert.)

Per-skill progress is now a live **mastery map** on the Training Room dashboard
(caught/attempted per skill, grouped by family) plus a **session recap** (skills
practiced + carry-forward tells for the ones missed) — the visible skill map the
model called for. Tapping any skill drills that skill alone (curriculum focus).
The active-recall "name the move" beat, dropped in the Training Room rebuild, is
now **restored and generalized**: after any item is graded, the learner names the
pattern from chips scoped to the item's family (a 1-of-5 retrieval, scaffolded by
the family shown in the header) before the pattern is revealed; the reveal then
marks the guess ✓/✗ and the recap reports "named the pattern X of Y." It is
formative — the drill rating is settled on the pick, so a mis-name never costs it,
which keeps the two halves of the skill (spot vs. name) independently measured.

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
- **2026-07-05** — **The Training Room** (10-wave build). The drill was rebuilt
  from a single 6-item spot quiz into a skills studio, and in the process the
  pool-depth blocker this arc kept hitting was removed: subagent authoring (not
  the app's blocked generation credits) produced a reviewed **35-item** pool.
  What shipped: (1) a second skill **family** — CRAFT (buried lede, false
  precision, missing so-what, absent caveat, padding) beside the five FIDELITY
  families, all in a unified `SKILLS` registry; (2) two new **modes** — Fix (pick
  the faithful repair) and Calibrate (pick the strongest supported claim) — so a
  learner now trains three kinds of retrieval, not one; (3) a **mastery map**
  (per-skill caught/attempted, both families) and a **session recap** with
  carry-forward tells, delivering the visible skill map the model called for;
  (4) **curriculum focus** — tapping a skill drills it alone; (5) skill-diverse
  selection re-keyed off the stored `skill` column plus rating-soft-weighting for
  a gentle difficulty ramp. Data model: `DrillItem` gained `mode`/`skill`/
  `difficulty`/`choices`, synced idempotently on build. Grading for all modes is
  locked (`drill-grade.ts` + `drill-content.test.ts`). Blinding held under the
  strongest test — the drill is where overclaim vocabulary is *permitted*, and
  the bundle guard confirms the teaching chunk stays drill-only while the
  canonical grep on client chunks is empty; drill attempts still never enter
  analytics. Deployed to production. Mastery-arc re-map above: bullet 1 done,
  bullet 3 partial; **bullet 2 (re-serve missed skills as extra reps) is now
  feasible and is the top open item**, with the active-recall "name the move"
  beat (dropped in the rebuild) the other named next candidate.
- **2026-07-05** — Curriculum, part 5: **missed-skill reinforcement selection**
  (mastery-model bullet 2, the round's chosen top open item). `getNextDrillItem`
  was two-tier — cover an unfaced *skill* first (bullet 1), else fall back to the
  whole unseen pool with a soft rating weight. That fallback treated a skill the
  learner had just *missed* the same as one they'd aced: reinforcement landed on
  random survivors, not weak spots. Now it is three-tier: (1) unfaced skill →
  (2) **weak tier** — a skill faced but MISSED (`caught < attempted`), and within
  it items are weighted by miss count so a skill missed twice is retried harder
  than one missed once → (3) anything left. Rationale by the decision lens: this
  is the single highest-impact move on the arc (it's *the* named top open item),
  it needed no new items or credits (reads the `correct` flag already stored on
  every `DrillAttempt`), and it is zero-risk to blinding (entirely inside one
  server function; the `/api/drill` response shape is untouched, no fidelity
  vocabulary moves). How it advances the arc: with bullet 1 (cover all) already
  shipped, a learner who has now seen every skill stops getting round-robin
  repeats and instead gets drilled on exactly the skills they're failing — the
  "learned one family, not the skill" failure the charter warns about, closed
  from the other side. Verified empirically: a session that faced all ten skills
  and missed two drew the next item from those two 100% of the time (uniform
  would be 20%); full gate green (tsc, lint, build, canonical grep empty, bundle
  guard PASS — teaching chunk still drill-only, 35-item content test passes).
  What this taught about the model: the three tiers now realize bullets 1 and 2
  cleanly and 3 partially; the remaining arc is a genuine *difficulty ladder*
  (bullet 3 — "clear the easy tier of a skill before its hard tier"), which the
  current soft rating-weight only approximates. That is the next high-value
  candidate, and unlike past rounds it is now feasible on the 35-item pool (three
  difficulty tiers already exist in the content). The credit-free selection
  policy is otherwise close to complete.
- **2026-07-05** — Curriculum, part 6: **the difficulty ladder made real**
  (mastery-model bullet 3, the round's chosen candidate). Selection *claimed* a
  difficulty ramp but keyed it off each item's Elo `rating`, which sits at its
  1200 default until items accrue attempts — so at the study's scale every item
  looked equidistant to a new learner and the authored difficulty tiers (1
  obvious .. 3 subtle) were effectively ignored. `getNextDrillItem` now derives a
  *target tier* from the learner's drill rating (tier 1 < 1240, tier 2 < 1340,
  tier 3 above) and weights candidates primarily by proximity of their AUTHORED
  difficulty to that target, keeping the Elo-closeness as a lighter refiner for
  when ratings do diverge. Because the drill rating moves ~±16 per call (K=32 at
  parity), the climb self-gates: a learner who keeps missing stays on obvious
  items; one who succeeds advances — the charter's "escalate only once the easy
  tier is reliably caught," realized in aggregate. Why it won the decision lens:
  it advances the exact next arc bullet, *deepens* an existing mechanism rather
  than adding surface, is entirely server-side (zero blinding-UI risk, no
  vocabulary moves), credit-free (uses the `difficulty` column + rating already
  stored), and is invisible-by-design so it adds no learner friction. Verified
  empirically (no UI to screenshot — the artifact is the distribution): the
  difficulty-3 share of draws climbs 28% → 30% → 30% → 52% as the modelled
  learner's rating rises 1150 → 1420, the difficulty-1 share falls 27% → 12% →
  11%; full gate green (tsc, lint, build, canonical grep empty, guard PASS —
  teaching chunk drill-only, 35-item content test passes). What this taught about
  the model: with bullets 1–3 now all realized, the credit-free *selection*
  policy is complete — a session covers unseen skills, reinforces missed ones,
  and ramps difficulty with competence. The remaining levers are content and
  surface, not selection: (a) the pool has only **6** obvious-tier (difficulty-1)
  items, so a brand-new learner's on-ramp is content-limited — a future content
  round adding more obvious items would sharpen it; (b) the active-recall "name
  the move" beat dropped in the Training Room rebuild is still the standout
  surface candidate (retrieval practice on "name how"), now the top named next
  item. Blinding held throughout; drill attempts still never enter analytics.
- **2026-07-05** — Surface, part 1: **active-recall "name the move" beat restored**
  (the round's chosen candidate, and the standout surface item named last round).
  With the credit-free *selection* policy complete (bullets 1–3 shipped), the
  highest-value lever moved from *which* item to serve to *how* the learner
  engages it. The charter's one-sentence definition is "notice when a telling
  asserts more than its data holds, **and name how**" — but the rebuilt drill only
  *revealed* the pattern passively; the "name how" half was never actively
  retrieved. Restored (and generalized beyond the old spot-only version): once an
  item is graded, the pattern name / device / explanation / tell are withheld and
  the learner first **names the move** from chips scoped to the item's family
  (fidelity → the 5 overclaim moves; craft → the 5 craft flaws), a clean 1-of-5
  retrieval scaffolded by the family already shown in the header. The reveal then
  marks the guess ✓/✗ against the truth, and the recap adds a "named the pattern
  X of Y" read beside "X of Y caught" — so both halves of the skill are measured
  separately. Crucially **formative**: the drill rating is settled on the spot
  pick and never re-graded, so a correct spotter who mis-names is never penalised
  (verified on screen — a +15 spot stood while the name was marked ✗); a "just
  show me" skip is always available. Why it won the decision lens: highest impact
  on the core teaching goal (retrieval practice is the best-evidenced learning
  intervention, and this is the *only* place the "name how" half is trained, not
  just shown); credit-free (reuses the SKILLS registry + the item's stored skill,
  no new content); and drill-only by construction, so zero blinding risk. Verified:
  drove spot items in both themes — fidelity items surface the 5 fidelity chips,
  craft items the 5 craft chips (family-scoping correct), both reveal phases gate
  the pattern properly; tsc, lint, build, canonical grep empty, bundle guard PASS
  (teaching chunk still drill-only, ~202 KB), drill-content 35/35. Screenshotted
  the naming phase + marked reveal in light and dark. How it advances the arc: the
  mastery model's *selection* is complete; this opens the *engagement* dimension —
  turning each item from a recognition task into recognition **plus** recall.
  Next candidates: persist naming accuracy into a durable per-skill read once the
  pool deepens (today it's a session-local tally), and the standing content lever
  (more obvious-tier items). Blinding held; drill attempts still never enter
  analytics; the naming tally is client-only and never POSTed.
- **2026-07-10** — Content, part 1: **the obvious-tier on-ramp filled** (the
  charter's standing content lever, named as the open gap in the last two
  amendments). The audit that opened this round sharpened the known problem:
  not only did the pool hold just 6 difficulty-1 items, but **five of the ten
  skills had zero** — `absent_caveat`, `buried_lede`, `false_precision`,
  `missing_sowhat`, `single_cause`. That's a selection-model hole, not just
  thin content: the difficulty ladder targets d1 for ratings under 1240 and
  the fresh tier serves a learner's first encounter with each skill — so for
  half the skills, a brand-new or struggling learner could never be served an
  obvious-tier rep, and the ladder shipped in the mastery arc was silently
  inert exactly where it matters most. Authored **5 new difficulty-1 spot
  items**, one per missing skill, through the established two-agent pipeline:
  an author pass (DS-flavored fictional scenarios — Swiftline, St. Alder,
  BrightPath, Emberfall, Lumo — each with a genuinely obvious tell, per the
  tier's contract) followed by an independent adversarial review. The reviewer
  passed three items and caught two real defects, both fixed before
  integration: the `missing_sowhat` item's faithful telling smuggled in an
  unsupported mechanism claim (rewritten mechanism-neutral: "until the crash
  on those devices is patched"), and the `absent_caveat` item's faithful
  telling contradicted its own prompt by implying the caveat was resolved
  (rewritten provisional: "treat the jump as provisional until April shows
  whether it holds"). Pool: 35 → **40 active items**; difficulty-1: 6 → 11;
  d1 coverage now **all ten skills** (sync check: "skills missing d1:
  NONE ✓"). Verified: drill-content test 40/40 PASS, tsc, lint, build,
  canonical blinding grep empty, bundle guard PASS (~201 KB, teaching chunk
  still drill-only); a new item served live through the real weighted draw
  and screenshotted in light and dark (one-pip difficulty marker and the
  corrected text confirmed on screen). Why it won the decision lens: it was
  the charter's own named next lever; it converts an already-shipped
  selection mechanism from partially inert to fully live (content unlocking
  code, no new code); and it is drill-only by construction — zero blinding
  surface. Next candidates: deepen d1 past one item per skill so the fresh
  tier has variety on re-entry, and the durable per-skill naming-accuracy
  read (needs schema, still deferred). Blinding held; drill attempts still
  never enter analytics.
