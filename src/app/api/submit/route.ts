import { NextResponse } from "next/server";
import { withTiming } from "@/lib/timing";
import { createDeckWithFinding, getSession } from "@/lib/repo";
import { DOMAINS } from "@/lib/types";

// POST /api/submit — BYO data (ROADMAP §3). Creates a private deck owned by the
// submitting session, holding one Finding(status=submitted). Nothing is voteable
// until the M2 pipeline generates variants AND an admin approves them — the
// same gate as everything else. PII stays the submitter's responsibility and
// decks are unlisted by default.
async function postHandler(request: Request) {
  const body = await request.json().catch(() => null);
  const { sessionId, deckName, title, domain, contextSnippet, sourceLabel, fact, driver, limitation } =
    body ?? {};

  if (typeof sessionId !== "string" || !(await getSession(sessionId))) {
    return NextResponse.json({ error: "unknown session — vote once first" }, { status: 401 });
  }
  const fields = { deckName, title, contextSnippet, sourceLabel, fact, driver, limitation };
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v !== "string" || v.trim().length < 3 || v.length > 600) {
      return NextResponse.json({ error: `invalid ${k}` }, { status: 400 });
    }
  }
  if (!(DOMAINS as readonly string[]).includes(domain)) {
    return NextResponse.json({ error: "invalid domain" }, { status: 400 });
  }

  // truthSummary follows the fact -> driver -> limitation template (ATTRIBUTES.md)
  const truthSummary = `${fact.trim()} ${driver.trim()} ${limitation.trim()}`;
  const deck = await createDeckWithFinding({
    deckName,
    ownerSessionId: sessionId,
    finding: { title: title.trim(), domain, contextSnippet: contextSnippet.trim(), sourceLabel: sourceLabel.trim(), truthSummary },
  });

  return NextResponse.json({ slug: deck.slug });
}

export const POST = withTiming("submit", postHandler);
