import Link from "next/link";
import { computeAnalyticsCached, MIN_N, wilson, type ValuePairStat } from "@/lib/analytics";
import { HOUSE_VIEW, stanceFor, type HouseStance } from "@/lib/house-view";
import { deskVerdict, verdictChipLabel, verdictChipTone, type DeskVerdict } from "@/lib/desk-verdict";
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
          // §01 — The Desk's Calls: the registry of preregistered stances, shown
          // whole in frozen registration order (§02 below re-ranks by evidence —
          // the record vs. the reading). Light physics: the frozen columns
          // (index, contrast, pick, quote) never carry accent; only the room's
          // verdict column is lit. Each row anchors itself (R·nn) and links to
          // its §02 caliper row.
          const graded = HOUSE_VIEW.map((h, i) => ({
            h,
            n: String(i + 1).padStart(2, "0"),
            anchor: `${h.attribute}-${h.valueA}-${h.valueB}`.replace(/[^a-zA-Z0-9_-]/g, ""),
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
          const allOpen = concurs === 0 && overruled === 0;
          return (
            <section className="mt-8 scroll-mt-6" id="desk-calls">
              <h2 className="kicker text-muted"><span className="text-ink-strong">01</span> · The Desk&apos;s Calls</h2>
              <div className="mt-2 rounded-card border-l-[3px] border-rule-strong bg-wash px-5 py-4">
                <p className="text-sm leading-relaxed text-pretty">
                  This study is not neutral. On {HOUSE_VIEW[0].registered} the desk put
                  {` ${HOUSE_VIEW.length} `}calls on the record — one per craft contrast, written before
                  the first vote and frozen since. The room votes blind and grades us live: a call
                  is concurred or overruled only when the room&apos;s 95% interval clears 50%.
                  Wins and losses print alike.
                </p>
              </div>

              <div className="card-reveal mt-3 rounded-card border border-card-border bg-card px-5 shadow-[var(--shadow-card)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border py-3">
                  <span
                    className="inline-block rounded-[2px] border border-rule-strong px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.18em] text-ink-strong"
                    style={{ transform: "rotate(-2deg)" }}
                  >
                    REG {HOUSE_VIEW[0].registered} · {HOUSE_VIEW.length} CALLS
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] text-accent" aria-hidden>
                    <span className="inline-block size-1.5 rounded-full bg-accent shadow-[var(--glow)]" />
                    GRADED LIVE
                  </span>
                </div>

                {graded.map(({ h, n, anchor, verdict }) => (
                  <div
                    key={`${h.attribute}:${h.valueA}|${h.valueB}`}
                    id={`r-${n}`}
                    className="scroll-mt-6 border-b border-card-border py-3 last:border-b-0"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <Link
                        href={`/calls/${n}`}
                        title="This call's own page — cite it, share it"
                        className="kicker shrink-0 text-muted decoration-card-border underline-offset-2 hover:underline"
                      >
                        R·{n}
                      </Link>
                      <a
                        href={`#${anchor}`}
                        className="text-sm font-semibold text-ink-strong decoration-card-border underline-offset-2 hover:underline"
                      >
                        {VALUE_LABELS[h.valueA] ?? h.valueA}{" "}
                        <span className="font-normal text-muted">vs</span>{" "}
                        {VALUE_LABELS[h.valueB] ?? h.valueB}
                      </a>
                      <span
                        className="min-w-3 flex-1 translate-y-[-0.28em] border-b border-dotted border-rule-strong/45"
                        aria-hidden
                      />
                      <span className="shrink-0 font-mono text-[0.8125rem] text-ink-strong">
                        {VALUE_LABELS[h.pick] ?? h.pick}
                      </span>
                      <span
                        className={`shrink-0 rounded-chip border px-1.5 py-px font-mono text-[10px] font-semibold tracking-[0.14em] ${verdictChipTone(verdict)}`}
                      >
                        {verdictChipLabel(verdict)}
                      </span>
                    </div>
                    <p className="mt-1 font-serif text-[0.9375rem] leading-snug text-muted text-pretty">
                      &ldquo;{h.line}&rdquo;
                    </p>
                  </div>
                ))}

                <div className="border-t border-rule-strong/60 py-3">
                  <p className="font-mono text-xs text-muted tabular-nums">
                    {allOpen ? (
                      <>
                        STANDING — {HOUSE_VIEW.length} calls on the record · first verdicts land
                        at n≥{MIN_N}
                      </>
                    ) : (
                      <>
                        STANDING — <span className="text-accent">concurs {concurs}</span> ·{" "}
                        <span className="text-danger">overrules {overruled}</span> · open {open}{" "}
                        <span className="text-ink-strong">of {HOUSE_VIEW.length}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <p className="mt-2 font-mono text-[0.6875rem] leading-relaxed text-muted">
                Amending a call requires a new dated entry; the old line stays in the git
                history. Record frozen at{" "}
                <a
                  href="https://github.com/jamessvolos/JudgmentCall/blob/be329f43888be39aa32d61342ddd70def526589f/src/lib/house-view.ts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  be329f4 · src/lib/house-view.ts
                </a>
                . Graded at 95%, roughly one verdict in {HOUSE_VIEW.length} should eventually be
                wrong by chance — noted now, before it happens.
              </p>
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
              // The n≥MIN_N promise ("no win rate is shown below n ≥ 30", §06 and
              // the header) binds this section too: the raw W–L record is data,
              // the derived rate is the protected inference. Below the floor the
              // bar becomes the same uniform hatched collecting strip as §02.
              const revealed = total >= MIN_N;
              const winShare = total > 0 ? row.wins / total : 0;
              const iv = revealed ? wilson(row.wins, total) : null;
              return (
                <div key={row.findingId} className="rounded-card border border-card-border bg-card p-4">
                  <p className="text-xs text-muted">{row.findingTitle}</p>
                  <p className="mt-1 font-serif text-[1.0625rem] leading-relaxed text-ink-strong text-pretty">{row.text}</p>
                  {/* Win-share bar: an honest read of head-to-head record (not a
                      time trend — per-variant Elo history isn't stored). */}
                  {revealed ? (
                    <div
                      className="mt-2.5 flex h-1.5 overflow-hidden rounded-[2px] bg-card-border"
                      role="img"
                      aria-label={`Won ${Math.round(winShare * 100)}% of ${total} head-to-heads`}
                    >
                      <div className="h-full bg-accent/70" style={{ width: `${winShare * 100}%` }} />
                    </div>
                  ) : (
                    <div
                      className="mt-2.5 h-1.5 overflow-hidden rounded-[2px]"
                      role="img"
                      aria-label={`Collecting: ${total} of ${MIN_N} head-to-heads before the win rate is shown`}
                      style={{
                        background:
                          "repeating-linear-gradient(-45deg, var(--card-border), var(--card-border) 3px, transparent 3px, transparent 7px)",
                      }}
                    >
                      <div
                        className="h-full bg-card-border"
                        style={{ width: `${Math.min(100, (total / MIN_N) * 100)}%` }}
                        title={`Collecting: ${total} of ${MIN_N} votes before this rate is shown`}
                      />
                    </div>
                  )}
                  <p className="mt-2 font-mono text-xs text-muted tabular-nums">
                    Elo {Math.round(row.elo)} · {row.wins}W–{row.losses}L
                    {revealed && iv
                      ? ` · ${Math.round(winShare * 100)}% win rate (${Math.round(iv.lo * 100)}–${Math.round(iv.hi * 100)}% at 95%)`
                      : ` · JURY'S STILL OUT — ${total}/${MIN_N}`}
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

        {/* §06 — pointer: the full protocol lives at /methods (its own citable
            page). The n≥ floor stays here so a hidden rate is explicable in place. */}
        <section className="mt-10 scroll-mt-6" id="methods">
          <h2 className="kicker text-muted"><span className="text-ink-strong">06</span> · Methods</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            A vote counts only when it was decided, first-exposure, differed on exactly one craft
            attribute, and took at least 0.8s; no win rate is shown below{" "}
            <span className="font-mono text-ink-strong tabular-nums">n ≥ {MIN_N}</span>. The full
            protocol — inclusion gates, the live sample, a position-bias self-check, thresholds,
            sources, disclosure — is a page of its own.
          </p>
          <p className="mt-2 text-sm">
            <Link href="/methods" className="font-semibold text-accent hover:underline">
              Read the methods →
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

