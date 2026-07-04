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

The families map onto the four generation devices in `ATTRIBUTES.md`
(causal, single-cause, extrapolation, certainty inflation) plus base-rate, which
the drill data exercises directly. `overclaimFamily(device)` classifies any
free-form device string into a family (keyword rules, `other` fallback, never
throws) — so richer, item-specific device wording still teaches a stable pattern.

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
