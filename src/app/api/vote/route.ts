import { createHash } from "crypto";
import { NextResponse } from "next/server";
import {
  getRecentVoteStats,
  getSession,
  getVariantPair,
  hasSeenPair,
  recordVote,
} from "@/lib/repo";
import { contrastKey } from "@/lib/matchmaking";
import {
  attributeDiff,
  CANT_DECIDE_MAX_IN_WINDOW,
  CANT_DECIDE_WINDOW,
  LOW_ATTENTION_MS,
  MAX_VOTES_PER_MINUTE,
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
  const { sessionId, variantAId, variantBId, winnerId, latencyMs } = body ?? {};

  if (
    typeof sessionId !== "string" ||
    typeof variantAId !== "string" ||
    typeof variantBId !== "string" ||
    (winnerId !== null && winnerId !== variantAId && winnerId !== variantBId)
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

  const { voteCount } = await recordVote({
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
  });

  return NextResponse.json({ voteCount });
}
