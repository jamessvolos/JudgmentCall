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
- Font loading: subset + `font-display: optional` for the mono face,
  preload the two weights actually used above the fold.
- Bundle audit: `@next/bundle-analyzer` in CI; admin routes already
  split; keep the swipe route's first-load JS under 120KB gzipped.

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
- Load test: `scripts/loadtest.ts` (autocannon) hitting /api/pair + vote
  at 50 rps in CI-adjacent runs; budget: p95 < 300ms at 50 rps on the
  hobby tier.
- Connection pooling: confirm the Neon connection string is the pooled
  (`-pooler`) endpoint for serverless, and alarm before the plan's
  connection ceiling.
