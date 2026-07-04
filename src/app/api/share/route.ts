import { NextResponse } from "next/server";
import { withTiming } from "@/lib/timing";
import { getSession, logShare } from "@/lib/repo";

// POST /api/share — fire-and-forget share-event log for the funnel panel.
// Zero XP on purpose: paying for shares invites spam; measuring them doesn't.
async function postHandler(request: Request) {
  const body = await request.json().catch(() => null);
  const { sessionId } = body ?? {};
  if (typeof sessionId !== "string") {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  const session = await getSession(sessionId);
  if (!session) return NextResponse.json({ error: "unknown session" }, { status: 404 });
  await logShare(sessionId);
  return NextResponse.json({ ok: true });
}

export const POST = withTiming("share", postHandler);
