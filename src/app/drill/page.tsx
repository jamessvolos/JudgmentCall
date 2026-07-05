"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Snippet } from "@/components/Snippet";
import { getSessionId, nowMs } from "@/lib/session-client";
import { withViewTransition } from "@/lib/view-transition";
// Drill-world only (fidelity vocabulary) — the sanctioned training surface.
import { overclaimFamily, OVERCLAIM_FAMILIES, type OverclaimFamily } from "@/lib/teaching";

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

type FamilyProgressDto = { id: string; name: string; attempted: number; caught: number };

type DrillDto = {
  item: DrillItemDto | null;
  remaining: number;
  drillRating: number;
  drillCount: number;
  familyProgress?: FamilyProgressDto[];
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

// The five nameable overclaim families, canonical order — the choices for the
// "name the move" recall beat on the verdict (retrieval practice: attempting to
// name the pattern before it's revealed makes it stick). "other" is a
// classifier fallback, not a nameable pattern, so it is never offered and items
// that land there skip the recall.
const RECALL_FAMILIES: OverclaimFamily["id"][] = [
  "cause",
  "single_cause",
  "extrapolation",
  "certainty",
  "base_rate",
];

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
  // The learner's "name the move" recall guess for the current verdict: null =
  // not yet answered (recall prompt showing), a family id = guessed that,
  // "skip" = chose to reveal without guessing. Reset per drill.
  const [familyGuess, setFamilyGuess] = useState<OverclaimFamily["id"] | "skip" | null>(null);
  // Running "name how" tally across this session's drills (NOT reset per drill):
  // how many patterns the learner named correctly, out of the ones they guessed.
  // Measures the second half of the skill (spot it AND name how); shown at the
  // end. Formative + client-only — a mid-session refresh just restarts it.
  const [naming, setNaming] = useState<{ named: number; guessed: number }>({ named: 0, guessed: 0 });

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
        setFamilyGuess(null);
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
            {/* The other half of the skill: spotting is the rating above; this
                is whether you could NAME the pattern when you tried (the recall
                beat). Session-local, shown only if you named at least one. */}
            {naming.guessed > 0 && (
              <p className="mt-1 font-mono text-sm text-muted tabular-nums">
                Named the pattern:{" "}
                <span className="text-ink-strong">{naming.named}</span> of {naming.guessed}
              </p>
            )}

            {/* The skill map: where the learner is fluent across the five
                overclaim families, and which to come back to. Drill-world only. */}
            {drill.familyProgress && drill.familyProgress.length > 0 && (
              <div className="mt-7 mx-auto w-full max-w-xs">
                <p className="kicker text-muted mb-3">Your overclaim radar</p>
                <ul className="space-y-2.5 text-left">
                  {drill.familyProgress.map((f) => (
                    <li key={f.id} className="flex items-center gap-3">
                      <span className="flex-1 text-sm text-ink-strong">{f.name}</span>
                      {f.attempted === 0 ? (
                        <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted">
                          not yet
                        </span>
                      ) : (
                        <>
                          <span className="flex gap-1" aria-hidden>
                            {Array.from({ length: f.attempted }).map((_, i) => (
                              <span
                                key={i}
                                className={`inline-block size-2 rounded-full ${
                                  i < f.caught ? "bg-accent" : "border border-rule-strong"
                                }`}
                              />
                            ))}
                          </span>
                          <span className="sr-only">
                            {f.caught} of {f.attempted} caught
                          </span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 font-mono text-[0.6875rem] leading-relaxed text-muted">
                  Filled = caught. Come back to the families you missed.
                </p>
              </div>
            )}

            {/* Consolidation: re-teach the transferable tell for exactly the
                families the learner MISSED (caught < attempted), at the
                reflective moment. The item pool is too small to re-serve those
                families as extra reps (mastery-model bullet 2, deferred on a
                deeper pool), so we reinforce the pattern instead. Drill-world
                only — OVERCLAIM_FAMILIES lives in teaching.ts. */}
            {(() => {
              const missed = (drill.familyProgress ?? []).filter(
                (f) => f.attempted > 0 && f.caught < f.attempted
              );
              const faced = (drill.familyProgress ?? []).some((f) => f.attempted > 0);
              if (!faced) return null;
              if (missed.length === 0) {
                return (
                  <p className="mt-6 font-mono text-xs text-accent">
                    Clean sweep — you caught every pattern you faced.
                  </p>
                );
              }
              return (
                <div className="mt-6 mx-auto w-full max-w-sm text-left">
                  <p className="kicker text-muted mb-2.5">Patterns to carry forward</p>
                  <ul className="space-y-2.5">
                    {missed.map((f) => {
                      const fam = OVERCLAIM_FAMILIES[f.id as OverclaimFamily["id"]];
                      if (!fam) return null;
                      return (
                        <li
                          key={f.id}
                          className="rounded-chip border-l-2 border-accent/50 bg-wash py-2 pl-3 pr-2"
                        >
                          <p className="font-mono text-xs font-semibold text-ink-strong">{f.name}</p>
                          <p className="mt-1 text-sm leading-relaxed text-pretty text-muted">
                            {fam.tell}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })()}

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
                {(() => {
                  const trueFamily = overclaimFamily(verdict.device);
                  const recallable = trueFamily.id !== "other";
                  const revealed = !recallable || familyGuess !== null;
                  const guessed = familyGuess !== null && familyGuess !== "skip";
                  const namedIt = guessed && familyGuess === trueFamily.id;

                  // Retrieval beat: the learner attempts to NAME the pattern
                  // before it's revealed (the charter's "spot it AND name how").
                  // The device / explanation / tell give the family away, so
                  // they stay hidden until the guess (or a "show me"). The drill
                  // rating is already settled on the spot — naming is formative,
                  // never re-graded — so a correct spotter is never penalised for
                  // mis-naming.
                  if (!revealed) {
                    return (
                      <div className="mt-4">
                        <p className="kicker text-muted">Now — name the move</p>
                        <p className="mt-1 text-xs text-muted">
                          Which overclaim pattern was it? Your rating is already in — naming it is
                          just how it sticks.
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          {RECALL_FAMILIES.map((id) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => {
                                setFamilyGuess(id);
                                setNaming((t) => ({
                                  named: t.named + (id === trueFamily.id ? 1 : 0),
                                  guessed: t.guessed + 1,
                                }));
                              }}
                              className="rounded-chip border border-card-border bg-wash px-3 py-1.5 font-mono text-xs text-ink-strong transition hover:border-rule-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            >
                              {OVERCLAIM_FAMILIES[id].name}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setFamilyGuess("skip")}
                          className="mt-2.5 font-mono text-[0.6875rem] text-muted underline decoration-muted/40 underline-offset-2 hover:text-ink-strong"
                        >
                          just show me →
                        </button>
                      </div>
                    );
                  }

                  // Revealed: the pattern (with a ✓/✗ on the recall attempt),
                  // the item-specific device, the explanation, and the tell.
                  return (
                    <>
                      <p className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="kicker text-muted shrink-0">Pattern</span>
                        <span className="font-mono text-xs font-semibold text-ink-strong">
                          {trueFamily.name}
                        </span>
                        {guessed && (
                          <span
                            className={`font-mono text-[0.6875rem] ${namedIt ? "text-accent" : "text-danger"}`}
                          >
                            {namedIt
                              ? "· you named it ✓"
                              : `· you said ${OVERCLAIM_FAMILIES[familyGuess as OverclaimFamily["id"]].name}`}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 flex items-baseline gap-2">
                        <span className="kicker text-muted shrink-0">Device</span>
                        <span className="font-mono text-xs text-muted">{verdict.device}</span>
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-pretty">
                        {verdict.explanation}
                      </p>
                      <div className="mt-3 rounded-chip border-l-2 border-accent/50 bg-wash py-2 pl-3 pr-2">
                        <p className="kicker text-accent">Carry it forward</p>
                        <p className="mt-1 text-sm leading-relaxed text-pretty text-muted">
                          {trueFamily.tell}
                        </p>
                      </div>
                      <button
                        onClick={fetchDrill}
                        className="cta-glow mt-4 w-full rounded-card bg-accent px-4 py-3 font-mono text-sm font-semibold text-on-accent"
                      >
                        Next drill →
                      </button>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
