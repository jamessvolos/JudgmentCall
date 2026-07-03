# Judgment Call

**Chatbot Arena for business insights.** You're shown two versions of the same data
finding — same facts, different craft — and you tap the better one. Every variant is
tagged with craft attributes (lead type, length, caveat placement, …), so aggregated
votes produce an empirical answer to *"what makes a great insight?"*

This repo is **Milestone 1**: the full playable core loop, running locally on SQLite.
See [`JudgmentCallSpec.md`](./JudgmentCallSpec.md) for the product spec and later milestones.

## Quick start

```bash
npm install
npx prisma migrate dev   # creates prisma/dev.db and runs the seed automatically
npm run dev              # http://localhost:3000
```

(If you ever need to re-seed by hand: `npx prisma db seed`. Re-seeding wipes all votes.)

The loop: pick a role segment → swipe through pairs → after 10 votes you get a
personal results card ("You picked implication-first 4 of 5 times") with a
keep-going CTA.

## How it works

### Data model (`prisma/schema.prisma`)

| Model | Purpose |
|---|---|
| `Finding` | An underlying fact: context snippet (the data), source label, and a `truthSummary` — the ground-truth claim every faithful variant must respect. |
| `Variant` | One telling of a finding. Tagged on six craft attributes (below) plus live `elo`/`wins`/`losses`. |
| `Comparison` | One vote: the pair, the winner (`null` = "can't decide"), session, segment, latency, and the `contrastAttrs` the pair differed on. Raw log kept forever so Bradley–Terry / per-attribute regression can be recomputed later. |
| `Session` | Anonymous identity: a client-generated UUID in localStorage plus the chosen segment. No auth. |

Craft attributes on every variant:

- `leadType` — `number_first` | `implication_first` | `question_first`
- `lengthBand` — `short` (<20 words) | `medium` (20–45) | `long` (>45)
- `caveatPlacement` — `upfront` | `trailing` | `omitted`
- `quantification` — `precise` | `rounded` | `qualitative`
- `soWhat` — `explicit` | `implied`
- `fidelity` — `faithful` | `overclaimed` — the hidden experiment flag. Exactly 1 of
  each finding's 6 variants subtly exceeds its `truthSummary` (causal language on
  correlational data, dropped uncertainty, extrapolated trend). It is never revealed
  in the UI or the personal results card.

Enum-ish fields are strings validated in `src/lib/types.ts` (SQLite has no enums, and
it keeps the Postgres swap schema-identical). All DB access goes through
`src/lib/repo.ts`, so the M4 SQLite → Postgres swap is a datasource config change.

### Seed data (`prisma/seed.ts`)

8 findings × 6 variants, hand-written, realistic but fictional: 3 earnings, 2 economic
indicators, 2 sports, 1 security ops. Each finding's variant set uses a **star
design**: a base variant plus deviations that each change exactly one attribute from
the base (rotating which attributes get contrasted across findings). That yields 5–6
clean single-attribute pairs per finding — the pairs that let a vote attribute
preference to a single craft choice.

The seed **validates its own tags** (length bands by word count, exactly one
overclaim per finding, minimum single-contrast pair count) and refuses to run if any
are wrong — the tags are the product.

### Matchmaking (`src/lib/matchmaking.ts`)

Per request, server-side:

1. Pick a finding at random, weighted toward the fewest logged comparisons
   (weight `1/(1+count)`).
2. Within it, prefer pairs differing on **exactly one** attribute; tolerate two;
   anything only as a last resort.
3. Among those, pick the contrast with the fewest total comparisons (coverage
   balancing), tie-break by closest Elo, then random.
4. Never repeat a pair for the same session. If a session exhausts every unseen pair
   in the pool, repeats are allowed rather than dead-ending the loop.
5. Left/right order is randomized server-side.

The pair endpoint returns only variant `id` + `text` — attribute tags (especially
`fidelity`) never reach the client, so they can't bias votes or unblind the
overclaim experiment.

### Elo (`src/lib/elo.ts`)

Standard Elo, K = 32, everyone starts at 1200:

```
expected(A) = 1 / (1 + 10^((R_B − R_A)/400))
R_A' = R_A + K · (1 − expected(A))     // A won
R_B' = R_B − K · (1 − expected(A))
```

Zero-sum by construction. "Can't decide" is logged but causes no rating change.
Votes faster than 800 ms are stored with `lowAttention = true` — they **do** count
toward Elo (per spec) but can be excluded in later analytics.

### Personal results (`src/lib/results.ts`)

Computed only from votes where the pair differed on exactly one attribute (clean
attribution). For each attribute, your most-picked value with its record; anything
under 3 observations is hedged as an "early signal." Fidelity contrasts are
deliberately excluded from the card so the overclaim experiment stays blind.

## API

| Route | Method | Purpose |
|---|---|---|
| `/api/session` | POST | Create/retag anonymous session `{ sessionId, segment }` |
| `/api/pair` | GET | Next matched pair for `?sessionId=` |
| `/api/vote` | POST | Record vote, update Elo `{ sessionId, variantAId, variantBId, winnerId\|null, latencyMs }` |
| `/api/results` | GET | Personal preference profile for `?sessionId=` |

## Judgment calls that deviate from (or fill gaps in) the spec

1. **Fidelity is excluded from the personal results card.** Showing "you prefer
   punchy-but-overclaimed" would unblind the hidden experiment (spec §4 says it's
   never surfaced in normal analytics). Those votes are still logged for the
   experiment view in M3.
2. **Attribute tags never leave the server.** The pair API returns only variant text —
   not strictly required by the spec, but tags in the payload could bias voters and
   would expose the overclaim flag in DevTools.
3. **`contrastAttrs` is denormalized onto `Comparison`.** Makes coverage balancing and
   the results card a cheap `groupBy` instead of re-diffing every comparison per
   request; the raw variant tags remain the source of truth.
4. **Results card timing:** the interstitial appears at exactly 10 votes; after that a
   persistent "Your results" link in the header reopens it anytime. "Copy my results"
   copies a text summary as a lightweight stand-in for M4's share cards.
5. **Overclaimed variants keep otherwise-identical tags to their base variant**, so
   each finding contains one clean faithful-vs-overclaimed pair — that head-to-head
   is the flagship experiment.
6. **Pair-exhaustion fallback:** the never-repeat-a-pair rule relaxes only if a session
   has seen all ~120 pairs, rather than erroring.
7. **`.env` is committed** (it holds only the local SQLite path — no secrets) so
   `migrate dev` works from a fresh clone with zero setup. Real secrets belong in
   `.env.local`, which stays ignored.
8. **System font stack instead of Google Fonts** so a fresh clone builds with no
   network dependency.
9. **"Can't decide" is not yet rate-limited** (spec §2 mentions discouraging overuse) —
   it's logged and Elo-neutral; throttling is deferred to the Sybil/troll pass (spec §9).

## Milestone 1 scope

No auth, no API-based variant generation, no admin screens, no public analytics page,
no deployment. The repo module (`src/lib/repo.ts`) and string-based enums keep the
Postgres swap and the M2 admin review flow from requiring a refactor.
