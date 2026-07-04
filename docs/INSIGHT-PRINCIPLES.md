# What makes a great data insight

The operational tagging rules live in `ATTRIBUTES.md`. This document is the
layer above them: the *why*. It states, as sharply as we can, what the desk
believes makes a data insight great — the convictions the House View
(`src/lib/house-view.ts`) puts on the record, the standards the generator
writes toward, and the tensions the study exists to measure. It is opinionated
on purpose. A study of judgment should have some.

It is also falsifiable. Every principle here maps to a live contrast on
`/results`; the room can and does overrule the desk in public. When the data
contradicts a principle with a clean interval, the principle is wrong — amend
it here with a dated note, don't quietly keep it.

---

## The thesis

**An insight is a claim that changes a decision, and survives being checked.**

Two failure modes bound it:
- **Inert but true** — a faithful restatement of the data that tells no one
  what to do differently. Accurate, and useless.
- **Useful but false** — a punchy telling that moves a decision by asserting
  more than the data can bear. Compelling, and a liability.

Everything below is about living in the narrow band between them: maximally
decision-changing per unit of truth spent. The craft is not decoration on top
of the number — it *is* how much of the number's real information survives the
trip to a busy reader's decision.

---

## The five craft convictions

The desk's public calls, stated as principles rather than as chips. Each is a
default, not a law; audience can flip it (see below).

### 1. Lead with the figure, not the feeling
A telling that buries its number is asking for trust it hasn't earned. The
number-first lead invites verification — it hands the reader the thing they can
check. Implication-first leads move faster but spend credibility up front;
question-first leads are a delay dressed as engagement. *Great insight: the
load-bearing number is in the first clause.*

### 2. Cut until it survives being short
If a finding can't survive being said in fifteen words, it isn't an insight
yet — it's a paragraph looking for one. Short tellings get repeated in
meetings, where decisions are actually made; long ones survive scrutiny
afterward, where they're mostly re-read by people who already agree. Length is
a bet on *which* failure you can afford — being under-quoted or being
under-read — and most desks over-insure against the wrong one. *Great insight:
short enough to be repeated verbatim.*

### 3. State the catch before the claim
A caveat before the number changes how every following digit is read; the same
caveat after the applause is fine print. Omitting it doesn't remove the risk —
it silently transfers the risk of over-reading onto whoever repeats you. The
strongest tellings earn trust by disclosing their own weakness first, then
making the claim anyway. *Great insight: names its own limitation up front and
survives it.*

### 4. Round to what you'd defend in a hallway
Decimal places read as confidence and audit as noise. "About a third" can be
checked against memory and repeated without a slide; "31.4%" implies a
precision the underlying data usually can't support and invites a fight over
the digit instead of the direction. Reserve precise figures for when the digit
*is* the point (a covenant, a threshold, a reconciliation). Qualitative wording
("cooled sharply") is a mood, not a measurement — it travels furthest and
verifies least. *Great insight: quantified exactly as precisely as the decision
needs, and no more.*

### 5. Say what you'd do about it
An explicit so-what tells the reader the move; an implied one delegates the
conclusion to whoever talks next — usually the loudest person in the room, not
the most careful. Explicit direction speeds decisions and invites the pushback
that improves them; implication flatters the author's expertise and risks the
point being missed entirely. *Great insight: names an action, and is willing to
be wrong about it in public.*

---

## Worked example

One finding, told two ways. Both are strictly faithful — this is a craft
demonstration, not a fidelity one — so the only thing separating them is the
five convictions.

**The finding.** A small-business hiring index fell for the third straight
month; the drop is small, the sample is a survey, and one month doesn't make a
trend.

**Weak telling (63 words):**
> There are a number of forces currently shaping the labor market, and among the
> various signals worth watching is small-business hiring sentiment, which
> according to the latest survey wave has now moved lower for the third
> consecutive month, declining 1.8 percentage points to 47.2, a reading that
> some observers may interpret as consistent with a broader softening, though of
> course much remains uncertain.

Buried lede (the number lands in the third clause), padded to 63 words, false
precision (47.2, 1.8pp on a survey), the caveat dissolved into "much remains
uncertain," and no so-what — the reader finishes knowing a number moved and not
what to do. Most of the craft failures below, stacked in one paragraph.

**Strong telling (24 words):**
> Small-business hiring sentiment fell for a third straight month — a small drop,
> and only survey data. Watch the next reading before calling it a trend.

Number-and-subject first, short enough to repeat in a meeting, the limitation
("small," "only survey data") stated before it can be over-read, rounded to what
the survey can defend, and an explicit so-what that names the move (*watch the
next reading*) and the thing it would settle (*before calling it a trend*).

Same facts. Same fidelity. The second one changes a decision and the first one
fills a slot. That gap — not the number — is what the study measures.

---

## The tension the study measures (blinded)

The five convictions are craft — matters of taste with no single right answer,
which is why the public study reports them as preferences, never as scores. But
underneath sits the one dimension that *does* have a right answer, and that we
never show while voting: **fidelity.**

A telling is faithful when every claim is entailed by the data — omitting a
limitation is allowed, exceeding one is not. It overclaims when it exceeds the
data via exactly one device:

1. **Causal language on correlational data** — "*because of* the price increase"
   when all you have is co-movement plus a partial survey.
2. **Single-cause attribution** — crediting one factor when several moved and
   nothing rules the others out.
3. **Trend extrapolation** — projecting one or two periods forward as if the
   line were a law.
4. **Certainty inflation** — "guarantees", "is over", "will" where the data
   supports "so far" and "may".
5. **Base-rate neglect** — a raw count or change foregrounded without its
   denominator, so a number reads as a rate: "phishing reports up 40%" while the
   *victim rate* fell. Every figure is accurate; the exceedance is the missing
   "out of how many," which can point the opposite way from the count.

**Which device a finding invites.** The device is not chosen at random. Each
data *shape* has one exceedance that fits its own narrative — and the overclaim
that is hardest to catch is always the one a real analyst would actually
commit, because it is the one the hurried reader already expects. A device that
doesn't fit the data reads as a non-sequitur and gets caught; the dangerous one
travels under cover of the finding's natural story.

| The finding is shaped like… | The exceedance it invites |
|---|---|
| **Two readings over time** — a period-over-period series (GDP growth y/y, an FX rate vs a year ago, revenue vs prior year) | **Trend extrapolation.** A two-point line begs to be extended: "growth is accelerating and will keep climbing." |
| **Two variables moving together** — prices up while complaints up | **Causal language.** Co-movement promoted to cause: "the price hike drove the complaints." |
| **One outcome, several live drivers** — margin fell as markdowns *and* freight *and* mix all moved | **Single-cause attribution.** "Margins fell because of freight" — one named, the rest quietly dropped. |
| **A partial or leading reading** — one month, a half-season, a "to date" figure | **Certainty inflation.** A provisional signal hardened: "the slump is over." |
| **A count with an available denominator** — reports, tickets, incidents that could be expressed as a rate | **Base-rate neglect.** The count is foregrounded and the denominator dropped: "reports up 40%" when the *rate* fell. |

This is why the study's *stimuli* matter as much as its scoring: an overclaim
has to be on-target to be worth measuring. The batch of two-reading macro
series the pipeline now ingests (World Bank indicators, ECB reference rates,
year-over-year revenue) is, structurally, a deep well of the extrapolation trap
specifically — two points, and the whole temptation is to draw the third.

The craft is what makes an insight land. Fidelity is what makes it *true*. The
flagship question of the whole project is whether the two trade off — whether
the tellings that land hardest are systematically the ones that quietly exceed
their data, and whether training a reader to spot the exceedance changes what
lands. That experiment only works if no one voting can tell which pairs carry
it, so fidelity vocabulary never reaches a voting client and the desk takes no
public position on it. (See `DESIGN.md` blinding rules.)

The moral center of the product: **a great insight is punchy *and* faithful —
and the ones that are punchy *instead of* faithful are the ones worth teaching
people to catch.**

---

## Audience is the flip switch

None of the five convictions is unconditional; the reader's job flips several.

- **Executives** decide under time pressure and delegate verification. For
  them, lead-with-the-number and explicit-so-what get *stronger*; a missing
  so-what is a real failure, not a stylistic choice.
- **Analysts** are the verification layer. For them, caveat-up-front and
  precise-figures matter more, and an unhedged extrapolation reads as a
  competence signal in the wrong direction.

The disagreement view on `/results` (executives vs analysts on the same
contrast) is where this stops being a claim and becomes data. When the two
segments split cleanly on a contrast, that gap is itself a finding about who
you're writing for — often more useful than the headline rate.

This flip is now operationalized, not just asserted: the run-review
micro-lesson (`src/lib/lessons.ts` `lessonFor(attribute, segment)`) appends a
short audience coda for exactly the flips above — executives get it on
lead-type and so-what, analysts on caveat-placement and quantification — so a
reader diverging from their *own* segment is told why the conviction weighs
more for the room they write for. The other segments read the base lesson.
Craft only; no fidelity coda exists.

---

## How insights fail

The convictions read as advice; they bite harder as a diagnostic. Nine ways a
telling of a real number goes wrong, each the shadow of a conviction above. The
first eight are craft (matters of degree the study measures as taste); the
ninth is the fault line the whole project is built to expose.

**The buried lede.** The number arrives in sentence three, after throat-
clearing. The reader has already decided how much to care, on no evidence.
*(Conviction 1.)*

**The padded finding.** Every true clause survives, and there are forty of
them. Length used as a proxy for rigor; the one number that matters is now load-
bearing for a paragraph no one finishes. *(Conviction 2.)*

**The fine-print caveat.** The limitation is present — in the last line, after
the claim has already been believed. Technically disclosed, functionally hidden.
*(Conviction 3.)*

**The absent caveat.** The hedge is simply gone. Not false, but the reader now
carries a risk they were never told they were holding. *(Conviction 3.)*

**The false precision.** "31.4%" on data that supports "about a third." The
extra digits don't add information; they add a target for the argument to move
onto, and a confidence the sample can't cash. *(Conviction 4.)*

**The vibe.** "Cooled sharply." No number at all, so nothing to check and
nothing to repeat but a feeling. Travels far, verifies never. *(Conviction 4.)*

**The missing so-what.** A true, well-caveated, precisely-quantified fact that
names no move. The reader nods and does nothing; the decision defaults to whoever
speaks next. *(Conviction 5.)*

**The over-reached so-what.** An action the data can't underwrite —
"reprice everything" off one quarter. The right instinct (say the move) applied
past the evidence. *(Conviction 5, colliding with fidelity.)*

**The exceedance.** The deepest failure and the one we hide: a telling that
lands precisely *because* it asserts more than the data holds — a correlation
promoted to a cause, one quarter extrapolated into a trend, "may" upgraded to
"will." Every number still accurate; the lie is in the grammar. A domain expert
objects; a hurried reader is convinced. This is not a craft flaw the room
grades in the open — it's the blinded variable, measured as a separate
experiment and reported only when the sample is defensible. The product's
whole reason to exist is the suspicion that this failure is not rare, not
obvious, and not penalized by the market — that the tellings which win are
disproportionately the ones that commit it. *(See `ATTRIBUTES.md` fidelity;
never surface this vocabulary to a voting client.)*

---

## How this doc is load-bearing

This is not a manifesto that sits in a drawer. It is the source the rest of the
system compiles from:

- **House View** (`src/lib/house-view.ts`) — each desk stance is one of these
  convictions, dated and frozen, rendered against the live room.
- **Generation** (`scripts/generate.ts`) — the craft standards and the
  overclaim device taxonomy the model writes toward.
- **Review micro-lessons** (`src/lib/lessons.ts`) — the craft-only notes a
  reader sees when their taste diverges from their segment, now
  audience-aware (`lessonFor(attribute, segment)` adds the flip coda). Fidelity
  is deliberately absent — it must never appear in a voting client.
- **Attribute rubric** (`docs/ATTRIBUTES.md`) — the mechanical tagging rules
  these principles justify.

When a principle here and a rule there disagree, one of them is wrong. Fix the
disagreement; don't let them drift.

---

## Amendment log

- **2026-07-04** — First articulation, written alongside the House View's 13
  founding calls. Nothing overruled yet; the room has ruled on 2 of 13.
- **2026-07-04** — Added the failure taxonomy ("How insights fail"): the nine
  ways a telling goes wrong, each the shadow of a conviction, with the
  exceedance named as the blinded fault line. Convictions unchanged.
- **2026-07-04** — Operationalized the audience flip: the run-review
  micro-lesson is now `lessonFor(attribute, segment)`, appending a short coda
  for the doc-named flips (executives on lead-type + so-what, analysts on
  caveat-placement + quantification). A section that was pure assertion is now
  load-bearing in the product. Craft only; convictions unchanged.
- **2026-07-04** — Added a worked example: one faithful finding told weakly
  (63 words) vs. strongly (24 words), so the five convictions are demonstrated,
  not just asserted. Craft-only; no fidelity vocabulary in either telling.
- **2026-07-04** — Added "Which device a finding invites": the overclaim device
  is a function of the finding's data shape, and the on-target exceedance is the
  one that hides in the finding's own narrative. Motivated by the pipeline's new
  two-reading macro series (World Bank, ECB FX, y/y revenue), which are
  structurally a well of the extrapolation trap. Folded the same shape→device
  mapping into the generator's overclaim standard so stimuli stay on-target.
  Convictions unchanged; this sharpens the blinded variable, not the craft.
- **2026-07-04** — Promoted **base-rate neglect** to a first-class overclaim
  device (5th), reconciling a taxonomy drift: the teaching layer
  (`src/lib/teaching.ts`, `TEACHING.md`) already recognized it as a family, but
  the study's device list here + `ATTRIBUTES.md` + the generator named only
  four. It is a real, distinct, and common business-data exceedance (a raw count
  with the denominator dropped, so it reads as a rate) — already exemplified by
  the "more reports, fewer victims" seed. Added to all four sources of truth
  (this doc's device list + shape table, `ATTRIBUTES.md` fidelity devices, the
  generator's overclaim standard) so study and teaching now share one five-device
  vocabulary. Craft convictions unchanged.
- **2026-07-04** — Propagated conviction 4's **load-bearing-digit carve-out**
  ("reserve precise figures for when the digit *is* the point — a covenant, a
  threshold, a reconciliation") to the three surfaces that were flattening it to
  "rounded always wins": the House View quantification stance
  (`src/lib/house-view.ts`), the run-review quantification micro-lesson
  (`src/lib/lessons.ts`), and — as a distinctness gap, quantification being the
  only conviction missing from the generator's "make the changed attribute LOUD"
  list — `scripts/generate.ts`. Five independent surface audits converged on the
  same gap. Also fixed an internal contradiction in the worked example: the weak
  telling was said to contain "every failure in the taxonomy below," but the
  ninth failure (the exceedance) is a fidelity failure a *strictly faithful*
  telling structurally cannot commit — corrected to "most of the craft failures
  below," which is both accurate and tightens blinding (a faithful telling no
  longer reads as carrying the hidden variable). Craft convictions unchanged;
  the pick on every stance is unchanged — only the stated boundary is restored.
