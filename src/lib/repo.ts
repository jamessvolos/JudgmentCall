// Repository module: ALL database access goes through here so the SQLite →
// Postgres swap (Milestone 4) is a datasource config change, not a refactor.
// Nothing outside src/lib should import prisma directly.

import { prisma } from "./db";
import { eloUpdate } from "./elo";
import { GOLD_MAJORITY, GOLD_MIN_N, JUDGE_MIN_GOLD, type Segment } from "./types";
import type { Finding, Variant, Comparison, Session } from "@prisma/client";

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
export async function getFindingComparisonCounts(
  deckId: string | null = null
): Promise<{ findingId: string; count: number }[]> {
  const findings = await prisma.finding.findMany({
    where: { deckId, status: { in: ["active", "submitted"] } },
    select: { id: true },
  });
  const grouped = await prisma.comparison.groupBy({ by: ["findingId"], _count: { _all: true } });
  const counts = new Map(grouped.map((g) => [g.findingId, g._count._all]));
  return findings.map((f) => ({ findingId: f.id, count: counts.get(f.id) ?? 0 }));
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
};

/**
 * Atomically: log the comparison, apply the Elo update + win/loss counters
 * (skipped for "can't decide"), and bump the session vote count.
 * Returns the new session vote count.
 */
export async function recordVote(input: VoteInput): Promise<{ voteCount: number }> {
  // Gold check (outside the transaction — read-only): does this pair already
  // have a strong consensus among OTHER sessions' clean decided votes?
  let isGold = false;
  let agreesWithConsensus = false;
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
    }
  }

  return prisma.$transaction(async (tx) => {
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
        ipHash: input.ipHash,
        userAgent: input.userAgent,
      },
    });

    if (input.winnerId) {
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

    const session = await tx.session.update({
      where: { id: input.sessionId },
      data: {
        voteCount: { increment: 1 },
        ...(isGold && {
          goldCount: { increment: 1 },
          goldAgreement: { increment: agreesWithConsensus ? 1 : 0 },
        }),
      },
    });
    if (isGold && session.goldCount >= JUDGE_MIN_GOLD) {
      await tx.session.update({
        where: { id: input.sessionId },
        data: { judgeScore: session.goldAgreement / session.goldCount },
      });
    }
    return { voteCount: session.voteCount };
  });
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
