"use client";

import Link from "next/link";
import { useState } from "react";
import { SEGMENT_LABELS, type Segment } from "@/lib/client-constants";

export type PreferenceDto = {
  attribute: string;
  attributeLabel: string;
  value: string;
  valueLabel: string;
  picked: number;
  shown: number;
  hedged: boolean;
};

export type ResultsDto = {
  segment: string;
  calibrated?: boolean;
  voteCount: number;
  decidedSingleContrasts: number;
  preferences: PreferenceDto[];
  xp?: number;
  level?: { level: number; title: string; nextAt: number | null };
  judgeRank?: string | null;
  drillRating?: number | null;
};


// Persona headline from the two strongest solid preferences. Falls back
// gracefully while the profile is still forming.
const LEAD_ADJ: Record<string, string> = {
  number_first: "Numbers-First",
  implication_first: "Implication-First",
  question_first: "Socratic",
};
const MOD_NOUN: Record<string, string> = {
  upfront: "Skeptic",
  trailing: "Realist",
  omitted: "Optimist",
  short: "Minimalist",
  long: "Deep Reader",
  medium: "Pragmatist",
  precise: "Precisionist",
  rounded: "Approximator",
  qualitative: "Storyteller",
  explicit: "Director",
  implied: "Trustee",
};

function personaTitle(preferences: PreferenceDto[]): string {
  const solid = preferences.filter((p) => !p.hedged);
  const pool = solid.length > 0 ? solid : preferences;
  const lead = pool.find((p) => p.attribute === "leadType");
  const modifier = pool.find((p) => p.attribute !== "leadType");
  const adj = lead ? LEAD_ADJ[lead.value] : undefined;
  const noun = modifier ? MOD_NOUN[modifier.value] : undefined;
  const allHedged = preferences.length > 0 && solid.length === 0;
  const suffix = allHedged ? " (early read)" : "";
  if (adj && noun) return `The ${adj} ${noun}${suffix}`;
  if (adj) return `The ${adj} Reader${suffix}`;
  if (noun) return `The ${noun}${suffix}`;
  return "The Undecided (so far)";
}

export function ResultsCard({
  results,
  onKeepGoing,
}: {
  results: ResultsDto;
  onKeepGoing: () => void;
}) {
  const [shareState, setShareState] = useState<"idle" | "shared" | "copied">("idle");
  const ordered = [
    ...results.preferences.filter((p) => !p.hedged),
    ...results.preferences.filter((p) => p.hedged),
  ];
  const title = personaTitle(results.preferences);

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
    } catch {
      // user dismissed the share sheet / clipboard unavailable — no-op
    }
  }

  return (
    <div>
      {/* The poster: a "printed" 4:5-ish card. Theme-stable ink tokens so a
          screenshot shared from dark mode looks identical to one from light —
          the poster is print, not UI. */}
      <div
        className="poster-in overflow-hidden rounded-[6px] px-6 py-6 shadow-[var(--shadow-lift)]"
        style={{ background: "var(--poster-bg)", color: "var(--poster-fg)" }}
      >
        <div className="flex items-center gap-3">
          <span className="h-px flex-1" style={{ background: "var(--poster-rule)" }} aria-hidden />
          <p className="masthead" style={{ color: "var(--poster-mut)" }}>
            Judgment Call
          </p>
          <span className="h-px flex-1" style={{ background: "var(--poster-rule)" }} aria-hidden />
        </div>

        <p className="kicker mt-5" style={{ color: "var(--poster-acc)" }}>
          My insight taste
        </p>
        <h2 className="mt-1.5 font-serif font-semibold text-[clamp(1.875rem,8.6vw,2.5rem)] leading-[1.04] text-balance">
          {title}
        </h2>
        <p className="mt-2 font-mono text-xs" style={{ color: "var(--poster-mut)" }}>
          {results.voteCount} judgment calls · voting as{" "}
          {SEGMENT_LABELS[results.segment as Segment] ?? "Reader"}
          {results.level && ` · ${results.level.title.toUpperCase()}`}
          {results.calibrated && (
            <span
              className="ml-2 rounded-full border px-2 py-0.5 font-semibold"
              style={{ borderColor: "var(--poster-acc)", color: "var(--poster-acc)" }}
            >
              CALIBRATED ✓
            </span>
          )}
        </p>

        <div
          className="mt-4 border-t-2"
          style={{ borderColor: "var(--poster-rule)" }}
          aria-hidden
        />

        <div className="mt-5">
          {ordered.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--poster-mut)" }}>
              No clean reads yet — your pairs so far differed on several attributes at once, or
              ended in &ldquo;can&apos;t decide.&rdquo; Keep going and a profile will emerge.
            </p>
          ) : (
            <ul className="space-y-4">
              {ordered.map((p) => (
                <li key={p.attribute}>
                  {/* Dot-leader index line: MONO ATTR · serif value …… n/n */}
                  <div className="flex items-baseline gap-2">
                    <span
                      className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] shrink-0"
                      style={{ color: "var(--poster-mut)" }}
                    >
                      {p.attributeLabel}
                    </span>
                    <span className={`font-serif text-base font-semibold ${p.hedged ? "italic" : ""}`}>
                      {p.valueLabel}
                    </span>
                    <span
                      aria-hidden
                      className="flex-1 border-b border-dotted translate-y-[-3px]"
                      style={{ borderColor: "var(--poster-rule)" }}
                    />
                    <span
                      className="font-mono text-xs tabular-nums shrink-0"
                      style={{ color: "var(--poster-mut)" }}
                    >
                      {p.picked}/{p.shown}
                      {p.hedged && " · early"}
                    </span>
                  </div>
                  <div
                    className="mt-1.5 h-[3px] overflow-hidden"
                    style={{ background: "color-mix(in oklab, var(--poster-rule) 45%, var(--poster-bg))" }}
                  >
                    <div
                      className="h-full"
                      style={{
                        width: `${(p.picked / p.shown) * 100}%`,
                        background: "var(--poster-acc)",
                        opacity: p.hedged ? 0.45 : 1,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {/* Credentials line: only ranks the reader has actually earned. */}
          {(results.judgeRank || results.drillRating) && (
            <p
              className="mt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--poster-acc)" }}
            >
              {[
                results.judgeRank,
                results.drillRating ? `overclaim drill ${results.drillRating}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <p className="mt-6 font-mono text-[10px] leading-relaxed" style={{ color: "var(--poster-mut)" }}>
            {`Your leanings, not findings — from the ${results.decidedSingleContrasts} ${
              results.decidedSingleContrasts === 1 ? "vote" : "votes"
            } where the two tellings differed on exactly one attribute.`}{" "}
            · <strong style={{ color: "var(--poster-fg)" }}>judgment.call</strong>
          </p>
        </div>
      </div>

      {/* Actions live outside the poster so screenshots stay clean. */}
      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <button
          onClick={onKeepGoing}
          className="flex-1 rounded-card bg-accent px-4 py-3 font-mono text-sm font-semibold text-on-accent transition hover:opacity-90 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          Keep going — sharpen your profile
        </button>
        <Link
          href="/review"
          className="flex-1 rounded-card border border-card-border px-4 py-3 text-center font-mono text-sm font-semibold transition hover:border-rule-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          Review my calls →
        </Link>
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
      </div>
    </div>
  );
}
