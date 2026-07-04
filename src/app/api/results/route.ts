import { NextResponse } from "next/server";
import { withTiming } from "@/lib/timing";
import { getSession } from "@/lib/repo";
import { computePersonalResults } from "@/lib/results";
import { judgeRank, levelFor } from "@/lib/progression";

// GET /api/results?sessionId=... — the session's personal preference profile,
// computed from its single-attribute-contrast votes only.
async function getHandler(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "unknown session" }, { status: 404 });
  }

  const results = await computePersonalResults(sessionId);
  const calibrated =
    session.goldCount >= 3 && session.judgeScore !== null && session.judgeScore >= 0.8;
  return NextResponse.json({
    segment: session.segment,
    calibrated,
    xp: session.xp,
    level: levelFor(session.xp),
    judgeRank: judgeRank(session.judgeAbility, session.goldCount),
    drillRating: session.drillCount > 0 ? Math.round(session.drillRating) : null,
    ...results,
  });
}

export const GET = withTiming("results", getHandler);
