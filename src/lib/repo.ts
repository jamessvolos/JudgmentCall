// Repository module: ALL database access goes through here so the SQLite →
// Postgres swap (Milestone 4) is a datasource config change, not a refactor.
// Nothing outside src/lib should import prisma directly.

import { prisma } from "./db";
import { eloUpdate } from "./elo";
import type { Segment } from "./types";
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
export async function getFindingComparisonCounts(): Promise<{ findingId: string; count: number }[]> {
  const findings = await prisma.finding.findMany({ select: { id: true } });
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
  return prisma.$transaction(async (tx) => {
    await tx.comparison.create({
      data: {
        findingId: input.findingId,
        variantAId: input.variantAId,
        variantBId: input.variantBId,
        winnerId: input.winnerId,
        sessionId: input.sessionId,
        segment: input.segment,
        contrastAttrs: input.contrastAttrs,
        latencyMs: input.latencyMs,
        lowAttention: input.lowAttention,
        isRepeat: input.isRepeat,
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
      data: { voteCount: { increment: 1 } },
    });
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

/** Sanity helper for the vote route: both variants, verified to share a finding. */
export async function getVariantPair(
  variantAId: string,
  variantBId: string
): Promise<{ a: Variant; b: Variant } | null> {
  const [a, b] = await Promise.all([
    prisma.variant.findUnique({ where: { id: variantAId } }),
    prisma.variant.findUnique({ where: { id: variantBId } }),
  ]);
  if (!a || !b || a.findingId !== b.findingId || a.id === b.id) return null;
  return { a, b };
}
