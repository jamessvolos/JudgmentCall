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

  // Returning visitor: offer to continue instead of a cold start. Progress was
  // always kept server-side — this just makes that visible.
  useEffect(() => {
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
    <main className="flex-1 flex flex-col items-center justify-center px-5 py-12 sm:px-8">
      <div className="w-full max-w-md text-center">
        {/* Masthead: hairline — wordmark — hairline, over the double rule. */}
        <div className="flex items-center gap-3 mb-1">
          <span className="h-px flex-1 bg-card-border" aria-hidden />
          <p className="masthead text-ink-strong">Judgment Call</p>
          <span className="h-px flex-1 bg-card-border" aria-hidden />
        </div>
        <div className="double-rule" aria-hidden />
        <p className="mt-3 mb-8 font-mono text-[0.75rem] text-muted">
          A live study of data storytelling · No sign-up · ≈90 seconds
        </p>

        <h1 className="font-serif font-semibold text-ink-strong text-[clamp(2.125rem,6vw,3.625rem)] leading-[1.06] tracking-[-0.015em] text-balance">
          Two tellings of the same finding. <em>You make the call.</em>
        </h1>
        <p className="mt-4 font-serif text-lg leading-[1.55] text-muted">
          Ten quick calls, then see what you value in a data story. Your votes feed a{" "}
          <a href="/results" className="text-accent hover:underline">
            public study
          </a>{" "}
          of what makes data stories land.
        </p>

        {returning && (
          <button
            onClick={() => pick(returning.segment)}
            disabled={pending !== null}
            className="mt-8 w-full rounded-card bg-accent px-4 py-4 text-base font-semibold text-on-accent shadow-[var(--shadow-card)] transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
          >
            {`Welcome back — continue as ${SEGMENT_LABELS[returning.segment]} (${returning.voteCount} calls so far)`}
          </button>
        )}
        <p className="mt-10 mb-3 kicker text-muted">
          {returning ? "…or switch roles" : "I mostly read data as a(n)…"}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {SEGMENTS.map((segment) => (
            <button
              key={segment}
              onClick={() => pick(segment)}
              disabled={pending !== null}
              className="group flex items-center justify-center gap-2.5 rounded-card border border-card-border bg-card px-4 py-4 font-serif text-lg font-semibold shadow-[var(--shadow-card)] transition hover:border-rule-strong hover:shadow-[var(--shadow-lift)] active:scale-[0.98] disabled:opacity-60"
            >
              <span
                aria-hidden
                className="inline-block size-3.5 shrink-0 rounded-full border border-rule-strong transition group-hover:bg-rule-strong group-active:bg-rule-strong"
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
