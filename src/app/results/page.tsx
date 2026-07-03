import Link from "next/link";
import { computeAnalytics, MIN_N, type ValuePairStat } from "@/lib/analytics";
import { getAnalysisSnapshots } from "@/lib/repo";
import { YourContribution } from "@/components/YourContribution";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Judgment Call — Live results",
  description: "What makes a data insight land? Live attribute win rates from pairwise votes.",
};

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

// One value-pair contrast: a labeled bar with the Wilson interval drawn as a
// darker band, or an honest "collecting n/30" state while suppressed.
function ContrastRow({ stat }: { stat: ValuePairStat }) {
  return (
    <div className="py-3 border-b border-card-border last:border-b-0">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <p>
          <span className="font-semibold">{stat.valueALabel}</span>
          <span className="text-muted"> vs </span>
          <span className="font-semibold">{stat.valueBLabel}</span>
        </p>
        <p className="font-mono text-xs text-muted shrink-0">
          {stat.suppressed ? `COLLECTING — ${stat.n}/${MIN_N}` : `n=${stat.n}`}
        </p>
      </div>
      {stat.suppressed ? (
        <div className="mt-2 h-2.5 rounded-full bg-card-border/60 overflow-hidden">
          <div
            className="h-full bg-card-border"
            style={{ width: `${(stat.n / MIN_N) * 100}%` }}
          />
        </div>
      ) : (
        <>
          <div className="relative mt-2 h-2.5 rounded-full bg-card-border/60 overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-accent/80" style={{ width: pct(stat.rateA!) }} />
            {stat.interval && (
              <div
                className="absolute inset-y-0 bg-accent"
                style={{
                  left: pct(stat.interval.lo),
                  width: `${Math.max(1, Math.round((stat.interval.hi - stat.interval.lo) * 100))}%`,
                  opacity: 0.45,
                }}
                title={`95% interval: ${pct(stat.interval.lo)}–${pct(stat.interval.hi)}`}
              />
            )}
            <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/30" />
          </div>
          <p className="mt-1 text-xs text-muted">
            {stat.valueALabel} wins {pct(stat.rateA!)} ({pct(stat.interval!.lo)}–
            {pct(stat.interval!.hi)} at 95%)
          </p>
        </>
      )}
    </div>
  );
}

export default async function ResultsPage() {
  const [a, snapshots] = await Promise.all([computeAnalytics(), getAnalysisSnapshots(5)]);
  const exec = a.segmentStats.executive ?? [];
  const analyst = a.segmentStats.analyst ?? [];
  // Disagreement view: pairs where both segments have unsuppressed data.
  const disagreements = exec
    .filter((e) => !e.suppressed)
    .map((e) => ({
      e,
      an: analyst.find(
        (x) => x.attribute === e.attribute && x.valueA === e.valueA && x.valueB === e.valueB && !x.suppressed
      ),
    }))
    .filter((d) => d.an)
    .sort((d1, d2) => Math.abs(d2.e.rateA! - d2.an!.rateA!) - Math.abs(d1.e.rateA! - d1.an!.rateA!));

  return (
    <main className="flex-1 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="pb-2">
          <p className="masthead text-ink-strong">Judgment Call</p>
        </div>
        <div className="double-rule" aria-hidden />
        <h1 className="mt-4 font-serif font-semibold text-ink-strong text-3xl sm:text-4xl tracking-tight">
          What makes an insight land?
        </h1>
        <p className="mt-2 text-muted text-sm">
          Live results from {a.totals.countedVotes.toLocaleString()} counted votes across{" "}
          {a.totals.votingSessions.toLocaleString()} voting sessions — the tables below sum to
          exactly this number. Win rates carry Wilson 95% intervals and stay hidden until n≥
          {MIN_N}. Full inclusion rules in Methods at the bottom.
        </p>
        <p className="mt-3 text-sm">
          <Link href="/" className="font-semibold text-accent hover:underline">
            Cast your own votes →
          </Link>
        </p>
        <YourContribution />

        <section className="mt-8">
          <h2 className="kicker text-muted">Attribute head-to-heads</h2>
          <div className="mt-2 rounded-card border border-card-border bg-card px-5 py-2">
            {a.attributeStats.length === 0 ? (
              <p className="py-4 text-sm text-muted">No counted votes yet.</p>
            ) : (
              a.attributeStats.map((s) => (
                <ContrastRow key={`${s.attribute}:${s.valueA}|${s.valueB}`} stat={s} />
              ))
            )}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="kicker text-muted">Executives vs. analysts</h2>
          <p className="mt-1 text-sm text-muted">
            The disagreement view: what leaders want vs. what analysts write. Appears once both
            segments clear n≥{MIN_N} on a contrast.
          </p>
          <div className="mt-2 rounded-card border border-card-border bg-card px-5 py-2">
            {disagreements.length === 0 ? (
              <p className="py-4 text-sm text-muted">
                Still collecting — no contrast has n≥{MIN_N} in both segments yet.
              </p>
            ) : (
              disagreements.map(({ e, an }) => (
                <div key={`${e.attribute}:${e.valueA}`} className="py-3 border-b border-card-border last:border-b-0">
                  <p className="text-sm font-semibold">
                    {e.valueALabel} <span className="text-muted font-normal">vs</span> {e.valueBLabel}
                  </p>
                  <div className="mt-1 grid grid-cols-2 gap-4 text-xs text-muted">
                    <p>
                      Executives: <strong className="text-foreground">{pct(e.rateA!)}</strong> (n={e.n})
                    </p>
                    <p>
                      Analysts: <strong className="text-foreground">{pct(an!.rateA!)}</strong> (n={an!.n})
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="kicker text-muted">Top telling per finding</h2>
          <p className="mt-1 text-sm text-muted">
            Variants only ever compete within their own finding, so ratings don&apos;t compare
            across findings — no global leaderboard, by design.
          </p>
          <div className="mt-2 space-y-3">
            {a.leaderboard.map((row) => (
              <div key={row.findingId} className="rounded-card border border-card-border bg-card p-4">
                <p className="text-xs text-muted">{row.findingTitle}</p>
                <p className="mt-1 font-serif text-[1.0625rem] leading-relaxed text-ink-strong">{row.text}</p>
                <p className="mt-2 font-mono text-xs text-muted tabular-nums">
                  Elo {Math.round(row.elo)} · {row.wins}W–{row.losses}L
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="kicker text-muted">Study log</h2>
          <p className="mt-1 text-sm text-muted">
            Formal analysis runs, newest first — published findings cite a snapshot id so anyone
            can ask for the exact numbers behind a claim.
          </p>
          <div className="mt-2 rounded-card border border-card-border bg-card px-5 py-3 text-xs font-mono text-muted space-y-1">
            {snapshots.length === 0 && <p>No analysis runs yet.</p>}
            {snapshots.map((s) => (
              <p key={s.id}>
                {s.createdAt.toISOString().slice(0, 10)} · {s.id.slice(0, 12)} · {s.method}
              </p>
            ))}
          </div>
        </section>

        <section className="mt-10" id="methods">
          <h2 className="kicker text-muted">Methods</h2>
          <div className="mt-2 rounded-card border-l-[3px] border-rule-strong bg-wash px-5 py-4 text-sm text-muted space-y-3">
            <p>
              <strong className="text-foreground">What counts.</strong> A vote counts toward the
              tables above when it was decided (not &ldquo;can&apos;t decide&rdquo;), the two
              tellings differed on exactly one craft attribute, the pair was not a repeat for
              that session, and it took at least 0.8s (a latency floor, not a comprehension
              check). Everything is still logged; exclusions only affect published statistics.
            </p>
            <p>
              <strong className="text-foreground">Sample composition.</strong>{" "}
              {a.segmentComposition.length === 0
                ? "No counted votes yet."
                : a.segmentComposition
                    .map((sc) => `${sc.segment}: ${sc.counted}`)
                    .join(" · ")}{" "}
              — segments are one-tap self-reports by anonymous sessions; treat cross-segment
              comparisons accordingly.
            </p>
            <p>
              <strong className="text-foreground">Position check.</strong> Left/right placement is
              randomized server-side. The left slot has won{" "}
              {a.positionBias.leftRate === null
                ? "—"
                : `${Math.round(a.positionBias.leftRate * 100)}%`}{" "}
              of {a.positionBias.n.toLocaleString()} decided votes
              {a.positionBias.interval &&
                ` (95%: ${pct(a.positionBias.interval.lo)}–${pct(a.positionBias.interval.hi)})`}
              . An interval excluding 50% would indicate position bias.
            </p>
            <p>
              <strong className="text-foreground">Thresholds.</strong> n≥{MIN_N} before a win rate
              is shown — a conventional floor for a stable Wilson interval, not a significance
              claim. These are live descriptive statistics, updated continuously; formal analysis
              (Bradley–Terry with finding fixed effects, preregistered cuts) is run separately
              before anything is published as a finding.
            </p>
            <p>
              <strong className="text-foreground">Disclosure.</strong> All findings use realistic
              but fictional data. A small share of tellings are deliberately written to subtly
              exceed their underlying data; that contrast is measured as a separate, blinded
              experiment and reported with its own methods when the sample is defensible —
              which tellings those are is never revealed while voting.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
