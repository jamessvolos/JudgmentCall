import { NextResponse } from "next/server";
import { getDeckBySlug, getDeckComparisonsCsv } from "@/lib/repo";

// Deck owner's raw-log CSV export (ROADMAP-2 §2). Owner = the session that
// created the deck; pass ?sessionId= (the owner's localStorage id).
export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const deck = await getDeckBySlug(slug);
  if (!deck) return NextResponse.json({ error: "unknown deck" }, { status: 404 });
  if (searchParams.get("sessionId") !== deck.ownerSessionId) {
    return NextResponse.json({ error: "owner only" }, { status: 403 });
  }
  const rows = await getDeckComparisonsCsv(deck.id);
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const csv = [
    "createdAt,segment,contrastAttrs,winner,decided,lowAttention,isRepeat,variantA,variantB",
    ...rows.map((r) =>
      [
        r.createdAt.toISOString(),
        r.segment,
        r.contrastAttrs,
        r.winnerId === r.variantAId ? "A" : r.winnerId === r.variantBId ? "B" : "",
        r.winnerId ? "1" : "0",
        r.lowAttention ? "1" : "0",
        r.isRepeat ? "1" : "0",
        esc(r.variantA.text),
        esc(r.variantB.text),
      ].join(",")
    ),
  ].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${slug}.csv"`,
    },
  });
}
