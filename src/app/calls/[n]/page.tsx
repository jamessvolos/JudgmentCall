import Link from "next/link";
import { notFound } from "next/navigation";
import { computeAnalyticsCached, MIN_N } from "@/lib/analytics";
import { HOUSE_VIEW } from "@/lib/house-view";
import { deskVerdict, verdictChipLabel, verdictChipTone } from "@/lib/desk-verdict";
import { ATTRIBUTE_LABELS, VALUE_LABELS } from "@/lib/types";

// One desk call, on its own page — the docket row R·nn as a citable, shareable
// object: the preregistered stance (frozen), the room's live verdict (moving),
// and nothing else. The share affordance the docket was missing: a link to
// /calls/7 carries its own OG card into the feed. Craft-only by construction
// (HOUSE_VIEW carries no fidelity vocabulary).

export const dynamic = "force-dynamic";

function callFor(n: number) {
  if (!Number.isInteger(n) || n < 1 || n > HOUSE_VIEW.length) return null;
  return HOUSE_VIEW[n - 1];
}

export async function generateMetadata({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const h = callFor(Number(n));
  if (!h) return {};
  const pair = `${VALUE_LABELS[h.valueA] ?? h.valueA} vs ${VALUE_LABELS[h.valueB] ?? h.valueB}`;
  return {
    title: `Judgment Call — Desk Call R·${n}: ${pair}`,
    description: `${h.line} Registered ${h.registered}; graded live by the room.`,
  };
}

export default async function CallPage({ params }: { params: Promise<{ n: string }> }) {
  const { n: raw } = await params;
  const n = Number(raw);
  const h = callFor(n);
  if (!h) notFound();

  const a = await computeAnalyticsCached();
  const stat = a.attributeStats.find(
    (s) => s.attribute === h.attribute && s.valueA === h.valueA && s.valueB === h.valueB
  );
  const verdict = deskVerdict(stat, h);
  const counted = stat?.n ?? 0;

  return (
    <main className="flex-1 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-xl">
        <div className="hero-line" style={{ "--i": 0 } as React.CSSProperties}>
          <p className="masthead text-ink-strong">Judgment Call · The Desk&apos;s Calls</p>
          <div className="datum mt-1.5" aria-hidden />
        </div>

        <div
          className="hero-line mt-6 rounded-card border border-card-border bg-card p-5 shadow-[var(--shadow-card)]"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          {/* header band: frozen registration on the left, live grading on the right */}
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              R·{n} of {HOUSE_VIEW.length} · REG {h.registered}
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-accent" aria-hidden>
              <span className="inline-block size-1.5 rounded-full bg-accent shadow-[var(--glow)]" />
              GRADED LIVE
            </span>
          </div>

          <p className="mt-4 kicker text-muted">{ATTRIBUTE_LABELS[h.attribute]}</p>
          <h1 className="mt-1 font-sans text-2xl font-semibold tracking-[-0.02em] text-ink-strong text-balance">
            {VALUE_LABELS[h.valueA] ?? h.valueA} <span className="font-normal text-muted">vs</span>{" "}
            {VALUE_LABELS[h.valueB] ?? h.valueB}
          </h1>

          <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="kicker shrink-0 text-muted">The desk picks</span>
            <span
              className="min-w-3 flex-1 translate-y-[-0.28em] border-b border-dotted border-rule-strong/45"
              aria-hidden
            />
            <span className="shrink-0 font-mono text-sm font-semibold text-ink-strong">
              {VALUE_LABELS[h.pick] ?? h.pick}
            </span>
          </div>
          <p className="mt-2 font-serif text-lg leading-snug text-ink-strong text-pretty">
            &ldquo;{h.line}&rdquo;
          </p>

          {/* the room's live read — same contract as the docket */}
          <div className="mt-5 border-t border-card-border pt-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="kicker text-muted">The room</span>
              <span
                className={`shrink-0 rounded-chip border px-1.5 py-px font-mono text-[10px] font-semibold tracking-[0.14em] ${verdictChipTone(verdict)}`}
              >
                {verdictChipLabel(verdict)}
              </span>
              <span className="font-mono text-xs text-muted tabular-nums">
                {verdict === "JURY'S OUT"
                  ? `still collecting — ${counted}/${MIN_N} counted votes before this call is graded`
                  : `n=${counted} · Wilson 95%`}
              </span>
            </div>
          </div>
        </div>

        <p
          className="hero-line mt-4 text-[0.8125rem] leading-relaxed text-muted"
          style={{ "--i": 2 } as React.CSSProperties}
        >
          Registered before the first vote and frozen since — the room grades it live, and wins
          and losses print alike.
        </p>

        <div className="hero-line mt-6 space-y-3" style={{ "--i": 3 } as React.CSSProperties}>
          <Link
            href="/"
            className="cta-glow block w-full rounded-card bg-accent px-4 py-3.5 text-center font-semibold text-on-accent active:scale-[0.98]"
          >
            Cast your own calls →
          </Link>
          <p className="text-center font-mono text-xs text-muted">
            <Link href={`/results#r-${n}`} className="text-accent hover:underline">
              All {HOUSE_VIEW.length} calls on the record →
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
