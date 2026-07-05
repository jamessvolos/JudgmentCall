import Link from "next/link";
import { computeAnalyticsCached, MIN_N, type ValuePairStat } from "@/lib/analytics";
import { HOUSE_VIEW, stanceFor, type HouseStance } from "@/lib/house-view";
import { getAnalysisSnapshots } from "@/lib/repo";
import { ATTRIBUTE_LABELS, VALUE_LABELS } from "@/lib/types";
import { CountUp } from "@/components/CountUp";
import { YourContribution } from "@/components/YourContribution";
import { ResultsHeadToHeads, type H2HRow } from "@/components/ResultsHeadToHeads";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Judgment Call — Live results",
  description: "What makes a data insight land? Live attribute win rates from pairwise votes.",
};

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

// The room's live verdict on a desk stance — used by the §01 scoreboard.
// "Concurs"/"overrules" only when the Wilson interval clears the 50% null.
type DeskVerdict = "ROOM CONCURS" | "ROOM OVERRULES" | "TOO CLOSE TO CALL" | "JURY'S OUT";
function deskVerdict(stat: ValuePairStat | undefined, stance: HouseStance): DeskVerdict {
  if (!stat || stat.suppressed || stat.rateA === null || stat.interval === null) return "JURY'S OUT";
  const clears = stat.interval.lo > 0.5 || stat.interval.hi < 0.5;
  if (!clears) return "TOO CLOSE TO CALL";
  const roomPick = stat.rateA > 0.5 ? stat.valueA : stat.valueB;
  return roomPick === stance.pick ? "ROOM CONCURS" : "ROOM OVERRULES";
}

// §02 ordering: how firmly the room has SETTLED each call. Tier 0 = resolved
// (interval clears the 50% null), tier 1 = sampled but straddling, tier 2 = the
// suppressed block (one uniform, undifferentiated tier at the bottom).
function decisionRank(s: ValuePairStat): 0 | 1 | 2 {
  if (s.suppressed || s.interval === null) return 2;
  return s.interval.lo > 0.5 || s.interval.hi < 0.5 ? 0 : 1;
}
function clearance(s: ValuePairStat): number {
  return s.interval ? Math.max(s.interval.lo - 0.5, 0.5 - s.interval.hi, 0) : 0;
}

// Resolve a segment's craft stats to render-ready rows for the client island:
// merge in the desk's un-voted contrasts (suppressed placeholders), rank by
// decisiveness, and pre-resolve every label + the desk stance + verdict on the
// SERVER — so the client component imports no server lib (keeping fidelity
// vocabulary and LOW_ATTENTION out of the browser bundle). Craft only.
function buildH2HRows(stats: ValuePairStat[]): H2HRow[] {
  const merged: ValuePairStat[] = [
    ...stats,
    ...HOUSE_VIEW.filter(
      (h) => !stats.some((s) => s.attribute === h.attribute && s.valueA === h.valueA && s.valueB === h.valueB)
    ).map(
      (h): ValuePairStat => ({
        attribute: h.attribute,
        attributeLabel: ATTRIBUTE_LABELS[h.attribute],
        valueA: h.valueA,
        valueB: h.valueB,
        valueALabel: VALUE_LABELS[h.valueA] ?? h.valueA,
        valueBLabel: VALUE_LABELS[h.valueB] ?? h.valueB,
        winsA: 0,
        n: 0,
        rateA: null,
        interval: null,
        suppressed: true,
      })
    ),
  ];
  merged.sort((x, y) => {
    const rx = decisionRank(x);
    const ry = decisionRank(y);
    if (rx !== ry) return rx - ry;
    if (rx === 0) return clearance(y) - clearance(x);
    if (rx === 1) return y.n - x.n;
    return 0;
  });
  return merged.map((s): H2HRow => {
    const stance = stanceFor(s.attribute, s.valueA, s.valueB);
    const clears = !s.suppressed && s.interval !== null && (s.interval.lo > 0.5 || s.interval.hi < 0.5);
    return {
      key: `${s.attribute}:${s.valueA}|${s.valueB}`,
      anchor: `${s.attribute}-${s.valueA}-${s.valueB}`.replace(/[^a-zA-Z0-9_-]/g, ""),
      valueALabel: s.valueALabel,
      valueBLabel: s.valueBLabel,
      n: s.n,
      rateA: s.rateA,
      intervalLo: s.interval?.lo ?? null,
      intervalHi: s.interval?.hi ?? null,
      suppressed: s.suppressed,
      clears,
      stancePickLabel: stance ? (VALUE_LABELS[stance.pick] ?? stance.pick) : null,
      stanceLine: stance ? stance.line : null,
      deskVerdict: stance ? deskVerdict(s, stance) : null,
    };
  });
}


export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ embed?: string }>;
}) {
  // Embed mode (?embed=1): chrome-less for iframes in articles — masthead and
  // colophon drop away (body:has() rule in globals.css), content stays whole.
  const embed = (await searchParams).embed === "1";
  const [a, snapshots] = await Promise.all([computeAnalyticsCached(), getAnalysisSnapshots(5)]);
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
    <main className="flex-1 px-4 py-8 sm:py-12" {...(embed && { "data-embed": "1" })}>
      <div className="mx-auto w-full max-w-2xl">
        {!embed && (
          <div className="hero-line" style={{ "--i": 0 } as React.CSSProperties}>
            <p className="masthead text-ink-strong">Judgment Call · Live study</p>
            <div className="datum mt-1.5" aria-hidden />
          </div>
        )}
        <h1
          className="hero-line ink-gradient mt-5 font-sans font-semibold text-[clamp(2.25rem,6vw,3.5rem)] leading-[1.02] tracking-[-0.03em] text-balance"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          What makes an insight land?
        </h1>
        {/* The study's pulse, set as a lit instrument readout: the two live
            totals as large tabular figures on an edge-lit panel with a LIVE
            tag. The tables below sum to exactly the vote count. */}
        <dl
          className="hero-line mt-6 flex flex-wrap items-end gap-x-10 gap-y-4 rounded-card border border-card-border bg-card px-5 py-4 shadow-[var(--shadow-card)]"
          style={{ "--i": 2 } as React.CSSProperties}
        >
          <div>
            <dd className="font-mono text-3xl sm:text-4xl font-semibold tabular-nums text-ink-strong leading-none">
              <CountUp value={a.totals.countedVotes} />
            </dd>
            <dt className="mt-2 kicker text-muted">counted votes</dt>
          </div>
          <div>
            <dd className="font-mono text-3xl sm:text-4xl font-semibold tabular-nums text-ink-strong leading-none">
              <CountUp value={a.totals.votingSessions} />
            </dd>
            <dt className="mt-2 kicker text-muted">voting sessions</dt>
          </div>
          <div className="ml-auto flex items-center gap-1.5 self-center">
            <span className="inline-block size-1.5 rounded-full bg-accent shadow-[var(--glow)]" aria-hidden />
            <span className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-accent">
              Live
            </span>
          </div>
        </dl>
        <p
          className="hero-line mt-4 text-muted text-sm"
          style={{ "--i": 3 } as React.CSSProperties}
        >
          The tables below sum to exactly the vote count. Win rates carry Wilson 95% intervals
          and stay hidden until n≥{MIN_N}; full inclusion rules in Methods at the bottom.
        </p>
        <p className="mt-3 text-sm">
          <Link
            href="/"
            {...(embed && { target: "_blank" })}
            className="font-semibold text-accent hover:underline"
          >
            Cast your own votes{embed ? " at judgment-call.vercel.app" : ""} →
          </Link>
        </p>
        <YourContribution />

        {(() => {
          // The desk's scoreboard: every stance graded against the live tables.
          const graded = HOUSE_VIEW.map((h) => ({
            h,
            verdict: deskVerdict(
              a.attributeStats.find(
                (s) => s.attribute === h.attribute && s.valueA === h.valueA && s.valueB === h.valueB
              ),
              h
            ),
          }));
          const concurs = graded.filter((g) => g.verdict === "ROOM CONCURS").length;
          const overruled = graded.filter((g) => g.verdict === "ROOM OVERRULES").length;
          const open = graded.length - concurs - overruled;
          return (
            <section className="mt-8 scroll-mt-6" id="house-view">
              <h2 className="kicker text-muted"><span className="text-ink-strong">01</span> · The House View</h2>
              <div className="mt-2 rounded-card border-l-[3px] border-rule-strong bg-wash px-5 py-4">
                <p className="text-sm leading-relaxed text-pretty">
                  This study is not neutral. On {HOUSE_VIEW[0].registered} the desk put{" "}
                  {HOUSE_VIEW.length} calls on the record — one per craft contrast, written before
                  the data and frozen since (changing one requires a new dated entry; the old line
                  stays in the git history). Each call is printed beside its caliper below, and the
                  room is free to overrule us in public.
                </p>
                <p className="mt-3 font-mono text-xs text-muted tabular-nums">
                  standing: room concurs {concurs} · room overrules {overruled} · still open {open}{" "}
                  of {HOUSE_VIEW.length}
                </p>
              </div>
            </section>
          );
        })()}

        <section className="card-reveal mt-8">
          <h2 className="kicker text-muted"><span className="text-ink-strong">02</span> · Attribute head-to-heads</h2>
          <p className="mt-1 text-sm text-muted">
            Ranked by how firmly the room has settled each call — decided contrasts lead,
            still-collecting pairs trail.
          </p>
          {/* Interactive: Everyone / Executives / Analysts filter. Per-segment
              craft stats already exist upstream (fidelity excluded); each view's
              suppressed rows stay one uniform collecting block. */}
          <ResultsHeadToHeads
            overall={buildH2HRows(a.attributeStats)}
            executive={buildH2HRows(a.segmentStats.executive ?? [])}
            analyst={buildH2HRows(a.segmentStats.analyst ?? [])}
            minN={MIN_N}
          />
        </section>

        <section className="card-reveal mt-8">
          <h2 className="kicker text-muted"><span className="text-ink-strong">03</span> · Executives vs. analysts</h2>
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
                <div key={`${e.attribute}:${e.valueA}`} className="py-3.5 border-b border-card-border last:border-b-0">
                  <p className="text-sm font-semibold">
                    {e.valueALabel} <span className="text-muted font-normal">vs</span> {e.valueBLabel}
                  </p>
                  {/* Both segments on ONE caliper: executives = filled dot,
                      analysts = hollow ring. The gap between the marks IS the
                      disagreement. */}
                  <div className="relative mt-2.5 h-7" aria-hidden>
                    <div className="absolute left-0 right-0 top-1/2 h-px bg-card-border" />
                    {[0, 25, 75, 100].map((t) => (
                      <div
                        key={t}
                        className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-card-border"
                        style={{ left: `${t}%` }}
                      />
                    ))}
                    <div className="absolute left-1/2 top-1/2 h-4 w-px -translate-y-1/2 bg-rule-strong" />
                    <div
                      className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
                      style={{ left: pct(e.rateA!) }}
                    />
                    <div
                      className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-card"
                      style={{ left: pct(an!.rateA!) }}
                    />
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted tabular-nums">
                    ● executives {pct(e.rateA!)} (n={e.n}) · ○ analysts {pct(an!.rateA!)} (n=
                    {an!.n}) · gap {Math.abs(Math.round((e.rateA! - an!.rateA!) * 100))}pp
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="card-reveal mt-8">
          <h2 className="kicker text-muted"><span className="text-ink-strong">04</span> · Top telling per finding</h2>
          <p className="mt-1 text-sm text-muted">
            Variants only ever compete within their own finding, so ratings don&apos;t compare
            across findings — no global leaderboard, by design.
          </p>
          <div className="mt-2 space-y-3">
            {a.leaderboard.map((row) => {
              const total = row.wins + row.losses;
              const winShare = total > 0 ? row.wins / total : 0;
              return (
                <div key={row.findingId} className="rounded-card border border-card-border bg-card p-4">
                  <p className="text-xs text-muted">{row.findingTitle}</p>
                  <p className="mt-1 font-serif text-[1.0625rem] leading-relaxed text-ink-strong text-pretty">{row.text}</p>
                  {/* Win-share bar: an honest read of head-to-head record (not a
                      time trend — per-variant Elo history isn't stored). */}
                  {total > 0 && (
                    <div
                      className="mt-2.5 flex h-1.5 overflow-hidden rounded-[2px] bg-card-border"
                      role="img"
                      aria-label={`Won ${Math.round(winShare * 100)}% of ${total} head-to-heads`}
                    >
                      <div className="h-full bg-accent/70" style={{ width: `${winShare * 100}%` }} />
                    </div>
                  )}
                  <p className="mt-2 font-mono text-xs text-muted tabular-nums">
                    Elo {Math.round(row.elo)} · {row.wins}W–{row.losses}L
                    {total > 0 ? ` · ${Math.round(winShare * 100)}% win rate` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card-reveal mt-8">
          <h2 className="kicker text-muted"><span className="text-ink-strong">05</span> · Study log</h2>
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
          <h2 className="kicker text-muted"><span className="text-ink-strong">06</span> · Methods</h2>
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
              <strong className="text-foreground">Sources.</strong> Findings mix real public data
              — SEC filings, federal economic series — with realistic fictional scenarios
              (marked &ldquo;fictional&rdquo; on the card). Real-data cards link their source,
              every telling is validated against the underlying numbers before it can serve, and
              real-data findings stop serving 90 days after retrieval so stale figures never
              circulate.
            </p>
            <p>
              <strong className="text-foreground">Disclosure.</strong> A small share of tellings
              are deliberately written to subtly exceed their underlying data; that contrast is
              measured as a separate, blinded experiment and reported with its own methods when
              the sample is defensible — which tellings those are is never revealed while
              voting. Deliberately overclaimed tellings are never attached to findings about
              real, named companies; they appear only on aggregate-data and fictional findings.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
