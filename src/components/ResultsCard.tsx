"use client";

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
  voteCount: number;
  decidedSingleContrasts: number;
  preferences: PreferenceDto[];
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
      {/* The poster: designed to look intentional in a screenshot. */}
      <div className="overflow-hidden rounded-3xl border border-card-border bg-card shadow-sm">
        <div className="bg-gradient-to-br from-accent to-indigo-900 px-6 py-6 text-white">
          <p className="text-[11px] font-semibold tracking-[0.25em] uppercase text-white/70">
            My insight taste
          </p>
          <h2 className="mt-1.5 text-3xl font-bold tracking-tight text-balance">{title}</h2>
          <p className="mt-1.5 text-sm text-white/80">
            {results.voteCount} judgment calls · voting as {SEGMENT_LABELS[results.segment as Segment] ?? "Reader"}
          </p>
        </div>

        <div className="px-6 py-5">
          {ordered.length === 0 ? (
            <p className="text-sm text-muted">
              No clean reads yet — your pairs so far differed on several attributes at once, or
              ended in &ldquo;can&apos;t decide.&rdquo; Keep going and a profile will emerge.
            </p>
          ) : (
            <ul className="space-y-4">
              {ordered.map((p) => (
                <li key={p.attribute}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                        {p.attributeLabel}
                      </span>{" "}
                      <strong>{p.valueLabel}</strong>
                    </p>
                    <p className="text-xs text-muted tabular-nums shrink-0">
                      {p.picked} of {p.shown}
                      {p.hedged && " · early"}
                    </p>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-card-border/60 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${p.hedged ? "bg-accent/40" : "bg-accent"}`}
                      style={{ width: `${(p.picked / p.shown) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-5 text-[11px] text-muted">
            {`Your leanings, not findings — from the ${results.decidedSingleContrasts} ${
              results.decidedSingleContrasts === 1 ? "vote" : "votes"
            } where the two tellings differed on exactly one attribute.`}{" "}
            · <strong>judgment call</strong>
          </p>
        </div>
      </div>

      {/* Actions live outside the poster so screenshots stay clean. */}
      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <button
          onClick={onKeepGoing}
          className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          Keep going — sharpen your profile
        </button>
        <button
          onClick={share}
          className="flex-1 rounded-xl border border-card-border px-4 py-3 text-sm font-semibold transition hover:border-accent hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
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
