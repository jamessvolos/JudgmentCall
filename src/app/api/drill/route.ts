import { createHash } from "crypto";
import { withTiming } from "@/lib/timing";
import { NextResponse } from "next/server";
import {
  getDrillFamilyProgress,
  getDrillItem,
  getNextDrillItem,
  getSession,
  hasAttemptedDrill,
  recordDrillAttempt,
} from "@/lib/repo";

// "Spot the overclaim" drills — the training mode. A separate world from the
// study (clearly labeled in the UI, items never served in the voting pool,
// attempts never in analytics), so immediate right/wrong feedback is safe
// here and only here.

// Which side the faithful telling renders on is deterministic per
// (session, item) so the answer can be re-derived at grading time without
// storing per-serve state: even digest → faithful first.
function faithfulFirst(sessionId: string, itemId: string): boolean {
  const h = createHash("sha256").update(`${sessionId}:${itemId}`).digest();
  return h[0] % 2 === 0;
}

// GET /api/drill?sessionId=... — next unattempted item, sides shuffled.
async function getHandler(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  const session = await getSession(sessionId);
  if (!session) return NextResponse.json({ error: "unknown session" }, { status: 404 });

  const { item, remaining } = await getNextDrillItem(sessionId);
  if (!item) {
    // Cleared the pool: return the per-family skill map so the completion
    // screen can show where the learner is strong and where to come back.
    return NextResponse.json({
      item: null,
      remaining: 0,
      drillRating: Math.round(session.drillRating),
      drillCount: session.drillCount,
      familyProgress: await getDrillFamilyProgress(sessionId),
    });
  }
  const flip = !faithfulFirst(sessionId, item.id);
  const texts = [item.faithfulText, item.overclaimedText];
  return NextResponse.json({
    item: {
      id: item.id,
      title: item.title,
      contextSnippet: item.contextSnippet,
      sourceLabel: item.sourceLabel,
      a: flip ? texts[1] : texts[0],
      b: flip ? texts[0] : texts[1],
    },
    remaining,
    drillRating: Math.round(session.drillRating),
    drillCount: session.drillCount,
  });
}

// POST /api/drill — grade an attempt.
// Body: { sessionId, drillId, picked: "a" | "b", latencyMs }
async function postHandler(request: Request) {
  const body = await request.json().catch(() => null);
  const { sessionId, drillId, picked, latencyMs } = body ?? {};
  if (
    typeof sessionId !== "string" ||
    typeof drillId !== "string" ||
    (picked !== "a" && picked !== "b")
  ) {
    return NextResponse.json({ error: "invalid drill payload" }, { status: 400 });
  }
  const [session, item] = await Promise.all([getSession(sessionId), getDrillItem(drillId)]);
  if (!session || !item) return NextResponse.json({ error: "unknown session or drill" }, { status: 404 });
  if (await hasAttemptedDrill(sessionId, drillId)) {
    return NextResponse.json({ error: "already attempted" }, { status: 409 });
  }

  const faithfulSide = faithfulFirst(sessionId, item.id) ? "a" : "b";
  const correct = picked === faithfulSide;
  const latency = Number.isFinite(latencyMs) ? Math.max(0, Math.round(latencyMs)) : 0;
  const result = await recordDrillAttempt({
    sessionId,
    drillItemId: drillId,
    correct,
    latencyMs: latency,
  });

  // Full reveal is safe here: this is training content, not study content.
  return NextResponse.json({
    correct,
    faithfulSide,
    device: item.device,
    explanation: item.explanation,
    drillRating: Math.round(result.drillRating),
    ratingDelta: Math.round(result.ratingDelta),
    drillCount: result.drillCount,
    xp: result.xp,
  });
}

export const GET = withTiming("drill", getHandler);
export const POST = withTiming("drill", postHandler);
