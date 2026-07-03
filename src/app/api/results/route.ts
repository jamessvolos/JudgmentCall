import { NextResponse } from "next/server";
import { getSession } from "@/lib/repo";
import { computePersonalResults } from "@/lib/results";

// GET /api/results?sessionId=... — the session's personal preference profile,
// computed from its single-attribute-contrast votes only.
export async function GET(request: Request) {
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
  return NextResponse.json({ segment: session.segment, calibrated, ...results });
}
