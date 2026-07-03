"use client";

import { useState } from "react";

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

export function ResultsCard({
  results,
  onKeepGoing,
}: {
  results: ResultsDto;
  onKeepGoing: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const solid = results.preferences.filter((p) => !p.hedged);
  const hedgedPrefs = results.preferences.filter((p) => p.hedged);

  async function copySummary() {
    const traits = results.preferences.map(
      (p) => `${p.valueLabel}${p.hedged ? " (early signal)" : ""}`
    );
    const text = `My insight taste after ${results.voteCount} judgment calls: I go for ${
      traits.length > 0 ? traits.join(", ") : "…still deciding"
    }. — Judgment Call`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. non-secure context) — quietly do nothing.
    }
  }

  return (
    <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
      <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent">
        Your insight taste
      </p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight">
        {`${results.voteCount} calls in — here's what you go for.`}
      </h2>
      <p className="mt-1 text-sm text-muted">
        Based on the {results.decidedSingleContrasts} of your votes where the two versions
        differed on exactly one craft attribute.
      </p>

      {results.preferences.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          No clean reads yet — your pairs so far differed on several attributes at once, or
          ended in &ldquo;can&apos;t decide.&rdquo; Keep going and a profile will emerge.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {[...solid, ...hedgedPrefs].map((p) => (
            <li key={p.attribute} className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
                {p.attributeLabel}
              </span>
              <span className="text-sm leading-relaxed">
                You picked <strong>{p.valueLabel}</strong> {p.picked} of {p.shown} times
                {p.hedged && (
                  <span className="text-muted"> — early signal, keep voting to confirm</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <button
          onClick={onKeepGoing}
          className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.99]"
        >
          Keep going — sharpen your profile
        </button>
        <button
          onClick={copySummary}
          className="flex-1 rounded-xl border border-card-border px-4 py-3 text-sm font-semibold transition hover:border-accent hover:text-accent"
        >
          {copied ? "Copied!" : "Copy my results"}
        </button>
      </div>
    </div>
  );
}
