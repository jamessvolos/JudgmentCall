"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Snippet } from "@/components/Snippet";
import { ResultsCard, type ResultsDto } from "@/components/ResultsCard";
import { getSessionId, nowMs } from "@/lib/session-client";
import { RESULTS_AT_VOTES } from "@/lib/client-constants";
import { withViewTransition } from "@/lib/view-transition";

type PairDto = {
  finding: {
    id: string;
    title: string;
    domain: string;
    contextSnippet: string;
    sourceLabel: string;
  };
  variantA: { id: string; text: string };
  variantB: { id: string; text: string };
  voteCount: number;
};

// How long the picked-card stamp stays on screen before the next pair.
// (Volthaus choreography: press → stamp lands ~250ms → next pair rises.)
const FLASH_MS = 380;

// Ten tally marks; the newest pops, the 10th beckons at 9/10.
function TallyMeter({ voteCount, total }: { voteCount: number; total: number }) {
  const oneMore = voteCount === total - 1;
  return (
    <div className="flex items-end gap-[3px] h-4" aria-hidden>
      {Array.from({ length: total }, (_, i) => {
        const filled = i < voteCount;
        const newest = i === voteCount - 1;
        const beckoning = oneMore && i === total - 1;
        return (
          <span
            key={i}
            className={`w-[3px] rounded-[1px] ${
              filled
                ? `h-4 bg-rule-strong ${newest ? "notch-pop" : ""}`
                : `h-3 bg-card-border ${beckoning ? "tick-beckon bg-rule-strong" : ""}`
            }`}
          />
        );
      })}
    </div>
  );
}

function SwipeInner() {
  const router = useRouter();
  const deck = useSearchParams().get("deck");
  const [pair, setPair] = useState<PairDto | null>(null);
  const [voteCount, setVoteCount] = useState(0);
  const [results, setResults] = useState<ResultsDto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{ title: string; xp: number } | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const [snippetExpanded, setSnippetExpanded] = useState(false);
  const [snippetTruncated, setSnippetTruncated] = useState(false);
  const snippetRef = useRef<HTMLParagraphElement | null>(null);
  const fastKeyHinted = useRef(false);
  const renderedAt = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPair = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/pair?sessionId=${encodeURIComponent(sessionId)}${deck ? `&deck=${encodeURIComponent(deck)}` : ""}`
      );
      if (!res.ok) throw new Error(`pair failed (${res.status})`);
      const data: PairDto = await res.json();
      withViewTransition(() => {
        setPair(data);
        setPickedId(null);
        setSnippetExpanded(false);
        setVoteCount(data.voteCount);
      });
      renderedAt.current = nowMs();
    } catch {
      setError("Couldn't load the next pair.");
    }
  }, [deck]);

  useEffect(() => {
    const el = snippetRef.current;
    setSnippetTruncated(el ? el.scrollHeight > el.clientHeight + 1 : false);
  }, [pair, snippetExpanded]);

  useEffect(() => {
    const sessionId = getSessionId();
    if (!sessionId) {
      router.replace("/");
      return;
    }
    sessionIdRef.current = sessionId;
    fetchPair();
  }, [router, fetchPair]);

  // Keyboard voting for desktop (Medium readers): 1/left = left card,
  // 2/right = right card, 0 or s = can't decide. No per-card number labels —
  // on-card ordering cues are the A/B-badge bias all over again.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!pair || results) return;
      if (submitting) {
        if (!fastKeyHinted.current && ["1", "2", "0", "ArrowLeft", "ArrowRight", "s"].includes(e.key)) {
          fastKeyHinted.current = true;
          flashNotice("Next pair is loading — presses land once it's on screen.");
        }
        return;
      }
      if (e.key === "1" || e.key === "ArrowLeft") vote(pair.variantA.id);
      else if (e.key === "2" || e.key === "ArrowRight") vote(pair.variantB.id);
      else if (e.key === "0" || e.key.toLowerCase() === "s") vote(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair, submitting, results]);

  function flashNotice(message: string) {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2600);
  }

  async function showResults() {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/results?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) throw new Error(`results failed (${res.status})`);
      const data = await res.json();
      withViewTransition(() => setResults(data));
    } catch {
      setError("Couldn't load your results.");
    }
  }

  async function vote(winnerId: string | null) {
    const sessionId = sessionIdRef.current;
    if (!pair || !sessionId || submitting) return;
    setSubmitting(true);
    setError(null);
    if (winnerId) setPickedId(winnerId);
    const latencyMs = Math.round(nowMs() - renderedAt.current);
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          variantAId: pair.variantA.id,
          variantBId: pair.variantB.id,
          winnerId,
          latencyMs,
        }),
      });
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        setPickedId(null);
        flashNotice(
          data.code === "cant_decide_throttled"
            ? "Make a call this time — pick the better one."
            : "Whoa — take a breath, then keep going."
        );
        return;
      }
      if (!res.ok) throw new Error(`vote failed (${res.status})`);
      const data = await res.json();
      setVoteCount(data.voteCount);
      setLiveMessage(`Vote saved. ${data.voteCount} votes so far.`);
      // Let the confirmation flash land before the pair swaps.
      if (winnerId) await new Promise((r) => setTimeout(r, FLASH_MS));
      if (data.voteCount === RESULTS_AT_VOTES) {
        await showResults(); // the milestone interstitial
      } else {
        if (data.leveledUp) {
          // Promotion earns typeset ceremony, not a toast; the slug's whole
          // lifecycle is one 2600ms keyframe matched to this timer.
          setPromotion({ title: data.level.title, xp: data.xp });
          setTimeout(() => setPromotion(null), 2600);
        } else if (data.voteCount > RESULTS_AT_VOTES && data.voteCount % 10 === 0) {
          flashNotice(`${data.voteCount} calls — run complete. Review it from your results.`);
        }
        await fetchPair();
      }
    } catch {
      setPickedId(null);
      setError("Vote didn't save — tap a card to try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function keepGoing() {
    setResults(null);
    fetchPair();
  }

  const oneMore = voteCount === RESULTS_AT_VOTES - 1;

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-2xl">
        <p className="sr-only" aria-live="polite">
          {liveMessage}
        </p>

        {/* Folio: masthead + progress, sitting on the double rule. */}
        <div className="mb-5">
          <div className="flex items-end justify-between gap-4 pb-2">
            <p className="masthead text-ink-strong">Judgment Call</p>
            <div className="flex items-center gap-3">
              {voteCount < RESULTS_AT_VOTES ? (
                <>
                  <TallyMeter voteCount={voteCount} total={RESULTS_AT_VOTES} />
                  <p
                    className={`font-mono text-xs tabular-nums ${oneMore ? "text-accent font-semibold" : "text-muted"}`}
                  >
                    {oneMore ? "1 more →" : `${voteCount}/${RESULTS_AT_VOTES}`}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-mono text-xs text-muted tabular-nums">{voteCount} calls</p>
                  <Link
                    href="/review"
                    className="font-mono text-xs font-semibold text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded"
                  >
                    Review
                  </Link>
                  <button
                    onClick={showResults}
                    className="font-mono text-xs font-semibold text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded"
                  >
                    Your results
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="double-rule" aria-hidden />
        </div>

        {results ? (
          <ResultsCard results={results} onKeepGoing={keepGoing} />
        ) : pair ? (
          <div key={pair.variantA.id} className="pair-in">
            {/* Context header: the "wire copy" panel. */}
            <button
              onClick={() => setSnippetExpanded((v) => !v)}
              className="w-full text-left rounded-card border-l-[3px] border-rule-strong bg-wash px-4 py-3 mb-4 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              <p className="kicker text-muted mb-1.5">The finding</p>
              <Snippet
                ref={snippetRef}
                markdown={pair.finding.contextSnippet}
                className={`text-sm leading-relaxed ${snippetExpanded ? "" : "line-clamp-3"}`}
              />
              <p className="mt-1.5 flex items-center justify-between gap-2 font-mono text-xs text-muted">
                <span>{pair.finding.sourceLabel}</span>
                {(snippetTruncated || snippetExpanded) && (
                  <span className="shrink-0 font-semibold text-accent">
                    {snippetExpanded ? "Less ▴" : "Full data ▾"}
                  </span>
                )}
              </p>
            </button>

            <div className="mb-3 flex items-center gap-3" aria-hidden="false">
              <span className="h-px flex-1 bg-card-border" aria-hidden />
              <p className="kicker text-muted">Which telling is better?</p>
              <span className="h-px flex-1 bg-card-border" aria-hidden />
            </div>

            {/* The two cards. No labels: anything beyond position could cue a
                preference, and position (A = left/top) is logged server-side. */}
            {/* The two tellings. No labels, no accent, one identical class:
                anything beyond position could cue a preference, and position
                (A = left/top) is logged server-side. */}
            <div className="grid gap-3 sm:grid-cols-2">
              {[pair.variantA, pair.variantB].map((variant) => (
                <button
                  key={variant.id}
                  onClick={() => vote(variant.id)}
                  disabled={submitting}
                  style={{ touchAction: "manipulation" }}
                  className={`relative select-none rounded-card border bg-card p-5 sm:p-6 text-left shadow-[var(--shadow-card)] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                    pickedId === variant.id
                      ? "border-rule-strong scale-[0.99]"
                      : pickedId
                        ? "clear-back border-card-border opacity-40"
                        : "border-card-border hover:border-rule-strong hover:shadow-[var(--shadow-lift)] active:scale-[0.99]"
                  }`}
                >
                  <span aria-hidden className="mb-3 block h-0.5 w-[34px] bg-rule-strong" />
                  <p className="font-serif text-[1.1875rem] leading-[1.58] text-ink-strong text-pretty">
                    {variant.text}
                  </p>
                  {pickedId === variant.id && (
                    <span
                      aria-hidden
                      className="stamp-in absolute right-3 top-3 rounded-chip border-2 border-rule-strong px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.18em] text-rule-strong"
                    >
                      LOGGED
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-5 text-center">
              <button
                onClick={() => vote(null)}
                disabled={submitting}
                className="min-h-11 rounded-full border border-card-border px-5 py-2.5 font-mono text-sm text-muted transition hover:text-foreground hover:border-rule-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-60"
              >
                Can&apos;t decide
              </button>
              <p className="mt-3 hidden sm:block font-mono text-xs text-muted">
                Keyboard: <kbd className="rounded-chip border border-card-border px-1">1</kbd> left ·{" "}
                <kbd className="rounded-chip border border-card-border px-1">2</kbd> right ·{" "}
                <kbd className="rounded-chip border border-card-border px-1">0</kbd> skip
              </p>
            </div>
          </div>
        ) : (
          !error && (
            <div aria-hidden className="animate-pulse">
              <div className="rounded-card bg-card-border/50 h-20 mb-4" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-card bg-card-border/50 h-40" />
                <div className="rounded-card bg-card-border/50 h-40" />
              </div>
            </div>
          )
        )}

        {promotion && (
          <div
            role="status"
            className="promo-slug mt-4 rounded-card border border-card-border bg-card px-4 py-3"
          >
            <div className="rule-draw double-rule" aria-hidden />
            <p className="kicker text-accent mt-3">Promoted</p>
            <p className="mt-1 font-serif text-lg font-semibold text-ink-strong">
              {promotion.title}
              <span
                className="stamp-in ml-2 inline-block align-middle rounded-chip border-2 border-rule-strong px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.18em] text-rule-strong"
                style={{ animationDelay: "300ms" }}
              >
                {promotion.xp} XP
              </span>
            </p>
          </div>
        )}
        {notice && (
          <div className="mt-4 rounded-card bg-accent-soft px-3 py-2 text-center text-sm font-medium text-accent">
            {notice}
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-card bg-danger/10 px-3 py-2 text-center">
            <p className="text-sm text-danger">{error}</p>
            {!pair && (
              <button
                onClick={fetchPair}
                className="mt-1 text-sm font-semibold text-accent hover:underline"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default function SwipePage() {
  return (
    <Suspense fallback={null}>
      <SwipeInner />
    </Suspense>
  );
}
