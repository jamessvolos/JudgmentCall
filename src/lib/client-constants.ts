// Constants safe to ship in the client JS bundle. Client components must
// import from HERE, never from types.ts — that module carries the fidelity
// vocabulary ("overclaimed", value labels) and integrity thresholds
// (low-attention floor, throttle windows), and anything imported by a client
// component lands in the served bundle where a curious voter can unblind the
// hidden experiment or learn exactly how to game the attention filter.

export const SEGMENTS = ["executive", "analyst", "data_leader", "other"] as const;
export type Segment = (typeof SEGMENTS)[number];

export const SEGMENT_LABELS: Record<Segment, string> = {
  executive: "Executive",
  analyst: "Analyst",
  data_leader: "Data Leader",
  other: "Other",
};

// Personal results card unlocks after this many votes.
export const RESULTS_AT_VOTES = 10;
