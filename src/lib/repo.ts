// Repository module: ALL database access goes through here so the SQLite →
// Postgres swap (Milestone 4) is a datasource config change, not a refactor.
// Nothing outside src/lib should import prisma directly.

import { createHash } from "crypto";
import { prisma } from "./db";
import { eloUpdate } from "./elo";
import { GOLD_MAJORITY, GOLD_MIN_N, JUDGE_MIN_GOLD, type Segment } from "./types";
import { XP, drillElo, levelFor, updateAbility, type LevelInfo } from "./progression";
// teaching.ts holds fidelity vocabulary but is a pure module; imported here on
// the SERVER only (repo.ts uses Prisma, so it never enters a client bundle) to
// classify drill devices into families. The bundle guard enforces this.
import { withTxRetry } from "./tx-retry";
import { FIDELITY_SKILLS } from "./teaching";
import {
  conferrals,
  gradeFor,
  type Conferral,
  type CredAttempt,
} from "./drill-credentials";
import {
  examPick,
  examSkillFor,
  examSlot,
  examStanding,
  examTargetDifficulty,
  EXAM_LENGTH,
  type ExamStanding,
} from "./drill-exam";
import type { Finding, Variant, Comparison, Session, DrillItem, QuizItem } from "@prisma/client";
import {
  getTrack,
  liveRating as foldLiveRating,
  levelStanding,
  badgeConferrals,
  topicProgress,
  calibration,
  type QuizRow,
  type LevelStanding,
  type Conferral as QuizConferral,
  type TopicProgress,
  type Calibration,
} from "./train-tracks";

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

      // Repeats are non-independent (exhaustion fallback or a double-tap) and
      // low-attention taps (< the latency floor) are flagged junk — both are
      // logged for the record but must not move ratings, matching their
      // exclusion from analytics and XP. The Elo leaderboard and its W–L /
      // win-share are PUBLISHED numbers (/results §04), so the intake rule is
      // uniform: a flagged vote never moves any published number. Only clean
      // decided votes touch Elo. (STUDY-INTEGRITY.md risk #2, closed.)
      if (input.winnerId && !input.isRepeat && !input.lowAttention) {
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

/** Next active drill item this session hasn't attempted, chosen by a three-tier
 *  mastery-model policy (TEACHING.md):
 *   1. an item whose SKILL the learner hasn't faced yet ("cover all before
 *      repeating one" — bullet 1); else
 *   2. an item in a skill the learner has faced but MISSED (caught < attempted),
 *      biased toward the most-missed skills ("extra reps on missed skills" —
 *      bullet 2); else
 *   3. anything left.
 *  Within the chosen tier, selection leans softly toward items near the learner's
 *  drill rating so difficulty ramps (bullet 3, partial). null when done.
 *  Also returns the session's per-skill progress, tallied from the SAME attempts
 *  scan (so /api/drill needn't read drillAttempt a second time for the recap).
 *  Server-only (Prisma-bound); no fidelity vocabulary crosses into a client bundle. */
/** Deterministic PRNG from a sha256 seed — the Daily Docket's draw. Same
 *  session + same UTC date + same progress ⇒ same docket; no reroll-shopping.
 *  (mulberry32 over the digest's first 4 bytes; no dependency.) */
export function docketRand(sessionId: string, seenCount: number): () => number {
  const digest = createHash("sha256")
    .update(`${sessionId}:${new Date().toISOString().slice(0, 10)}:${seenCount}`)
    .digest();
  let a = digest.readUInt32LE(0);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SittingInfo = { position: number; total: number; correctSoFar: number };
export type ExamBlocked = { reason: "sat_today" } | { reason: "exhausted"; skill: string };

export async function getNextDrillItem(
  sessionId: string,
  opts?: { mode?: string; skill?: string; docket?: boolean; caseId?: string; exam?: boolean }
): Promise<{
  item: DrillItem | null;
  remaining: number;
  session: Session | null;
  skillProgress: SkillProgressRow[];
  sitting?: SittingInfo;
  examBlocked?: ExamBlocked;
}> {
  const [attempts, session] = await Promise.all([
    prisma.drillAttempt.findMany({
      where: { sessionId },
      select: {
        drillItemId: true,
        correct: true,
        mode: true,
        createdAt: true,
        item: { select: { skill: true } },
      },
    }),
    prisma.session.findUnique({ where: { id: sessionId } }),
  ]);
  // Per-skill recap map, derived from the attempts we just fetched — no second scan.
  const skillProgress = tallySkillProgress(attempts);

  // CASE FILE sitting — the attempt rows are the state machine: serve the
  // lowest-caseSeq unattempted item, in the author's order, no draw.
  if (opts?.caseId) {
    const items = await prisma.drillItem.findMany({
      where: { status: "active", caseId: opts.caseId },
      orderBy: { caseSeq: "asc" },
    });
    const byId = new Set(items.map((it) => it.id));
    const caseAttempts = attempts.filter((a) => byId.has(a.drillItemId));
    const answered = new Set(caseAttempts.map((a) => a.drillItemId));
    const nextItem = items.find((it) => !answered.has(it.id)) ?? null;
    const sitting: SittingInfo = {
      position: Math.min(answered.size + 1, items.length),
      total: items.length,
      correctSoFar: caseAttempts.filter((a) => a.correct).length,
    };
    return {
      item: nextItem,
      remaining: items.length - answered.size,
      session,
      skillProgress,
      sitting,
    };
  }

  // THE CHECKPOINT — form arithmetic over exam-mode rows; unseen-by-any-mode,
  // near-band floored at d2, deterministically dealt. Refusals are honest and
  // typed; a seen item is never substituted.
  if (opts?.exam) {
    const examRows = attempts.filter((a) => a.mode === "exam");
    const { form, position } = examSlot(examRows.length);
    const standing = examStanding(
      examRows.map((a) => ({ correct: a.correct, createdAt: a.createdAt, mode: "exam" }))
    );
    if (position === 0 && standing.satToday) {
      return { item: null, remaining: 0, session, skillProgress, examBlocked: { reason: "sat_today" } };
    }
    const skill = examSkillFor(position);
    const seenIds = attempts.map((a) => a.drillItemId);
    const candidates = await prisma.drillItem.findMany({
      where: { status: "active", caseId: "", skill, id: { notIn: seenIds } },
      select: { id: true, difficulty: true, rating: true },
    });
    const rating = session?.drillRating ?? 1200;
    const pick = examPick(candidates, rating, sessionId, form, skill);
    if (!pick) {
      return { item: null, remaining: 0, session, skillProgress, examBlocked: { reason: "exhausted", skill } };
    }
    const item = await prisma.drillItem.findUnique({ where: { id: pick.id } });
    const sitting: SittingInfo = {
      position: position + 1,
      total: EXAM_LENGTH,
      correctSoFar: examRows.slice(form * EXAM_LENGTH).filter((a) => a.correct).length,
    };
    return { item, remaining: EXAM_LENGTH - position, session, skillProgress, sitting };
  }

  let pool: DrillItem[];
  if (opts?.mode === "field") {
    // FIELD READ — an attempt mode over the existing fidelity spot pool, not an
    // item mode. Exclusions: items this session already field-read, and items
    // touched today in ANY mode (a same-day rerun is a memory test, not a read).
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const fieldSeen = new Set(attempts.filter((a) => a.mode === "field").map((a) => a.drillItemId));
    const todaySeen = new Set(
      attempts.filter((a) => a.createdAt >= dayStart).map((a) => a.drillItemId)
    );
    const all = await prisma.drillItem.findMany({
      where: {
        status: "active",
        caseId: "",
        mode: "spot",
        skill: { in: [...FIDELITY_SKILLS] },
        ...(opts?.skill ? { skill: opts.skill } : {}),
      },
    });
    const eligible = all.filter((it) => !fieldSeen.has(it.id) && !todaySeen.has(it.id));
    // Re-test tier first: items met before in another mode — the field read as
    // the room's spaced-repetition layer. Fresh items are the fallback.
    const priorIds = new Set(attempts.filter((a) => a.mode !== "field").map((a) => a.drillItemId));
    const retest = eligible.filter((it) => priorIds.has(it.id));
    pool = retest.length > 0 ? retest : eligible;
    if (pool.length === 0) return { item: null, remaining: 0, session, skillProgress };
  } else {
    const seen = attempts.map((a) => a.drillItemId);
    pool = await prisma.drillItem.findMany({
      where: {
        status: "active",
        caseId: "",
        id: { notIn: seen },
        ...(opts?.mode ? { mode: opts.mode } : {}),
        ...(opts?.skill ? { skill: opts.skill } : {}),
      },
    });
    if (pool.length === 0) return { item: null, remaining: 0, session, skillProgress };
  }

  // Per-skill history: how many of each skill the learner faced and caught, so
  // we can tell an unfaced skill from a faced-but-missed one.
  const skillStats = new Map<string, { attempted: number; caught: number }>();
  for (const a of attempts) {
    const key = a.item.skill;
    const cell = skillStats.get(key) ?? { attempted: 0, caught: 0 };
    cell.attempted++;
    if (a.correct) cell.caught++;
    skillStats.set(key, cell);
  }
  const missesFor = (skill: string) => {
    const s = skillStats.get(skill);
    return s ? s.attempted - s.caught : 0;
  };

  // Tier the pool. Bullet 1 first: cover skills never faced. Only once every
  // skill has been seen do we spend reps on the ones the learner MISSED
  // (bullet 2) — reinforcement lands on weak spots, not random survivors.
  const fresh = pool.filter((it) => !skillStats.has(it.skill));
  const weak = pool.filter((it) => missesFor(it.skill) > 0);
  const candidates = fresh.length > 0 ? fresh : weak.length > 0 ? weak : pool;
  const weakTier = fresh.length === 0 && weak.length > 0;

  const rating = session?.drillRating ?? 1200;
  // Difficulty ladder (mastery bullet 3): ramp the TARGET difficulty tier with
  // the learner's demonstrated competence, and weight items by how close their
  // AUTHORED difficulty (1 obvious .. 3 subtle) sits to it — so a learner meets
  // the obvious overclaims first and only climbs to the subtle ones once they've
  // cleared the easy tier. The drill rating self-gates the climb: it rises ~16
  // per catch and falls ~16 per miss (K=32 at parity), so a struggling learner
  // stays on tier 1 while a reliable one advances. Authored difficulty is the
  // signal that matters here — the item Elo `rating` sits near its 1200 default
  // until items accrue attempts, so it only *refines* the match once data exists.
  // EXAM-CERTIFIED re-aims the selector (expert placement): a certified
  // session stops being dealt d1 warm-ups. Selection, not measurement.
  const certified =
    examStanding(
      attempts
        .filter((a) => a.mode === "exam")
        .map((a) => ({ correct: a.correct, createdAt: a.createdAt, mode: "exam" }))
    ).passedAt !== null;
  const ladderTarget = rating < 1240 ? 1 : rating < 1340 ? 2 : 3;
  const targetDifficulty = certified ? examTargetDifficulty(rating) : ladderTarget;
  const weighted = candidates.map((it) => {
    // Primary: proximity of the item's authored tier to the target (1, .5, .33).
    const diffCloseness = 1 / (1 + Math.abs(it.difficulty - targetDifficulty));
    // Secondary refiner: item-rating closeness, meaningful once ratings diverge.
    const eloCloseness = 1 / (1 + Math.abs(it.rating - rating) / 400);
    // In the weak tier, give the most-missed skills proportionally more reps so
    // a skill missed twice is retried harder than one missed once.
    const missBoost = weakTier ? 0.5 * missesFor(it.skill) : 0;
    return { it, w: 0.15 + diffCloseness + 0.35 * eloCloseness + missBoost };
  });
  const total = weighted.reduce((s, x) => s + x.w, 0);
  const rand = opts?.docket ? docketRand(sessionId, attempts.length) : Math.random;
  let roll = rand() * total;
  let chosen = weighted[0].it;
  for (const x of weighted) {
    roll -= x.w;
    if (roll <= 0) {
      chosen = x.it;
      break;
    }
  }
  return { item: chosen, remaining: pool.length, session, skillProgress };
}

export type SkillProgressRow = { id: string; attempted: number; caught: number };

/**
 * Per-skill caught/attempted tally from a session's already-fetched attempts,
 * keyed off each item's stored `skill` (an empty default folds to "unknown").
 * Pure (no DB) so getNextDrillItem can hand the /api/drill recap its skill map
 * from the SAME drillAttempt scan it makes for selection, instead of a second
 * identical read. The client merges the result against the full SKILLS registry
 * so the map is complete. Server-only — no teaching vocabulary here.
 */
function tallySkillProgress(
  attempts: { correct: boolean; item: { skill: string } }[]
): SkillProgressRow[] {
  const acc = new Map<string, { attempted: number; caught: number }>();
  for (const a of attempts) {
    const key = a.item.skill || "unknown";
    const cell = acc.get(key) ?? { attempted: 0, caught: 0 };
    cell.attempted++;
    if (a.correct) cell.caught++;
    acc.set(key, cell);
  }
  return [...acc.entries()].map(([id, v]) => ({ id, ...v }));
}

export async function getDrillItem(id: string): Promise<DrillItem | null> {
  return prisma.drillItem.findUnique({ where: { id } });
}

export async function hasAttemptedDrill(
  sessionId: string,
  drillItemId: string,
  opts?: { field?: boolean }
): Promise<boolean> {
  // Field reads are a distinct attempt mode: a field POST is blocked only by a
  // prior field attempt on the item (the re-serve is the point); any other
  // POST is blocked by any prior attempt (unchanged strictness).
  const n = await prisma.drillAttempt.count({
    where: { sessionId, drillItemId, ...(opts?.field ? { mode: "field" } : {}) },
  });
  return n > 0;
}

/** Write-once naming-beat persistence: stamp the pair's latest un-named attempt.
 *  Formative by construction — touches nothing but the namedSkill column. */
export async function recordDrillNaming(
  sessionId: string,
  drillItemId: string,
  namedSkill: string
): Promise<void> {
  const latest = await prisma.drillAttempt.findFirst({
    where: { sessionId, drillItemId, namedSkill: null },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!latest) return;
  await prisma.drillAttempt.update({ where: { id: latest.id }, data: { namedSkill } });
}

/** The Record: grades + credentials, derived fresh from the attempt rows on
 *  every read. Nothing stored, nothing to desync. */
export type CaseStanding = {
  id: string;
  answered: number;
  total: number;
  correct: number;
  filedAt: Date | null;
};

export async function getDrillStanding(sessionId: string): Promise<{
  grade: ReturnType<typeof gradeFor>;
  credentials: Conferral[];
  exam: ExamStanding;
  cases: CaseStanding[];
}> {
  const [rows, session, caseTotals] = await Promise.all([
    prisma.drillAttempt.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      select: {
        drillItemId: true,
        correct: true,
        createdAt: true,
        ratingAfter: true,
        namedSkill: true,
        mode: true,
        item: { select: { skill: true, difficulty: true, mode: true, caseId: true } },
      },
    }),
    prisma.session.findUnique({ where: { id: sessionId }, select: { drillRating: true } }),
    prisma.drillItem.groupBy({
      by: ["caseId"],
      where: { caseId: { not: "" }, status: "active" },
      _count: { _all: true },
    }),
  ]);
  const attempts = rows as (CredAttempt & { item: { caseId: string } })[];
  const liveRating = session?.drillRating ?? 1200;

  // FILED is derived, never stored: every item of the case attempted.
  const cases: CaseStanding[] = caseTotals.map((c) => {
    const caseRows = attempts.filter((a) => a.item.caseId === c.caseId);
    const total = c._count._all;
    const answered = new Set(caseRows.map((a) => a.drillItemId)).size;
    return {
      id: c.caseId,
      answered,
      total,
      correct: caseRows.filter((a) => a.correct).length,
      filedAt:
        answered >= total && caseRows.length > 0
          ? caseRows.reduce((m, a) => (a.createdAt > m ? a.createdAt : m), caseRows[0].createdAt)
          : null,
    };
  });

  return {
    grade: gradeFor(attempts, liveRating),
    credentials: conferrals(sessionId, attempts),
    exam: examStanding(attempts.map((a) => ({ correct: a.correct, createdAt: a.createdAt, mode: a.mode }))),
    cases,
  };
}

/** Atomically: log the attempt, move both Elo ratings, award XP if correct. */
export async function recordDrillAttempt(input: {
  sessionId: string;
  drillItemId: string;
  correct: boolean;
  latencyMs: number;
  mode?: string; // "" = the item's own mode; "field" = single-telling re-serve
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
      await tx.drillAttempt.create({
        data: {
          sessionId: input.sessionId,
          drillItemId: input.drillItemId,
          correct: input.correct,
          latencyMs: input.latencyMs,
          mode: input.mode ?? "",
          // the post-settle rating, written where the value already exists —
          // makes grade certification a monotone fold over rows (The Record).
          ratingAfter: next.session,
        },
      });
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
// TRAINING TRACKS (statistics, architecture) — an isolated multiple-choice
// world. Same Elo settle as the drill (drillElo), but the session-side rating
// lives entirely in QuizAttempt.ratingAfter — nothing on Session — so a track's
// whole standing (rating, level, badges, topic map) is a pure fold over its
// rows (src/lib/train-tracks.ts). Never touches the study or the overclaim drill.

/** A session's ordered attempt ledger for one track, projected to the fold shape. */
async function quizRows(sessionId: string, track: string): Promise<QuizRow[]> {
  const rows = await prisma.quizAttempt.findMany({
    where: { sessionId, track },
    orderBy: { createdAt: "asc" },
    select: {
      quizItemId: true,
      topic: true,
      difficulty: true,
      correct: true,
      confidence: true,
      ratingAfter: true,
      createdAt: true,
    },
  });
  return rows;
}

export async function getQuizItem(id: string): Promise<QuizItem | null> {
  return prisma.quizItem.findUnique({ where: { id } });
}

export async function hasAttemptedQuiz(sessionId: string, quizItemId: string): Promise<boolean> {
  const n = await prisma.quizAttempt.count({ where: { sessionId, quizItemId } });
  return n > 0;
}

/**
 * Serve the next quiz item for a track: skip everything the session has already
 * answered, prefer topics not yet faced (curriculum coverage), then weight by a
 * difficulty ladder + item-rating closeness — the same self-gating climb the
 * drill uses, so a reliable learner advances to the subtle calls and a
 * struggling one stays on the foundational tier.
 */
export async function getNextQuizItem(
  sessionId: string,
  track: string,
  opts?: { topic?: string }
): Promise<{ item: QuizItem | null; remaining: number; liveRating: number; count: number }> {
  const [rows, items] = await Promise.all([
    quizRows(sessionId, track),
    prisma.quizItem.findMany({
      where: { track, status: "active", ...(opts?.topic ? { topic: opts.topic } : {}) },
    }),
  ]);
  const rating = foldLiveRating(rows);
  const attempted = new Set(rows.map((r) => r.quizItemId));
  const pool = items.filter((it) => !attempted.has(it.id));
  if (pool.length === 0) {
    return { item: null, remaining: 0, liveRating: Math.round(rating), count: rows.length };
  }
  // Coverage first: unfaced topics before reinforcement (unless a topic filter
  // already narrowed the pool).
  const faced = new Set(rows.map((r) => r.topic));
  const fresh = opts?.topic ? [] : pool.filter((it) => !faced.has(it.topic));
  const candidates = fresh.length > 0 ? fresh : pool;
  const targetDifficulty = rating < 1300 ? 1 : rating < 1420 ? 2 : 3;
  const weighted = candidates.map((it) => {
    const diffCloseness = 1 / (1 + Math.abs(it.difficulty - targetDifficulty));
    const eloCloseness = 1 / (1 + Math.abs(it.rating - rating) / 400);
    return { it, w: 0.15 + diffCloseness + 0.35 * eloCloseness };
  });
  const total = weighted.reduce((s, x) => s + x.w, 0);
  let roll = Math.random() * total;
  let chosen = weighted[0].it;
  for (const x of weighted) {
    roll -= x.w;
    if (roll <= 0) {
      chosen = x.it;
      break;
    }
  }
  return { item: chosen, remaining: pool.length, liveRating: Math.round(rating), count: rows.length };
}

/** Atomically: settle both Elo ratings and log the attempt. The current
 *  session-side rating is the last ratingAfter for (session, track); the new
 *  one is written onto this row, so The Record stays a fold with nothing on
 *  Session to desync. */
export async function recordQuizAttempt(input: {
  sessionId: string;
  quizItemId: string;
  track: string;
  topic: string;
  difficulty: number;
  correct: boolean;
  choiceIndex: number;
  confidence: number | null;
  latencyMs: number;
}): Promise<{ liveRating: number; ratingDelta: number; count: number }> {
  return withTxRetry(() =>
    prisma.$transaction(async (tx) => {
      const item = await tx.quizItem.findUniqueOrThrow({ where: { id: input.quizItemId } });
      const last = await tx.quizAttempt.findFirst({
        where: { sessionId: input.sessionId, track: input.track },
        orderBy: { createdAt: "desc" },
        select: { ratingAfter: true },
      });
      const current = last?.ratingAfter ?? 1200;
      const next = drillElo(current, item.rating, input.correct);
      await tx.quizAttempt.create({
        data: {
          sessionId: input.sessionId,
          quizItemId: input.quizItemId,
          track: input.track,
          topic: input.topic,
          difficulty: input.difficulty,
          correct: input.correct,
          choiceIndex: input.choiceIndex,
          confidence: input.confidence,
          latencyMs: input.latencyMs,
          ratingAfter: next.session,
        },
      });
      await tx.quizItem.update({
        where: { id: item.id },
        data: { rating: next.item, attempts: { increment: 1 } },
      });
      const count = await tx.quizAttempt.count({
        where: { sessionId: input.sessionId, track: input.track },
      });
      return { liveRating: next.session, ratingDelta: next.session - current, count };
    }, WRITE_TX_OPTS)
  );
}

export type QuizStanding = {
  liveRating: number;
  count: number;
  level: LevelStanding;
  badges: QuizConferral[];
  topics: TopicProgress[];
  calibration: Calibration;
};

/** The Record for a track — level, badges, topic map, calibration — a pure fold. */
export async function getQuizStanding(sessionId: string, track: string): Promise<QuizStanding | null> {
  const t = getTrack(track);
  if (!t) return null;
  const rows = await quizRows(sessionId, track);
  return {
    liveRating: Math.round(foldLiveRating(rows)),
    count: rows.length,
    level: levelStanding(t, rows),
    badges: badgeConferrals(t, rows),
    topics: topicProgress(t, rows),
    calibration: calibration(rows),
  };
}

/** Live "The Room" tally for a duel item — how everyone who has faced it picked
 *  (choiceIndex 0 = Design A, 1 = Design B). Powers the You / Room / Desk reveal. */
export async function getDuelTally(quizItemId: string): Promise<{ a: number; b: number; total: number }> {
  const rows = await prisma.quizAttempt.groupBy({
    by: ["choiceIndex"],
    where: { quizItemId },
    _count: { _all: true },
  });
  let a = 0;
  let b = 0;
  for (const r of rows) {
    if (r.choiceIndex === 0) a = r._count._all;
    else if (r.choiceIndex === 1) b = r._count._all;
  }
  return { a, b, total: a + b };
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
