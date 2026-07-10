# Insight synthesis — log

The synthesis loop's job is to turn the study's collective votes into durable
understanding: patterns strong enough to sharpen `INSIGHT-PRINCIPLES.md` or to
publish as "what the study is teaching us." This log records each round — what
was synthesized, on what evidence, and (just as importantly) the rounds where
the honest answer was *not yet*. The loop is scholarship, not content
generation: a synthesis produced here must itself survive the standards the
constitution sets for any insight — entailed by the data, caveated, and never
punchier than the evidence.

## The evidence bar (what a pattern must clear before it becomes synthesis)

1. **Published-grade data only.** A pattern must come from counted votes (the
   `getAnalyticsComparisons` contract) in the **production** ledger or its
   analysis snapshots — never from local/synthetic data, never from the blinded
   fidelity dimension, never from drill behavior.
2. **Resolved, not collecting.** Every contrast cited must clear `MIN_N` with a
   Wilson interval clearing 50 — a straddling interval is a non-finding and is
   reported as such.
3. **Durable, not a snapshot artifact.** The direction must hold across at
   least two analysis snapshots separated by meaningful new volume (so a burst
   of early votes can't mint a "principle").
4. **Cross-segment read stated honestly.** If executives and analysts split on
   a contrast, the split *is* the finding; a headline that averages over a real
   split is the buried-lede failure the constitution warns about.
5. **Overrule evidence is the gold standard.** The room overruling a
   preregistered House View stance with a clean interval is the single
   strongest synthesis trigger — it is the falsifiability mechanism firing, and
   it obligates a dated amendment to the constitution (never a quiet edit).

## Round log

- **2026-07-09 — Round 1: bar established; no synthesis (correctly).**
  Assessment: this environment can read only the local ledger, whose votes are
  synthetic (driver-generated; 410 of them were auto-flagged `lowAttention` by
  the intake floor — see `STUDY-INTEGRITY.md`). The production ledger and its
  daily analysis snapshots are not readable from here, and the live study is
  young enough that most contrasts are still collecting. Any "pattern" cited
  this round would be a pattern in test scripts — precisely the
  useful-but-false failure the constitution exists to name. Decision: converge
  with the evidence bar above as the round's artifact. What would open Round 2
  with real work: access to production analysis snapshots (or an ops export of
  counted votes) showing ≥2–3 contrasts that clear the bar — at that point the
  first candidates to examine are (a) any House View overrule (bar item 5),
  (b) the executive/analyst disagreement view, and (c) whether the room's
  decisiveness ranking on /results is stable across snapshots.
