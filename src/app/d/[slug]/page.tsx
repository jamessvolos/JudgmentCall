import Link from "next/link";
import { notFound } from "next/navigation";
import { getDeckWithStats } from "@/lib/repo";

export const dynamic = "force-dynamic";

// A private BYO deck (unlisted — reachable only by slug). Votes here are
// scoped to the deck and never enter the public study.
export default async function DeckPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const stats = await getDeckWithStats(slug);
  if (!stats) notFound();
  const { deck, votes } = stats;
  const ready = deck.findings.some((f) => f.variants.length >= 2);

  return (
    <main className="flex-1 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent">
          Judgment Call · Private deck
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{deck.name}</h1>
        <p className="mt-2 text-sm text-muted">
          {deck.findings.length} finding{deck.findings.length === 1 ? "" : "s"} ·{" "}
          {votes} vote{votes === 1 ? "" : "s"} · votes on this deck stay out of the public study.
        </p>

        {ready ? (
          <Link
            href={`/swipe?deck=${deck.slug}`}
            className="mt-6 inline-block rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white"
          >
            Vote on this deck →
          </Link>
        ) : (
          <div className="mt-6 rounded-2xl border border-card-border bg-card p-5 text-sm text-muted">
            <p className="font-semibold text-foreground">Variants are being prepared.</p>
            <p className="mt-1">
              The generation pipeline writes six tellings of each finding, and a reviewer checks
            them against your truth claim before anyone can vote. Check back soon — then share
              this link with the people whose judgment you want.
            </p>
          </div>
        )}

        {/* Progress toward a defensible read */}
        <div className="mt-4">
          <div className="h-2 w-full max-w-xs rounded-full bg-card-border overflow-hidden">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.min(100, (votes / 30) * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted">
            {votes < 30
              ? `${votes}/30 votes — invite ${Math.max(1, Math.ceil((30 - votes) / 10))} more people (~10 votes each) for a defensible read.`
              : "30+ votes — win rates below are worth reading."}
          </p>
        </div>

        <div className="mt-8 space-y-3">
          {deck.findings.map((f) => {
            const rated = [...f.variants].sort((x, y) => y.elo - x.elo);
            const top = rated[0];
            return (
              <div key={f.id} className="rounded-2xl border border-card-border bg-card p-4 text-sm">
                <p className="font-semibold">{f.title}</p>
                <p className="mt-1 text-xs text-muted">
                  {f.variants.length} approved variant{f.variants.length === 1 ? "" : "s"} ·{" "}
                  {f.sourceLabel}
                </p>
                {top && top.wins + top.losses > 0 && (
                  <p className="mt-2 text-xs">
                    <span className="font-semibold text-accent">Leading telling</span>{" "}
                    ({top.wins}W–{top.losses}L): {top.text}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-xs text-muted">
          Deck owner? Export the raw vote log:{" "}
          <code>/api/deck/{deck.slug}/export?sessionId=&lt;your session id&gt;</code> — owner
          session only.
        </p>
      </div>
    </main>
  );
}
