"use client";

import { useEffect, useState } from "react";
import { getSessionId } from "@/lib/session-client";

type Contribution = {
  voteCount: number;
  studyContribution: { counted: number; excluded: number };
};

// The "you" in the public results page: what this visitor's own session has
// contributed to the study so far. Renders nothing for visitors who haven't
// voted.
export function YourContribution() {
  const [data, setData] = useState<Contribution | null>(null);

  useEffect(() => {
    const id = getSessionId();
    if (!id) return;
    fetch(`/api/results?sessionId=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.voteCount > 0) setData(d);
      })
      .catch(() => {});
  }, []);

  if (!data) return null;
  const { counted, excluded } = data.studyContribution;
  return (
    <div className="mt-4 rounded-xl border border-card-border bg-accent-soft/60 px-4 py-3 text-sm">
      <strong>Your contribution:</strong> {data.voteCount}{" "}
      {data.voteCount === 1 ? "call" : "calls"} cast · {counted} counted toward the study
      {excluded > 0 && (
        <span className="text-muted">
          {" "}
          · {excluded} excluded (undecided, repeats, very fast votes, multi-attribute pairs, or
          calibration comparisons)
        </span>
      )}
    </div>
  );
}
