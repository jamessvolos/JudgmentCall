# Judgment Call — Roadmap 2

Follows ROADMAP.md (now implemented: admin console + audit, judge scoring,
recursive-learning loop, BYO decks). Three tracks: tuning, reporting, and
expanded public data sources.

---

## 1. Tuning — make every loop measurably better

**Matchmaking tuning.** The serving policy now has four competing goals
(session variety, global coverage, fidelity oversampling, Elo informativeness)
combined with fixed weights. Replace with a tunable scoring function whose
weights live in a `ServingPolicy` row (admin-editable, audited), and evaluate
policies by replay: simulate candidate policies against the historical log and
score them on time-to-n≥30 per contrast, card-fill rate at vote 10, and repeat
rate. Ship a policy change like a prompt change — behind the regression gate.

**Generation tuning.** (a) Blind second-pass verifier (Haiku) from the original
M2 plan: label each variant faithful/overclaimed + independently re-tag; track
overclaim detectability (too obvious / too subtle) and per-attribute tag
agreement as *prompt* health metrics. (b) A/B prompt versions: generate the
golden set under both, human-review blind, adopt the winner — recorded in the
audit log. (c) Auto-repair budget tuning from repair-turn stats (which
validator errors recur → tighten instructions, not retries).

**Statistical tuning.** Move publication analysis from live Wilson peeking to
a disciplined cadence: analysis snapshots are already stored — add (a)
group-sequential alpha-spending thresholds for the flagship overclaim claim,
(b) per-session clustering (one-vote-per-session-per-cell robustness cut, now
cheap via judgeScore weighting), (c) preregistered cuts file checked into the
repo before launch (`docs/PREREGISTRATION.md`).

**Model/effort tuning.** Generation cost is trivial; quality is not. Sweep the
generation model (spec-pinned Sonnet 4.6 vs newer) on the golden set with the
blind verifier as judge before switching — never silently.

## 2. User & admin reporting

**User reporting (retention + trust).**
- Personal trends: "your taste vs the crowd" — per attribute, your pick rate
  next to the public rate once both clear thresholds; opt-in email/link-back
  "your profile changed" cards.
- Deck owner reports: per-deck results page (win rates within the deck,
  n-gated), CSV export of the deck's raw log, "invite N more voters to reach
  n=30" progress meter — the BYO wedge becomes self-serve.
- A public changelog of published findings ("what this study has concluded so
  far"), each linking its analysis snapshot id — reproducibility as a feature.

**Admin reporting (operate the study from one screen).**
- Time series on the overview: votes/day, TTFV, funnel (landing → first vote →
  10 votes), share-loop conversion by referrer/UTM.
- Coverage heatmap: value-pair × segment grid colored by n/MIN_N (the demand
  signal made visual); click-through to the pairs being served.
- Judge-quality panel: gold agreement distribution, low-score session list,
  weighted-vs-unweighted robustness view of every published number.
- Digest: a scheduled job (cron) that emails/webhooks the overview deltas +
  n≥30 crossings ("you can publish X now") + pending-review count. Storage
  exists (snapshots, audit); this is presentation.

## 3. Expanded public data sources

**Ingestion adapters, same gate.** Each source lands as
`Finding(status=submitted, source metadata)` → generation → human review —
identical governance to BYO. One adapter interface:
`fetch() -> {title, domain, contextSnippet, sourceLabel, truthSummary-draft}`.

Priority order:
1. **FRED / BLS (econ):** monthly CPI, payrolls, claims — clean numbers, public
   domain, natural fact→driver→limitation structure. Adapter drafts the truth
   summary; the admin confirms it (the human still owns the truth claim).
2. **Company earnings (8-K/press releases via SEC EDGAR):** the flagship
   domain; adapter extracts headline revenue/margin lines. License-clean
   (filings are public), but fictionalization pass optional for consistency
   with the seed deck's house style.
3. **Sports (public box-score APIs):** high-volume, low-stakes, great for
   volume growth and the casual audience; auto-drafts need the small-sample
   limitation sentence by template.
4. **Community nominations:** a public queue where voters flag interesting
   stats (URL + one line); admin turns accepted ones into findings via the
   adapter tooling. Rate-limited, PII-screened, audited.

**Freshness mechanics.** Sourced findings get `publishedAt` + `staleAfter`;
matchmaking down-weights stale findings; retired findings keep their history
(analysis is timestamped) but stop being served. Provenance (source URL,
retrieval date) rides on the card's source label — trust surface, not
metadata.

**Sequencing:** tuning-stats (preregistration + clustering) → admin reporting
(heatmap + digest) → FRED adapter → deck owner reports → EDGAR → the rest.
Non-negotiables unchanged: blind fidelity everywhere, human gate on every
automated path, no learning signal ever biases which values get written.
