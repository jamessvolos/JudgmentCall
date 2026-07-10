// The methods protocol — six anchored, citable clauses (M·01…M·06): inclusion
// gates as dot-leader ledger rows, the live sample with a reconciling sum, the
// position-bias self-check on the findings' own caliper, thresholds, sources,
// and the disclosure (verbatim, last, unornamented). Server-rendered only; no
// client JS. Rendered by /methods (its own citable page); /results keeps a
// two-line pointer so the n≥ floor stays visible where rates are hidden.

type Interval = { lo: number; hi: number };
export type MethodsAnalytics = {
  totals: { countedVotes: number; votingSessions: number };
  segmentComposition: { segment: string; counted: number }[];
  positionBias: { n: number; leftRate: number | null; interval: Interval | null };
};

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function MethodsProtocol({ a, minN }: { a: MethodsAnalytics; minN: number }) {
  return (
    <div className="mt-4">
      <MethodClause id="m-01" index="M·01" title="What counts">
        <div className="space-y-1.5">
          <MethodRow label="Vote" value="decided — never “can’t decide”" />
          <MethodRow label="Contrast" value="exactly 1 craft attribute" />
          <MethodRow label="Repeat pair" value="excluded within a session" />
          <MethodRow label="Time to decision" value="≥ 0.8 s" />
        </div>
        <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-muted">
          The 0.8&thinsp;s is a latency floor, not a comprehension check. Everything is still
          logged; exclusions only affect published statistics.
        </p>
      </MethodClause>

      <MethodClause id="m-02" index="M·02" title="Sample">
        {a.segmentComposition.length === 0 ? (
          <p className="text-sm italic text-muted/55">No counted votes yet.</p>
        ) : (
          <>
            <div className="space-y-1.5">
              {a.segmentComposition.map((sc) => (
                <MethodRow
                  key={sc.segment}
                  label={sc.segment.replace(/_/g, " ")}
                  value={sc.counted.toLocaleString()}
                />
              ))}
              <MethodRow label="Σ counted" value={a.totals.countedVotes.toLocaleString()} strong />
            </div>
            <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-muted">
              The sum reconciles with the counted-votes readout on the results page. Segments are
              one-tap self-reports by anonymous sessions; treat cross-segment comparisons
              accordingly.
            </p>
          </>
        )}
      </MethodClause>

      <MethodClause id="m-03" index="M·03" title="Position check">
        <PositionCheckCard pb={a.positionBias} minN={minN} />
      </MethodClause>

      <MethodClause id="m-04" index="M·04" title="Thresholds">
        <p className="text-sm leading-relaxed text-muted">
          No win rate is shown below{" "}
          <span className="font-mono text-ink-strong tabular-nums">n ≥ {minN}</span> — a
          conventional floor for a stable Wilson interval, not a significance claim. Everything
          published live is descriptive; formal analysis (Bradley–Terry with finding fixed
          effects, preregistered cuts) runs separately before anything is published as a finding.
        </p>
      </MethodClause>

      <MethodClause id="m-05" index="M·05" title="Sources">
        <p className="text-sm leading-relaxed text-muted">
          Findings mix real public data — SEC filings, federal economic series — with fictional
          scenarios, marked as such on the card. Real-data cards link their source, every telling
          is validated against the underlying numbers before it can serve, and real-data findings
          retire <span className="font-mono text-ink-strong tabular-nums">90 days</span> after
          retrieval.
        </p>
      </MethodClause>

      <MethodClause id="m-06" index="M·06" title="Disclosure">
        <p className="border-l-2 border-rule-strong pl-3 text-sm leading-relaxed text-muted">
          A small share of tellings are deliberately written to subtly exceed their underlying
          data; that contrast is measured as a separate, blinded experiment and reported with its
          own methods when the sample is defensible — which tellings those are is never revealed
          while voting. Deliberately overclaimed tellings are never attached to findings about
          real, named companies; they appear only on aggregate-data and fictional findings.
        </p>
      </MethodClause>
    </div>
  );
}

/** One citable protocol clause: anchored mono index rail + titled content. */
function MethodClause({
  id,
  index,
  title,
  children,
}: {
  id: string;
  index: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className="scroll-mt-6 border-t border-card-border py-5 sm:grid sm:grid-cols-[72px_1fr] sm:gap-x-4"
    >
      <p className="kicker text-muted">
        <a href={`#${id}`} className="hover:underline decoration-card-border underline-offset-2">
          {index}
        </a>
      </p>
      <div className="mt-1.5 sm:mt-0">
        <p className="kicker text-ink-strong">{title}</p>
        <div className="mt-2.5">{children}</div>
      </div>
    </div>
  );
}

/** Dot-leader ledger row (the submit-page primitive): mono label · leader · value. */
function MethodRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline gap-2 ${strong ? "border-t border-rule-strong/60 pt-1.5" : ""}`}>
      <span className="kicker shrink-0 text-muted">{label}</span>
      <span
        className="min-w-3 flex-1 translate-y-[-0.28em] border-b border-dotted border-rule-strong/45"
        aria-hidden
      />
      <span className="text-right font-mono text-[0.8125rem] text-ink-strong tabular-nums text-pretty">
        {value}
      </span>
    </div>
  );
}

/** M·03 — the live position self-check, on the findings' own caliper (same 0–100
 *  scale as the head-to-heads; a zoomed axis would dramatize noise). The chip
 *  states the geometric fact, never a verdict — and the failure state ships
 *  before any failure, so its copy can't soften after the fact. */
function PositionCheckCard({
  pb,
  minN,
}: {
  pb: { n: number; leftRate: number | null; interval: Interval | null };
  minN: number;
}) {
  const running = (
    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-accent" aria-hidden>
      <span className="inline-block size-1.5 rounded-full bg-accent shadow-[var(--glow)]" />
      RUNNING
    </span>
  );

  if (pb.leftRate === null || pb.interval === null) {
    return (
      <div className="rounded-card border border-card-border bg-card px-4 py-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-3">
          <p className="kicker text-muted">Live self-check</p>
          {running}
        </div>
        <p className="mt-3 font-mono text-xs text-muted tabular-nums">
          COLLECTING — {pb.n}/{minN} decided votes before this check reads
        </p>
        <div
          className="mt-2 h-2.5 overflow-hidden rounded-[2px]"
          style={{
            background:
              "repeating-linear-gradient(-45deg, var(--card-border), var(--card-border) 3px, transparent 3px, transparent 7px)",
          }}
        >
          <div className="h-full bg-card-border" style={{ width: `${Math.min(100, (pb.n / minN) * 100)}%` }} />
        </div>
        <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-muted">
          Left/right placement is randomized server-side. An interval excluding 50% would
          indicate position bias.
        </p>
      </div>
    );
  }

  const { lo, hi } = pb.interval;
  const excludes = lo > 0.5 || hi < 0.5;
  return (
    <div className="rounded-card border border-card-border bg-card px-4 py-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-3">
        <p className="kicker text-muted">Live self-check</p>
        {running}
      </div>

      <p className="mt-3 font-mono tabular-nums">
        <span className="text-2xl font-semibold leading-none text-ink-strong">
          {(pb.leftRate * 100).toFixed(1)}%
        </span>
        <span className="ml-2 text-xs text-muted">
          LEFT SLOT · n = {pb.n.toLocaleString()}
        </span>
      </p>

      <div className="relative mt-3 h-7" aria-hidden>
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
          className="absolute top-1/2 h-2.5 -translate-y-1/2 border-x-2 border-t-2 border-accent"
          style={{ left: pct(lo), width: `${Math.max(1, Math.round((hi - lo) * 100))}%` }}
        />
        <div
          className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
          style={{ left: pct(pb.leftRate) }}
        />
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <p className="font-mono text-xs text-muted tabular-nums">
          95% interval {(lo * 100).toFixed(1)}–{(hi * 100).toFixed(1)}
        </p>
        <span
          className={`shrink-0 rounded-chip border px-1.5 py-px font-mono text-[10px] font-semibold tracking-[0.14em] ${
            excludes ? "border-danger text-danger" : "border-accent text-accent"
          }`}
        >
          {excludes ? "INTERVAL EXCLUDES 50 — FLAG" : "INTERVAL COVERS 50"}
        </span>
      </div>

      <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-muted">
        Left/right placement is randomized server-side. An interval excluding 50% would indicate
        position bias{excludes ? " — treat every pairwise result above with suspicion until this clears." : "."}
      </p>
      <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-muted/80">
        The failure state of this check is written and deployed before any failure — its copy
        does not get to soften after the fact.
      </p>
    </div>
  );
}
