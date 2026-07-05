"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionId } from "@/lib/session-client";

// "Run this on your numbers" — the BYO-data page, reimagined as an optical
// bench: THE INSTRUMENT (you compose on the left) and THE PLATE (a live spec
// plate that assembles as you type, on the right). The three-part TRUTH
// (fact → driver → limitation) is the hero: the limitation you write draws a
// luminous "claim line" across the plate — the boundary a telling may not
// claim past, made a machined, visible thing. Not a voting surface, so accent
// and the datum beam are welcome here; no fidelity/experiment vocabulary.

type Key =
  | "deckName"
  | "title"
  | "contextSnippet"
  | "sourceLabel"
  | "fact"
  | "driver"
  | "limitation";

const TRUTH_HELP: Record<"fact" | "driver" | "limitation", string> = {
  fact: "State it with exact figures.",
  driver: "Name what moved it.",
  limitation: "Name what it cannot claim — this sets the boundary.",
};

// Light numeric tokens on the plate (figures emit accent — earned by data).
// Scoped to the plate render only; the inputs stay plain text.
function litFigures(text: string) {
  const parts = text.split(/(\$?\d[\d,.]*\s?(?:%|pp|bps|×|x|B|M|K|bn|m|k)?)/g);
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <span key={i} className="text-accent">
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

// Minimal, dependency-free render of the data snippet: **bold** spans, the rest
// plain, figures lit. Never a markdown library.
function renderData(text: string) {
  const segs = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return segs.map((s, i) =>
    s.startsWith("**") && s.endsWith("**") ? (
      <strong key={i} className="font-semibold text-ink-strong">
        {litFigures(s.slice(2, -2))}
      </strong>
    ) : (
      <span key={i}>{litFigures(s)}</span>
    )
  );
}

/** A dot-leader ledger row: mono label · dotted leader · value (etched when empty). */
function Row({
  label,
  value,
  serif,
  ghost,
}: {
  label: string;
  value: React.ReactNode;
  serif?: boolean;
  ghost: string;
}) {
  const empty = value === "" || value === null || value === undefined;
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="kicker shrink-0 text-muted">{label}</span>
      <span className="min-w-3 flex-1 translate-y-[-0.28em] border-b border-dotted border-rule-strong/45" aria-hidden />
      <span
        className={`${serif ? "font-serif" : "font-mono"} ${
          empty ? "text-muted/55 italic" : "text-ink-strong"
        } text-right text-pretty`}
      >
        {empty ? ghost : value}
      </span>
    </div>
  );
}

export default function SubmitPage() {
  const router = useRouter();
  const [v, setV] = useState<Record<string, string>>({ domain: "ops" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLTextAreaElement | HTMLSelectElement>) =>
    setV((prev) => ({ ...prev, [k]: e.target.value }));

  const filled = (k: Key) => (v[k] ?? "").trim().length >= 3;
  const ready = useMemo(
    () =>
      (["deckName", "title", "contextSnippet", "sourceLabel", "fact", "driver", "limitation"] as Key[]).every(
        filled
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [v]
  );
  const done = (["deckName", "title", "contextSnippet", "sourceLabel", "fact", "driver", "limitation"] as Key[]).filter(
    filled
  ).length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: getSessionId(), ...v }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "submit failed");
      router.push(`/d/${data.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "submit failed");
      setBusy(false);
    }
  }

  // A composed field: mono label, teaching line, edge-lit input; the label
  // brightens to accent once the field has earned its light. This is a plain
  // render helper called inline (NOT a <Component/>) so the textarea is never
  // remounted mid-typing — a component defined in render would drop focus on
  // every keystroke.
  const field = ({
    k,
    label,
    help,
    ph,
    rows = 1,
  }: {
    k: Key;
    label: string;
    help?: string;
    ph: string;
    rows?: number;
  }) => (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className={`kicker ${filled(k) ? "text-accent" : "text-muted"}`}>{label}</span>
        {help && <span className="font-sans text-xs text-muted text-right">{help}</span>}
      </span>
      <textarea
        required
        minLength={3}
        rows={rows}
        placeholder={ph}
        value={v[k] ?? ""}
        onChange={set(k)}
        className="mt-1.5 w-full resize-y rounded-chip border border-card-border bg-card px-3 py-2 font-sans text-sm shadow-[var(--inset-well)] transition focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      />
    </label>
  );

  return (
    <main className="relative flex-1 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto w-full max-w-6xl">
        {/* Masthead */}
        <div className="hero-line" style={{ "--i": 0 } as React.CSSProperties}>
          <p className="kicker text-muted">Judgment Call · Bring your data</p>
          <h1 className="mt-2 font-sans font-semibold text-ink-strong text-[clamp(2rem,4.6vw,3.25rem)] leading-[1.02] tracking-[-0.03em] text-balance">
            Run this on your numbers
          </h1>
          <p className="mt-3 max-w-2xl font-sans text-[0.95rem] leading-[1.55] text-muted text-pretty">
            Write up one finding and watch the preview build as you type. You get a private deck —
            six tellings of your fact, reviewed before anyone votes, on a link only you share. Your
            deck&apos;s votes never enter the public study. You own the truth claim; write it in three
            lines.
          </p>
        </div>

        <div className="datum hero-line mt-5" style={{ "--i": 1 } as React.CSSProperties} aria-hidden />

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.02fr_1px_0.98fr] lg:gap-10">
          {/* ── THE INSTRUMENT ─────────────────────────────────────────── */}
          <form onSubmit={submit} className="hero-line min-w-0 space-y-8" style={{ "--i": 2 } as React.CSSProperties}>
            <fieldset className="space-y-4">
              <legend className="mb-1 flex items-baseline gap-2">
                <span className="font-mono text-xs font-semibold text-muted tabular-nums">01</span>
                <span className="kicker text-ink-strong">Identity</span>
              </legend>
              {field({ k: "deckName", label: "Deck name", ph: "Q3 board pack" })}
              {field({ k: "title", label: "Finding title", ph: "Churn fell after the pricing change" })}
              {field({ k: "sourceLabel", label: "Source label", ph: "Internal retention dashboard" })}
              <label className="block">
                <span className="kicker text-muted">Domain</span>
                <select
                  value={v.domain}
                  onChange={set("domain")}
                  className="mt-1.5 w-full rounded-chip border border-card-border bg-card px-3 py-2 font-mono text-sm shadow-[var(--inset-well)] focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                >
                  {["earnings", "econ", "sports", "ops"].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="mb-1 flex items-baseline gap-2">
                <span className="font-mono text-xs font-semibold text-muted tabular-nums">02</span>
                <span className="kicker text-ink-strong">The data</span>
              </legend>
              {field({ k: "contextSnippet", label: "One stat or 1–3 rows", help: "**bold** the headline", ph: "**Churn, Q3:** 2.1% (Q2: 3.4%) · Pricing change shipped July 1", rows: 2 })}
            </fieldset>

            {/* THE TRUTH — the hero panel */}
            <fieldset className="space-y-4 rounded-card border border-card-border bg-wash p-4 shadow-[var(--shadow-card)] sm:p-5">
              <legend className="flex items-baseline gap-2 px-1">
                <span className="font-mono text-xs font-semibold text-accent tabular-nums">03</span>
                <span className="kicker text-ink-strong">The truth · what a telling may claim</span>
              </legend>
              {field({ k: "fact", label: "The fact", help: TRUTH_HELP.fact, ph: "Monthly churn fell from 3.4% in Q2 to 2.1% in Q3." })}
              {field({ k: "driver", label: "The driver", help: TRUTH_HELP.driver, ph: "The decline followed the July 1 pricing change." })}
              {field({ k: "limitation", label: "The limitation", help: TRUTH_HELP.limitation, ph: "One quarter of data; correlational, not proven causal.", rows: 2 })}
            </fieldset>

            <div className="space-y-3">
              <button
                disabled={busy || !ready}
                className={`w-full rounded-card px-4 py-3.5 text-sm font-semibold transition disabled:cursor-not-allowed ${
                  ready
                    ? "cta-glow bg-accent text-on-accent"
                    : "border border-card-border bg-card text-muted"
                }`}
              >
                {busy
                  ? "Creating deck…"
                  : ready
                    ? "Create my private deck →"
                    : `Compose the finding — ${done}/7`}
              </button>
              {error && <p className="text-sm text-danger">{error}</p>}
              <p className="font-mono text-[0.6875rem] leading-relaxed text-muted">
                Don&apos;t submit confidential or personal data — anyone with the deck link can read it.
              </p>
            </div>
          </form>

          {/* ── THE DATUM BEAM (column divider, desktop only) ──────────── */}
          <div className="datum hidden self-stretch lg:block lg:w-px" aria-hidden style={{ height: "auto" }} />

          {/* ── THE PLATE (live preview; decorative mirror of the form) ── */}
          <aside
            aria-hidden
            className="hero-line lg:sticky lg:top-6 lg:self-start"
            style={{ "--i": 3 } as React.CSSProperties}
          >
            <div className="well overflow-hidden rounded-card border border-card-border bg-card p-5 sm:p-6">
              <div className="flex items-baseline justify-between">
                <span className="masthead text-ink-strong">Private deck</span>
                <span className="font-mono text-[0.6875rem] text-muted">
                  {v.deckName?.trim() ? `· ${v.deckName.trim()}` : "· unnamed"}
                </span>
              </div>
              <div className="datum mt-2" />

              <h2 className="mt-4 font-serif text-xl font-semibold leading-snug text-balance">
                {v.title?.trim() ? (
                  <span className="text-ink-strong">{v.title.trim()}</span>
                ) : (
                  <span className="text-muted/55 italic">Your finding title</span>
                )}
              </h2>

              <div className="mt-3 rounded-chip bg-wash px-3 py-2.5 font-mono text-[0.8125rem] leading-relaxed">
                {v.contextSnippet?.trim() ? (
                  renderData(v.contextSnippet.trim())
                ) : (
                  <span className="text-muted/55 italic">**Your headline:** the stat that carries it</span>
                )}
              </div>
              <p className="mt-1.5 font-mono text-[0.6875rem] text-muted">
                {v.sourceLabel?.trim() ? v.sourceLabel.trim() : "source label"}
              </p>

              {/* THE TRUTH ledger */}
              <p className="kicker mt-5 text-muted">What a telling may claim</p>
              <div className="mt-2.5 space-y-2.5">
                <Row label="Fact" ghost="state it with exact figures" serif value={v.fact?.trim() ? litFigures(v.fact.trim()) : ""} />
                <Row label="Driver" ghost="what moved it" serif value={v.driver?.trim() ? v.driver.trim() : ""} />
              </div>

              {/* THE CLAIM LINE — drawn once the limitation is written */}
              <div className="mt-4">
                {v.limitation?.trim() ? (
                  <>
                    <div className="rule-draw datum" />
                    <p className="rise mt-1.5 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-accent">
                      A telling may not claim past this line
                    </p>
                    <p className="rise mt-1.5 font-mono text-[0.8125rem] leading-relaxed text-ink-strong">
                      {v.limitation.trim()}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="h-px w-full bg-rule-strong/25" />
                    <p className="mt-1.5 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted/55">
                      The boundary — write the limitation
                    </p>
                  </>
                )}
              </div>

              <div className="mt-5 border-t border-card-border pt-3">
                <p className="font-mono text-[0.6875rem] leading-relaxed text-muted">
                  {ready
                    ? "PLATE READY · six tellings written & reviewed after you create the deck"
                    : "six tellings written & reviewed after you create the deck"}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
