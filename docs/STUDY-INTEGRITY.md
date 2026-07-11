# Study integrity

Judgment Call publishes numbers a stranger is invited to trust. This document is
the authoritative record of *how* that trust is protected: the layered defenses
that keep low-effort or adversarial voting from distorting a published result,
the wall between raw votes and public outputs, and the risks we have accepted
(and why). It is the counterpart to `INSIGHT-PRINCIPLES.md` (what a good insight
*is*) — this is what keeps the measurement of taste *honest*.

Prime directive: **nothing here may change what a voter sees or how a vote is
generated or scored.** Integrity is enforced at intake and at aggregation, never
by altering the blinded voting experience. When a protection would require
touching the voting flow, it is redesigned to avoid it or declined.

---

## The two choke points

Every integrity control lives at one of two places. Nothing in between is trusted.

1. **Intake** (`src/app/api/vote/route.ts` → `recordVote` in `src/lib/repo.ts`):
   what is allowed into the ledger, and how each row is flagged.
2. **Aggregation** (`src/lib/analytics.ts`, `src/lib/results.ts` via
   `computeAnalyticsCached`): which ledger rows are allowed to reach a published
   number.

The ledger itself is append-only truth: every vote is stored, flags and all.
Filtering happens on the *read*, so a mistake in a filter is always recoverable
from the ledger and never corrupts the underlying record.

---

## Defense in depth (what exists today)

| Layer | Control | Where | Effect |
|---|---|---|---|
| Rate | `MAX_VOTES_PER_MINUTE = 30` → 429 | vote route | caps single-session flooding |
| Effort | can't-decide throttle (`>2` undecided of last `5` → next undecided rejected) | vote route | forces genuine calls, kills abstain-spam |
| Effort | latency floor `LOW_ATTENTION_MS = 800` → `lowAttention` | vote route | sub-0.8s taps flagged |
| Independence | `isRepeat` (pair already seen this session) | `hasSeenPair` | non-independent re-judgements flagged |
| Idempotency | `clientVoteId` UNIQUE; duplicate insert → `P2002`, settle rolls back | repo / vote route | retries & double-taps can't double-count Elo/XP/tally |
| Fairness | A/B side flipped 50/50 per render (`Math.random() < 0.5`) | `matchmaking.ts:232` | neutralizes left/right position bias |
| Trust boundary | contrast key computed server-side from stored tags, never from the client | vote route | client can't mislabel what a vote is about |
| Forensics | salted SHA-256 IP digest; **stores `null` in prod without a real salt** | `hashIp` | post-hoc sybil analysis without holding raw IPs |
| Publication | `MIN_N = 30` suppression + Wilson 95% intervals + "TOO CLOSE TO CALL" straddle | `analytics.ts` | thin/uncertain contrasts never assert |

### What reaches a published number

A vote contributes to a public tally **iff**: `winnerId != null` **and**
`lowAttention = false` **and** `isRepeat = false` **and** `deckId = null` (bring-
your-own-data decks are private, never in the public study), its `contrastAttrs`
is a single key, and that key is not the blinded fidelity attribute. This filter
(`getAnalyticsComparisons`, `repo.ts`) is the one contract every published craft
number depends on — replicate it, never re-derive it.

Consequences worth stating plainly:
- **Low-attention and repeat votes are excluded from every published tally** —
  they cannot move a public preference number.
- **The blinded fidelity dimension is dropped before analytics** — it is never
  in a public output, so ranking or displaying craft contrasts can expose
  nothing about the hidden experiment (bundle guard + canonical grep enforce the
  client side; this filter enforces the server side).
- **Drill attempts never enter analytics**, and **learner behavior never feeds
  generation or scoring** — the training room is isolated from the study.

---

## Risk register

Prioritized by expected damage to published credibility × ease of exploitation.
Each risk lists its current mitigation and the residual we knowingly accept.

1. **Cross-session sybil / ballot-stuffing.** A session id is client-generated,
   so one actor can open many sessions and push a contrast.
   *Mitigation:* `MIN_N` + Wilson intervals mean a handful of extra votes can't
   manufacture a "resolved" result; the 30/min cap bounds per-session throughput;
   the salted IP digest supports post-hoc forensics.
   *Residual (accepted):* no *active* per-IP dedup in aggregation — deliberately,
   because NAT/shared-IP false positives would silently drop honest votes, and
   the stakes (a public taste leaderboard) don't justify that harm.
   *Monitoring (shipped):* `scripts/integrity-scan.ts` — a read-only scan that
   flags any session contributing ≥30% of a contrast's counted votes (contrasts
   with n ≥ 10; both thresholds env-tunable). Run it against the production
   `DATABASE_URL` from an ops shell; exit 2 on flags for alarm wiring. It is a
   *signal*, never an automatic exclusion — investigate first; the ledger stays
   authoritative.

2. **Low-effort voting.** Rapid, thoughtless taps.
   *Mitigation:* latency floor → `lowAttention`, excluded from all tallies;
   can't-decide throttle forces real calls.
   *Residual:* CLOSED (2026-07-10). `lowAttention` votes no longer move Elo or
   the W–L counters — the leaderboard and its win-share are published numbers,
   so the intake rule is now uniform: a flagged vote (repeat or low-attention)
   never moves any published number. Historical Elo/W–L retain pre-fix junk
   influence; the ledger is authoritative, so a one-time replay can rebase them
   if that residue ever matters at scale.

3. **Self-reported segment abuse.** Segment (executive/analyst/…) is self-declared.
   *Mitigation:* segment only ever *splits* the disagreement view, which is itself
   gated at `n ≥ 30` per segment; it never gates voting or reweights the headline
   number.
   *Residual:* low — worst case is a cosmetic skew in a segment split that already
   requires 30 observations to appear.

4. **Repeat / double-tap inflation.** *Mitigated:* `isRepeat` exclusion +
   `clientVoteId` idempotency. No residual known.

5. **Position bias.** *Mitigated:* 50/50 A/B flip per render. No residual known.

6. **Blinding leakage into a public output.** *Mitigated:* fidelity dropped before
   analytics; bundle guard + canonical grep block the client side. This is the
   one risk that outranks all optimization — see `DESIGN.md` / `INSIGHT-PRINCIPLES.md`.

7. **Stale or misleading public numbers.** *Mitigated:* `computeAnalyticsCached`
   keys on a data-version (comparison count + latest id + approved-variant count),
   so a published number can never lag the ledger a reader could check; `MIN_N`
   suppression + honest intervals prevent over-claiming from thin data.

---

## How this doc is load-bearing

- The **intake filter** and the **published-number filter** above are the two
  invariants every integrity change must preserve. If a future optimization
  (e.g. a Wave-2 aggregate table, see `PERF-WAVES.md`) changes *how* a number is
  computed, it must reproduce the intake filter byte-for-byte and reconcile
  against the ledger — the ledger stays authoritative.
- When a new attack or bias is discovered, it is added to the risk register with
  its mitigation and residual, so the study's defensibility is auditable in one
  place rather than reconstructed from code comments.

---

## Amendment log

- **2026-07-05** — First articulation (v1). No code change. Catalogued the
  existing defense-in-depth (rate cap, can't-decide throttle, latency floor,
  repeat + idempotency, server-side contrast, 50/50 position flip, salted-IP
  forensics, `MIN_N`/Wilson publication suppression), documented the intake →
  aggregation isolation and the exact "reaches a published number" contract, and
  opened the prioritized risk register. Verified the posture against the code:
  position bias is already neutralized (`matchmaking.ts` 50/50 flip), fidelity is
  dropped before analytics, drill attempts and BYO decks are isolated from the
  public study. Assessment: study health is **strong** — the machinery is mature
  and no live-path change clears the "clear integrity gain + zero risk to the
  blinded experience + lowest added attack surface" bar this round. The single
  highest-value *future* action is a read-only anomaly-scan script for the
  cross-session sybil residual (risk #1); it is deferred as it wants production
  ledger access to be meaningful, not a code change makeable or verifiable here.
- **2026-07-09** — **Sybil-monitoring scan shipped** (risk #1's named next
  action; v1 deferred it, this round revisited: the *findings* need production
  data, but the *tool* is buildable and verifiable here, and it becomes a
  standing ops capability). `scripts/integrity-scan.ts`: read-only, reuses
  `getAnalyticsComparisons` (the published-number DB filter) rather than
  re-deriving it, and mirrors the analytics in-loop rules (single contrast key,
  fidelity dropped) so it watches exactly the rows that can reach a public
  number. Per contrast it computes n, distinct sessions, and the top session's
  share; flags share ≥ `SCAN_SHARE` (default 0.3) where n ≥ `SCAN_MIN_N`
  (default 10). Exit 0 clean / 2 on flags (alarm-friendly, distinct from crash).
  **Verified end-to-end on the local ledger:** (a) drove 150 honest votes
  through the real intake with proper `latencyMs` — scan reported healthy
  distribution, exit 0; (b) injected a synthetic sybil session (12 rows flooding
  one contrast) — scan flagged exactly that session at 55% share, exit 2;
  (c) removed the injection — clean again. A bonus validation fell out of the
  work: 410 earlier driver-generated votes that omitted `latencyMs` were all
  auto-flagged `lowAttention` by the intake floor and correctly count for
  nothing — the defense caught synthetic low-effort input exactly as designed.
  Integrity audit: zero live-path change (a script only; app build unchanged,
  blinding grep clean, guard PASS, all tests pass); no new attack surface (it
  only reads); published numbers untouched; the ledger stays authoritative and
  the scan is documented as a signal, never an automatic exclusion.
  **Reflection.** Chosen because it was the register's own top action and the
  only item combining real credibility value with strictly-zero live-path risk.
  Study health remains **strong**; remaining high-priority residuals: wire the
  scan into a nightly ops hook against production (config, not code), decide
  the open Elo/lowAttention consistency question (risk #2), and set the prod
  `IP_HASH_SALT` so the forensic digest stops storing null (risk #1 forensics).
- **2026-07-10** — **Risk #2's open question closed: flagged votes no longer
  move Elo.** The v1 charter accepted that `lowAttention` votes move Elo on the
  theory that "the tally is the protected public surface" — but the variant Elo
  leaderboard (with W–L and a win-share bar) is itself published on /results
  §04, so a sub-0.8s tap could move a published number while being excluded
  from every tally. The intake rule is now uniform: the Elo/W–L settle condition
  gained `&& !input.lowAttention`, at the exact site where `isRepeat` was
  already excluded. One-condition change; the vote is still logged whole (flags
  and all — the ledger keeps everything); nothing a voter sees changes (XP
  already excluded flagged votes; no voter-visible surface reads Elo at vote
  time); the blinded experience is untouched. **Verified end-to-end** through
  the real intake: a 120 ms vote was flagged and moved neither Elo nor W–L on
  either variant, while a 4.2 s vote moved both normally; tsc, lint, build,
  blinding grep empty, guard PASS, all tests pass. Known and accepted:
  historical Elo/W–L retain pre-fix junk influence (Elo is path-dependent);
  the ledger is authoritative, so a one-time replay (`scripts/replay.ts`-class
  job) can rebase ratings from clean votes if that residue ever matters —
  documented reconciliation path, not needed at current volume.
  **Reflection.** Chosen because it was the register's only remaining
  code-addressable residual, it strengthened the exact contract the charter
  calls load-bearing ("what reaches a published number"), and it carried the
  lowest possible surface (one condition, one comment). Remaining
  high-priority items are both ops, not code: wire `integrity-scan.ts` into a
  nightly production hook, and set the prod `IP_HASH_SALT` so the forensic
  digest stops storing null. Study health: **strong** — intake and aggregation
  now enforce one uniform published-number contract.
- **2026-07-10 (later)** — **Publication-floor sweep: the register brought
  current, one gap closed at aggregation.** Context: two integrity-relevant
  fixes shipped through the design loop since the last amendment and are now
  recorded against their risks, and the sweep they motivated found one more
  instance of the same class, fixed this round at the aggregation choke point.
  (a) *Risk #7 (misleading public numbers):* /results §04 printed a derived
  win rate + win-share bar at any n > 0 under a page promising the n≥30 floor
  three times; it now suppresses below `MIN_N` with the same uniform
  collecting treatment as §02 and carries the Wilson interval when revealed
  (`cdcbe88`). (b) *Risk #6 (blinding leakage):* fidelity vocabulary shipped
  in client copy on two non-drill surfaces (the /review drill CTA, the share
  poster's credential line) beneath the canonical grep's pattern, which
  checks the raw tag value; both strings were aligned to public branding and
  `bundle-guard` check 3 was widened to police the bare token in any
  inflection, drill-chunk-only — verified by falsification (planted token
  fails the guard by name; clean tree passes) (`c6c2907`). (c) *This round's
  fix:* the **position-bias self-check published below its own floor** —
  `computeAnalytics().positionBias` returned `leftRate`/`interval` at any
  n ≥ 1, so the public /methods card's COLLECTING state ("n/30 decided votes
  before this check reads") could never render past the first vote, and a
  young ledger could print a spurious red "INTERVAL EXCLUDES 50 — FLAG" (or a
  hollow all-clear) from noise. The readout now nulls below `MIN_N` at the
  aggregation layer — enforcement at the choke point, not the display —
  while `computeOverclaim().positionBias` (the admin monitor) deliberately
  stays ungated so operators see the check forming early. **Verified
  end-to-end on both sides of the floor:** against the live dev ledger
  (n=583) the measured card still publishes rate + interval; against a fresh
  scratch ledger the /methods page renders the COLLECTING card with no
  readout (the sub-floor branch had plausibly never rendered before, since
  the old gate nulled only at exactly n=0). tsc, lint, build, blinding grep
  empty, guard PASS, tests 40/40.
  **Reflection.** Chosen because it was the register's own doctrine applied:
  the "publication" defense layer claims `MIN_N` suppression for published
  rates, and the sweep found the one published rate that layer didn't yet
  cover. The class lesson from §04 generalizes — *every* derived rate a
  stranger can read must inherit the floor, and the floor must live at
  aggregation. Publication surfaces now floor-complete: §02 (suppressed
  stats), §04 (this week), /api/crowd (filters suppressed), the /methods
  position check (this round); the poster's personal leanings are labeled
  "leanings, not findings" and publish no study rates. Study health:
  **strong**. Remaining high-priority items are unchanged and ops-only: wire
  `integrity-scan.ts` into a nightly production hook, and set the prod
  `IP_HASH_SALT`.
