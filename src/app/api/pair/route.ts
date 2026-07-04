import { NextResponse } from "next/server";
import { getDeckBySlug, getSession } from "@/lib/repo";
import { selectPair, serializePair } from "@/lib/matchmaking";
import { withTiming } from "@/lib/timing";

// GET /api/pair?sessionId=... — matchmake the next pair for this session.
//
// Deliberately returns ONLY id + text for each variant: attribute tags (and
// especially the hidden fidelity flag) must never reach the client, where
// they could bias votes or unblind the overclaim experiment. The vote route
// recomputes the contrast server-side from the variant ids.
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

  const deckSlug = searchParams.get("deck");
  let deckId: string | null = null;
  if (deckSlug) {
    const deck = await getDeckBySlug(deckSlug);
    if (!deck) return NextResponse.json({ error: "unknown deck" }, { status: 404 });
    deckId = deck.id;
  }
  const pair = await selectPair(sessionId, deckId);
  if (!pair) {
    return NextResponse.json({ error: "no pairs available" }, { status: 503 });
  }

  return NextResponse.json(serializePair(pair, session.voteCount));
}

export const GET = withTiming("pair", getHandler);
