# Judgment Call — Spec v0.1

*Positioning shorthand: "Chatbot Arena for business insights." Pairwise preference collection on AI-generated data narratives, producing an empirical answer to "what makes a great insight?"*

---

## 1. Product Summary

A low-friction web app where users are shown **two versions of the same data insight** and tap the better one. Every variant is tagged with craft attributes (lead type, length, caveat placement, etc.), so aggregated votes produce attribute-level win rates — an evidence base for what makes data narratives land, segmented by audience (executive vs. analyst).

**Primary goals**
1. Generate publishable findings for the Medium series (e.g., "implication-first framing beats number-first 68% of the time with executives").
2. Demonstrate the preference-elicitation-as-governance thesis: before automating narrative generation, humans must define the standard. This app is that mechanism.
3. Portfolio artifact: shareable, embeddable, memorable.

**Non-goals (v1):** accounts/auth, monetization, user-submitted findings, model fine-tuning.

---

## 2. Core Loop

1. User lands → picks a role segment: **Executive / Analyst / Data Leader / Other** (one tap, stored in session).
2. Swipe screen shows:
   - A compact context header: the underlying finding as a small data snippet (1–3 rows or a single stat with source label).
   - Two insight cards (A/B), same finding, different craft.
3. User taps the better card (or "Can't decide" — logged, rate-limited to discourage overuse).
4. Instant next pair. Progress counter visible.
5. After 10 votes: **personal results card** — "You prefer implication-first, short, caveats-up-front" — with a share link. This is the viral hook and the re-engagement device.

Target time-to-first-vote: **under 15 seconds** from page load. No signup, no tutorial beyond one line of instruction.

---

## 3. Data Model

```
Finding
  id, title, domain (earnings|econ|sports|ops), context_snippet (markdown),
  source_label, truth_summary (the ground-truth claim variants must respect)

Variant
  id, finding_id, text,
  lead_type        (number_first | implication_first | question_first)
  length_band      (short <20w | medium 20–45w | long >45w)
  caveat_placement (upfront | trailing | omitted)
  quantification   (precise | rounded | qualitative)
  so_what          (explicit | implied)
  fidelity         (faithful | overclaimed)   ← hidden experiment flag
  elo (default 1200), wins, losses

Comparison
  id, finding_id, variant_a_id, variant_b_id, winner_id (nullable for "can't decide"),
  session_id, segment, latency_ms, created_at

Session
  id (anonymous cookie/localStorage), segment, created_at, vote_count
```

Log every raw comparison. Elo gives live scores; raw logs allow Bradley–Terry recomputation and per-attribute regression later.

---

## 4. Variant Generation

**Attribute grid.** Full factorial is 3×3×3×3×2×2 = 324 combos — far too many. Per finding, generate **6 variants** selected so that the set maximizes pairwise single-attribute contrasts (a D-optimal-ish fractional design; a greedy heuristic is fine).

**Fidelity constraint.** Every variant must be checkable against `truth_summary`. Generation prompt requires the variant to entail the truth summary and nothing beyond it — except:

**Overclaim experiment.** ~1 in 6 variants is deliberately `overclaimed` (causal language on correlational data, dropped uncertainty, extrapolated trend). Never surfaced in normal analytics; reported only in the dedicated experiment view: *does punchy-but-wrong beat accurate-but-hedged?* This finding is the flagship article.

**Pipeline (Milestone 2).** Anthropic Messages API (`claude-sonnet-4-6`), one call per finding, JSON output: 6 variants + attribute tags + a self-check field confirming entailment of the truth summary. Human review pass in an admin screen before variants go live (on-brand: an explicit judgment gate). API docs: https://docs.claude.com/en/api/overview

**Seed content (Milestone 1).** No API needed — Claude Code hand-writes seed data at build time: 8 findings × 6 variants, tagged. Domains: 3 earnings-style, 2 economic indicators, 2 sports, 1 ops/security-flavored.

---

## 5. Pair Selection (Matchmaking)

Within a random under-sampled finding, choose the pair that:
1. Differs on **exactly one attribute** where possible (clean attribution), tolerating two.
2. Prioritizes the attribute contrast with the fewest total comparisons (coverage balancing).
3. Tie-break: closest Elo (maximally informative match).
4. Never shows the same pair to the same session twice.

---

## 6. Scoring & Analytics

- **Elo:** K=32, both start 1200, update per comparison. Simple and live.
- **Attribute win rates:** for comparisons where variants differ on exactly one attribute, credit the attribute value of the winner. Report with Wilson 95% intervals; suppress until n ≥ 30 per contrast.
- **Segment splits:** every metric cut by Executive vs. Analyst. The disagreement view ("what leaders want vs. what analysts write") is a headline chart.
- **Overclaim view:** faithful-vs-overclaimed head-to-head record, segmented. Hidden behind an admin flag until sample size is defensible.
- **Public results page:** live leaderboard of top variants + attribute win-rate chart. This page is what gets embedded in Medium.

---

## 7. Stack

| Layer | Choice | Rationale |
|---|---|---|
| App | Next.js (App Router) + Tailwind | One repo, API routes included, Vercel deploy |
| DB (M1) | SQLite via Prisma | Zero external accounts; Claude Code can run everything locally end-to-end |
| DB (M4) | Swap to Postgres (Supabase or Vercel Postgres) via Prisma | Needed once public; schema unchanged |
| Identity | Anonymous session ID in localStorage | No auth friction |
| Charts | Recharts | Results page |
| Deploy | Vercel | Free tier fine for launch |

Keep the data layer behind a thin repository interface so the M1→M4 DB swap is a config change, not a refactor.

---

## 8. Milestones

- **M1 — Playable core (build first):** schema, seed data, swipe UI, Elo, matchmaking, personal results card after 10 votes. Local, SQLite.
- **M2 — Generation pipeline:** Claude API variant generation + admin review screen + fidelity self-check.
- **M3 — Analytics:** public results page, attribute win rates with intervals, segment split view, admin-only overclaim view.
- **M4 — Ship:** Postgres swap, Vercel deploy, OG/share cards for personal results, embed-friendly results page.

---

## 9. Open Decisions

- ~~Name~~ **Decided: Judgment Call.** Before publishing: check judgmentcall .com/.app availability, GitHub org, and run a quick trademark search.
- "Can't decide" handling in Elo (v1: no rating change, log only).
- Whether the personal results card requires a minimum spread before making claims (recommend: yes, hedge below n=10 per attribute).
- Sybil/troll resistance pre-launch (v1: rate limit per session, drop sub-800ms votes as low-attention).

---

## 10. Claude Code Kickoff Prompt (paste as-is)

```
You are building Milestone 1 of "Judgment Call," a pairwise preference app for AI-generated data insights. Users see two versions of the same business insight and tap the better one. Votes update Elo ratings and are logged with attribute metadata so we can later compute which craft attributes (lead type, length, caveat placement, etc.) win.

STACK
- Next.js (App Router, TypeScript) + Tailwind CSS
- Prisma + SQLite (local file DB). Put all DB access behind a repository module (src/lib/repo.ts) so we can swap to Postgres later without touching UI or API routes.
- No auth. Anonymous session: generate a UUID, store in localStorage, send with every vote.

DATA MODEL (Prisma)
- Finding: id, title, domain, contextSnippet (markdown), sourceLabel, truthSummary
- Variant: id, findingId, text, leadType (number_first|implication_first|question_first), lengthBand (short|medium|long), caveatPlacement (upfront|trailing|omitted), quantification (precise|rounded|qualitative), soWhat (explicit|implied), fidelity (faithful|overclaimed), elo (default 1200), wins, losses
- Comparison: id, findingId, variantAId, variantBId, winnerId (nullable), sessionId, segment, latencyMs, createdAt
- Session: id, segment (executive|analyst|data_leader|other), voteCount, createdAt

SEED DATA
Write a seed script with 8 findings x 6 variants each, using realistic but fictional data (3 earnings-style, 2 economic-indicator, 2 sports, 1 security-operations). All 6 variants of a finding must describe the SAME underlying fact (the truthSummary) but vary the craft attributes. Choose the 6 variants per finding so the set maximizes pairs differing on exactly one attribute. Exactly 1 of the 6 per finding gets fidelity=overclaimed: it should read punchier but subtly exceed the truthSummary (causal language on correlational data, dropped caveat, extrapolated trend). All others must be strictly faithful. Tag every variant's attributes accurately — the tags are the product.

CORE FLOW
1. Landing page: one-line explanation + four segment buttons (Executive / Analyst / Data Leader / Other). Selection creates the session and routes to /swipe.
2. /swipe: shows the finding's contextSnippet in a compact header, then two variant cards side by side (stacked on mobile). Tapping a card records the vote and immediately loads the next pair. Include a small "Can't decide" link (logs winnerId=null, no Elo change). Show a progress counter.
3. Matchmaking (server-side): pick a random finding weighted toward fewest comparisons; within it, prefer a variant pair differing on exactly ONE attribute, prioritizing the attribute contrast with the fewest total comparisons so coverage stays balanced; tie-break by closest Elo; never repeat a pair for the same session.
4. Elo update on vote: K=32. Also increment wins/losses and log the Comparison row with latencyMs (time from pair render to tap, sent from client).
5. After 10 votes, show a personal results card: their top preferences by attribute (e.g., "You picked implication-first 7 of 9 times"), computed only from single-attribute-contrast votes, with a "keep going" CTA. Hedge any attribute with fewer than 3 observations.

QUALITY BARS
- Time from page load to first possible vote under 15 seconds; no tutorial screens.
- Mobile-first layout; cards must be comfortably tappable.
- Votes with latencyMs < 800 are stored but flagged lowAttention=true (add the field) and excluded from Elo? No — include in Elo, but flag them so analytics can exclude later.
- Clean, minimal visual design; the insight text is the hero. No placeholder lorem ipsum anywhere.

OUT OF SCOPE FOR THIS MILESTONE
Auth, API-based variant generation, admin screens, public analytics page, deployment. Do not build these, but don't paint us into a corner: keep the repo module and schema ready for a Postgres swap and an admin review flow later.

DEFINITION OF DONE
- `npx prisma migrate dev` + seed runs clean from a fresh clone.
- `npm run dev` gives me the full loop: pick segment -> swipe 10+ pairs -> see personal results card.
- A README covering setup, the data model, the matchmaking rules, and the Elo math.
- Print a summary of any judgment calls you made that deviate from this spec.

Start by proposing the file structure and Prisma schema for my approval before writing the rest.
```

---

## 11. Medium Series Tie-ins

- Launch article: "I built a Chatbot Arena for business insights — without writing the code myself" (the Claude Code build story is itself the low-code-for-business-users proof point).
- Results article: attribute win rates, exec vs. analyst disagreement.
- Flagship: the overclaim experiment — "Your executives prefer confident insights over correct ones."
- Governance article: preference elicitation as the human-judgment gate before narrative automation (direct Judgment Spectrum tie-in).
