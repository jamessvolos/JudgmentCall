# Judgment Call — Forward Plan

Design plan for the four post-M4 tracks: recursive learning, insight & user
scoring, public + BYO data, and the admin experience. Each section states the
goal, the mechanism, the schema it needs, and its guardrails. Sequencing at the
end.

---

## 1. Recursive learning — close the loop from votes back to generation

**Goal.** The system should get better at writing insights *because* people
vote, without ever silently training on unvalidated preferences. The loop is:
votes → attribute effects → generation targets → new variants → human review →
more votes.

**Mechanism.**

1. **Nightly analysis job** (`scripts/analyze.ts`, cron/GitHub Action):
   - Recompute attribute effects with **Bradley–Terry with finding fixed
     effects** on the raw comparison log (the publication-grade estimate; Elo
     stays UI sugar). Store one `AnalysisSnapshot` row per run: coefficients,
     intervals, n per contrast, per segment.
   - Emit a **coverage report**: which value-pair contrasts are below target n,
     per segment — this is the demand signal.
2. **Generation targeting.** `planFinding()` gains a `coverageHints` input fed
   from the latest snapshot: the planner prioritizes doubling the attributes
   whose value-pairs are starved, instead of blind rotation. The deck grows
   where the data is thinnest.
3. **Craft priors, explicitly quarantined.** What we *learn* (e.g.
   implication-first wins with executives) is NOT fed back into how variants
   are written — that would collapse the experiment (variants must stay
   uniformly distributed across attribute values). Learning changes *which
   contrasts we sample*, never *which values we prefer to generate*. The only
   text-level feedback allowed: rejection reasons from admin review are
   appended to the generation prompt as negative exemplars ("avoid: <pattern
   the reviewer rejected>"), versioned with the prompt.
4. **Prompt-regression gate.** Golden set = the 8 seed findings + 4 held-out.
   Any prompt/model change regenerates the golden set and diffs validator
   pass-rate + blind-verifier metrics against the stored snapshot; regressions
   block the prompt version from being used.

**Schema.** `AnalysisSnapshot(id, createdAt, method, coefficients JSON,
coverage JSON, promptVersion)`; `PromptVersion(id, template, createdAt,
regressionReport JSON)`.

**Guardrail.** Every automated change lands as a *proposal* (pending prompt
version, pending plan weights) that the admin approves — same governance gate
as variant review.

---

## 2. Insight & user scoring

**Goal.** Two reputation systems: one for insights (which telling is good),
one for voters (whose judgment to weight).

**Insight scoring.**
- Keep per-finding Elo for the live UI.
- Add a **quality score** per variant: BT strength ± interval from the nightly
  job, plus attention-weighted win rate (excludes lowAttention/repeats). Shown
  on admin; the public page keeps only per-finding boards.
- Findings themselves get an **engagement score** (decided-vote rate,
  can't-decide rate, mean latency) so stale or confusing findings can be
  retired; a high can't-decide rate marks a finding as poorly differentiated.

**User (judge) scoring — quality of judgment, not volume.**
- `Session.judgeScore` computed from: (a) **gold questions** — occasional pairs
  with a known strong consensus (>80% majority at n≥50) re-served to new
  sessions; agreement rate is the core signal; (b) **intra-session
  consistency** — the exhaustion fallback already re-serves seen pairs, so
  repeat agreement with one's own earlier vote is free signal; (c) attention
  profile (latency distribution, throttle hits).
- Used for: weighting analytics (sensitivity analysis: publish unweighted, but
  show weighted as robustness check), sybil screening, and a user-facing
  "calibrated judge" badge on the results card at high score (opt-in fun, no
  shaming — low scores are never surfaced to the user).
- **Never** trains generation and never gates voting; it only re-weights
  analysis.

**Schema.** `Variant.qualityScore/qualityLo/qualityHi`, `Finding.engagement
JSON`, `Session.judgeScore/goldAgreement/goldCount`, `Comparison.isGold`.

---

## 3. Public + BYO data

**Goal.** Anyone can bring a finding (a stat, a small table, a chart claim) and
get a Judgment Call deck for it — the "preference elicitation as governance"
mechanism applied to *their* data. Public deck grows from vetted submissions.

**BYO flow (M2 pipeline already does the heavy lifting):**
1. `/submit` — paste a stat or upload a small CSV (≤50 rows), plus source
   label. A guided form builds the `truthSummary` to the fact → driver →
   limitation template with model assistance (Claude drafts, the submitter
   confirms — the human owns the truth claim).
2. Submission lands as `Finding(status=submitted, ownerId)` → generation
   pipeline runs → variants pending → **admin review** (same gate; public deck)
   or **owner review** (private deck).
3. **Private decks:** a submitter gets a shareable link (`/d/<slug>`) to run
   their deck with their team; their votes stay scoped to the deck
   (`Comparison.deckId`) and never mix into the public study. This is the
   product wedge: "find out how *your* executives want *your* numbers told."
4. **Promotion path:** private decks with clean review can be nominated to the
   public pool; public findings need license/source checks (fictionalization
   pass for anything sensitive — the admin can ask the pipeline to anonymize
   numbers by scaling).

**Abuse/PII guardrails.** Submissions are unlisted by default; PII/profanity
screen at submit time (model pass + blocklist); rate-limited per IP hash;
nothing public without an admin decision. Truth summaries carry a provenance
field (`submitted_by`, `source_url`) shown on the card's source label.

**Schema.** `Finding.status(seed|submitted|approved|retired)`, `Finding.deckId?`,
`Deck(id, slug, ownerSessionId, visibility)`, `Comparison.deckId?`,
`Session.ownerOf[]`. Auth upgrade: magic-link email for submitters (first auth
in the product; voters stay anonymous).

---

## 4. Admin experience

**Goal.** One place to run the study: today's three key-gated pages become a
real console.

- **Unified `/admin` shell** with nav: Overview (votes/day, sessions, TTFV,
  funnel from referrer/UTM), Experiment (overclaim view + position bias +
  attention-exclusion rates), Review (variant gate, now with keyboard
  shortcuts and batch approve), Content (findings list: engagement scores,
  retire/repair actions, per-finding pair coverage heatmap), Generation (run
  the pipeline from the UI on a submitted finding; view repair-turn history
  and lints), Data (submissions queue, decks, exports: CSV of the raw
  comparison log for reproducibility).
- **Auth upgrade:** replace `?key=` with a signed session cookie set by a
  `/admin/login` page (`ADMIN_KEY` exchanged once; cookie httpOnly, SameSite
  strict). Key-in-URL leaks via browser history/referrer — fine locally,
  unacceptable deployed.
- **Audit log.** Every admin action (approve/reject/retire/prompt-version
  change) appends an `AuditEvent(actor, action, subject, at)` — the study's
  paper trail; the governance article can show it.
- **Alerts.** Daily digest (email or webhook): pending review count, position
  bias drifting off 50%, contrast coverage milestones (n≥30 crossings — i.e.
  "you can publish X now").

---

## Sequencing

| Order | Track | Why first |
|---|---|---|
| 1 | Admin auth + unified shell + audit log | Everything else lands inside it; key-in-URL must die before deploy |
| 2 | User scoring (gold questions + consistency) | Cheap, uses existing plumbing, protects data quality for all later tracks |
| 3 | Recursive learning (nightly BT job + coverage-fed planner) | Needs vote volume from launch; snapshot table unblocks insight scoring too |
| 4 | BYO/private decks, then public submissions | Biggest surface area; depends on auth, review UX, and scoring being solid |

Non-negotiables that hold across all four: the overclaim experiment stays
blind on every new surface; nothing user-facing reveals fidelity; nothing
automated ships without passing the same human gate as everything else.
