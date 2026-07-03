import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { computeCoverageGrid, computeOverclaim, computeAnalytics, MIN_N } from "@/lib/analytics";
import { audit, isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { getServingConfig, getVotesPerDay, setServingConfig } from "@/lib/repo";
import { SEGMENTS } from "@/lib/types";
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

  const [o, a, grid, series, policy, pendingCount, weekVotes, lowJudges] = await Promise.all([
    computeOverclaim(),
    computeAnalytics(),
    computeCoverageGrid(),
    getVotesPerDay(14),
    getServingConfig(),
    prisma.variant.count({ where: { status: "pending" } }),
    prisma.comparison.count({
      where: { createdAt: { gte: weekAgo() }, deckId: null },
    }),
    prisma.session.count({ where: { judgeScore: { lt: 0.5 }, goldCount: { gte: 3 } } }),
  ]);
  const maxDay = Math.max(1, ...series.map((d) => d.votes));

  async function updatePolicy(formData: FormData) {
    "use server";
    if (!(await isAdmin(String(formData.get("key") ?? "") || undefined))) return;
    const config = {
      fidelityBoost: Number(formData.get("fidelityBoost")) || 2,
      earlyFidelityCap: Number(formData.get("earlyFidelityCap")) || 2,
      capUntilVotes: Number(formData.get("capUntilVotes")) || 10,
    };
    await setServingConfig(config);
    await audit("policy.update", "serving", JSON.stringify(config));
    revalidatePath("/admin");
  }
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
            <div key={x.label} className="rounded-card border border-card-border bg-card px-3 py-4">
              <p className="text-2xl font-bold tabular-nums">{x.value}</p>
              <p className="mt-1 text-xs text-muted">{x.label}</p>
            </div>
          ))}
        </div>
        {/* Votes/day time series */}
        <section className="mt-6 rounded-card border border-card-border bg-card p-5">
          <h2 className="kicker text-muted">
            Public-study votes / day (14d)
          </h2>
          <div className="mt-3 flex items-end gap-1 h-20">
            {series.length === 0 && <p className="text-xs text-muted">No votes in window.</p>}
            {series.map((d) => (
              <div key={d.day} className="flex-1" title={`${d.day}: ${d.votes}`}>
                <div
                  className="rounded-t bg-accent"
                  style={{ height: `${(d.votes / maxDay) * 72}px` }}
                />
              </div>
            ))}
          </div>
        </section>

        <h1 className="mt-8 font-serif font-semibold text-ink-strong text-3xl tracking-tight">The overclaim experiment</h1>
        <p className="mt-2 text-sm text-muted">
          Faithful vs. overclaimed head-to-heads (decided, attention-passing, non-repeat votes
          on fidelity-only contrasts). Does punchy-but-wrong beat accurate-but-hedged? Do not
          publish below n≥{MIN_N} per reported segment.
        </p>

        <section className="mt-6 rounded-card border border-card-border bg-card p-5">
          <h2 className="kicker text-muted">Overall</h2>
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
                    {s.suppressed && <span className="text-danger"> · below n={MIN_N}</span>}
                  </>
                )}
              </p>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-card border border-card-border bg-card p-5">
          <h2 className="kicker text-muted">
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
        {/* Judge-quality panel */}
        <section className="mt-6 rounded-card border border-card-border bg-card p-5">
          <h2 className="kicker text-muted">Judge quality</h2>
          <p className="mt-2 text-sm">
            Overclaim rate weighted by judge score:{" "}
            <strong>
              {o.weightedOverallRate === null ? "—" : pct(o.weightedOverallRate)}
            </strong>{" "}
            vs unweighted{" "}
            <strong>{o.overall.n > 0 ? pct(o.overall.overclaimWins / o.overall.n) : "—"}</strong>
            <span className="text-muted"> — a large gap means low-quality judges move the result.</span>
          </p>
          <div className="mt-3 flex gap-4 text-sm tabular-nums">
            {o.judgeHistogram.map((b) => (
              <p key={b.bucket}>
                <span className="text-muted">{b.bucket}:</span> {b.sessions}
              </p>
            ))}
          </div>
        </section>

        {/* Coverage heatmap */}
        <section className="mt-6 rounded-card border border-card-border bg-card p-5 overflow-x-auto">
          <h2 className="kicker text-muted">
            Coverage heatmap (n / {MIN_N} per segment)
          </h2>
          <table className="mt-3 w-full text-xs">
            <thead>
              <tr className="text-muted">
                <th className="text-left font-normal pr-2">contrast</th>
                {SEGMENTS.map((seg) => (
                  <th key={seg} className="font-normal px-1">{seg.slice(0, 4)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((cell) => (
                <tr key={cell.key}>
                  <td className="pr-2 py-0.5 whitespace-nowrap">{cell.label}</td>
                  {SEGMENTS.map((seg) => {
                    const n = cell.bySegment[seg] ?? 0;
                    const frac = Math.min(1, n / MIN_N);
                    return (
                      <td key={seg} className="px-1 py-0.5">
                        <div
                          className="rounded px-1 text-center tabular-nums"
                          style={{
                            background: `color-mix(in oklab, var(--accent) ${Math.round(frac * 85)}%, var(--card-border))`,
                            color: frac > 0.5 ? "white" : "inherit",
                          }}
                        >
                          {n}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Serving policy editor */}
        <section className="mt-6 rounded-card border border-card-border bg-card p-5">
          <h2 className="kicker text-muted">
            Serving policy <span className="normal-case font-normal">(audited; replay-check with scripts/replay.ts before big changes)</span>
          </h2>
          <form action={updatePolicy} className="mt-3 flex flex-wrap items-end gap-3 text-sm">
            <input type="hidden" name="key" value={key} />
            {[
              { name: "fidelityBoost", label: "fidelity boost", value: policy.fidelityBoost },
              { name: "earlyFidelityCap", label: "early fidelity cap", value: policy.earlyFidelityCap },
              { name: "capUntilVotes", label: "cap until votes", value: policy.capUntilVotes },
            ].map((f) => (
              <label key={f.name} className="block">
                <span className="text-xs text-muted">{f.label}</span>
                <input
                  name={f.name}
                  type="number"
                  step="1"
                  min="0"
                  defaultValue={f.value}
                  className="mt-1 w-24 rounded-lg border border-card-border bg-background px-2 py-1.5"
                />
              </label>
            ))}
            <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent">
              Save policy
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
