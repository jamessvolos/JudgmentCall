"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Snippet } from "@/components/Snippet";
import { ResultsCard, type ResultsDto } from "@/components/ResultsCard";
import { getSessionId, nowMs } from "@/lib/session-client";
import { RESULTS_AT_VOTES } from "@/lib/types";

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
const FLASH_MS = 220;

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
    const sessionId = getSessionId();
    if (!sessionId) {
      router.replace("/");
      return;
    }
    sessionIdRef.current = sessionId;
    fetchPair();
  }, [router, fetchPair]);

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
                markdown={pair.finding.contextSnippet}
                className={`text-sm leading-relaxed ${snippetExpanded ? "" : "line-clamp-3"}`}
              />
              <p className="mt-1 text-xs text-muted">{pair.finding.sourceLabel}</p>
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
