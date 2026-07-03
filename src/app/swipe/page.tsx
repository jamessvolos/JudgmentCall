"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Snippet } from "@/components/Snippet";
import { ResultsCard, type ResultsDto } from "@/components/ResultsCard";
import { getSessionId, nowMs } from "@/lib/session-client";
import { RESULTS_AT_VOTES } from "@/lib/client-constants";

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

// How long the picked-card flash stays on screen before the next pair.
const FLASH_MS = 160;

export default function SwipePage() {
  const router = useRouter();
  const [pair, setPair] = useState<PairDto | null>(null);
  const [voteCount, setVoteCount] = useState(0);
  const [results, setResults] = useState<ResultsDto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
      const res = await fetch(`/api/pair?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) throw new Error(`pair failed (${res.status})`);
      const data: PairDto = await res.json();
      setPair(data);
      setPickedId(null);
      setSnippetExpanded(false);
      setVoteCount(data.voteCount);
      renderedAt.current = nowMs();
    } catch {
      setError("Couldn't load the next pair.");
    }
  }, []);

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
      setResults(await res.json());
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
        if (data.voteCount > RESULTS_AT_VOTES && data.voteCount % 10 === 0) {
          flashNotice(`${data.voteCount} calls — your profile just got sharper.`);
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

  const progress = Math.min(voteCount / RESULTS_AT_VOTES, 1);
  const oneMore = voteCount === RESULTS_AT_VOTES - 1;

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-2xl">
        <p className="sr-only" aria-live="polite">
          {liveMessage}
        </p>

        {/* Progress header */}
        <div className="flex items-center justify-between gap-4 mb-5">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent">
            Judgment Call
          </p>
          <div className="flex items-center gap-3">
            {voteCount < RESULTS_AT_VOTES ? (
              <>
                <div className="h-2 w-32 rounded-full bg-card-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
                <p
                  className={`text-xs tabular-nums ${oneMore ? "text-accent font-semibold" : "text-muted"}`}
                >
                  {oneMore ? "1 more →" : `${voteCount}/${RESULTS_AT_VOTES}`}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-muted tabular-nums">{voteCount} calls</p>
                <button
                  onClick={showResults}
                  className="text-xs font-semibold text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded"
                >
                  Your results
                </button>
              </>
            )}
          </div>
        </div>

        {results ? (
          <ResultsCard results={results} onKeepGoing={keepGoing} />
        ) : pair ? (
          <div key={pair.variantA.id} className="pair-in">
            {/* Context header */}
            <button
              onClick={() => setSnippetExpanded((v) => !v)}
              className="w-full text-left rounded-xl border border-card-border bg-accent-soft/60 px-4 py-3 mb-4 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              <Snippet
                ref={snippetRef}
                markdown={pair.finding.contextSnippet}
                className={`text-sm leading-relaxed ${snippetExpanded ? "" : "line-clamp-3"}`}
              />
              <p className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
                <span>{pair.finding.sourceLabel}</span>
                {(snippetTruncated || snippetExpanded) && (
                  <span className="shrink-0 font-semibold text-accent">
                    {snippetExpanded ? "Less ▴" : "Full data ▾"}
                  </span>
                )}
              </p>
            </button>

            <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">
              Which telling of this finding is better?
            </p>

            {/* The two cards. No labels: anything beyond position could cue a
                preference, and position (A = left/top) is logged server-side. */}
            <div className="grid gap-3 sm:grid-cols-2">
              {[pair.variantA, pair.variantB].map((variant) => (
                <button
                  key={variant.id}
                  onClick={() => vote(variant.id)}
                  disabled={submitting}
                  style={{ touchAction: "manipulation" }}
                  className={`select-none rounded-2xl border bg-card p-5 text-left shadow-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                    pickedId === variant.id
                      ? "border-accent ring-2 ring-accent bg-accent-soft/40"
                      : pickedId
                        ? "border-card-border opacity-40"
                        : "border-card-border hover:border-accent hover:shadow-md active:scale-[0.99]"
                  }`}
                >
                  <p className="text-[17px] leading-relaxed text-pretty">{variant.text}</p>
                </button>
              ))}
            </div>

            <div className="mt-5 text-center">
              <button
                onClick={() => vote(null)}
                disabled={submitting}
                className="min-h-11 rounded-full border border-card-border px-5 py-2.5 text-sm text-muted transition hover:text-foreground hover:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-60"
              >
                Can&apos;t decide
              </button>
              <p className="mt-3 hidden sm:block text-xs text-muted">
                Keyboard: <kbd className="rounded border border-card-border px-1">1</kbd> left ·{" "}
                <kbd className="rounded border border-card-border px-1">2</kbd> right ·{" "}
                <kbd className="rounded border border-card-border px-1">0</kbd> skip
              </p>
            </div>
          </div>
        ) : (
          !error && (
            <div aria-hidden className="animate-pulse">
              <div className="rounded-xl bg-card-border/50 h-20 mb-4" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-card-border/50 h-40" />
                <div className="rounded-2xl bg-card-border/50 h-40" />
              </div>
            </div>
          )
        )}

        {notice && (
          <div className="mt-4 rounded-lg bg-accent-soft px-3 py-2 text-center text-sm font-medium text-accent">
            {notice}
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-center">
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
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
