import { notFound } from "next/navigation";
import { computeOverclaim, computeAnalytics, MIN_N } from "@/lib/analytics";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { AdminNav } from "@/components/AdminNav";

export const dynamic = "force-dynamic";

// Server component; wall-clock read happens per-request, not per-render frame
// (the purity lint can't see through the direct Date.now() call).
function weekAgo(): Date {
  return new Date(Date.now() - 7 * 86400_000);
}

// Admin-only view (spec §6): the overclaim experiment and integrity monitors.
// Gated by ADMIN_KEY — /admin?key=... — and 404s otherwise so the route is
// invisible without the flag. Never link to this from public pages.
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  if (!(await isAdmin(key))) notFound();

  const [o, a, pendingCount, weekVotes, lowJudges] = await Promise.all([
    computeOverclaim(),
    computeAnalytics(),
    prisma.variant.count({ where: { status: "pending" } }),
    prisma.comparison.count({
      where: { createdAt: { gte: weekAgo() }, deckId: null },
    }),
    prisma.session.count({ where: { judgeScore: { lt: 0.5 }, goldCount: { gte: 3 } } }),
  ]);
  const publishable = a.attributeStats.filter((s) => !s.suppressed).length;
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

  return (
    <main className="flex-1 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <AdminNav active="/admin" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          {[
            { label: "votes / 7d", value: weekVotes },
            { label: "pending review", value: pendingCount },
            { label: "publishable contrasts", value: publishable },
            { label: "low-score judges", value: lowJudges },
          ].map((x) => (
            <div key={x.label} className="rounded-2xl border border-card-border bg-card px-3 py-4">
              <p className="text-2xl font-bold tabular-nums">{x.value}</p>
              <p className="mt-1 text-xs text-muted">{x.label}</p>
            </div>
          ))}
        </div>
        <h1 className="mt-8 text-3xl font-bold tracking-tight">The overclaim experiment</h1>
        <p className="mt-2 text-sm text-muted">
          Faithful vs. overclaimed head-to-heads (decided, attention-passing, non-repeat votes
          on fidelity-only contrasts). Does punchy-but-wrong beat accurate-but-hedged? Do not
          publish below n≥{MIN_N} per reported segment.
        </p>

        <section className="mt-6 rounded-2xl border border-card-border bg-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Overall</h2>
          <p className="mt-2 text-2xl font-bold">
            {o.overall.n === 0 ? (
              "no data yet"
            ) : (
              <>
                {pct(o.overall.overclaimWins / o.overall.n)}{" "}
                <span className="text-sm font-normal text-muted">
                  of {o.overall.n} votes went to the overclaimed telling
                  {o.overall.interval &&
                    ` (95%: ${pct(o.overall.interval.lo)}–${pct(o.overall.interval.hi)})`}
                  {o.overall.suppressed && ` — SUPPRESSED, collecting ${o.overall.n}/${MIN_N}`}
                </span>
              </>
            )}
          </p>
          <div className="mt-4 space-y-2">
            {o.bySegment.map((s) => (
              <p key={s.segment} className="text-sm tabular-nums">
                <span className="inline-block w-28 font-semibold">{s.segment}</span>
                {s.n === 0 ? (
                  <span className="text-muted">no data</span>
                ) : (
                  <>
                    {pct(s.overclaimWins / s.n)} of {s.n}
                    {s.interval && (
                      <span className="text-muted">
                        {" "}
                        ({pct(s.interval.lo)}–{pct(s.interval.hi)})
                      </span>
                    )}
                    {s.suppressed && <span className="text-red-500"> · below n={MIN_N}</span>}
                  </>
                )}
              </p>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-card-border bg-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
            Position-bias monitor
          </h2>
          <p className="mt-2 text-sm">
            Left/top slot wins{" "}
            <strong>{o.positionBias.leftRate === null ? "—" : pct(o.positionBias.leftRate)}</strong>{" "}
            of {o.positionBias.n} decided votes
            {o.positionBias.interval && (
              <span className="text-muted">
                {" "}
                (95%: {pct(o.positionBias.interval.lo)}–{pct(o.positionBias.interval.hi)})
              </span>
            )}
            . Placement is randomized server-side, so deviation from 50% is position bias — cite
            it in the methods section if the interval excludes 50%.
          </p>
        </section>
      </div>
    </main>
  );
}
