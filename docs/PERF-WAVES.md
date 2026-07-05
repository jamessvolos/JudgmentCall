# Architecture & performance — five waves

The app's read paths were written for correctness first: every published
number is recomputed from raw comparisons on demand. That is the right
v1 bias (no cache-invalidation bugs in a study's numbers) and the wrong
steady state (every page view pays O(total votes)). These five waves move
the hot paths to O(1)-per-request without ever letting a cached number
disagree with the ledger.

Ground rules for all waves:
- Published statistics must never be stale in a way a reader could catch:
  caches key on data versions, not clocks.
- The blinding invariants (docs/DESIGN.md) outrank any optimization.
- Each wave lands independently deployable, with before/after numbers in
  the commit message.

## Wave 1 — Read-path economics ✅ (shipped)

- Indexes: `Comparison(contrastAttrs)`, `Comparison(createdAt)`,
  `Variant(status)` — covering the coverage-balancing groupBy, the
  votes/day series + freshness probes, and the review-queue/serving
  filters. (`prisma/migrations/20260704065135_perf_indexes`, mirrored to
  the Postgres overlay as `000000000002_perf_indexes`.)
- `computeAnalyticsCached()`: per-instance memo of the full analytics
  snapshot keyed by `getAnalyticsVersion()` (comparison count + latest id
  + approved-variant count — three indexed point queries). Exact
  freshness: any vote or approval changes the key. Hot callers swapped:
  `/results`, `/api/review`, `/api/crowd`, the results OG image. Admin
  keeps the direct compute.
- Matchmaking: one batched `findMany` for all candidate findings replaces
  the per-finding query chain; `/api/review` fetches gold-pair consensus
  in one parallel burst.

## Wave 2 — Aggregates as first-class state  ⏸ DEFERRED BY DESIGN

**Status: not shipped, on purpose.** At current volume (~200 counted votes)
the Wave-1 memoized scan resolves `/results` in ~30ms and only recomputes
when the data version changes. A vote-path aggregate table would add write
complexity and a drift-risk to the flagship study's *published numbers* for
a benefit that doesn't materialize until roughly 50k+ counted votes. Ship
this wave when the analytics recompute (measured, not guessed) crosses ~150ms
p95, and only behind the reconciliation guard below. The design is recorded
here so it's a drop-in when that day comes.

**Exact write contract (must match `getAnalyticsComparisons` byte-for-byte).**
A vote contributes to the tally iff: `winnerId != null AND lowAttention =
false AND isRepeat = false AND deckId = null`, its `contrastAttrs` is a single
key, and that key is not `fidelity`. The value pair is `[winner[attr],
loser[attr]].sort()`; `winsA` increments when `winner[attr] === valueA`. Any
divergence from this filter corrupts a public claim — replicate it, don't
re-derive it.

- `ContrastTally(attribute, valueA, valueB, segment, winsA, n)`, one row per
  segment (store ALL segments; `/results` overall = sum across segments, the
  segment views filter to executive/analyst — strictly more general than the
  current scan). Updated inside the existing vote `$transaction`.
- Backfill script replays the ledger once; a nightly reconciliation step
  (ops.yml) recomputes from the ledger and asserts `tally == recount`,
  alarming on any drift. The ledger stays the single source of truth; the
  tally is a cache that must prove equality before reads switch to it.
- Per-finding and per-contrast counts (`getFindingComparisonCounts`,
  `getContrastCounts`) maintained the same way, removing both groupBys from
  the `/api/pair` hot path.
- `getSeenPairKeys` capped to the session's last N≈200 pair keys (a session
  past 200 pairs has already exhausted a pool of this size — bounded read,
  no behavior change at current scale).

## Wave 3 — Vote-path latency & integrity

- Vote settle is ALREADY a single `prisma.$transaction` (comparison
  insert, Elo, XP events, gold marking, session counters) — a crash can't
  half-settle. ✅ (pre-existing; verified.)
- The three independent pre-settle reads (`getRecentVoteStats`,
  `getVariantPair`, `hasSeenPair`) now run in one `Promise.all` instead of
  three serial awaits — one round-trip, not three. ✅ Verified: vote drops
  from ~24ms to ~12–17ms warm; record / idempotency / can't-decide all
  still correct.
- Idempotency: client sends a `clientVoteId` (uuid per pair render);
  server dedupes on a nullable unique column so retries and double-taps
  become no-ops instead of a second Elo application. Also stop applying
  Elo on `isRepeat` votes — repeats are non-independent and should not
  move ratings (they already earn no XP and are excluded from analytics).
- Per-route timing: `withTiming()` (`src/lib/timing.ts`) wraps the hot
  handlers (`/api/vote`, `/api/pair`) — one `[perf] route=… ms=… status=…`
  log line per request plus a `Server-Timing` response header (visible in
  devtools). ✅ Baseline at ~535 votes (local SQLite, warm): `pair` ≈6–12ms,
  `vote` ≈24ms (the settle transaction + inline next-pair selection). This is
  the measurement floor every future wave is judged against. Now also wraps
  the analytics-backed reads `/api/review`, `/api/crowd`, and `/api/results`,
  so every API read/write path emits a `[perf]` line + `Server-Timing`
  header. ✅ (`/results` is an RSC page with no handler to wrap — measure it
  via the `computeAnalyticsCached` version-key hit rate; if it shows hot,
  move it to ISR `revalidate` rather than a response header.)

## Wave 4 — Client performance & perceived speed

- Prefetch the NEXT pair while the voter reads the current one (the
  decision takes seconds; the fetch takes ~100ms — the next pair should
  always be waiting). Serve from the prefetch on vote, fetch-ahead again.
- Optimistic vote: stamp + tally tick immediately, reconcile in the
  background, roll back with an apology toast only on failure.
- Font loading ✅: migrated from `@fontsource` CSS imports to
  `next/font/local`, reading the same latin variable woff2 (copied into
  `src/app/fonts/`, so no build-time network — `next/font/google` is
  unavailable in the sandbox). This auto-injects `<link rel=preload>` for the
  above-the-fold faces (killing the hero/masthead FOUT), applies size-adjust
  fallback metrics (cuts CLS), and emits ONLY the latin faces used — the old
  `import "@fontsource-variable/geist"` shipped `@font-face` for five scripts ×
  normal + italic, none preloaded. Geist sans + mono carry no italic and
  preload on every route (above the fold everywhere); Source Serif ships
  normal + italic with `preload: false` (it's the tellings/quotes voice, never
  the LCP element, absent from the landing above the fold — so its ~100KB never
  crowds the critical path and loads on demand where it renders). Verified: the
  landing preloads exactly the two Geist faces; all three families paint
  (incl. serif italic on the desk quotes); build + lint clean. IBM Plex Mono
  remains OG-only.
- Bundle audit ✅: measured (gzipped first-load JS, served chunks) — every
  route clusters at ~185–190KB, with the spread between routes only ~5KB, i.e.
  almost all of it is the shared React 19 + Next 16 (App Router, Turbopack)
  runtime; the biggest single chunk is react-dom (~69KB). The app's OWN
  per-route code is small (~12KB). No leaked heavy dependency (no Prisma,
  Anthropic SDK, or chart lib in any client chunk). The original "<120KB"
  target predates this framework baseline and isn't reachable without dropping
  React/Next — so the meaningful budget is the *route delta* (keep app code
  small), not the absolute floor. Rather than track a number by hand, the
  invariants are now GUARDED automatically: `scripts/bundle-guard.sh`
  (run via `npm run guard` after a build) fails on (1) any study fidelity tag
  in a client chunk — the flagship blinding invariant, previously a manual
  grep, (2) any server-only SDK/ingest host in a client chunk, (3) teaching
  vocab reachable from a non-drill route. Wired into `.github/workflows/ci.yml`
  (new): every push runs tsc + lint + the offline unit tests (`npm test`) +
  build + the guard, hermetically on a throwaway SQLite DB (no secrets). This
  turns every manual per-round check into an enforced gate.

## Wave 5 — Scale & operations

- Region pinning: `vercel.json` pins functions to `iad1` (Neon is
  us-east-1) so every DB round-trip is single-digit ms. ✅
- CDN caching for public read surfaces: `/api/crowd` (s-maxage=60) and the
  OG images (results 5 min, brand 1 day, profile 1 hr) carry
  `stale-while-revalidate` — all eventually-consistent by design. ✅
- Connection discipline: singleton Prisma client (done) + Neon pooled
  connection string for serverless; alarm if connection count nears the
  plan limit.
- Snapshot serving: when the live tables pass ~100k votes, `/results`
  switches to the latest `AnalysisSnapshot` JSON (already produced daily)
  with live numbers only for the headline totals; the full recompute
  becomes cron-only.
- Load test: `scripts/loadtest.ts` (dependency-free) drives session →
  pair → vote loops and reports per-route p50/p95/p99. ✅ measured (local
  SQLite, `CONCURRENCY=4 DURATION=12`): **vote p50 5ms / p95 23ms / p99
  34ms / max 73ms at 58 rps** — inside the p95 < 300ms budget. Read that
  number, not the harness's `ok%`: `ok%` is `res.ok`, so it counts the
  vote route's per-session rate-limit **429s (a study-integrity feature,
  MAX_VOTES_PER_MINUTE) as "not ok"**. A single-source flood trips the
  limiter constantly, so `ok%` says nothing about health — latency does.
- Connection pooling: confirm the Neon connection string is the pooled
  (`-pooler`) endpoint for serverless, and alarm before the plan's
  connection ceiling.

### Write-path contention hardening ✅ (shipped)

The load test at `CONCURRENCY=10` pushed local SQLite past its
single-writer lock and surfaced two vote-settle failure classes. SQLite's
global write lock is a **local-only artifact** (Postgres uses row-level
MVCC — writes don't serialize behind one lock), but it exposed a real
gap: the vote settle path had no contention resilience at all, so the
equivalent Postgres failure (a serialization/deadlock abort) would have
dropped a vote from the ledger as a 500. Three changes, all correct on
both engines:

- **`withTxRetry` (`src/lib/tx-retry.ts`)** wraps both write transactions
  (`recordVote`, `recordDrillAttempt`). It retries **only** errors that
  guarantee the transaction rolled back — Prisma `P2034`, Postgres
  SQLSTATE `40001`/`40P01`/`55P03`, and message-matched lock/serialize/
  deadlock — with jittered backoff. It never retries `P2002` (the
  `clientVoteId` idempotency signal the vote route already treats as a
  settled no-op), validation, not-found, or opaque errors, so a re-run
  can never double-record. 23 offline assertions in
  `scripts/tx-retry.test.ts` (wired into `npm test`).
- **`WRITE_TX_OPTS` (maxWait 10s / timeout 15s)** on both interactive
  transactions. Prisma's defaults (2s / 5s) dropped votes under
  contention with `P2028` ("interactive transaction timeout"); widening
  the budget eliminated that class entirely (server log: present before,
  zero after). For a votes ledger, waiting for the write lock is always
  correct over dropping the vote; under normal load these settle in
  single-digit ms and never approach the ceiling. Pairs with the retry:
  the budget covers "waited for the lock", the retry covers "aborted
  after grabbing it".
- **SQLite WAL** (`src/lib/db.ts`): `journal_mode=WAL` +
  `synchronous=NORMAL` + `busy_timeout=8000`, guarded to `file:` URLs so
  it is a strict no-op on Postgres. Lets local/self-host writers hand off
  the lock fast instead of stalling readers. The residual `Socket
  timeout` 500s at `CONCURRENCY=10` are SQLite saturation Postgres does
  not share — correctly **not** retried (a socket timeout gives no
  rollback guarantee).

### Round reflection — 2026-07-04 · converged (no change)

Re-audited the hot paths after the write-path hardening above and found no
improvement that clears the "clear value + full safety bar + lowest risk"
gate. What was evaluated and why each was declined:

- **`/api/crowd` totals-only fast path.** The new landing's hero live-count
  reads only `totals`, but `/api/crowd` computes full analytics. Declined:
  the endpoint is CDN-cached (`s-maxage=60`, swr=300) and
  version-memoized, and it serves a *second* consumer (`YourContribution`)
  that needs the full `stats` payload — so the cost is amortized and the
  payload isn't dead weight. A separate cheap path would save only a rare
  cold-compute (new instance + cache miss + first-since-version-change)
  while adding a divergent query to keep truthful. Low value, added
  surface.
- **SSR the landing hero count.** Would put the number in initial HTML, but
  it would trade the landing's static shell + one CDN-cached fetch for
  dynamic-per-request SSR on the highest-traffic page — a scale
  *regression*, not a win. The current static-shell + streamed-count
  design is the correct architecture for a front door; leave it.
- **Drill selection query (this session's family-diverse `getNextDrillItem`).**
  Verified already index-covered: `DrillAttempt` carries `@@index([sessionId])`
  and `@@index([drillItemId])`, so both the session filter and the device
  join hit indexes. No gap introduced.
- **Deferred big items still correctly gated.** Snapshot-serving (@~100k
  votes) and Wave 2 aggregate tables (@~50k, behind the reconciliation
  guard) remain unjustified at the study's current ~768 counted votes;
  building them now would add reconciliation surface with no live benefit.

Assessment of remaining high-confidence opportunities: none actionable
now. The next real perf work is threshold-triggered (aggregate tables /
snapshot serving once vote volume approaches the documented thresholds),
plus the standing ops item — confirming the production Neon URL is the
pooled (`-pooler`) endpoint, which is a config/ops check, not a code
change this loop can make. Ledger remains the source of truth; no caching
or staleness surface was added; blinding untouched. Convergence recorded
per the stop condition — not forcing a change.

### Round reflection — 2026-07-04 · re-check, still converged

Loop re-fired. The only code change since the convergence above was the drill
completion screen's missed-family reinforcement (`drill/page.tsx`) — a
client-side filter/map over ≤6 families whose data (`OVERCLAIM_FAMILIES`) was
already in the drill chunk, so the bundle held at ~198 KB (guard-confirmed) and
no hot path, query, index, or schema changed. Vote volume is still ~768,
far below the 50k/100k thresholds that gate the deferred aggregate-table and
snapshot-serving work. A fresh look at other candidates (read-path error
handling, bundle trim, N+1) surfaces nothing clearing the "clear value + full
safety bar + lowest risk" gate. No change.

**Standing policy to avoid churn:** while the hot paths (vote settle, the
analytics read path + its CDN/memo caching, the client bundle) are unchanged
since this note **and** vote volume stays below the documented aggregate/
snapshot thresholds, this loop is a no-op — re-checking is fine, but do not
re-log or edit for its own sake. The next entry should coincide with a real
change, a crossed threshold, or a newly-surfaced hot path (e.g. a production
profiling signal from the `withTiming` `[perf]` logs / Server-Timing headers).

### Round reflection — 2026-07-05 · Training Room surface assessed (no change)

A newly-surfaced path (the `/drill` rebuild into the Training Room) is the reason
this entry exists rather than a silent no-op. Assessment:

- **The study's published-number paths are untouched.** `analytics.ts`,
  `results.ts`, and the `/api/vote|pair|crowd|results` handlers have zero diff
  across the Training Room build — so the ledger, the version-keyed analytics
  memo + CDN caching, and every blinding invariant on published numbers are
  unaffected. The build added columns to `DrillItem` (not in the analytics path)
  and a mode-aware `/api/drill`; drill attempts still never enter analytics.
- **The drill path is a cold, non-published surface.** `/api/drill` GET now does
  two `drillAttempt.findMany` scans per request (`getNextDrillItem` +
  `getSkillProgress`), each on `@@index([sessionId])` over a per-session table
  bounded by the pool size (≤35 rows). It is user-paced training traffic, not a
  study hot path, and touches no published number — so `withTiming` wraps it for
  observability but it needs no caching or aggregate table.
- **Bundle unchanged.** The Training Room is its own route chunk (guard-confirmed
  ~200 KB shared JS, teaching content drill-only); no shared-bundle growth.

**Chosen action: none — converge.** No change clears the "clear value + full
live-study safety bar + lowest risk" gate: the study paths didn't move, and the
drill path's minor double-scan is negligible (two indexed reads of a ≤35-row
table on a user-paced request) — optimizing it now would be premature. Recorded
two low-priority candidates for a future round: (1) fold `getSkillProgress` into
the attempts `getNextDrillItem` already fetches, saving one drill-GET query; (2)
remove `getDrillFamilyProgress`, now orphaned by the new API. Both are cleanups,
not live-study perf; deferred until the drill path shows a real profiling signal.
Ledger truth + blinding untouched; standing thresholds (50k aggregate / 100k
snapshot) still far off at the study's current volume.

### Round reflection — 2026-07-05 · drill read-path tidy (shipped)

**Why this round wasn't a no-op.** The standing anti-churn policy keys on the hot
paths being unchanged; since the note above, `getNextDrillItem` *was* changed
(missed-skill reinforcement, mastery bullet 2), which re-opened the drill read
path for audit and made the two parked candidates directly actionable.

**Chosen improvement (both parked candidates, one coherent change).** The
`/api/drill` GET was scanning `drillAttempt` for the session **twice** per
request — once in `getNextDrillItem` and again in `getSkillProgress` — and after
the reinforcement change `getNextDrillItem` already fetches the exact rows
(`correct` + `item.skill`) the recap needs. So: (1) `getNextDrillItem` now derives
the per-skill recap from the attempts it already has (new pure `tallySkillProgress`
helper) and returns it; the route drops both `getSkillProgress` calls — **one
`drillAttempt` scan per drill GET instead of two.** (2) Removed the orphaned
`getDrillFamilyProgress` + `FamilyProgress` type (zero callers since the Training
Room rebuild), which also retired the last `overclaimFamily` / `OVERCLAIM_FAMILIES`
use in `repo.ts` — so the `./teaching` import is gone from `repo.ts` entirely, a
small **blinding-surface reduction** (fewer server files carrying fidelity vocab).

**Why it won the decision lens.** Highest-confidence-safe available: the drill
path is non-published, non-analytics, non-blinding (attempts never enter the
ledger), so there is *zero* staleness or published-number risk by construction;
the change is a pure refactor with identical output; and it also tightens the
blinding audit surface. Minimal surface (two files), and it's exactly the
follow-up the prior reflection recorded.

**Verification.** tsc + lint clean; full build clean; blinding grep empty (exit 1);
bundle guard PASS (~203 KB, teaching chunk still drill-only); `drill-content.test`
35/35. Live-study safety audit: no study/published-number path touched
(`analytics.ts`, `results.ts`, `/api/vote|pair|crowd|results` unchanged);
ledger remains the single source of truth; drill attempts still never enter
analytics; no aggregate/cache introduced, so no staleness surface. **Functional
proof:** drove 5 drill attempts across skills, then asserted the refactored GET's
`skillProgress` equals an independent `drillAttempt` DB recount — MATCH (identical).

**Remaining opportunities.** None actionable now. The drill GET still runs two
*distinct* queries (attempts + pool) which is inherent, not redundant. The
threshold-gated big items (Wave 2 aggregate tables @~50k, snapshot serving @~100k)
stay correctly deferred; the standing ops check (confirm the prod Neon URL is the
`-pooler` endpoint) is config, not code. Standing anti-churn policy still holds,
now re-keyed to this note's state.
