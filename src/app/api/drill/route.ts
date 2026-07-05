import { withTiming } from "@/lib/timing";
import { faithfulSideFor, isCorrectDrillCall } from "@/lib/drill-grade";
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
// (session, item) — see faithfulSideFor in @/lib/drill-grade, shared with the
// grading path so the two can't drift.

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
  const faithful = faithfulSideFor(sessionId, item.id);
  return NextResponse.json({
    item: {
      id: item.id,
      title: item.title,
      contextSnippet: item.contextSnippet,
      sourceLabel: item.sourceLabel,
      a: faithful === "a" ? item.faithfulText : item.overclaimedText,
      b: faithful === "b" ? item.faithfulText : item.overclaimedText,
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

  const faithfulSide = faithfulSideFor(sessionId, item.id);
  // Correct = picked the OVERCLAIMED (non-faithful) side — the telling that
  // exceeds the data. This was previously `picked === faithfulSide`, which
  // rewarded picking the FAITHFUL telling: inverted against the on-screen
  // question ("Which telling exceeds the data?") and the drill's whole purpose,
  // so a learner who correctly caught the overclaim was told "It got you" and
  // lost rating. Drill rating/XP are training-only (never in analytics), so
  // fixing forward is safe. See @/lib/drill-grade (+ its test).
  const correct = isCorrectDrillCall(picked, faithfulSide);
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
