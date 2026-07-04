import { createHash } from "crypto";
import { NextResponse } from "next/server";
import {
  getRecentVoteStats,
  getSession,
  getVariantPair,
  hasSeenPair,
  recordVote,
} from "@/lib/repo";
import { contrastKey, selectPair, serializePair } from "@/lib/matchmaking";
import { levelFor } from "@/lib/progression";
import {
  attributeDiff,
  CANT_DECIDE_MAX_IN_WINDOW,
  CANT_DECIDE_WINDOW,
  LOW_ATTENTION_MS,
  MAX_VOTES_PER_MINUTE,
  RESULTS_AT_VOTES,
  type AttributeProfile,
  type Segment,
} from "@/lib/types";

// Salted, non-reversible IP digest for post-hoc sybil forensics. The salt is
// deployment-local; without it (dev) we still hash so raw IPs never land in
// the DB.
function hashIp(request: Request): string | null {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!ip) return null;
  let salt = process.env.IP_HASH_SALT;
  if (!salt) {
    // A publicly-known salt makes the digest dictionary-attackable, so in
    // production we store nothing rather than a false sense of hashing.
    if (process.env.NODE_ENV === "production") return null;
    salt = "judgment-call-dev-salt";
  }
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

// POST /api/vote — record a comparison and apply the Elo update.
// Body: { sessionId, variantAId, variantBId, winnerId | null, latencyMs }
// winnerId === null means "can't decide": logged, no rating change.
//
// Integrity rules (spec §9):
// - Hard cap of MAX_VOTES_PER_MINUTE per session (429).
// - "Can't decide" is throttled: more than CANT_DECIDE_MAX_IN_WINDOW of the
//   last CANT_DECIDE_WINDOW votes undecided → the next undecided vote is
//   rejected with code "cant_decide_throttled" (the client asks for a pick).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { sessionId, variantAId, variantBId, winnerId, latencyMs, clientVoteId } = body ?? {};

  if (
    typeof sessionId !== "string" ||
    typeof variantAId !== "string" ||
    typeof variantBId !== "string" ||
    (winnerId !== null && winnerId !== variantAId && winnerId !== variantBId) ||
    (clientVoteId !== undefined && clientVoteId !== null && typeof clientVoteId !== "string")
  ) {
    return NextResponse.json({ error: "invalid vote payload" }, { status: 400 });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "unknown session" }, { status: 404 });
  }

  const stats = await getRecentVoteStats(sessionId, CANT_DECIDE_WINDOW);
  if (stats.votesLastMinute >= MAX_VOTES_PER_MINUTE) {
    return NextResponse.json(
      { error: "too many votes, slow down", code: "rate_limited" },
      { status: 429 }
    );
  }
  if (winnerId === null) {
    const recentUndecided = stats.recentWinners.filter((w) => w === null).length;
    if (recentUndecided >= CANT_DECIDE_MAX_IN_WINDOW) {
      return NextResponse.json(
        { error: "make a call this time", code: "cant_decide_throttled" },
        { status: 429 }
      );
    }
  }

  const pair = await getVariantPair(variantAId, variantBId);
  if (!pair) {
    return NextResponse.json({ error: "invalid variant pair" }, { status: 400 });
  }

  // Contrast is computed server-side from the stored tags — never trusted
  // from the client. Repeat detection must run BEFORE the vote is logged.
  const isRepeat = await hasSeenPair(sessionId, variantAId, variantBId);
  const contrastAttrs = contrastKey(
    attributeDiff(pair.a as unknown as AttributeProfile, pair.b as unknown as AttributeProfile)
  );

  const latency = Number.isFinite(latencyMs) ? Math.max(0, Math.round(latencyMs)) : 0;

  let result;
  try {
    result = await recordVote({
      sessionId,
      segment: session.segment as Segment,
      findingId: pair.a.findingId,
      deckId: pair.a.finding.deckId,
      variantAId,
      variantBId,
      winnerId,
      contrastAttrs,
      latencyMs: latency,
      lowAttention: latency < LOW_ATTENTION_MS,
      isRepeat,
      ipHash: hashIp(request),
      userAgent: request.headers.get("user-agent")?.slice(0, 256) ?? null,
      clientVoteId: typeof clientVoteId === "string" ? clientVoteId : null,
    });
  } catch (e) {
    // A retried or double-tapped vote carries the same clientVoteId; the
    // unique index rejects the second insert (P2002) and the whole settle
    // rolls back. Return the session's current state so the client advances
    // exactly once — no double Elo, no double XP, no second row.
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      const s = await getSession(sessionId);
      const nextPair =
        s && s.voteCount !== RESULTS_AT_VOTES
          ? await selectPair(sessionId, pair.a.finding.deckId).then((p) =>
              p ? serializePair(p, s.voteCount) : null
            )
          : null;
      return NextResponse.json({
        voteCount: s?.voteCount ?? 0,
        xp: s?.xp ?? 0,
        xpGained: [],
        level: levelFor(s?.xp ?? 0),
        leveledUp: false,
        duplicate: true,
        nextPair,
      });
    }
    throw e;
  }

  // Inline the next pair so the hot loop is ONE round-trip, not two: the vote
  // records the current pair (so the no-repeat matchmaker won't re-serve it),
  // then the same handler matchmakes the next one. Skipped only at the 10-vote
  // milestone, where the client shows the results interstitial instead of a
  // pair. Selection is identical to /api/pair (same serializer) — no blinding
  // surface changes, tags still never ship.
  const nextPair =
    result.voteCount === RESULTS_AT_VOTES
      ? null
      : await selectPair(sessionId, pair.a.finding.deckId).then((p) =>
          p ? serializePair(p, result.voteCount) : null
        );

  // Progression payload is deliberately generic: kinds + amounts only, never
  // attribute names — the reward stream must not fingerprint any contrast.
  return NextResponse.json({
    voteCount: result.voteCount,
    xp: result.xp,
    xpGained: result.xpGained,
    level: result.level,
    leveledUp: result.leveledUp,
    nextPair,
  });
}
