# Site Architecture & Performance Review — 2026-07-26

Four parallel read-only reviews (data layer/API, client bundle/rendering,
Next.js architecture/caching, module structure/drift), synthesized into one
change program. Every claim below was verified against the code; file:line
refs are as of commit `c78ed08`.

## Measured baseline

- First Load JS (gz): `/train/[track]` 170.8 KB, `/drill` 159.3 KB, `/` 149.4 KB.
  ~146 KB of that is the framework floor (react-dom 69 KB + Next runtime).
  Total client JS 232 KB gz (bundle-guard's number). CSS 10.8 KB gz. No images.
- Rendering modes: 9 routes prerendered, the rest per-request dynamic.
  No middleware. Region pinned `iad1`, matching Neon in us-east-1.
- prod-init syncs 281 content rows serially on every deploy.

## What the review found sound (verified, not re-litigated)

- Vote loop: pre-settle reads batched, next pair returned inline with the vote
  response, `clientVoteId` unique makes retries idempotent, 380ms stamp dwell
  overlaps the network call.
- Blinding: no fidelity vocabulary in client chunks, teaching vocab reachable
  only from /drill, guard runs in CI; serve-path projections strip answers
  field-by-field.
- No build-time DB coupling outside the (already fixed) /results OG card; the
  333 KB content modules never reach a runtime bundle.
- CDN caching caches nothing per-session; /api/crowd's s-maxage=60 + swr is
  the right pattern.
- Fonts self-hosted via next/font/local with latin subsets; animation CSS is
  transform/opacity almost everywhere with a full reduced-motion block.
- Prisma client is a proper module-scope singleton; sqlite WAL tuning is
  URL-scheme-gated; no transaction spans a network call.

## Changes shipped in this pass

### Correctness / integrity
1. `@@index([variantAId, variantBId])` on Comparison — the gold-consensus
   groupBy ran a sequential scan per decided vote (and ×10 per /api/review).
2. `@@unique([sessionId, quizItemId])` on QuizAttempt and
   `@@unique([sessionId, drillItemId, mode])` on DrillAttempt — the drill and
   quiz POSTs were check-then-insert with no constraint; a concurrent retry
   could double-record and double-settle Elo. Migrations dedupe existing rows
   first; routes catch P2002 as the 409 the pre-check already returns. This
   copies the pattern the vote path has had since `clientVoteId`.
3. Migrations-parity test hardened: column matches are now scoped to each
   model's own CREATE/ALTER blocks, so a common column name on a new model
   can no longer false-pass.

### Query cost that scaled with total votes
4. `getAnalyticsVersion` no longer runs `comparison.count()` (O(n)) per cached
   read — the version key is the latest comparison row + approved-variant
   count, with a 10s TTL floor before re-checking at all.
5. `getAnalyticsComparisons` / `getSessionComparisons` project only the fields
   analytics/personal-results actually fold over — variant `text` and
   `selfCheck` no longer cross the wire on every recompute.
6. The matchmaking walk selects attribute/elo fields only and fetches full
   text just for the two chosen variants.
7. Global coverage aggregates (`getFindingComparisonCounts`,
   `getContrastCounts`, `getStarvedAttrs`) memoized ~30s per warm instance —
   they are heuristic weights that tolerate staleness by design.
8. `/api/train` GET reads the attempt ledger once (was twice) and picks the
   next item from an id/weight projection instead of full item rows;
   `/api/drill` GET likewise shares one attempts fetch and one session read.

### Resilience (the outage's lesson, generalized)
9. Root `error.tsx` + `global-error.tsx` + `loading.tsx` for the dynamic
   pages — a DB failure no longer white-screens with no recovery.
10. TrackRoom: initial load is retryable with a real Retry button, fetches
    carry a 12s timeout so a hung request degrades to the error state instead
    of an eternal skeleton (the observed outage behavior).
11. prod-init content sync batched into transactions with retry — a dropped
    connection mid-sync no longer fails an unrelated deploy or leaves a
    half-synced pool.

### Perceived latency
12. Room mount waterfalls removed: session POST and data GET run in parallel
    (with a one-shot retry for first visits) in both /train/[track] and
    /drill — one round trip saved on every room open.
13. Landing prefetches /swipe and /train.
14. All five track pages prerendered (was 2 of 5).
15. /results, /methods, /calls/[n] moved from force-dynamic to
    `revalidate = 60` — identical global HTML now serves from the CDN.

### Rendering cost
16. FloodCall's 1,024-rect SVG grid (rebuilt per slider tick) replaced with
    run-geometry rects — the biggest mobile-jank candidate.
17. `pool-slide` animates transform instead of `left`; meters scale instead
    of transitioning `width`; the body's fixed-attachment gradient moved off
    the scroll-repaint path.

### Drift locks (the class that caused the outage)
18. Stale committed `prisma/postgres/schema.prisma` (missing two whole
    models) deleted/ignored — it is a build product of `vercel-build.sh`'s
    sed, and the committed copy lied.
19. `gen-quiz` regeneration locked in CI: `quiz.ts` must match its sources or
    the build fails — previously nothing enforced regeneration.
20. `import "server-only"` added to the server-side lib modules and an eslint
    restriction confining teaching vocabulary to /drill — the blinding
    boundary is now structural at build time, with bundle-guard as backstop.
21. Single-source dedupes: wilson interval (client copy is canonical), AXMIN
    calibration floor, the provider-swap sed (one script, three callers).

### Hygiene
22. Dead exports removed or demoted (`getFindingWithVariants`, `getTotals`,
    unused fontsource deps out of prod dependencies, etc.). The BYO-data
    surface (/submit, /d/[slug]) is deliberately hidden, not dead — kept.
23. `toAttributeProfile` narrowing replaces the `as unknown as` casts on the
    vote path; silent config-fallback catches now log a warning.

## Recommended but deferred (with reasons)

- **TrackRoom.tsx decomposition** (2,164 lines, 10 call-kind components) into
  `calls/<kind>.tsx` + a `Record<QuizKind, Component>` registry, and the
  matching per-kind serve/grade registry in `/api/train`. Pure relocation,
  but it churns the money path (grading) and every open PR/agent working the
  file; schedule as its own change with reveal-payload snapshot tests first.
  Same for `repo.ts` → `repo/{study,drill,quiz,funnel}.ts` barrel split.
- **Kind-union single source** (`src/lib/train-kinds.ts`) — shipped as types
  where cheap; the full payload-schema unification (route + client + gen-quiz
  + tests importing one module) belongs with the registry refactor above.
- **Analytics materialization** (incremental tallies instead of full refold)
  — not needed at current traffic; the projection + cheap version key buys
  the headroom. Revisit at ~50k votes.
- **Neon pooled endpoint**: prod `DATABASE_URL` appears to point at the
  direct (non-pooled) endpoint. Worth switching to the `-pooler` host in the
  repo secret — serverless concurrency spikes will exhaust direct
  connections. Requires a secrets change (operator action), not a code change.
- **Landing as server component with client islands** — modest gain, touches
  a carefully-tuned surface; not worth the churn now.
