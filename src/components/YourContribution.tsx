"use client";

import { useEffect, useState } from "react";
import { getSessionId } from "@/lib/session-client";

type Contribution = {
  voteCount: number;
  studyContribution: { counted: number; excluded: number };
  preferences: { attribute: string; value: string; valueLabel: string; picked: number; shown: number; hedged: boolean }[];
};

type CrowdStat = {
  attribute: string; valueA: string; valueB: string;
  valueALabel: string; valueBLabel: string; rateA: number; n: number;
};

// The "you" in the public results page: what this visitor's own session has
// contributed to the study so far. Renders nothing for visitors who haven't
// voted.
export function YourContribution() {
  const [data, setData] = useState<Contribution | null>(null);
  const [crowd, setCrowd] = useState<CrowdStat[]>([]);

  useEffect(() => {
    const id = getSessionId();
    if (!id) return;
    fetch(`/api/results?sessionId=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.voteCount > 0) setData(d);
      })
      .catch(() => {});
    fetch("/api/crowd")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCrowd(d.stats))
      .catch(() => {});
  }, []);

  if (!data) return null;

  // Your taste vs the crowd: for each solid personal preference, find an
  // unsuppressed crowd contrast involving that value and compare directions.
  const versus = (data.preferences ?? [])
    .filter((p) => !p.hedged)
    .map((p) => {
      const stat = crowd.find(
        (c) => c.attribute === p.attribute && (c.valueA === p.value || c.valueB === p.value)
      );
      if (!stat) return null;
      const crowdRate = stat.valueA === p.value ? stat.rateA : 1 - stat.rateA;
      return { label: p.valueLabel, you: p.picked / p.shown, crowd: crowdRate };
    })
    .filter(Boolean) as { label: string; you: number; crowd: number }[];
  const { counted, excluded } = data.studyContribution;
  return (
    <div className="mt-4 rounded-card border-l-[3px] border-rule-strong bg-wash px-4 py-3 text-sm">
      <strong>Your contribution:</strong> {data.voteCount}{" "}
      {data.voteCount === 1 ? "call" : "calls"} cast · {counted} counted toward the study
      {excluded > 0 && (
        <span className="text-muted">
          {" "}
          · {excluded} excluded (undecided, repeats, very fast votes, multi-attribute pairs, or
          calibration comparisons)
        </span>
      )}
      {versus.length > 0 && (
        <span className="mt-1 block text-xs text-muted">
          You vs the crowd:{" "}
          {versus
            .slice(0, 3)
            .map(
              (v) =>
                `${v.label} — you ${Math.round(v.you * 100)}%, crowd ${Math.round(v.crowd * 100)}%`
            )
            .join(" · ")}
        </span>
      )}
    </div>
  );
}
