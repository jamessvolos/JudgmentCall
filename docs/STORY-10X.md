# The Data Storytelling room 10x — rebrand, competition & build record

The room formerly called **"Spot the overreach"** is now **Data Storytelling** — a
name that covers what it always taught: not just catching a telling that outruns
its data, but *telling the data straight*. This is the record of the rebrand and
the four-firm competition that added the room's new signature interaction. The
simulated year is in **STORY-YEAR.md**.

## The rebrand

"Spot the overreach" → **Data Storytelling**, across every surface the name
appears: the `/train` hub card, the room's own masthead at `/drill`, the sibling
"other rooms" links inside each track room, and the landing page's rooms line
(also corrected from a stale "Three rooms" to the true four). The room's URL
(`/drill`), its mechanics, grades, credentials, case files, and checkpoint exam
are unchanged — only the name and the framing widened from *catch it* to *tell it
straight, and catch the telling that outruns it*.

## The brief

The room already had five modes — **spot** (which of two tellings exceeds the
data), **fix** (pick the faithful rewrite), **calibrate** (pick the strongest
safe claim), **field** (call one telling cold), **ledger** (stamp every claim).
All five are *discriminative*: the learner judges a finished telling. The
competition asked four firms — each a bleeding-edge designer × an award-winning
data-communicator × an award-winning teacher — for ONE new signature interaction
that teaches something those five structurally can't, gradeable deterministically
server-side, blinding-safe, and mobile-legible.

## The four firms

| Firm | Interaction | Lens | The truth it teaches |
|---|---|---|---|
| **A · Compositor** | **COMPOSE** (`compose`) — build the lede from tagged fragments | generative | Overreach and timidity are decided one phrase at a time; a claim is only as honest as its weakest fragment and only as strong as its meekest one. |
| B · Axis | LEVEL (`level`) — un-distort a truncated-axis chart | visualization | The same true numbers can lie through their encoding; honesty is a chart parameter. |
| C · Throughline | THREAD (`thread`) — order true findings into the faithful telling | narrative | A true-but-buried lede misleads as surely as an overclaim; the sequence itself can lie. |
| D · Reader | BRIEF (`brief`) — pick the telling that fits a stated audience+decision | audience | Fitness-for-audience is a skill orthogonal to fidelity. |

## The judging panel (scores out of 40)

Three judges — a **rigorist** (measurement/assessment design), a **teacher**
(learning outcomes), and a **designer-engineer** (craft + buildability, who read
the codebase).

| Firm | Rigorist | Teacher | Designer | **Total** |
|---|---:|---:|---:|---:|
| **A · COMPOSE** | 31 | 36 | 34 | **101** 🏆 |
| C · THREAD | 29 | 31 | 33 | 93 |
| B · LEVEL | 24 | 33 | 31 | 88 |
| D · BRIEF | 18 | 27 | 26 | 71 |

**A · COMPOSE won all three panels outright** — a unanimous, no-tiebreak result
with an 8-point margin. Why each judge put it first:

- *Rigorist (A ≻ C ≻ B ≻ D):* COMPOSE is the only pitch whose target is a
  single, exactly-computable value (the max-safe strength total) graded by strict
  equality with no tolerance band and no contested convention. He ranked **D
  last** because "fitness-for-audience" is an irreducibly tasted judgment dressed
  as a boolean, and **B** below the top because a truncated-bar's "honest floor"
  is either always zero (a dominant heuristic that games it) or convention-
  contested. His one condition for the winner became a build graft (below).
- *Teacher (A ≻ B ≻ C ≻ D):* COMPOSE is the only mode where the learner
  *produces* the artifact and is graded for **both** storyteller sins — reaching
  too far *and* shrinking too timidly — the durable, transferable judgment the
  five discriminative modes can't train. His must-honor note: keep the *went-soft*
  stamp legible so a learner sees why a fully in-bounds lede still failed.
- *Designer-engineer (A ≻ C ≻ B ≻ D):* COMPOSE is genuinely new in the `mode`
  union, rides the existing `choices` JSON column so it needs **no migration**,
  grades purely and testably beside `isCorrectLedger`, and its per-slot single-
  select is lighter client state than C's tap-to-place ordering. He flagged B as
  the single most distinct pitch but the only one forcing a migration *and*
  injecting net-new SVG into a prose-only room, and D as a `ListChoices` reskin.

## The winner & the synthesis

**Winner: Compositor's "COMPOSE."** The grafts the panel converged on, all shipped:

1. **Rigorist's exactness graft.** Every slot is authored with a **unique
   strongest-safe option** (locked by `drill-content.test.ts`), so the target
   lede is a single assembly — no ties, no tolerance. Fragments are authored to
   compose independently (each safe fragment stays safe in the max-safe whole),
   and the grader is strict equality on the max-safe total.
2. **Teacher's went-soft graft.** On reveal every chosen fragment is stamped
   distinctly — **held · strong** (accent), **went soft** (a timid but in-bounds
   pick, muted, with the stronger wording shown), or **overreach** (danger) — and
   the strongest-safe lede is assembled whole beneath. The "aha" is the went-soft
   stamp: an all-true lede can still be wrong for going meek.
3. **Designer's build graft.** Single-select per slot, a live serif line that
   assembles the learner's choices as they pick, and zero schema change — the
   slots serialize into the same `choices` column every other mode uses.
4. **Throughline's idea, preserved.** COMPOSE's slots run in reading order
   (THE MOVE · THE LINK · THE SCOPE), so a trace of sequence is already in it; the
   full ordering interaction (THREAD, "a lie made only of truths") is the Q2
   headliner in STORY-YEAR.md.

## What shipped in v1

- **A new drill mode, `compose`**, in the Data Storytelling room: the learner
  builds a lede one fragment at a time, choosing the boldest phrasing each part
  still supports. Serve sends the slots with options shuffled and text-only —
  the `strength`/`overreach`/`rationale` never cross the wire before commit.
  Grade: **correct iff no fragment overreaches AND every slot is pushed to its
  strongest safe strength** (assembly total == max-safe total). One overreach
  fails the lede; so does one timid slot.
- **6 compose items** across fidelity and craft skills — single_cause
  (paid-social co-movement), extrapolation (volunteer-pilot rollout), certainty
  (an A/B peek), base_rate (precision≠recall), buried_lede (front-load the move),
  missing_sowhat (land on the decision). Every slot carries a unique
  strongest-safe fragment and at least one genuine overreach trap.
- **`isCorrectCompose` + `composeMaxSafe` + `composeSafeIndex` + `parseComposeSlots`**
  in `drill-grade.ts`, unit-tested in `drill-grade.test.ts`; a content-integrity
  branch in `drill-content.test.ts` that re-derives and asserts the unique-
  strongest-safe invariant per slot for every authored item.

Verified end-to-end against the live API: all 6 compose items serve without
leaking strength/overreach/rationale (6/6); the strongest-safe assembly grades
correct (6/6); a timid assembly is caught as *went soft* (6/6); an overreaching
assembly fails (6/6). Full suite (152 quiz items · ALL PASS), drill grade +
content tests pass, bundle-guard **blinding PASS** (the room's teaching
vocabulary stays reachable only from `/drill`), build green, and Playwright
confirmed the reveal renders the held / went-soft / overreach stamps and the
assembled strongest-safe lede on mobile.
