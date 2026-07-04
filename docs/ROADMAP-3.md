# Judgment Call — Roadmap 3

ROADMAP.md and ROADMAP-2.md are substantially built (learning loop, judge
scoring, BYO decks, admin console, real-data ingestion, snapshots).
PERF-WAVES.md owns the architecture/performance track. This roadmap covers
the horizon opened by the 2026-07 work: the product became *opinionated*
(the House View), the data became *real* (SEC/FRED), and the design became
*alive*. Three tracks follow from that: **Editorial**, **Growth**, and
**Research rigor**. Each names the goal, the mechanism, the schema/guardrail.

---

## Track A — Editorial: earn the opinion

The House View turned a neutral instrument into a publication with a stance.
That only pays off if the stance is *accountable* and *evolving*.

### A1. The desk's scorecard, over time
**Goal.** Show the desk being right and wrong in public — that is the trust
engine. **Mechanism.** Each `HouseStance` already carries a `registered`
date; snapshot the room's verdict on every stance into a new
`StanceOutcome` row per analysis run (concurs/overrules/open + n at the
time). Render a small "the desk's record" sparkline on `/results#house-view`:
"11 of 13 calls the room has ruled on, the desk got 8." A desk that is wrong
in public and says so is more credible than one that is never tested.
**Guardrail.** Craft only; never a fidelity stance.

### A2. Contested calls become content
**Goal.** Turn every `ROOM OVERRULES` into a publishable micro-post. When the
room overrules the desk with a clean interval, that is a finding: "We said
lead with the number. 1,200 readers disagree, and here's the interval."
**Mechanism.** A digest step (ops.yml) flags newly-overruled stances; each
becomes a templated draft in `docs/desk-notes/`. Distribution feeds Track B.

### A3. Segment-aware stances
**Goal.** The desk currently speaks once; executives and analysts genuinely
differ (the disagreement caliper proves it). **Mechanism.** Allow a stance to
carry an optional per-segment override ("for executives, we'd actually flip
this"). Rendered only where both segments clear n≥MIN_N. This makes the
"Executives vs analysts" section argue with itself — the most interesting
thing on the page.

### A4. Reader-submitted stances
**Goal.** Let power users register their OWN calls and track them against the
room, like the desk does. **Mechanism.** After a user hits a high judge
rating, unlock "put a call on the record"; store as a personal stance,
graded on their `/review`. A retention hook that is also more preference
data.

---

## Track B — Growth: the study distributes itself

The product has three latent distribution surfaces (the taste poster, the
public results, the House View) that are underused.

### B1. The poster is the ad
**Goal.** Every 10-vote poster should be one tap from a shareable, branded
image. The OG PNG twin already exists at `/p/[slug]`. **Mechanism.** Add a
"share your taste" native-share sheet at the poster moment (not just "get my
public link"), pre-filled with a one-line hook ("I value caveats up front and
short over complete — what do you value?"). Instrument the funnel (already
logged) and optimize the hook copy by A/B.

### B2. Embeddable House View widget
**Goal.** A Medium/Substack author drops one line and gets a live, updating
"what makes an insight land" caliper. `?embed=1` on `/results` is chrome-less
already. **Mechanism.** Ship a documented `<iframe>` snippet + a lightweight
oEmbed endpoint; each embed carries `utm_source` so referral traffic is
attributable. The article (docs/ARTICLE.md) is the first customer.

### B3. Weekly "the room ruled" email/RSS
**Goal.** A reason to come back without an app install. **Mechanism.** The
daily digest already computes deltas; batch to a weekly public RSS/email:
new contrasts that cleared n, stances the room overruled, the sharpest
segment disagreement. Opt-in only, no PII beyond an email row.

### B4. Seeded head-to-heads for social
**Goal.** Native social cards that ARE a vote. **Mechanism.** A
`/vs/[contrast]` page rendering one representative pair with an OG image
that poses the question; the click-through lands mid-swipe. Careful: never
expose which pairs are experimental.

---

## Track C — Research rigor: make it citable

The disclosure language promises "Bradley–Terry with finding fixed effects,
preregistered cuts." Deliver that fully so the flagship overclaim result is
defensible.

### C1. Publication-grade estimator
Move the public tables' point estimates from per-pair Wilson to the stored
Bradley–Terry snapshot (Wilson stays for the live "collecting" affordance).
Report coefficients with clustered-by-session standard errors. The overclaim
experiment gets group-sequential alpha spending (already specced in
ROADMAP-2 §1) so the peeking is honest.

### C2. Preregistration lock
`docs/PREREGISTRATION.md` exists; add a CI check that fails if a committed
analysis script's cut list diverges from the preregistered one without a
dated amendment. The study cannot quietly move its own goalposts.

### C3. Naive-vs-trained as a headline
The `postDrill` stamp already splits fidelity votes by whether the voter had
trained. Once n is defensible, "training judges reduces the overclaim win
rate by X pp" is itself the paper. Track power; auto-surface when the
interval separates.

### C4. Data-quality telemetry
Ship the blind second-pass verifier (ROADMAP-2 §1) as a standing metric:
per-generation-batch overclaim detectability and tag agreement, charted in
admin. Catch prompt drift before it reaches voters.

---

## Sequencing

1. **A1 + B1** first — cheapest, and they compound (a tested desk + a
   shareable poster is the whole trust-and-distribution loop).
2. **PERF Wave 2–3** in parallel (independent track) once vote volume
   justifies it.
3. **C1** before any public write-up — the numbers must be publication-grade
   before they're cited.
4. **A2/B2/B3** as the audience grows; **A3/A4/B4/C2–C4** are the mature-
   product horizon.

Everything here inherits the non-negotiables: blinding (docs/DESIGN.md), the
ledger as source of truth (PERF-WAVES.md), and craft-only editorial voice.
