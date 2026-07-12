// The room's live verdict on a desk stance — ONE contract shared by every
// surface that prints it (/results §01 docket, the per-call /calls/[n] pages
// and their OG cards). "Concurs"/"overrules" only when the Wilson interval
// clears the 50% null; suppressed or missing data is always the uniform open
// state. Server-side only; craft vocabulary only.

import type { ValuePairStat } from "./analytics";
import type { HouseStance } from "./house-view";

export type DeskVerdict = "ROOM CONCURS" | "ROOM OVERRULES" | "TOO CLOSE TO CALL" | "JURY'S OUT";

export function deskVerdict(stat: ValuePairStat | undefined, stance: HouseStance): DeskVerdict {
  if (!stat || stat.suppressed || stat.rateA === null || stat.interval === null) return "JURY'S OUT";
  const clears = stat.interval.lo > 0.5 || stat.interval.hi < 0.5;
  if (!clears) return "TOO CLOSE TO CALL";
  const roomPick = stat.rateA > 0.5 ? stat.valueA : stat.valueB;
  return roomPick === stance.pick ? "ROOM CONCURS" : "ROOM OVERRULES";
}

// Docket chips: short labels + tones. "Light physics": only the room's verdict
// column carries accent/danger; open states stay muted graphite.
export function verdictChipLabel(v: DeskVerdict): string {
  if (v === "ROOM CONCURS") return "CONCURS";
  if (v === "ROOM OVERRULES") return "OVERRULES";
  if (v === "TOO CLOSE TO CALL") return "TOO CLOSE";
  return "JURY'S OUT";
}

export function verdictChipTone(v: DeskVerdict): string {
  if (v === "ROOM CONCURS") return "border-accent text-accent";
  if (v === "ROOM OVERRULES") return "border-danger text-danger";
  return "border-card-border text-muted";
}
