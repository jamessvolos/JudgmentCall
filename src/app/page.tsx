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
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent mb-4">
          Judgment Call
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
          Two versions of the same insight. Tap the better one.
        </h1>
        <p className="mt-4 text-muted">
          Ten quick calls, then see what you value in a data story. Your votes feed a{" "}
          <a href="/results" className="text-accent hover:underline">
            public study
          </a>{" "}
          of what makes data stories land. No sign-up.
        </p>

        {returning && (
          <button
            onClick={() => pick(returning.segment)}
            disabled={pending !== null}
            className="mt-8 w-full rounded-xl bg-accent px-4 py-4 text-base font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
          >
            {`Welcome back — continue as ${SEGMENT_LABELS[returning.segment]} (${returning.voteCount} calls so far)`}
          </button>
        )}
        <p className="mt-10 mb-3 text-sm font-medium text-muted">
          {returning ? "…or switch roles:" : "I mostly read data as a(n)…"}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {SEGMENTS.map((segment) => (
            <button
              key={segment}
              onClick={() => pick(segment)}
              disabled={pending !== null}
              className="rounded-xl border border-card-border bg-card px-4 py-4 text-base font-semibold shadow-sm transition hover:border-accent hover:text-accent active:scale-[0.98] disabled:opacity-60"
            >
              {pending === segment ? "Starting…" : SEGMENT_LABELS[segment]}
            </button>
          ))}
        </div>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </main>
  );
}
