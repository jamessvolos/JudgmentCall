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

## Wave 2 — Aggregates as first-class state

The remaining full scans (`getAnalyticsComparisons`, `getContrastCounts`,
`getFindingComparisonCounts`) shrink to point reads:

- `ContrastTally` table (attribute, valueA, valueB, segment, winsA, n)
  updated inside the vote transaction — analytics becomes a 26-row read.
  Backfill script replays existing comparisons once; a nightly
  reconciliation job (ops.yml) asserts tally == recount and alarms on
  drift, so the ledger stays the source of truth.
- Per-finding and per-contrast comparison counts maintained the same way
  (or read from the tally), removing both groupBys from `/api/pair`.
- `getSeenPairKeys` capped: read only the session's last N=200 pair keys
  (a session that has seen 200 pairs is already in repeat territory).

## Wave 3 — Vote-path latency & integrity

- Collapse the vote settle (comparison insert, Elo update, XP events,
  gold marking, session counters, tallies) into a single
  `prisma.$transaction` — one round-trip to Neon instead of a sequence,
  and a crash can no longer half-settle a vote.
- Idempotency: client sends a `voteToken` (pair key + counter); retries
  and double-taps become no-ops server-side instead of relying on UI
  disabling.
- Per-route timing: a 3-line wrapper logs `route, ms, sessionId-hash` on
  every API response so p95s are readable from Vercel logs before and
  after each wave.

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

- Region pinning: deploy functions in `iad1` (Neon is us-east-1) so every
  DB round-trip is single-digit ms; verify with route timings.
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
- CDN caching for the public read surfaces: `/api/crowd` and OG images
  get `s-maxage=60, stale-while-revalidate` — they are already
  eventually-consistent by design.
