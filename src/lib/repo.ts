// Repository module: ALL database access goes through here so the SQLite →
// Postgres swap (Milestone 4) is a datasource config change, not a refactor.
// Nothing outside src/lib should import prisma directly.

import { prisma } from "./db";
import { eloUpdate } from "./elo";
import { GOLD_MAJORITY, GOLD_MIN_N, JUDGE_MIN_GOLD, type Segment } from "./types";
import { XP, drillElo, levelFor, updateAbility, type LevelInfo } from "./progression";
// teaching.ts holds fidelity vocabulary but is a pure module; imported here on
// the SERVER only (repo.ts uses Prisma, so it never enters a client bundle) to
// classify drill devices into families. The bundle guard enforces this.
import { overclaimFamily, OVERCLAIM_FAMILIES, type OverclaimFamily } from "./teaching";
import { withTxRetry } from "./tx-retry";
import type { Finding, Variant, Comparison, Session, DrillItem } from "@prisma/client";

export type { Finding, Variant, Comparison, Session };

export type VariantWithFinding = Variant & { finding: Finding };
export type ComparisonWithVariants = Comparison & { variantA: Variant; variantB: Variant };

// ---------------------------------------------------------------------------
// Sessions

export async function upsertSession(
  id: string,
  segment: Segment,
  funnel?: { referrer?: string | null; utmSource?: string | null }
): Promise<Session> {
  return prisma.session.upsert({
    where: { id },
    create: {
      id,
      segment,
      referrer: funnel?.referrer ?? null,
      utmSource: funnel?.utmSource ?? null,
    },
    update: { segment }, // re-picking a segment just retags; funnel fields keep first-touch values
  });
}

export async function getSession(id: string): Promise<Session | null> {
  return prisma.session.findUnique({ where: { id } });
}

// ---------------------------------------------------------------------------
// Matchmaking reads

/** All findings with their comparison counts (for fewest-comparisons weighting). */
export type ServingConfig = {
  fidelityBoost: number;
  earlyFidelityCap: number;
  capUntilVotes: number;
  // Findings with a real public source (sourceUrl) are favored this many times
  // over fictional seeds — the serving pool shifts to real data as fast as the
  // human review gate clears it, without dead-ending when only seeds exist.
  realBoost: number;
};
export const DEFAULT_SERVING: ServingConfig = {
  fidelityBoost: 2,
  earlyFidelityCap: 2,
  capUntilVotes: 10,
  realBoost: 3,
};

export async function getServingConfig(): Promise<ServingConfig> {
  const row = await prisma.servingPolicy.findUnique({ where: { id: "default" } });
  if (!row) return DEFAULT_SERVING;
  try {
    return { ...DEFAULT_SERVING, ...JSON.parse(row.config) };
  } catch {
    return DEFAULT_SERVING;
  }
}

export async function setServingConfig(config: ServingConfig): Promise<void> {
  await prisma.servingPolicy.upsert({
    where: { id: "default" },
    create: { id: "default", config: JSON.stringify(config) },
    update: { config: JSON.stringify(config) },
  });
}

/**
 * Cheap freshness key for cached analytics: changes whenever a comparison is
 * logged or a variant clears review — the two events that can move any
 * published number. Three indexed point queries instead of a full-table scan.
 */
export async function getAnalyticsVersion(): Promise<string> {
  const [comparisons, latest, approved] = await Promise.all([
    prisma.comparison.count(),
    prisma.comparison.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true },
    }),
    prisma.variant.count({ where: { status: "approved" } }),
  ]);
  return `${comparisons}:${latest?.createdAt.getTime() ?? 0}:${latest?.id ?? ""}:${approved}`;
}

export async function getAnalysisSnapshots(take = 20) {
  return prisma.analysisSnapshot.findMany({ orderBy: { createdAt: "desc" }, take });
}

export async function getDeckComparisonsCsv(deckId: string) {
  return prisma.comparison.findMany({
    where: { deckId },
    include: { variantA: true, variantB: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getFindingComparisonCounts(
  deckId: string | null = null
): Promise<{ findingId: string; count: number; real: boolean }[]> {
  const findings = await prisma.finding.findMany({
    where: {
      deckId,
      status: { in: ["active", "submitted"] },
      OR: [{ staleAfter: null }, { staleAfter: { gte: new Date() } }],
    },
    select: { id: true, sourceUrl: true },
  });
  const grouped = await prisma.comparison.groupBy({ by: ["findingId"], _count: { _all: true } });
  const counts = new Map(grouped.map((g) => [g.findingId, g._count._all]));
  return findings.map((f) => ({
    findingId: f.id,
    count: counts.get(f.id) ?? 0,
    real: f.sourceUrl !== null,
  }));
}

export async function getFindingWithVariants(
  findingId: string
): Promise<(Finding & { variants: Variant[] }) | null> {
  // Only approved variants are ever served (M2 review gate; seeds default approved).
  return prisma.finding.findUnique({
    where: { id: findingId },
    include: { variants: { where: { status: "approved" } } },
  });
}

/**
 * Batch form of the above for matchmaking: the selection loop walks findings
 * in sampled order until one yields a pair, and fetching them one-by-one made
 * the worst case (small pools, well-covered sessions) one query per finding.
 */
export async function getFindingsWithVariantsByIds(
  ids: string[]
): Promise<Map<string, Finding & { variants: Variant[] }>> {
  const rows = await prisma.finding.findMany({
    where: { id: { in: ids } },
    include: { variants: { where: { status: "approved" } } },
  });
  return new Map(rows.map((f) => [f.id, f]));
}

/** Unordered pair keys ("idA|idB", ids sorted) this session has already been shown. */
export async function getSeenPairKeys(sessionId: string): Promise<Set<string>> {
  const rows = await prisma.comparison.findMany({
    where: { sessionId },
    select: { variantAId: true, variantBId: true },
  });
  return new Set(rows.map((r) => [r.variantAId, r.variantBId].sort().join("|")));
}

/** This session's comparisons per contrast key — matchmaking serves variety within a session. */
export async function getSessionContrastCounts(sessionId: string): Promise<Map<string, number>> {
  const grouped = await prisma.comparison.groupBy({
    by: ["contrastAttrs"],
    where: { sessionId },
    _count: { _all: true },
  });
  return new Map(grouped.map((g) => [g.contrastAttrs, g._count._all]));
}

/** Total comparisons logged per contrast key (e.g. "leadType"), for coverage balancing. */
export async function getContrastCounts(): Promise<Map<string, number>> {
  const grouped = await prisma.comparison.groupBy({ by: ["contrastAttrs"], _count: { _all: true } });
  return new Map(grouped.map((g) => [g.contrastAttrs, g._count._all]));
}

// ---------------------------------------------------------------------------
// Voting

export type VoteInput = {
  sessionId: string;
  segment: Segment;
  findingId: string;
  variantAId: string;
  variantBId: string;
  winnerId: string | null; // null = can't decide
  deckId: string | null;
  contrastAttrs: string;
  latencyMs: number;
  lowAttention: boolean;
  isRepeat: boolean;
  ipHash: string | null;
  userAgent: string | null;
  clientVoteId: string | null; // per-render uuid; a duplicate insert (retry/double-tap) is rejected by the unique index
};

export type VoteResult = {
  voteCount: number;
  xp: number;
  xpGained: { kind: string; amount: number }[];
  level: LevelInfo;
  leveledUp: boolean;
};

// Interactive-transaction budget for the two write paths (vote + drill). The
// Prisma defaults (maxWait 2s / timeout 5s) drop the transaction under write
// contention — a load test showed votes lost to "interactive transaction
// timeout" the moment several voters settled at once. For a votes ledger,
// waiting for the write lock is always correct over dropping the vote, so we
// widen both ceilings. Under normal operation these settle in single-digit ms
// and never approach the limits; on Postgres they're a rarely-touched safety
// margin, on SQLite they absorb the single-writer serialization. Pairs with
// withTxRetry: this covers "waited for the lock", retry covers "aborted after
// grabbing it".
const WRITE_TX_OPTS = { maxWait: 10_000, timeout: 15_000 } as const;

/** Top-2 most-starved craft attributes from the newest analysis snapshot. */
async function getStarvedAttrs(): Promise<Set<string>> {
  const snap = await prisma.analysisSnapshot.findFirst({ orderBy: { createdAt: "desc" } });
  if (!snap) return new Set();
  try {
    const cov = JSON.parse(snap.coverage) as { starvation?: { attr: string }[] };
    return new Set((cov.starvation ?? []).slice(0, 2).map((s) => s.attr));
  } catch {
    return new Set();
  }
}

/**
 * Atomically: log the comparison, apply the Elo update + win/loss counters
 * (skipped for "can't decide"), bump the session vote count, and settle XP.
 *
 * XP RULES (blinding-critical): every decided, non-repeat public vote earns
 * the identical base amount regardless of contrast type, so the reward stream
 * can never fingerprint the hidden fidelity contrast. Bonus kinds (coverage,
 * frontier, run, daily) are returned as generic labels, never attribute names.
 * XP is cosmetic — analytics never reads it.
 */
export async function recordVote(input: VoteInput): Promise<VoteResult> {
  // Gold check (outside the transaction — read-only): does this pair already
  // have a strong consensus among OTHER sessions' clean decided votes?
  let isGold = false;
  let agreesWithConsensus = false;
  let consensusShare = 0.5;
  if (input.winnerId && !input.isRepeat && !input.lowAttention) {
    const prior = await prisma.comparison.groupBy({
      by: ["winnerId"],
      where: {
        winnerId: { not: null },
        isRepeat: false,
        lowAttention: false,
        sessionId: { not: input.sessionId },
        OR: [
          { variantAId: input.variantAId, variantBId: input.variantBId },
          { variantAId: input.variantBId, variantBId: input.variantAId },
        ],
      },
      _count: { _all: true },
    });
    const total = prior.reduce((sum, g) => sum + g._count._all, 0);
    const top = prior.sort((a, b) => b._count._all - a._count._all)[0];
    if (top && total >= GOLD_MIN_N && top._count._all / total >= GOLD_MAJORITY) {
      isGold = true;
      agreesWithConsensus = top.winnerId === input.winnerId;
      consensusShare = top._count._all / total;
    }
  }

  // XP context reads (outside the transaction; races here cost at most a
  // duplicate small bonus, never correctness of the study data).
  const publicVote = input.deckId === null;
  const [starved, priorSameContrast, todayVotes] = publicVote
    ? await Promise.all([
        getStarvedAttrs(),
        prisma.comparison.count({
          where: { sessionId: input.sessionId, contrastAttrs: input.contrastAttrs },
        }),
        prisma.comparison.count({
          where: {
            sessionId: input.sessionId,
            createdAt: { gte: new Date(new Date().toISOString().slice(0, 10)) },
          },
        }),
      ])
    : [new Set<string>(), 1, 1];

  // Wrapped in withTxRetry: on Postgres a serialization/deadlock abort (P2034)
  // rolls the whole transaction back, so re-running it is safe and keeps the
  // vote in the ledger instead of dropping it as a 500. See tx-retry.ts.
  return withTxRetry(() =>
    prisma.$transaction(async (tx) => {
      const before = await tx.session.findUniqueOrThrow({ where: { id: input.sessionId } });
      await tx.comparison.create({
        data: {
          findingId: input.findingId,
          variantAId: input.variantAId,
          variantBId: input.variantBId,
          winnerId: input.winnerId,
          sessionId: input.sessionId,
          segment: input.segment,
          deckId: input.deckId,
          contrastAttrs: input.contrastAttrs,
          latencyMs: input.latencyMs,
          lowAttention: input.lowAttention,
          isRepeat: input.isRepeat,
          isGold,
          postDrill: before.drillCount > 0,
          ipHash: input.ipHash,
          userAgent: input.userAgent,
          clientVoteId: input.clientVoteId,
        },
      });

      // Repeats are non-independent (exhaustion fallback or a double-tap) — they
      // are logged for the seen-set but must not move ratings, matching their
      // exclusion from analytics and XP. Only clean decided votes touch Elo.
      if (input.winnerId && !input.isRepeat) {
        const loserId = input.winnerId === input.variantAId ? input.variantBId : input.variantAId;
        const [winner, loser] = await Promise.all([
          tx.variant.findUniqueOrThrow({ where: { id: input.winnerId } }),
          tx.variant.findUniqueOrThrow({ where: { id: loserId } }),
        ]);
        const next = eloUpdate(winner.elo, loser.elo);
        await Promise.all([
          tx.variant.update({
            where: { id: winner.id },
            data: { elo: next.winner, wins: { increment: 1 } },
          }),
          tx.variant.update({
            where: { id: loser.id },
            data: { elo: next.loser, losses: { increment: 1 } },
          }),
        ]);
      }

      // XP settlement. Base pay only for decided, non-repeat public votes;
      // bonus labels are generic on purpose (see function doc).
      const xpGained: { kind: string; amount: number }[] = [];
      if (publicVote && input.winnerId && !input.isRepeat) {
        xpGained.push({ kind: "vote", amount: XP.vote });
        if (priorSameContrast === 0) xpGained.push({ kind: "first_contrast", amount: XP.firstContrast });
        const attrs = input.contrastAttrs.split(",").filter(Boolean);
        if (attrs.length === 1 && starved.has(attrs[0]))
          xpGained.push({ kind: "frontier", amount: XP.frontier });
        if ((before.voteCount + 1) % 10 === 0)
          xpGained.push({ kind: "run_complete", amount: XP.runComplete });
        if (todayVotes === 0) xpGained.push({ kind: "daily", amount: XP.daily });
      }
      const xpTotal = xpGained.reduce((s, e) => s + e.amount, 0);
      if (xpTotal > 0) {
        await tx.xpEvent.createMany({
          data: xpGained.map((e) => ({
            sessionId: input.sessionId,
            kind: e.kind,
            amount: e.amount,
          })),
        });
      }

      const session = await tx.session.update({
        where: { id: input.sessionId },
        data: {
          voteCount: { increment: 1 },
          ...(xpTotal > 0 && { xp: { increment: xpTotal } }),
          ...(isGold && {
            goldCount: { increment: 1 },
            goldAgreement: { increment: agreesWithConsensus ? 1 : 0 },
            judgeAbility: updateAbility(before.judgeAbility, consensusShare, agreesWithConsensus),
          }),
        },
      });
      if (isGold && session.goldCount >= JUDGE_MIN_GOLD) {
        await tx.session.update({
          where: { id: input.sessionId },
          data: { judgeScore: session.goldAgreement / session.goldCount },
        });
      }
      const level = levelFor(session.xp);
      return {
        voteCount: session.voteCount,
        xp: session.xp,
        xpGained,
        level,
        leveledUp: level.level > levelFor(before.xp).level,
      };
    }, WRITE_TX_OPTS)
  );
}

// ---------------------------------------------------------------------------
// Personal results

/** A session's decided comparisons with both variants, for preference computation. */
export async function getSessionComparisons(sessionId: string): Promise<ComparisonWithVariants[]> {
  return prisma.comparison.findMany({
    where: { sessionId },
    include: { variantA: true, variantB: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Integrity reads for the vote route: rate limit + can't-decide throttle. */
export async function getRecentVoteStats(
  sessionId: string,
  windowSize: number
): Promise<{ votesLastMinute: number; recentWinners: (string | null)[] }> {
  const oneMinuteAgo = new Date(Date.now() - 60_000);
  const [votesLastMinute, recent] = await Promise.all([
    prisma.comparison.count({ where: { sessionId, createdAt: { gte: oneMinuteAgo } } }),
    prisma.comparison.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      take: windowSize,
      select: { winnerId: true },
    }),
  ]);
  return { votesLastMinute, recentWinners: recent.map((r) => r.winnerId) };
}

/** Has this session already voted on this (unordered) pair? */
export async function hasSeenPair(
  sessionId: string,
  variantAId: string,
  variantBId: string
): Promise<boolean> {
  const count = await prisma.comparison.count({
    where: {
      sessionId,
      OR: [
        { variantAId, variantBId },
        { variantAId: variantBId, variantBId: variantAId },
      ],
    },
  });
  return count > 0;
}

// ---------------------------------------------------------------------------
// Analytics reads (public results page + admin)

/**
 * Decided, attention-passing, non-repeat comparisons with both variants —
 * the only votes that count toward published stats. Fine to compute in-process
 * at current scale; revisit with materialized aggregates post-launch.
 */
export async function getAnalyticsComparisons(): Promise<ComparisonWithVariants[]> {
  // deckId null = the public study; private BYO decks never mix in.
  return prisma.comparison.findMany({
    where: { winnerId: { not: null }, lowAttention: false, isRepeat: false, deckId: null },
    include: { variantA: true, variantB: true },
  });
}

/** All decided comparisons (incl. low-attention/repeats) for the position-bias monitor. */
export async function getDecidedComparisonSlots(): Promise<
  { variantAId: string; winnerId: string | null }[]
> {
  return prisma.comparison.findMany({
    where: { winnerId: { not: null } },
    select: { variantAId: true, winnerId: true },
  });
}

/** sessionId -> judgeScore (null when unscored) for weighting robustness views. */
export async function getJudgeScores(): Promise<Map<string, number | null>> {
  const rows = await prisma.session.findMany({ select: { id: true, judgeScore: true } });
  return new Map(rows.map((r) => [r.id, r.judgeScore]));
}

/** Public-study votes per UTC day for the last `days` days (admin time series). */
export async function getVotesPerDay(days = 14): Promise<{ day: string; votes: number }[]> {
  const since = new Date(Date.now() - days * 86400_000);
  const rows = await prisma.comparison.findMany({
    where: { createdAt: { gte: since }, deckId: null },
    select: { createdAt: true },
  });
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const day = r.createdAt.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  return [...byDay.entries()].map(([day, votes]) => ({ day, votes })).sort((a, b) => a.day.localeCompare(b.day));
}

/** Findings with approved variants sorted by Elo, for the per-finding leaderboard. */
export async function getFindingsWithVariantStats(): Promise<(Finding & { variants: Variant[] })[]> {
  return prisma.finding.findMany({
    include: { variants: { where: { status: "approved" }, orderBy: { elo: "desc" } } },
  });
}

export async function getTotals(): Promise<{ comparisons: number; sessions: number }> {
  const [comparisons, sessions] = await Promise.all([
    prisma.comparison.count(),
    prisma.session.count(),
  ]);
  return { comparisons, sessions };
}

// ---------------------------------------------------------------------------
// BYO-data decks

export async function getDeckBySlug(slug: string) {
  return prisma.deck.findUnique({ where: { slug } });
}

export async function createDeckWithFinding(input: {
  deckName: string;
  ownerSessionId: string;
  finding: {
    title: string;
    domain: string;
    contextSnippet: string;
    sourceLabel: string;
    truthSummary: string;
  };
}) {
  const slug = `${input.deckName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32).replace(/^-|-$/g, "") || "deck"}-${Math.random().toString(36).slice(2, 8)}`;
  return prisma.deck.create({
    data: {
      slug,
      name: input.deckName.slice(0, 80),
      ownerSessionId: input.ownerSessionId,
      findings: { create: { ...input.finding, status: "submitted" } },
    },
    include: { findings: true },
  });
}

export async function getDeckWithStats(slug: string) {
  const deck = await prisma.deck.findUnique({
    where: { slug },
    include: { findings: { include: { variants: { where: { status: "approved" } } } } },
  });
  if (!deck) return null;
  const votes = await prisma.comparison.count({ where: { deckId: deck.id } });
  return { deck, votes };
}

/** Sanity helper for the vote route: both variants, verified to share a finding. */
export async function getVariantPair(
  variantAId: string,
  variantBId: string
): Promise<{ a: VariantWithFinding; b: VariantWithFinding } | null> {
  const [a, b] = await Promise.all([
    prisma.variant.findUnique({ where: { id: variantAId }, include: { finding: true } }),
    prisma.variant.findUnique({ where: { id: variantBId }, include: { finding: true } }),
  ]);
  if (!a || !b || a.findingId !== b.findingId || a.id === b.id) return null;
  return { a, b };
}

// ---------------------------------------------------------------------------
// Run review (learning loop, phase 1)

/** The session's most recent run: its last `take` public-study votes. */
export async function getLastRunComparisons(
  sessionId: string,
  take = 10
): Promise<ComparisonWithVariants[]> {
  const rows = await prisma.comparison.findMany({
    where: { sessionId, deckId: null },
    include: { variantA: true, variantB: true },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.reverse();
}

/**
 * Current consensus on an unordered pair among OTHER sessions' clean decided
 * votes. Used by the review to grade gold ("calibration") votes with today's
 * best estimate of the settled read.
 */
export async function getPairConsensus(
  variantAId: string,
  variantBId: string,
  excludeSessionId: string
): Promise<{ majorityWinnerId: string; share: number; n: number } | null> {
  const prior = await prisma.comparison.groupBy({
    by: ["winnerId"],
    where: {
      winnerId: { not: null },
      isRepeat: false,
      lowAttention: false,
      sessionId: { not: excludeSessionId },
      OR: [
        { variantAId, variantBId },
        { variantAId: variantBId, variantBId: variantAId },
      ],
    },
    _count: { _all: true },
  });
  const total = prior.reduce((sum, g) => sum + g._count._all, 0);
  const top = prior.sort((a, b) => b._count._all - a._count._all)[0];
  if (!top || total === 0 || !top.winnerId) return null;
  return { majorityWinnerId: top.winnerId, share: top._count._all / total, n: total };
}

// ---------------------------------------------------------------------------
// Overclaim drills (learning loop, phase 3). A separate world from the study:
// drill items are never served in the voting pool, attempts never touch
// analytics, and the only bridge is the postDrill stamp on later comparisons
// (so the fidelity analysis can cut naive vs trained judges).

export type { DrillItem };

/** Next active drill item this session hasn't attempted, chosen family-diverse:
 *  an overclaim family the learner hasn't faced yet is preferred over one they
 *  already have (TEACHING.md mastery model, bullet 1 — "cover all families
 *  before repeating one"), random within the preferred set; null when done.
 *  Server-only: overclaimFamily (fidelity vocabulary) never reaches a client
 *  bundle through repo.ts (Prisma-bound, guard-enforced). */
export async function getNextDrillItem(sessionId: string): Promise<{
  item: DrillItem | null;
  remaining: number;
  session: Session | null;
}> {
  const [attempts, session] = await Promise.all([
    prisma.drillAttempt.findMany({
      where: { sessionId },
      select: { drillItemId: true, item: { select: { device: true } } },
    }),
    prisma.session.findUnique({ where: { id: sessionId } }),
  ]);
  const seen = attempts.map((a) => a.drillItemId);
  const pool = await prisma.drillItem.findMany({
    where: { status: "active", id: { notIn: seen } },
  });
  if (pool.length === 0) return { item: null, remaining: 0, session };

  // Prefer an item whose overclaim family the learner hasn't faced yet, so a
  // short session touches distinct families before any repeat (mastery-model
  // bullet 1). Falls back to the full pool once every family has been seen, or
  // when only one family remains. This covers *unseen* families; steering
  // toward a learner's *missed* families + difficulty escalation still wait on
  // a deeper item pool (see TEACHING.md).
  const faced = new Set(attempts.map((a) => overclaimFamily(a.item.device).id));
  const fresh = pool.filter((it) => !faced.has(overclaimFamily(it.device).id));
  const choices = fresh.length > 0 ? fresh : pool;
  return {
    item: choices[Math.floor(Math.random() * choices.length)],
    remaining: pool.length,
    session,
  };
}

export async function getDrillItem(id: string): Promise<DrillItem | null> {
  return prisma.drillItem.findUnique({ where: { id } });
}

export type FamilyProgress = {
  id: OverclaimFamily["id"];
  name: string;
  attempted: number;
  caught: number;
};

/**
 * Per-family drill progress for a session: how many items of each overclaim
 * family the learner has faced and how many they caught. Each attempted item's
 * device string is classified into its family at read time (no schema change),
 * so this works on existing data. Returns all five families in canonical order
 * — including unpracticed ones (attempted 0) — so the skill map is complete;
 * `other` appears only if something classified there. Server-only: teaching.ts
 * (fidelity vocabulary) never enters a client bundle through this path.
 */
export async function getDrillFamilyProgress(sessionId: string): Promise<FamilyProgress[]> {
  const attempts = await prisma.drillAttempt.findMany({
    where: { sessionId },
    select: { correct: true, item: { select: { device: true } } },
  });
  const acc = new Map<OverclaimFamily["id"], { attempted: number; caught: number }>();
  for (const id of Object.keys(OVERCLAIM_FAMILIES) as OverclaimFamily["id"][]) {
    acc.set(id, { attempted: 0, caught: 0 });
  }
  for (const a of attempts) {
    const cell = acc.get(overclaimFamily(a.item.device).id)!;
    cell.attempted++;
    if (a.correct) cell.caught++;
  }
  const order: OverclaimFamily["id"][] = [
    "cause",
    "single_cause",
    "extrapolation",
    "certainty",
    "base_rate",
    "other",
  ];
  return order
    .filter((id) => id !== "other" || acc.get("other")!.attempted > 0)
    .map((id) => ({ id, name: OVERCLAIM_FAMILIES[id].name, ...acc.get(id)! }));
}

export async function hasAttemptedDrill(sessionId: string, drillItemId: string): Promise<boolean> {
  const n = await prisma.drillAttempt.count({ where: { sessionId, drillItemId } });
  return n > 0;
}

/** Atomically: log the attempt, move both Elo ratings, award XP if correct. */
export async function recordDrillAttempt(input: {
  sessionId: string;
  drillItemId: string;
  correct: boolean;
  latencyMs: number;
}): Promise<{ drillRating: number; ratingDelta: number; drillCount: number; xp: number }> {
  // Same contention guard as the vote path: a serialization/deadlock abort
  // rolls back, so the whole attempt closure is safe to re-run (drill data is
  // training-only, but a dropped Elo update would still corrupt the ladder).
  return withTxRetry(() =>
    prisma.$transaction(async (tx) => {
      const [session, item] = await Promise.all([
        tx.session.findUniqueOrThrow({ where: { id: input.sessionId } }),
        tx.drillItem.findUniqueOrThrow({ where: { id: input.drillItemId } }),
      ]);
      const next = drillElo(session.drillRating, item.rating, input.correct);
      await tx.drillAttempt.create({ data: input });
      await tx.drillItem.update({
        where: { id: item.id },
        data: { rating: next.item, attempts: { increment: 1 } },
      });
      if (input.correct) {
        await tx.xpEvent.create({
          data: { sessionId: input.sessionId, kind: "drill", amount: XP.drill },
        });
      }
      const updated = await tx.session.update({
        where: { id: input.sessionId },
        data: {
          drillRating: next.session,
          drillCount: { increment: 1 },
          ...(input.correct && { xp: { increment: XP.drill } }),
        },
      });
      return {
        drillRating: updated.drillRating,
        ratingDelta: next.session - session.drillRating,
        drillCount: updated.drillCount,
        xp: updated.xp,
      };
    }, WRITE_TX_OPTS)
  );
}

// ---------------------------------------------------------------------------
// Share-loop funnel (launch kit)

/** Log a share tap. Amount 0: the XP ledger doubles as an event log here —
 * shares are measured, never rewarded (rewarding them invites spam). */
export async function logShare(sessionId: string): Promise<void> {
  await prisma.xpEvent.create({ data: { sessionId, kind: "share", amount: 0 } });
}

export type Funnel = {
  sessions: number;
  voted: number; // >=1 vote
  completed: number; // >=10 votes (saw the payoff moment)
  sharers: number; // distinct sessions with a share tap
  topReferrers: { referrer: string; sessions: number }[];
  topUtm: { utmSource: string; sessions: number }[];
};

export async function getFunnel(): Promise<Funnel> {
  const [sessions, voted, completed, shareEvents, refs, utms] = await Promise.all([
    prisma.session.count(),
    prisma.session.count({ where: { voteCount: { gt: 0 } } }),
    prisma.session.count({ where: { voteCount: { gte: 10 } } }),
    prisma.xpEvent.findMany({ where: { kind: "share" }, select: { sessionId: true } }),
    prisma.session.groupBy({
      by: ["referrer"],
      where: { referrer: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
    prisma.session.groupBy({
      by: ["utmSource"],
      where: { utmSource: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
  ]);
  return {
    sessions,
    voted,
    completed,
    sharers: new Set(shareEvents.map((e) => e.sessionId)).size,
    topReferrers: refs.map((r) => ({ referrer: r.referrer!, sessions: r._count._all })),
    topUtm: utms.map((u) => ({ utmSource: u.utmSource!, sessions: u._count._all })),
  };
}

// ---------------------------------------------------------------------------
// Public taste profiles (launch kit)

/** Idempotent publish: mint a short public slug for the session's poster. */
export async function publishProfile(sessionId: string): Promise<string | null> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return null;
  if (session.publicSlug) return session.publicSlug;
  // Opaque short id; retry on the (astronomically unlikely) collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = Math.random().toString(36).slice(2, 10);
    try {
      await prisma.session.update({ where: { id: sessionId }, data: { publicSlug: slug } });
      return slug;
    } catch {
      continue;
    }
  }
  return null;
}

export async function getSessionByPublicSlug(slug: string): Promise<Session | null> {
  return prisma.session.findUnique({ where: { publicSlug: slug } });
}
