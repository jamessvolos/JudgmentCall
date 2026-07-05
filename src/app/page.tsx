"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getOrCreateSessionId, getSessionId } from "@/lib/session-client";
import {
  HOUSE_VIEW_COUNT,
  SEGMENTS,
  SEGMENT_LABELS,
  type Segment,
} from "@/lib/client-constants";

// THE LIVE CONSOLE — the landing is the lit control surface of a study that is
// already running. You read the one earned light (the live count you're about
// to change), the specimen makes "pick the one that lands" concrete, then the
// console presents the seven surfaces with Vote as the single glowing action.
//
// The role/seat is DEMOTED from gate to optional calibration: chips only set
// the segment (they never launch); the one Vote CTA starts immediately with the
// segment (default "other", a valid value), so the /results disagreement view
// keeps its signal without forcing a choice.
//
// Blinding: craft-only throughout. No fidelity vocabulary, no hint the study
// hides an experiment; the specimen's two tellings are equally true and differ
// only by style; only experiment-agnostic /api/crowd totals are read.

// The six secondary surfaces, canonical order (matches the footer colophon).
const SURFACES: {
  n: string;
  label: string;
  href: string;
  benefit: string;
  mode: string;
  live?: boolean;
}[] = [
  {
    n: "02",
    label: "Results",
    href: "/results",
    benefit: "See what the room values.",
    mode: "Live findings · Elo leaderboard",
    live: true,
  },
  {
    n: "03",
    label: "Review",
    href: "/review",
    benefit: "See where you're contrarian.",
    mode: "Your last run vs the room & the desk",
  },
  {
    n: "04",
    label: "Train",
    href: "/drill",
    benefit: "Sharpen your eye.",
    mode: "Training room · spot the weaker telling · instant feedback",
  },
  {
    n: "05",
    label: "House View",
    href: "/results#house-view",
    benefit: "Agree — or overrule the desk.",
    mode: `${HOUSE_VIEW_COUNT} preregistered calls on the record`,
  },
  {
    n: "06",
    label: "Bring your data",
    href: "/submit",
    benefit: "Test your own story.",
    mode: "Turn a finding into a head-to-head",
  },
  {
    n: "07",
    label: "Methods",
    href: "/results#methods",
    benefit: "See how it holds up.",
    mode: "How the study works · pairing, intervals, inclusion",
  },
];

export default function Landing() {
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>("other");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returning, setReturning] = useState<{ segment: Segment; voteCount: number } | null>(null);
  const [totals, setTotals] = useState<{ countedVotes: number; votingSessions: number } | null>(
    null
  );

  useEffect(() => {
    // The live readout: public totals (same numbers as /results). Loads for
    // EVERYONE — it's the first-timer's social proof, not gated on a session.
    fetch("/api/crowd")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.totals && setTotals(d.totals))
      .catch(() => {});

    // Returning visitor: offer to continue, and pre-select their seat so a
    // prior role is honored without re-asking.
    const id = getSessionId();
    if (!id) return;
    fetch(`/api/results?sessionId=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.voteCount > 0) {
          setReturning({ segment: d.segment, voteCount: d.voteCount });
          setSegment(d.segment);
        }
      })
      .catch(() => {});
  }, []);

  // The ONE launcher. Starts immediately with the current segment (default
  // "other"); role chips only refine `segment`, they never call this.
  async function start() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: getOrCreateSessionId(),
          segment,
          referrer: document.referrer || null,
          utmSource: new URLSearchParams(window.location.search).get("utm_source"),
        }),
      });
      if (!res.ok) throw new Error(`session failed (${res.status})`);
      router.push("/swipe");
    } catch {
      setError("Couldn't start a session. Please try again.");
      setPending(false);
    }
  }

  const live = totals && totals.countedVotes > 0;

  return (
    <main className="flex-1 px-5 py-12 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        {/* 1 · NAMEPLATE — hairline · wordmark · hairline, live status at the edge */}
        <div
          className="hero-line flex items-center gap-3"
          style={{ "--i": 0 } as React.CSSProperties}
        >
          <span className="h-px flex-1 bg-rule-strong/40" aria-hidden />
          <p className="masthead text-ink-strong">Judgment Call</p>
          <span className="h-px flex-1 bg-rule-strong/40" aria-hidden />
        </div>
        {live && (
          <p
            className="hero-line mt-1.5 flex items-center justify-center gap-1.5 font-mono text-[11px] tracking-wide text-muted"
            style={{ "--i": 0 } as React.CSSProperties}
          >
            <span
              aria-hidden
              className="inline-block size-1.5 rounded-full bg-accent shadow-[var(--glow)]"
            />
            <span className="text-ink-strong">LIVE</span>
            {totals.votingSessions > 0 && (
              <span>· {totals.votingSessions.toLocaleString()} in the room</span>
            )}
          </p>
        )}

        {/* 2 · THE DATUM BEAM — the reference plane, drawn once */}
        <div
          className="hero-line double-rule rule-draw mt-3"
          style={{ "--i": 0 } as React.CSSProperties}
          aria-hidden
        />

        {/* 3 · THE READOUT / HERO WHY */}
        <div className="mt-6 text-center">
          <p
            className="hero-line kicker text-muted"
            style={{ "--i": 1 } as React.CSSProperties}
          >
            A live study of data storytelling
          </p>

          {live ? (
            <div className="hero-line mt-3" style={{ "--i": 2 } as React.CSSProperties}>
              <span
                aria-hidden
                className="count block font-mono font-semibold leading-none text-accent tabular-nums text-[clamp(2.5rem,8vw,4rem)]"
                style={{ "--num": totals.countedVotes } as React.CSSProperties}
              />
              <span className="sr-only">
                {totals.countedVotes.toLocaleString()} calls logged in the study so far
              </span>
              <p className="mt-1.5 font-mono text-[0.75rem] text-muted">
                calls logged in the study so far
              </p>
            </div>
          ) : (
            <p
              className="hero-line mt-3 font-mono text-[0.75rem] text-muted"
              style={{ "--i": 2 } as React.CSSProperties}
            >
              No sign-up · Anonymous · ≈90 seconds
            </p>
          )}

          <h1
            className="hero-line mt-6 font-sans font-semibold text-ink-strong text-[clamp(2.25rem,6.4vw,3.875rem)] leading-[1.0] tracking-[-0.03em] text-balance"
            style={{ "--i": 3 } as React.CSSProperties}
          >
            Two tellings of the same finding. You pick the one that lands.{" "}
            <em className="not-italic text-muted">
              Ten calls, ninety seconds — then your taste, measured.
            </em>
          </h1>
          <p
            className="hero-line mx-auto mt-5 max-w-xl font-sans text-lg leading-[1.55] text-muted"
            style={{ "--i": 4 } as React.CSSProperties}
          >
            Every number on this page is a real vote on which way of telling a data story
            works better. Make ten calls of your own and see your taste — and where you stand
            against the room. No sign-up. Anonymous.
          </p>
        </div>

        {/* 4 · THE SPECIMEN — one call, up close. Obeys the instrument rule:
            the demonstrative pair emits nothing (no accent, no beam, no glow). */}
        <section className="rise mt-12" style={{ "--i": 1 } as React.CSSProperties}>
          <p className="kicker text-muted">One call, up close</p>
          <p className="mt-1 font-sans text-lg font-semibold text-ink-strong tracking-[-0.01em]">
            One finding, two tellings. Which would you pick?
          </p>
          <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-card border border-card-border bg-card-border sm:grid-cols-2">
            <div className="bg-card p-5">
              <p className="kicker text-muted mb-2">Telling A</p>
              <p className="font-serif text-[1.0625rem] leading-[1.58] text-ink-strong text-pretty">
                Remote-first teams shipped 12% more releases last quarter.
              </p>
            </div>
            <div className="bg-card p-5">
              <p className="kicker text-muted mb-2">Telling B</p>
              <p className="font-serif text-[1.0625rem] leading-[1.58] text-ink-strong text-pretty">
                Are we finally seeing the payoff from remote work? Over the last quarter,
                remote-first teams appear to have edged ahead on shipping cadence — by something in
                the low double digits.
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-pretty">
            <span className="text-muted">Most people assume they&apos;d side with the room. </span>
            <span className="font-semibold text-ink-strong">
              Most don&apos;t.
            </span>{" "}
            <span className="text-muted">
              Both tellings are equally true — the only difference is style.
            </span>
          </p>
        </section>

        {/* 5 · THE CONSOLE — the seven surfaces; hierarchy by layout + light */}
        <section className="mt-12">
          <div className="mb-4 flex items-center gap-3">
            <p className="kicker text-muted">Seven ways in</p>
            <span className="h-px flex-1 bg-card-border" aria-hidden />
          </div>

          {/* 01 VOTE — the full-width primary panel, the page's one earned glow */}
          <div className="rounded-card border border-card-border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-sm text-muted tabular-nums">01</span>
              <div>
                <p className="font-sans text-xl font-semibold text-ink-strong tracking-[-0.01em]">
                  Vote
                </p>
                <p className="kicker text-muted mt-1">The 90-second call · ten side-by-side picks</p>
              </div>
            </div>
            <p className="mt-2 text-muted">See what you actually value.</p>
            <button
              onClick={start}
              disabled={pending}
              className="cta-glow mt-4 w-full rounded-card bg-accent px-4 py-4 text-base font-semibold text-on-accent active:scale-[0.98] disabled:opacity-60"
            >
              {pending
                ? "Starting…"
                : returning
                  ? `Continue your run — ${returning.voteCount} calls so far`
                  : "Make your first call →"}
            </button>
            <p className="mt-2 text-center font-mono text-xs text-muted">
              Ten calls · ~90s · no sign-up · anonymous
            </p>

            {/* Optional calibration: chips SET the seat, they never launch. */}
            <div className="well mt-4 rounded-card bg-wash px-4 py-3">
              <p className="kicker text-muted">Optional · tag your seat</p>
              <p className="mt-1 text-sm text-muted">
                {returning
                  ? "…or switch the seat you read data from — it sharpens how your Results compare."
                  : "Where do you read data from? It sharpens how your Results compare — or skip it and make the call."}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SEGMENTS.map((seg) => (
                  <button
                    key={seg}
                    type="button"
                    aria-pressed={segment === seg}
                    onClick={() => setSegment(seg)}
                    className={`rounded-chip border px-3 py-2 font-mono text-sm transition ${
                      segment === seg
                        ? "border-rule-strong bg-card text-ink-strong"
                        : "border-card-border bg-card/40 text-muted hover:border-rule-strong"
                    }`}
                  >
                    {SEGMENT_LABELS[seg]}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          </div>

          {/* 02–07 — the six secondary surfaces as milled, ink-only tiles */}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SURFACES.map((s) => (
              <Link
                key={s.n}
                href={s.href}
                className="group rounded-card border border-card-border bg-card p-4 shadow-[var(--shadow-card)] transition hover:-translate-y-px hover:border-rule-strong hover:shadow-[var(--shadow-lift)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-muted tabular-nums transition group-hover:translate-x-0.5">
                    {s.n}
                  </span>
                  <span className="font-sans font-semibold text-ink-strong">{s.label}</span>
                  {s.live && (
                    <span
                      aria-hidden
                      className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-accent"
                    >
                      <span className="inline-block size-1.5 rounded-full bg-accent shadow-[var(--glow)]" />
                      LIVE
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-sm text-muted">{s.benefit}</p>
                <p className="mt-2 font-mono text-[0.6875rem] leading-relaxed text-muted">
                  {s.mode}
                </p>
              </Link>
            ))}
          </div>

          {/* 6 · THE DESK — one real craft stance, on the record */}
          <div className="mt-8 rounded-card border-l-[3px] border-rule-strong bg-wash px-5 py-4">
            <p className="kicker text-muted">The desk, on the record</p>
            <p className="mt-2 font-serif text-lg leading-snug text-ink-strong text-pretty">
              &ldquo;Lead with the figure. A telling that hides its number is asking for trust it
              hasn&apos;t earned yet.&rdquo;
            </p>
            <Link
              href="/results#house-view"
              className="mt-2 inline-block font-mono text-xs text-accent hover:underline"
            >
              Agree or overrule →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
