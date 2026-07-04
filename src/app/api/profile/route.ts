import { NextResponse } from "next/server";
import { withTiming } from "@/lib/timing";
import { publishProfile } from "@/lib/repo";

// POST /api/profile — opt-in publish of the session's taste poster.
// Idempotent; returns the public URL. Only the session owner can publish
// (the session id IS the credential, same trust model as voting).
async function postHandler(request: Request) {
  const body = await request.json().catch(() => null);
  const { sessionId } = body ?? {};
  if (typeof sessionId !== "string") {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  const slug = await publishProfile(sessionId);
  if (!slug) return NextResponse.json({ error: "unknown session" }, { status: 404 });
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  return NextResponse.json({ slug, url: `${origin}/p/${slug}` });
}

export const POST = withTiming("profile", postHandler);
