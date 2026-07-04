# Attribute tagging rubric

Operational decision rules for the six craft attributes. This is the single
source of truth for the seed data, the M2 generation prompt, and human review.
The tags are the product: when a rule here is ambiguous, fix the rule, not the tag.

The *why* behind these rules — what the desk believes makes a data insight
great, and the faithful-vs-punchy tension the study measures — lives in
`INSIGHT-PRINCIPLES.md`. When a principle there and a rule here disagree, one
of them is wrong; fix the disagreement rather than let them drift.

## leadType — judged on the first *non-caveat* clause

- `number_first` — leads with the data movement ("Revenue grew 6.2%…", "Inflation
  cooled to 2.9%…"). An opening hedge ("Caveat aside —") does not change the lead.
  A qualitative variant can still be `number_first` if it leads with the data
  movement, however quantified ("Hiring sentiment fell again in June…").
- `implication_first` — leads with what the finding means ("Cloud is now carrying
  Northwind's growth…").
- `question_first` — the first sentence is a question and must end with "?".

## lengthBand — mechanical word count

A word is any whitespace-separated token containing a letter or digit
("$2.84B" is one word; a bare em-dash is not). `short` < 20, `medium` 20–45,
`long` > 45. Use `wordCount()`/`bandFor()` from `src/lib/types.ts` — never a
different tokenizer. Generation should aim mid-band (short 12–16, medium 28–40,
long 50–70) and never land within 2 words of a boundary.

## caveatPlacement — where the epistemic hedge lives

- `upfront` — the hedge appears before or inside the first claim sentence.
- `trailing` — the hedge is the final sentence or clause.
- `omitted` — no hedge anywhere in the text.

A caveat is an *epistemic* limitation (sample size, one month of data,
correlation-not-causation, model uncertainty) — a monitoring directive ("track
whether freight costs keep climbing") is a so-what, not a caveat.

**Fidelity interaction:** a *faithful* `omitted` variant silently drops the
limitation — allowed, entailment is one-directional. An *overclaimed* variant
asserts **past** the limitation. Omission alone is never what makes a variant
overclaimed.

## quantification — uniform within a variant

- `precise` — figures as reported (6.2%, $2.84B, 0.31/90).
- `rounded` — approximations ("nearly two points", "about 31%", "roughly $1.40").
- `qualitative` — no numerals for magnitudes ("cooled meaningfully", "close to
  flat"). Sequence ordinals ("third consecutive decline") are allowed — they
  aren't magnitude quantification.

All magnitudes in one variant get the same treatment. Don't mix precise and
rounded figures in the same text.

## soWhat

- `explicit` — contains an imperative or recommendation sentence ("Watch
  volumes", "Keep the training cadence", "Reprice now").
- `implied` — the reader infers the action; predictions without recommendations
  ("his output should double") stay `implied`.

## fidelity — the hidden experiment flag

- `faithful` — every factual claim is directly supported by the finding's
  `truthSummary` or `contextSnippet`. Derived figures allowed only as pure
  arithmetic on given numbers. Omitting a limitation is allowed; exceeding one
  is not.
- `overclaimed` — deliberately exceeds the truth via exactly ONE device:
  (a) causal language on correlational data, (b) single-cause attribution,
  (c) extrapolating a trend forward, (d) certainty inflation ("guarantees",
  "is over"), (e) base-rate neglect (foreground a raw count, drop the
  denominator so it reads as a rate). Every number stays accurate; the
  overclaim lives in language and framing, not data. Keep a short *token* caveat in the same position as the paired faithful
  base variant so `caveatPlacement` stays honest. Target: a domain expert
  should object; a hurried reader should not notice.

The overclaimed variant must share all non-fidelity tags with a faithful base
variant (a clean fidelity-only contrast pair — this head-to-head is the
flagship experiment). Never reveal fidelity in any user-facing surface.

## truthSummary authoring template

Fact(s) → driver(s) → limitation(s), each in its own sentence. A structured
truth makes entailment checking and caveat generation near-mechanical.
