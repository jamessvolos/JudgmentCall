import { NextResponse } from "next/server";
import { getSession, getVariantPair, recordVote } from "@/lib/repo";
import { contrastKey } from "@/lib/matchmaking";
import { attributeDiff, LOW_ATTENTION_MS, type AttributeProfile, type Segment } from "@/lib/types";

// POST /api/vote — record a comparison and apply the Elo update.
// Body: { sessionId, variantAId, variantBId, winnerId | null, latencyMs }
// winnerId === null means "can't decide": logged, no rating change.
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

  const pair = await getVariantPair(variantAId, variantBId);
  if (!pair) {
    return NextResponse.json({ error: "invalid variant pair" }, { status: 400 });
  }

  // Contrast is computed server-side from the stored tags — never trusted
  // from the client.
  const contrastAttrs = contrastKey(
    attributeDiff(pair.a as unknown as AttributeProfile, pair.b as unknown as AttributeProfile)
  );

  const latency = Number.isFinite(latencyMs) ? Math.max(0, Math.round(latencyMs)) : 0;

  const { voteCount } = await recordVote({
    sessionId,
    segment: session.segment as Segment,
    findingId: pair.a.findingId,
    variantAId,
    variantBId,
    winnerId,
    contrastAttrs,
    latencyMs: latency,
    lowAttention: latency < LOW_ATTENTION_MS,
  });

  return NextResponse.json({ voteCount });
}
