# Simulated user testing — round 1 (three personas, live app)

Method: three persona agents drove the running app with Playwright (mobile
390px exec, desktop keyboard analyst who cast 61 votes, skeptical methods
reviewer who also audited code + bundle). Ranked findings below; ✅ = fixed in
the "next ten" round, → = routed to docs/ROADMAP.md.

## Mobile executive
1. ✅ 10-vote payoff nearly empty ("1 of 1" card) — fidelity up-weighting ate the first votes
2. ✅ Snippet clamped mid-sentence with invisible expand affordance
3. → /results is an "empty room" pre-launch (fills with volume; suppression stays honest)
4. ✅ Returning users get a cold start (now: Welcome back — continue)
5. ✅ Share is a blind clipboard write ("Shared!" lie) + weak 1-of-1 brag (hedged title)
Delights: 2 taps to first vote (~400ms), "1 more →" nudge, poster design.

## Desktop analyst (61 votes)
1. → Content pool too small for heavy voters (8 findings; scales via M2 pipeline)
2. ✅ Keypresses silently dropped during transition (now: explicit feedback; votes are
   never queued onto unseen pairs by design — that would poison latency/attention data)
3. ✅ /results had no "you" (now: Your contribution strip); per-user exclusion opacity is
   deliberate (see blinding)
4. → Navigation loops through persona picker (partially fixed via welcome-back)
5. ✅ Small-sample "profile theater" (hedged "(early read)" persona titles)
Delights: keyboard-first flow, statistical hygiene, frictionless persistence.

## Skeptical methods reviewer
1. ✅ Public "Top telling" showcased the overclaimed plant (now faithful-only)
2. ✅ Headline count let readers infer the hidden arm by subtraction (headline now equals
   the table sum; sessions = voting sessions)
3. ✅ Client bundle leaked fidelity vocabulary + thresholds (client-constants split; prod
   chunks verified clean)
4. ✅ No methodology surface (now: Methods section — inclusion rules, segment composition,
   public position check, threshold rationale, deception disclosure)
5. → Independence/identity assumptions (per-voter clustering, gold questions, weighting:
   ROADMAP "user scoring"; sequential-testing discipline: publication checklist)
Earned trust: honest suppression, Wilson intervals, server-side contrasts, blind API.
