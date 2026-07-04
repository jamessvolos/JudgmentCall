"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Snippet } from "@/components/Snippet";
import { getSessionId, nowMs } from "@/lib/session-client";
import { withViewTransition } from "@/lib/view-transition";

// "Spot the overclaim" — the training room. Clearly labeled as NOT the study:
// items are purpose-built, feedback is immediate, and attempts never touch
// the public analytics. This is the one place the product says right/wrong.

type DrillItemDto = {
  id: string;
  title: string;
  contextSnippet: string;
  sourceLabel: string;
  a: string;
  b: string;
};

type DrillDto = {
  item: DrillItemDto | null;
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
  const [liveMessage, setLiveMessage] = useState("");
  const renderedAt = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const verdictRef = useRef<HTMLDivElement | null>(null);
  const prefetched = useRef<DrillDto | null>(null);
  const [oldRating, setOldRating] = useState<number | null>(null);

  const loadDrill = useCallback(async (): Promise<DrillDto> => {
    const sessionId = sessionIdRef.current!;
    const res = await fetch(`/api/drill?sessionId=${encodeURIComponent(sessionId)}`);
    if (!res.ok) throw new Error();
    return res.json();
  }, []);

  const fetchDrill = useCallback(async () => {
    if (!sessionIdRef.current) return;
    try {
      // The GET is idempotent, so the copy prefetched while the user read the
      // explanation is safe to consume; fall back to a live fetch. Always
      // await (even the cached copy) so state never updates synchronously
      // inside the mount effect.
      const cached = prefetched.current;
      prefetched.current = null;
      const next = await (cached ? Promise.resolve(cached) : loadDrill());
      withViewTransition(() => {
        setVerdict(null);
        setPicked(null);
        setDrill(next);
      });
      renderedAt.current = nowMs();
    } catch {
      setError(true);
    }
  }, [loadDrill]);

  useEffect(() => {
    const sessionId = getSessionId();
    if (!sessionId) {
      router.replace("/");
      return;
    }
    sessionIdRef.current = sessionId;
    // Initial data load on mount; every setState is behind an await (same
    // shape as /swipe, which the rule accepts).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDrill();
  }, [router, fetchDrill]);

  // Verdict is the one moment the product says right/wrong: move focus onto
  // it (the picked button just went disabled, which drops focus to <body>)
  // and speak the result + rating change.
  useEffect(() => {
    if (!verdict) return;
    verdictRef.current?.focus();
    // Prefetch the next item while the explanation is being read — free RTT.
    loadDrill()
      .then((d) => (prefetched.current = d))
      .catch(() => {});
  }, [verdict, loadDrill]);

  const attempt = useCallback(
    async (side: "a" | "b") => {
      const sessionId = sessionIdRef.current;
      if (!drill?.item || !sessionId || submitting || verdict) return;
      setSubmitting(true);
      setPicked(side);
      setOldRating(drill.drillRating);
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
        const data: VerdictDto = await res.json();
        setLiveMessage(
          `${data.correct ? "Correct" : "Incorrect"}. ${
            data.correct
              ? ""
              : `The overclaim was the ${data.faithfulSide === "a" ? "second" : "first"} telling. `
          }Rating ${data.ratingDelta >= 0 ? "up" : "down"} ${Math.abs(data.ratingDelta)}, now ${data.drillRating}.`
        );
        withViewTransition(() => setVerdict(data));
      } catch {
        setError(true);
        setPicked(null);
      } finally {
        setSubmitting(false);
      }
    },
    [drill, submitting, verdict]
  );

  // Keyboard parity with /swipe: 1/left = first telling, 2/right = second.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!drill?.item || submitting || verdict) return;
      if (e.key === "1" || e.key === "ArrowLeft") attempt("a");
      else if (e.key === "2" || e.key === "ArrowRight") attempt("b");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drill, submitting, verdict, attempt]);

  const headerRating = verdict ? verdict.drillRating : (drill?.drillRating ?? 0);

  return (
    <main className="flex-1 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <p className="sr-only" aria-live="polite">
          {liveMessage}
        </p>
        <div className="flex items-end justify-between pb-2">
          <p className="masthead text-ink-strong">Judgment Call</p>
          {drill && (
            <p
              className="font-mono text-xs text-muted tabular-nums"
              style={{ viewTransitionName: "drill-rating" }}
            >
              drill rating{" "}
              <span
                aria-hidden
                className="count"
                style={{ "--num": String(headerRating) } as React.CSSProperties}
              />
              <span className="sr-only">{headerRating}</span>
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

        {!drill && !error && (
          <div aria-hidden className="mt-5 animate-pulse">
            <div className="rounded-card bg-card-border/50 h-20 mb-4" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-card bg-card-border/50 h-40" />
              <div className="rounded-card bg-card-border/50 h-40" />
            </div>
          </div>
        )}

        {drill && !drill.item && (
          <div className="mt-8 text-center">
            <p className="font-sans text-xl font-semibold text-ink-strong tracking-[-0.02em] text-balance">
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
                    style={{
                      touchAction: "manipulation",
                      // Tint, not transparency: post-verdict is a comparison
                      // moment, both tellings must stay fully legible. Invalid
                      // color-mix is dropped at parse time → bg-card fallback.
                      ...(isOverclaimed
                        ? { background: "color-mix(in oklab, var(--danger) 7%, var(--card))" }
                        : {}),
                    }}
                    className={`relative select-none rounded-card border bg-card p-5 text-left shadow-[var(--shadow-card)] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                      verdict
                        ? isOverclaimed
                          ? "verdict-culprit border-danger"
                          : "border-card-border"
                        : `transition-all duration-200 ${
                            picked === side
                              ? "border-rule-strong scale-[0.99]"
                              : "border-card-border hover:border-rule-strong hover:shadow-[var(--shadow-lift)] active:scale-[0.99]"
                          }`
                    }`}
                  >
                    <span aria-hidden className="mb-3 block h-0.5 w-[34px] bg-rule-strong" />
                    <p className="font-serif text-[1.0625rem] leading-[1.58] text-ink-strong text-pretty">
                      {text}
                    </p>
                    {verdict && (
                      <span
                        aria-hidden
                        className={`stamp-in absolute -right-1 -top-2.5 rounded-chip border-2 bg-card px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.18em] ${
                          isFaithful
                            ? "border-rule-strong text-rule-strong"
                            : "border-danger text-danger"
                        }`}
                        // Beat 0: the culprit stamp presses first; the
                        // acquittal lands one beat later.
                        style={isFaithful ? { animationDelay: "200ms" } : undefined}
                      >
                        {isFaithful ? "FAITHFUL" : "OVERCLAIMED"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {!verdict && (
              <p className="mt-3 hidden sm:block text-center font-mono text-xs text-muted">
                Keyboard: <kbd className="rounded-chip border border-card-border px-1">1</kbd>{" "}
                first · <kbd className="rounded-chip border border-card-border px-1">2</kbd> second
              </p>
            )}

            {verdict && (
              <div
                ref={verdictRef}
                tabIndex={-1}
                className="verdict-card-in mt-4 rounded-card border border-card-border bg-card p-5 focus:outline-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <p
                    className={`font-mono text-sm font-semibold ${verdict.correct ? "text-accent" : "text-danger"}`}
                  >
                    {verdict.correct ? "Called it." : "It got you."}
                  </p>
                  {/* Ledger correction: old → new, delta as a graded chip. */}
                  <p className="font-mono tabular-nums text-right">
                    <span className="text-sm text-muted">
                      {oldRating ?? verdict.drillRating - verdict.ratingDelta}
                    </span>
                    <span className="text-muted"> → </span>
                    <span className="text-xl font-semibold text-ink-strong">
                      {verdict.drillRating}
                    </span>
                    <span
                      className={`ml-2 rounded-chip border px-1 text-[10px] align-middle ${
                        verdict.ratingDelta >= 0
                          ? "border-accent text-accent"
                          : "border-danger text-danger"
                      }`}
                    >
                      {verdict.ratingDelta >= 0 ? "+" : ""}
                      {verdict.ratingDelta}
                    </span>
                  </p>
                </div>
                <p className="mt-2 flex items-baseline gap-2">
                  <span className="kicker text-muted shrink-0">Device</span>
                  <span className="font-mono text-xs text-muted">{verdict.device}</span>
                </p>
                <p className="mt-2 text-sm leading-relaxed text-pretty">{verdict.explanation}</p>
                <button
                  onClick={fetchDrill}
                  className="cta-glow mt-4 w-full rounded-card bg-accent px-4 py-3 font-mono text-sm font-semibold text-on-accent"
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
