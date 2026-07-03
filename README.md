# Judgment Call

**Chatbot Arena for business insights.** You're shown two versions of the same data
finding — same facts, different craft — and you tap the better one. Every variant is
tagged with craft attributes (lead type, length, caveat placement, …), so aggregated
votes produce an empirical answer to *"what makes a great insight?"*

This is **v1**: the full product — core voting loop, personal taste card, public
results page, blinded overclaim experiment, judge scoring, AI variant generation
behind a human review gate, BYO decks, and an admin console. It runs locally on
SQLite in one command and deploys as a responsive **website** (mobile-first; no
native app needed). See [`JudgmentCallSpec.md`](./JudgmentCallSpec.md) for the spec.

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
9. **"Can't decide" is throttled server-side** (more than 2 undecided of the last 5
   votes forces a pick), alongside a 30 votes/minute/session cap — see Integrity rules.

## Analytics (`/results`, `/admin`)

- **`/results` (public):** per value-pair attribute win rates from decided,
  attention-passing, non-repeat, single-attribute-contrast votes, with Wilson 95%
  intervals. Suppressed below n≥30 — shown honestly as "collecting n/30". Includes the
  executive-vs-analyst disagreement view and a top-variant-per-finding board (variants
  never compete across findings, so there is deliberately no global leaderboard).
- **`/admin?key=$ADMIN_KEY` (private, 404 without the key):** the overclaim experiment
  (faithful vs. overclaimed head-to-head, segmented, same intervals and suppression)
  and a position-bias monitor (left-slot win rate — placement is randomized
  server-side, so deviation from 50% is measurable bias). Set `ADMIN_KEY` in `.env`;
  change it before any public deploy.

## Integrity rules

- 30 votes/minute/session hard cap (HTTP 429).
- "Can't decide" throttled: more than 2 undecided of the last 5 forces a pick.
- Votes under 800 ms are flagged `lowAttention` (kept in Elo, excluded from analytics).
- Repeated pairs (post-exhaustion) are flagged `isRepeat` and excluded from analytics.
- Comparisons carry a salted IP hash + user agent for post-hoc sybil forensics;
  sessions carry referrer/UTM for share-loop attribution.
- See `docs/ATTRIBUTES.md` for the tagging rubric shared by seeds, generation, and review.

## Variant generation (M2)

```bash
export ANTHROPIC_API_KEY=...          # or `ant auth login`
npx tsx scripts/generate.ts my-findings.json   # see scripts/example-findings.json
```

The deterministic planner (`src/lib/generation/planner.ts`) designs each finding's
6-profile star — rotating base profiles and contrasted attributes so no value is
"always the base" — and the model (`claude-sonnet-4-6`, pinned by spec §4) only
writes prose to the declared profiles, returning a claim-by-claim self-check
ledger. Mechanical validators (`src/lib/generation/validate.ts`, same rules and
tokenizer as the seed) check tag echo, length bands, numeric fidelity against the
truth summary, and the star properties; hard failures trigger up to two repair
turns that regenerate only the failing slots. Output lands as `status="pending"` —
**nothing is served to voters until a human approves it at `/admin/review?key=…`**,
where the text, tags, claims ledger, and lints are reviewed side by side. The
fidelity contrast is up-weighted in matchmaking (its coverage count is halved) so
the flagship overclaim experiment reaches publishable sample sizes first.

## Learning loop (review, progression, drills)

Chess.com-style feedback, adapted to a blinded preference study:

- **Run review** (`/review`): after each run of 10, every call is tagged — `WITH THE
  ROOM` / `CONTRARIAN` / `SPLIT ROOM` on contrasts already public at n≥30,
  `CALIBRATION — MATCHED/MISSED` on gold pairs (settled consensus), and one
  indistinguishable `STILL COLLECTING` state for everything else. Suppressed craft
  contrasts, multi-attribute pairs, and every fidelity pair collapse into that same
  state, so review feedback can never fingerprint the hidden experiment. Taste tags
  are never right/wrong — grading craft preference would train conformity into the
  data being measured.
- **Progression**: an auditable `XpEvent` ledger. Every decided vote earns identical
  base XP regardless of contrast type (blinding); bonuses reward coverage (first
  contrast, frontier cells from the latest analysis snapshot), cadence (run complete,
  first of the day), and drills. Levels: Stringer → Desk Assistant → Beat Reporter →
  Section Editor → Managing Editor → Editor-in-Chief. XP is cosmetic — analytics
  never reads it, and there is deliberately no reward for agreeing with the crowd.
- **Skill**: `Session.judgeAbility` is a Rasch-style rating updated per gold vote
  against the pair's consensus-margin difficulty (matching a 65/35 lean earns more
  than a 95/5 landslide). `/drill` is the "spot the overclaim" training room —
  purpose-built items (never served in the voting pool), immediate feedback with a
  claims-ledger explanation naming the overclaim device, and a separate Elo rating
  for judge and item. The only bridge back to the study is the `postDrill` stamp on
  later comparisons, which gives the fidelity analysis a naive-vs-trained cut
  (`/admin`) — "does training judges reduce the overclaim win rate?" is itself a
  publishable finding.

## Releasing v1

Judgment Call ships as a **website**, not a native app: the audience arrives from a
Medium article mid-read, and the 15-second time-to-first-vote budget doesn't survive
an App Store detour. The UI is mobile-first (390px is the design target), works as an
embed, and can be wrapped as a PWA or native shell later without touching the core.

### Deploy (Vercel + Postgres)

1. **Swap the database.** In `prisma/schema.prisma`, change the datasource to
   `provider = "postgresql"` and point `DATABASE_URL` at your Postgres instance
   (Vercel Postgres/Neon/Supabase all work). Then:

   ```bash
   rm -rf prisma/migrations          # SQLite migration history doesn't transfer
   npx prisma migrate dev --name init  # regenerates against Postgres + seeds
   ```

   All DB access already goes through `src/lib/repo.ts` and enums are plain
   strings, so no application code changes.

2. **Import the repo into Vercel.** The build needs no config beyond env vars —
   `postinstall` runs `prisma generate`.

3. **Set production env vars:**

   | Var | Required | Notes |
   |---|---|---|
   | `DATABASE_URL` | yes | Postgres connection string |
   | `ADMIN_KEY` | yes | Long random string. The dev default `local-admin` is **rejected in production** — the admin surface stays locked until you set a real key. |
   | `IP_HASH_SALT` | yes | Long random string. Without it, production stores **no** IP digests (a known salt would be dictionary-attackable) and sybil forensics lose a signal. |
   | `NEXT_PUBLIC_SITE_URL` | recommended | Absolute origin (e.g. `https://judgmentcall.example`) for OG/social metadata. |
   | `ANTHROPIC_API_KEY` | for generation | Only needed when running `scripts/generate.ts`; the serving app never calls the API. |
   | `DIGEST_WEBHOOK_URL` | optional | `scripts/digest.ts` posts the daily digest here. |
   | `FRED_API_KEY` | optional | For `scripts/ingest.ts` FRED adapter. |

4. **Release checklist:**
   - [ ] Fresh production DB seeded once (`npx prisma db seed`) — never reuse a dev DB with test votes.
   - [ ] `/admin` 404s without the key; `/admin/login` works with the new `ADMIN_KEY`.
   - [ ] Cast one vote end-to-end in production; confirm it lands in `Comparison` with an `ipHash`.
   - [ ] `docs/PREREGISTRATION.md` is committed *before* votes are collected (the alpha-spending plan depends on it).
   - [ ] `/results` renders in an iframe/embed context (no fixed backgrounds — it inherits the page).
   - [ ] Point a cron (or GitHub Action) at `scripts/analyze.ts` and `scripts/digest.ts` daily.

### Operations

Recurring jobs are plain scripts (run from repo root): `npm run analyze` writes an
`AnalysisSnapshot` (the Study Log on `/results`), `npm run digest` posts the daily
ops digest, `npm run replay` sanity-checks serving-policy changes against logged
votes before you save them in `/admin`.
