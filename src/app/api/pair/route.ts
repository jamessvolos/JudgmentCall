import { NextResponse } from "next/server";
import { getSession } from "@/lib/repo";
import { selectPair } from "@/lib/matchmaking";

// GET /api/pair?sessionId=... — matchmake the next pair for this session.
//
// Deliberately returns ONLY id + text for each variant: attribute tags (and
// especially the hidden fidelity flag) must never reach the client, where
// they could bias votes or unblind the overclaim experiment. The vote route
// recomputes the contrast server-side from the variant ids.
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

  const pair = await selectPair(sessionId);
  if (!pair) {
    return NextResponse.json({ error: "no pairs available" }, { status: 503 });
  }

  return NextResponse.json({
    finding: {
      id: pair.finding.id,
      title: pair.finding.title,
      domain: pair.finding.domain,
      contextSnippet: pair.finding.contextSnippet,
      sourceLabel: pair.finding.sourceLabel,
    },
    variantA: { id: pair.variantA.id, text: pair.variantA.text },
    variantB: { id: pair.variantB.id, text: pair.variantB.text },
    voteCount: session.voteCount,
  });
}
