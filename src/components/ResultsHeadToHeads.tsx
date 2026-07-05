"use client";

// §02 of /results, made interactive: the attribute head-to-heads with an
// Everyone / Executives / Analysts filter.
//
// BLINDING: this is a client component, so it must import NOTHING from the
// server libs — pulling in `@/lib/types` (which is a sibling of LOW_ATTENTION_MS
// and the fidelity labels) or house-view would ship that vocabulary to the
// browser. Instead the server (results/page.tsx) resolves every row to a
// craft-only, render-ready shape and passes it as props. This component only
// toggles and renders; the only strings it ever sees are public craft labels.
//
// Hard rule preserved: within any one view, every suppressed contrast collapses
// into the same uniform "JURY'S STILL OUT" collecting state; switching segments
// swaps to a different view's uniform block — it never splits a single view's.

import { useState } from "react";

export type H2HRow = {
  key: string;
  anchor: string;
  valueALabel: string;
  valueBLabel: string;
  n: number;
  rateA: number | null;
  intervalLo: number | null;
  intervalHi: number | null;
  suppressed: boolean;
  clears: boolean;
  stancePickLabel: string | null;
  stanceLine: string | null;
  deskVerdict: "ROOM CONCURS" | "ROOM OVERRULES" | "TOO CLOSE TO CALL" | "JURY'S OUT" | null;
};

const pct = (x: number) => `${Math.round(x * 100)}%`;

function verdictTone(v: H2HRow["deskVerdict"]): string {
  return v === "ROOM CONCURS" ? "text-accent" : v === "ROOM OVERRULES" ? "text-danger" : "text-muted";
}

function ContrastRow({ row, minN }: { row: H2HRow; minN: number }) {
  return (
    <div id={row.anchor} className="card-reveal group scroll-mt-6 py-3.5 border-b border-card-border last:border-b-0">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <p>
          <a href={`#${row.anchor}`} className="hover:underline decoration-card-border underline-offset-2">
            <span className="font-semibold">{row.valueALabel}</span>
            <span className="text-muted"> vs </span>
            <span className="font-semibold">{row.valueBLabel}</span>
          </a>
        </p>
        <p className="font-mono text-xs text-muted shrink-0 tabular-nums">
          {row.suppressed ? `JURY'S STILL OUT — ${row.n}/${minN}` : `n=${row.n}`}
        </p>
      </div>
      {row.suppressed ? (
        <div
          className="mt-2.5 h-2.5 rounded-[2px] overflow-hidden"
          style={{
            background:
              "repeating-linear-gradient(-45deg, var(--card-border), var(--card-border) 3px, transparent 3px, transparent 7px)",
          }}
        >
          <div
            className="h-full bg-card-border"
            style={{ width: `${(row.n / minN) * 100}%` }}
            title={`Collecting: ${row.n} of ${minN} votes before this rate is shown`}
          />
        </div>
      ) : (
        <>
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
            {row.intervalLo !== null && row.intervalHi !== null && (
              <div
                className="absolute top-1/2 h-2.5 -translate-y-1/2 border-x-2 border-t-2 border-accent"
                style={{
                  left: pct(row.intervalLo),
                  width: `${Math.max(1, Math.round((row.intervalHi - row.intervalLo) * 100))}%`,
                }}
                title={`95% interval: ${pct(row.intervalLo)}–${pct(row.intervalHi)}`}
              />
            )}
            <div
              className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
              style={{ left: pct(row.rateA!) }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="font-mono text-xs text-muted tabular-nums">
              {row.valueALabel} wins {pct(row.rateA!)} ({pct(row.intervalLo!)}–{pct(row.intervalHi!)} at 95%)
            </p>
            <span
              className={`shrink-0 rounded-chip border px-1.5 py-px font-mono text-[10px] font-semibold tracking-[0.14em] ${
                row.clears ? "border-accent text-accent" : "border-card-border text-muted"
              }`}
            >
              {row.clears ? "INTERVAL CLEARS 50" : "STRADDLES 50"}
            </span>
          </div>
        </>
      )}
      {row.stancePickLabel && (
        <div className="mt-2.5 flex items-start justify-between gap-3 border-l-2 border-rule-strong pl-3">
          <p className="text-[0.8125rem] leading-snug text-muted">
            <span className="font-mono text-[10px] font-semibold tracking-[0.14em] text-ink-strong">
              THE DESK&apos;S CALL:{" "}
            </span>
            <strong className="text-foreground">{row.stancePickLabel}</strong>
            {" — "}
            <em className="font-serif">&ldquo;{row.stanceLine}&rdquo;</em>
          </p>
          {row.deskVerdict && (
            <span className={`shrink-0 font-mono text-[10px] font-semibold tracking-[0.14em] ${verdictTone(row.deskVerdict)}`}>
              {row.deskVerdict}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const SEGMENTS: { id: "overall" | "executive" | "analyst"; label: string }[] = [
  { id: "overall", label: "Everyone" },
  { id: "executive", label: "Executives" },
  { id: "analyst", label: "Analysts" },
];

export function ResultsHeadToHeads({
  overall,
  executive,
  analyst,
  minN,
}: {
  overall: H2HRow[];
  executive: H2HRow[];
  analyst: H2HRow[];
  minN: number;
}) {
  const [seg, setSeg] = useState<"overall" | "executive" | "analyst">("overall");
  const [sort, setSort] = useState<"decisiveness" | "voted" | "az">("decisiveness");
  const rows = seg === "executive" ? executive : seg === "analyst" ? analyst : overall;

  // Hard rule: suppressed rows are one uniform block, always pinned to the
  // bottom in EVERY sort mode. Sorting only ever reorders the resolved/sampled
  // rows above them; the incoming order is already decisiveness-ranked.
  const active = rows.filter((r) => !r.suppressed);
  const suppressed = rows.filter((r) => r.suppressed);
  const sortedActive =
    sort === "voted"
      ? [...active].sort((a, b) => b.n - a.n)
      : sort === "az"
        ? [...active].sort((a, b) => a.valueALabel.localeCompare(b.valueALabel))
        : active; // "decisiveness" — keep the server's decisiveness order
  const displayRows = [...sortedActive, ...suppressed];

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div
          className="inline-flex rounded-chip border border-card-border p-0.5"
          role="tablist"
          aria-label="Filter head-to-heads by who was voting"
        >
          {SEGMENTS.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={seg === s.id}
              onClick={() => setSeg(s.id)}
              className={`rounded-chip px-3 py-1 font-mono text-xs transition ${
                seg === s.id
                  ? "bg-card text-ink-strong shadow-[var(--shadow-card)]"
                  : "text-muted hover:text-ink-strong"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 font-mono text-xs text-muted">
          <span className="sr-only sm:not-sr-only">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "decisiveness" | "voted" | "az")}
            aria-label="Sort head-to-heads"
            className="rounded-chip border border-card-border bg-card px-2 py-1 font-mono text-xs text-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="decisiveness">Most decisive</option>
            <option value="voted">Most voted</option>
            <option value="az">A–Z</option>
          </select>
        </label>
      </div>

      {seg !== "overall" && (
        <p className="mt-2 font-mono text-[0.6875rem] text-muted">
          {SEGMENTS.find((s) => s.id === seg)!.label}&apos; cut · a contrast stays collecting until it
          clears n≥{minN} in this segment.
        </p>
      )}

      <div className="mt-2 rounded-card border border-card-border bg-card px-5 py-2">
        {displayRows.map((r) => (
          <ContrastRow key={`${seg}:${r.key}`} row={r} minN={minN} />
        ))}
      </div>
    </>
  );
}
