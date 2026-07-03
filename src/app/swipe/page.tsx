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

export default function SwipePage() {
  const router = useRouter();
  const [pair, setPair] = useState<PairDto | null>(null);
  const [voteCount, setVoteCount] = useState(0);
  const [results, setResults] = useState<ResultsDto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const renderedAt = useRef(0);
  const sessionIdRef = useRef<string | null>(null);

  const fetchPair = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    setError(null);
    try {
      const res = await fetch(`/api/pair?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) throw new Error(`pair failed (${res.status})`);
      const data: PairDto = await res.json();
      setPair(data);
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
      if (!res.ok) throw new Error(`vote failed (${res.status})`);
      const data = await res.json();
      setVoteCount(data.voteCount);
      if (data.voteCount === RESULTS_AT_VOTES) {
        await showResults(); // the milestone interstitial
      } else {
        await fetchPair();
      }
    } catch {
      setError("Vote didn't save. Tap to try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function keepGoing() {
    setResults(null);
    fetchPair();
  }

  const progress = Math.min(voteCount / RESULTS_AT_VOTES, 1);

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-2xl">
        {/* Progress header */}
        <div className="flex items-center justify-between gap-4 mb-5">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent">
            Judgment Call
          </p>
          <div className="flex items-center gap-3">
            {voteCount < RESULTS_AT_VOTES ? (
              <>
                <div className="h-1.5 w-24 rounded-full bg-card-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted tabular-nums">
                  {voteCount}/{RESULTS_AT_VOTES}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-muted tabular-nums">{voteCount} calls</p>
                <button
                  onClick={showResults}
                  className="text-xs font-semibold text-accent hover:underline"
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
          <>
            {/* Context header */}
            <div className="rounded-xl border border-card-border bg-accent-soft/60 px-4 py-3 mb-4">
              <Snippet
                markdown={pair.finding.contextSnippet}
                className="text-sm leading-relaxed"
              />
              <p className="mt-1 text-xs text-muted">{pair.finding.sourceLabel}</p>
            </div>

            <p className="text-sm font-medium text-muted mb-3">
              Which telling of this finding is better?
            </p>

            {/* The two cards */}
            <div className="grid gap-3 sm:grid-cols-2">
              {[pair.variantA, pair.variantB].map((variant, i) => (
                <button
                  key={variant.id}
                  onClick={() => vote(variant.id)}
                  disabled={submitting}
                  className="group relative rounded-2xl border border-card-border bg-card p-5 pt-4 text-left shadow-sm transition hover:border-accent hover:shadow-md active:scale-[0.99] disabled:opacity-60"
                >
                  <span className="inline-block rounded-md bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent mb-2">
                    {i === 0 ? "A" : "B"}
                  </span>
                  <p className="text-[17px] leading-relaxed">{variant.text}</p>
                </button>
              ))}
            </div>

            <div className="mt-4 text-center">
              <button
                onClick={() => vote(null)}
                disabled={submitting}
                className="text-sm text-muted hover:text-foreground underline underline-offset-4 disabled:opacity-60"
              >
                Can&apos;t decide
              </button>
            </div>
          </>
        ) : (
          !error && <p className="text-center text-muted py-20">Loading the first pair…</p>
        )}

        {error && (
          <div className="mt-6 text-center">
            <p className="text-sm text-red-600 mb-2">{error}</p>
            <button
              onClick={() => (pair ? undefined : fetchPair())}
              className="text-sm font-semibold text-accent hover:underline"
            >
              {pair ? "Tap a card to retry" : "Retry"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
