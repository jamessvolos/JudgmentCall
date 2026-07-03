import { notFound } from "next/navigation";
import { computeOverclaim, MIN_N } from "@/lib/analytics";

export const dynamic = "force-dynamic";

// Admin-only view (spec §6): the overclaim experiment and integrity monitors.
// Gated by ADMIN_KEY — /admin?key=... — and 404s otherwise so the route is
// invisible without the flag. Never link to this from public pages.
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const adminKey = process.env.ADMIN_KEY;
  const { key } = await searchParams;
  if (!adminKey || key !== adminKey) notFound();

  const o = await computeOverclaim();
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

  return (
    <main className="flex-1 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent">
          Judgment Call · Admin
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">The overclaim experiment</h1>
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
