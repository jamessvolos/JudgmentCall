# Preregistration — Judgment Call public study

Checked in BEFORE launch; changes to this file after launch are themselves
audit events. The live /results page shows descriptive statistics only;
published claims follow the rules below.

## Primary hypothesis (flagship)
H1: In faithful-vs-overclaimed head-to-heads, the overclaimed telling wins
more than 50% of decided votes among executive-segment sessions.
- Test: two-sided binomial vs 0.5 on decided, attention-passing, non-repeat,
  fidelity-only-contrast votes; report Wilson 95% CI.
- Sequential discipline: O'Brien-Fleming-style alpha spending with looks at
  n = 50, 100, 200 per segment (overall alpha 0.05). No claims below n=30.

## Secondary (exploratory, labeled as such)
Per value-pair craft-attribute win rates overall and by segment; the
exec-vs-analyst disagreement ranking. All corrected with Benjamini-Hochberg
across the reported family; robustness checks required before publication:
(a) one-vote-per-session-per-cell clustered recompute must agree in direction,
(b) judge-score-weighted recompute must agree in direction.

## Exclusions (fixed)
Undecided votes; latency < 800ms (attention floor); repeated pairs; deck
(BYO) votes; sessions flagged by rate limiting.

## Known limitations (declared up front)
Self-reported segments; anonymous sessions (IP-hash forensics only);
fictional stimulus data; convenience sample recruited via articles/shares.
