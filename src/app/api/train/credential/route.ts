import { NextResponse } from "next/server";
import { withTiming } from "@/lib/timing";
import { publishProfile, logCredential } from "@/lib/repo";
import { isTrackId } from "@/lib/train-tracks";

// POST /api/train/credential — publish a Calibration Credential for a room.
// Mints (idempotently) the session's public slug and logs a track-tagged
// credential event for the launch funnel. The session id IS the credential,
// same trust model as voting. Returns the slug; the client builds the URL.
async function postHandler(request: Request) {
  const body = await request.json().catch(() => null);
  const { sessionId, track } = body ?? {};
  if (typeof sessionId !== "string") {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  if (typeof track !== "string" || !isTrackId(track)) {
    return NextResponse.json({ error: "unknown track" }, { status: 400 });
  }
  const slug = await publishProfile(sessionId);
  if (!slug) return NextResponse.json({ error: "unknown session" }, { status: 404 });
  await logCredential(sessionId, track);
  return NextResponse.json({ slug });
}

export const POST = withTiming("train-credential", postHandler);
