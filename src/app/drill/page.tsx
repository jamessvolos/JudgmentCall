"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Snippet } from "@/components/Snippet";
import { getSessionId, nowMs } from "@/lib/session-client";

// "Spot the overclaim" — the training room. Clearly labeled as NOT the study:
// items are purpose-built, feedback is immediate, and attempts never touch
// the public analytics. This is the one place the product says right/wrong.

type DrillDto = {
  item: {
    id: string;
    title: string;
    contextSnippet: string;
    sourceLabel: string;
    a: string;
    b: string;
  } | null;
  remaining: number;
  drillRating: number;
  drillCount: number;
};

type VerdictDto = {
  correct: boolean;
  faithfulSide: "a" | "b";
  device: string;
  explanation: string;
  drillRating: number;
  ratingDelta: number;
  drillCount: number;
  xp: number;
};

export default function DrillPage() {
  const router = useRouter();
  const [drill, setDrill] = useState<DrillDto | null>(null);
  const [verdict, setVerdict] = useState<VerdictDto | null>(null);
  const [picked, setPicked] = useState<"a" | "b" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const renderedAt = useRef(0);
  const sessionIdRef = useRef<string | null>(null);

  const fetchDrill = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    setVerdict(null);
    setPicked(null);
    try {
      const res = await fetch(`/api/drill?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) throw new Error();
      setDrill(await res.json());
      renderedAt.current = nowMs();
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    const sessionId = getSessionId();
    if (!sessionId) {
      router.replace("/");
      return;
    }
    sessionIdRef.current = sessionId;
    fetchDrill();
  }, [router, fetchDrill]);

  async function attempt(side: "a" | "b") {
    const sessionId = sessionIdRef.current;
    if (!drill?.item || !sessionId || submitting || verdict) return;
    setSubmitting(true);
    setPicked(side);
    try {
      const res = await fetch("/api/drill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          drillId: drill.item.id,
          picked: side,
          latencyMs: Math.round(nowMs() - renderedAt.current),
        }),
      });
      if (!res.ok) throw new Error();
      setVerdict(await res.json());
    } catch {
      setError(true);
      setPicked(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex-1 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-end justify-between pb-2">
          <p className="masthead text-ink-strong">Judgment Call</p>
          {drill && (
            <p className="font-mono text-xs text-muted tabular-nums">
              drill rating {verdict ? verdict.drillRating : drill.drillRating}
            </p>
          )}
        </div>
        <div className="double-rule" aria-hidden />

        {/* Quarantine banner: this is training, not the study. */}
        <div className="mt-4 rounded-card border border-card-border bg-wash px-4 py-2.5">
          <p className="kicker text-muted">Training room — not part of the study</p>
          <p className="mt-1 text-xs text-muted">
            One of these tellings subtly exceeds its data. Spot it. Immediate feedback, separate
            rating — none of this touches the public results.
          </p>
        </div>

        {error && (
          <p className="mt-6 text-sm text-danger">
            Something broke.{" "}
            <button onClick={fetchDrill} className="font-semibold text-accent hover:underline">
              Retry
            </button>
          </p>
        )}

        {drill && !drill.item && (
          <div className="mt-8 text-center">
            <p className="font-serif text-xl font-semibold text-ink-strong">
              You&apos;ve cleared every drill.
            </p>
            <p className="mt-2 font-mono text-sm text-muted tabular-nums">
              Final drill rating: {drill.drillRating} · {drill.drillCount} attempted
            </p>
            <Link
              href="/swipe"
              className="mt-6 inline-block rounded-card bg-accent px-6 py-3 font-mono text-sm font-semibold text-on-accent"
            >
              Back to the study →
            </Link>
          </div>
        )}

        {drill?.item && (
          <div key={drill.item.id} className="pair-in mt-5">
            <div className="rounded-card border-l-[3px] border-rule-strong bg-wash px-4 py-3 mb-4">
              <p className="kicker text-muted mb-1.5">The data</p>
              <Snippet markdown={drill.item.contextSnippet} className="text-sm leading-relaxed" />
              <p className="mt-1.5 font-mono text-xs text-muted">{drill.item.sourceLabel}</p>
            </div>

            <div className="mb-3 flex items-center gap-3">
              <span className="h-px flex-1 bg-card-border" aria-hidden />
              <p className="kicker text-muted">Which telling exceeds the data?</p>
              <span className="h-px flex-1 bg-card-border" aria-hidden />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(["a", "b"] as const).map((side) => {
                const text = drill.item![side];
                const isFaithful = verdict && verdict.faithfulSide === side;
                const isOverclaimed = verdict && verdict.faithfulSide !== side;
                return (
                  <button
                    key={side}
                    onClick={() => attempt(side)}
                    disabled={submitting || !!verdict}
                    style={{ touchAction: "manipulation" }}
                    className={`relative select-none rounded-card border bg-card p-5 text-left shadow-[var(--shadow-card)] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                      verdict
                        ? isOverclaimed
                          ? "border-danger"
                          : "border-card-border opacity-60"
                        : picked === side
                          ? "border-rule-strong scale-[0.99]"
                          : "border-card-border hover:border-rule-strong hover:shadow-[var(--shadow-lift)] active:scale-[0.99]"
                    }`}
                  >
                    <span aria-hidden className="mb-3 block h-0.5 w-[34px] bg-rule-strong" />
                    <p className="font-serif text-[1.0625rem] leading-[1.58] text-ink-strong text-pretty">
                      {text}
                    </p>
                    {verdict && (
                      <span
                        className={`stamp-in absolute right-3 top-3 rounded-chip border-2 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.18em] ${
                          isFaithful ? "border-rule-strong text-rule-strong" : "border-danger text-danger"
                        }`}
                      >
                        {isFaithful ? "FAITHFUL" : "OVERCLAIMED"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {verdict && (
              <div className="pair-in mt-4 rounded-card border border-card-border bg-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <p
                    className={`font-mono text-sm font-semibold ${verdict.correct ? "text-accent" : "text-danger"}`}
                  >
                    {verdict.correct ? "Called it." : "It got you."}
                  </p>
                  <p className="font-mono text-xs text-muted tabular-nums">
                    {verdict.ratingDelta >= 0 ? "+" : ""}
                    {verdict.ratingDelta} → {verdict.drillRating}
                  </p>
                </div>
                <p className="mt-1 kicker text-muted">Device: {verdict.device}</p>
                <p className="mt-2 text-sm leading-relaxed">{verdict.explanation}</p>
                <button
                  onClick={fetchDrill}
                  className="mt-4 w-full rounded-card bg-accent px-4 py-3 font-mono text-sm font-semibold text-on-accent transition hover:opacity-90"
                >
                  Next drill →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
