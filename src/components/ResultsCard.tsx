"use client";

import { useState } from "react";
import {
  TastePoster,
  personaTitle,
  type PosterData,
  type PreferenceDto,
} from "@/components/TastePoster";

export type { PreferenceDto };
export type ResultsDto = PosterData;

export function ResultsCard({
  results,
  onKeepGoing,
}: {
  results: ResultsDto;
  onKeepGoing: () => void;
}) {
  const [shareState, setShareState] = useState<"idle" | "shared" | "copied">("idle");
  const [linkState, setLinkState] = useState<"idle" | "working" | "copied">("idle");
  const title = personaTitle(results.preferences);

  function logShare() {
    // Funnel breadcrumb — fire-and-forget, never blocks the share.
    const sessionId = localStorage.getItem("jc_session_id");
    if (sessionId) {
      fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
    }
  }

  async function share() {
    const traits = results.preferences
      .slice(0, 3)
      .map((p) => p.valueLabel)
      .join(", ");
    const text = `${title} — after ${results.voteCount} judgment calls I go for ${
      traits || "…still deciding"
    }. What's your insight taste?`;
    try {
      if (navigator.share) {
        await navigator.share({ text, url: window.location.origin });
        setShareState("shared");
      } else {
        await navigator.clipboard.writeText(`${text} ${window.location.origin}`);
        setShareState("copied");
      }
      setTimeout(() => setShareState("idle"), 2500);
      logShare();
    } catch {
      // user dismissed the share sheet / clipboard unavailable — no-op
    }
  }

  // Publish (idempotent) and copy the public permalink.
  async function getLink() {
    const sessionId = localStorage.getItem("jc_session_id");
    if (!sessionId || linkState === "working") return;
    setLinkState("working");
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      await navigator.clipboard.writeText(url);
      setLinkState("copied");
      setTimeout(() => setLinkState("idle"), 2500);
      logShare();
    } catch {
      setLinkState("idle");
    }
  }

  return (
    <div>
      <TastePoster data={results} />

      {/* Actions live outside the poster so screenshots stay clean. */}
      <div className="print-hide mt-4 flex flex-col sm:flex-row gap-3">
        <button
          onClick={onKeepGoing}
          className="flex-1 rounded-card bg-accent px-4 py-3 font-mono text-sm font-semibold text-on-accent transition hover:opacity-90 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          Keep going — sharpen your profile
        </button>
        <a
          href="/review"
          className="flex-1 rounded-card border border-card-border px-4 py-3 text-center font-mono text-sm font-semibold transition hover:border-rule-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          Review my calls →
        </a>
      </div>
      <div className="print-hide mt-3 flex flex-col sm:flex-row gap-3">
        <button
          onClick={share}
          className="flex-1 rounded-card border border-card-border px-4 py-3 font-mono text-sm font-semibold transition hover:border-rule-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          {shareState === "shared"
            ? "Shared!"
            : shareState === "copied"
              ? "Copied — paste anywhere"
              : "Share my taste"}
        </button>
        <button
          onClick={getLink}
          className="flex-1 rounded-card border border-card-border px-4 py-3 font-mono text-sm font-semibold transition hover:border-rule-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-60"
          disabled={linkState === "working"}
        >
          {linkState === "copied"
            ? "Link copied — it's live"
            : linkState === "working"
              ? "Publishing…"
              : "Get my public link"}
        </button>
      </div>
      <p className="print-hide mt-2 text-center font-mono text-[10px] text-muted">
        The public link shows this poster only — never your individual votes.
      </p>
    </div>
  );
}
