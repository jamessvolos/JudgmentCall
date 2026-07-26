# VOICE — the writing contract

Judgment Call's copy was machine-written, and it showed in countable ways: a
spaced em-dash every fifty words, the "X, not the Y" contrast in every third
explanation, a closing epigram on every reveal, and thirty-odd features named
"THE [NOUN]". This contract is the fix. It is enforced by
`scripts/copy-lint.mjs` (report mode; `--check` fails CI when a group regresses
past `copy-lint.baseline.json`), so the site cannot quietly re-acquire the
habits the next time a feature ships.

## Ban list (all rooms, all surfaces)

1. **Em-dash budget.** At most ~4 spaced em-dashes per 1,000 words in content,
   ~5 in the drill pools. Prefer a period. A colon is fine. Parentheses exist.
2. **The contrast tic.** "X — not the Y", "X, not the Y", "isn't just X" — use
   at most once per file, and only when the contrast is the actual lesson.
3. **The closing epigram.** Explanations may not habitually end on a short,
   number-free aphorism. Target: under ~10% of explanations per room. End on
   the number, on a caveat, on a next step, or just end.
4. **THE-NOUN names.** Room mastheads keep theirs (THE STATS ROOM etc.), THE
   DESCENT and THE LADDER earned theirs. Everything else is a plain noun:
   "Workload", "Scenario", "The two lines" → "Two lines". UI cap enforced.
5. **One metaphor per room.** The room's own instrument (the caliper, the dial,
   the gate) may speak; imported metaphors may not pile on top.

## Registers — six rooms, six writers

Utility copy (buttons, errors, empty states, footers) is plain everywhere:
"Next", "Try again", "Nothing here yet." Voice lives only in scenarios and
reveals, and differs by room:

- **Statistics** — dry lab notes. Short declaratives. Numbers carry the
  sentences; adjectives are rationed. Wit, if any, is deadpan.
- **Economics** — wry, a little worldly. Allowed one raised eyebrow per
  reveal. Never smug.
- **Architecture** — terse engineer. Constraints and consequences. Sentence
  fragments acceptable. No poetry.
- **Decision (Solver)** — clipped, poker-table cadence. Second person.
  Verdicts land fast; explanations don't linger.
- **ML (Tuning)** — practitioner shoptalk. Concrete units, tool-bench tone,
  the occasional sigh of experience ("this is how eval budgets die").
- **Data Storytelling (drill)** — newsroom style desk. Confident, editorial,
  slightly formal; HOLDS/EXCEEDS stamps keep their lead tokens.

## What a rewrite may touch

Prose fields only: `scenario`, `prompt`, `explanation`, choice/claim
`rationale`s, UI strings. Never: numbers, `choices[].text` answer options,
correctness flags, payload fields, titles (they are natural keys), or any
value a validator re-derives. `node scripts/gen-quiz.mjs` and the content
tests re-check every invariant after a copy edit; run them.

## The measured before (2026-07-23, pre-rewrite)

| group | words | em-dash/1k | not-the/1k | epigram % | THE-caps |
|---|---:|---:|---:|---:|---:|
| statistics | 7,320 | 8.5 | 3.8 | 15 | |
| economics | 2,699 | 6.3 | 2.6 | 23 | |
| architecture | 6,286 | 7.0 | 0.8 | 6 | |
| decision | 4,411 | 16.3 | 3.6 | 15 | |
| ml | 4,409 | 15.4 | 3.6 | 15 | |
| drills | 16,713 | 19.3 | 1.3 | 12 | |
| ui | 5,304 | 16.0 | 2.3 | 0 | 40 |

## The measured after (2026-07-26, post-rewrite)

| group | words | em-dash/1k | not-the/1k | epigram % | THE-caps |
|---|---:|---:|---:|---:|---:|
| statistics | 7,240 | 0 | 0.7 | 2 | |
| economics | 2,828 | 0 | 0.4 | 0 | |
| architecture | 6,221 | 0 | 0 | 2 | |
| decision | 4,279 | 0.2 | 0.2 | 0 | |
| ml | 4,469 | 0.2 | 0 | 4 | |
| drills | 16,530 | 2.7 | 0.2 | 0 | |
| ui | 5,206 | 0.6 | 0.6 | 0 | 40 |

Every surviving hit is deliberate: the drills residue sits entirely in
frozen fields the crude extractor also counts (answer options, bolded data
lines, titles — editable drill prose is at zero), the ui residue is the
frozen LadderStrip plus two contrasts that are the lesson itself, and
THE-caps stayed by design (room names are set decoration, not prose). A
slop-reader pass then broke the structural repeats the counters cannot see:
identical explanation scaffolds across sibling flood, gap, and duel items.

The canonical after-numbers live in `scripts/copy-lint.baseline.json`,
recorded via `node scripts/copy-lint.mjs --baseline`; `npm test` runs
`copy-lint --check`, so a >15% regression on any metric fails the build.
