"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getOrCreateSessionId, getSessionId } from "@/lib/session-client";
import { SEGMENTS, SEGMENT_LABELS, type Segment } from "@/lib/client-constants";

export default function Landing() {
  const router = useRouter();
  const [pending, setPending] = useState<Segment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [returning, setReturning] = useState<{ segment: Segment; voteCount: number } | null>(null);
  const [totals, setTotals] = useState<{ countedVotes: number; votingSessions: number } | null>(
    null
  );

  // Returning visitor: offer to continue instead of a cold start. Progress was
  // always kept server-side — this just makes that visible.
  useEffect(() => {
    // The edition line: live public totals (same numbers as /results). This is
    // the first-timer's social proof, so it must load for EVERYONE — not gated
    // behind the returning-visitor session check below.
    fetch("/api/crowd")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.totals && setTotals(d.totals))
      .catch(() => {});

    // Returning visitor: offer to continue where they left off.
    const id = getSessionId();
    if (!id) return;
    fetch(`/api/results?sessionId=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.voteCount > 0) setReturning({ segment: d.segment, voteCount: d.voteCount });
      })
      .catch(() => {});
  }, []);

  async function pick(segment: Segment) {
    if (pending) return;
    setPending(segment);
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
      setPending(null);
    }
  }

  return (
    <main className="relative flex-1 flex flex-col items-center justify-center px-5 py-12 sm:px-8">
      <div className="w-full max-w-md text-center">
        {/* Masthead: hairline — wordmark — hairline, over the double rule. */}
        <div
          className="hero-line flex items-center gap-3 mb-1"
          style={{ "--i": 0 } as React.CSSProperties}
        >
          <span className="h-px flex-1 bg-rule-strong/40" aria-hidden />
          <p className="masthead text-ink-strong">Judgment Call</p>
          <span className="h-px flex-1 bg-rule-strong/40" aria-hidden />
        </div>
        <div className="hero-line double-rule" style={{ "--i": 0 } as React.CSSProperties} aria-hidden />
        <p
          className="hero-line mt-3 mb-8 font-mono text-[0.75rem] text-muted tabular-nums text-pretty"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          {totals && totals.countedVotes > 0 ? (
            <>
              A live study of data storytelling ·{" "}
              {/* Mechanical counter: the live total ticks up from 0 on load —
                  a small "this is live" heartbeat, reduced-motion safe. The
                  number + its unit never break across a line. */}
              <span className="whitespace-nowrap">
                <span
                  className="count text-ink-strong"
                  style={{ "--num": totals.countedVotes } as React.CSSProperties}
                />{" "}
                calls logged
              </span>{" "}
              · ≈90 seconds
            </>
          ) : (
            "A live study of data storytelling · No sign-up · ≈90 seconds"
          )}
        </p>

        <h1
          className="hero-line font-sans font-semibold text-ink-strong text-[clamp(2.25rem,6.4vw,3.875rem)] leading-[1.0] tracking-[-0.03em] text-balance"
          style={{ "--i": 2 } as React.CSSProperties}
        >
          Two tellings of the same finding.{" "}
          <em className="not-italic text-muted">You make the call.</em>
        </h1>
        <p
          className="hero-line mt-5 font-sans text-lg leading-[1.55] text-muted"
          style={{ "--i": 3 } as React.CSSProperties}
        >
          Ten quick calls, then see what you value in a data story. Your votes feed a{" "}
          <a
            href="/results"
            className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
          >
            public study
          </a>{" "}
          of what makes data stories land — and the desk has{" "}
          <a
            href="/results#house-view"
            className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
          >
            13 calls of its own
          </a>{" "}
          on the record for the room to overrule.
        </p>

        {returning && (
          <button
            onClick={() => pick(returning.segment)}
            disabled={pending !== null}
            className="cta-glow mt-8 w-full rounded-card bg-accent px-4 py-4 text-base font-semibold text-on-accent active:scale-[0.98] disabled:opacity-60"
          >
            {`Welcome back — continue as ${SEGMENT_LABELS[returning.segment]} (${returning.voteCount} calls so far)`}
          </button>
        )}
        <p className="mt-10 mb-3 kicker text-muted">
          {returning ? "…or switch roles" : "I mostly read data as a(n)…"}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {SEGMENTS.map((segment, i) => (
            <button
              key={segment}
              onClick={() => pick(segment)}
              disabled={pending !== null}
              style={{ "--i": i } as React.CSSProperties}
              className="rise group flex items-center justify-center gap-2.5 rounded-card border border-card-border bg-card px-4 py-4 font-sans text-lg font-semibold tracking-[-0.01em] shadow-[inset_0_1px_0_var(--edge-light),var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-rule-strong hover:shadow-[var(--glow)] active:translate-y-0 active:scale-[0.98] disabled:opacity-60"
            >
              {/* The role dot earns accent on hover — this sets a segment, not
                  a data preference, so the instrument rule doesn't apply. */}
              <span
                aria-hidden
                className="inline-block size-3.5 shrink-0 rounded-full border border-rule-strong transition group-hover:translate-x-0.5 group-hover:border-accent group-hover:bg-accent group-active:bg-accent"
              />
              {pending === segment ? "Starting…" : SEGMENT_LABELS[segment]}
            </button>
          ))}
        </div>
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      </div>
    </main>
  );
}
