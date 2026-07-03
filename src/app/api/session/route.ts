import { NextResponse } from "next/server";
import { upsertSession } from "@/lib/repo";
import { isSegment } from "@/lib/types";

// POST /api/session — create (or retag) the anonymous session.
// Body: { sessionId: string, segment: Segment }
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const sessionId = body?.sessionId;
  const segment = body?.segment;

  if (typeof sessionId !== "string" || sessionId.length < 8 || sessionId.length > 64) {
    return NextResponse.json({ error: "invalid sessionId" }, { status: 400 });
  }
  if (!isSegment(segment)) {
    return NextResponse.json({ error: "invalid segment" }, { status: 400 });
  }

  const session = await upsertSession(sessionId, segment);
  return NextResponse.json({
    sessionId: session.id,
    segment: session.segment,
    voteCount: session.voteCount,
  });
}
