// The teaching layer for the drill ("spot the overclaim") — the canonical
// FAMILIES of overclaim, each with a transferable tell. Drill items carry a
// precise, item-specific `device` string ("treating a noisy point estimate as
// settled"); this maps that string to the family it belongs to and pairs it
// with a reusable lesson, so a learner leaves each drill with a pattern they
// can carry to the next one — not just "that particular one was wrong."
//
// BLINDING: this module names the overclaim vocabulary and therefore belongs to
// the DRILL WORLD ONLY. It must be imported solely by /drill (the sanctioned,
// clearly-labelled training surface, whose attempts never enter analytics and
// whose items never serve in the voting pool). Never import it from swipe,
// results, review, or any voting/study surface.

export type OverclaimFamily = {
  id: "cause" | "single_cause" | "extrapolation" | "certainty" | "base_rate" | "other";
  name: string; // the recognizable pattern name
  tell: string; // the transferable "how to catch it next time" lesson
};

export const OVERCLAIM_FAMILIES: Record<OverclaimFamily["id"], OverclaimFamily> = {
  cause: {
    id: "cause",
    name: "Cause from correlation",
    tell: "Two things moving together isn't one moving the other. Ask what else changed in the same window, and whether anything actually ruled the alternatives out.",
  },
  single_cause: {
    id: "single_cause",
    name: "Single-cause story",
    tell: "When several drivers moved at once, crediting a single one is a choice, not a finding. Look for the drivers that got quietly dropped.",
  },
  extrapolation: {
    id: "extrapolation",
    name: "Overreach",
    tell: "A line drawn through one or two points, or from a narrow sample to everyone. Ask how many observations there are — and whether they'd hold outside the slice that was measured.",
  },
  certainty: {
    id: "certainty",
    name: "Certainty inflation",
    tell: "A noisy or provisional reading spoken as settled. Watch for 'is', 'will', 'guarantees' where the data only supports 'so far' and 'may'.",
  },
  base_rate: {
    id: "base_rate",
    name: "Base-rate neglect",
    tell: "A raw count with no denominator. Ask 'out of how many?' — the rate can move the opposite way from the count.",
  },
  other: {
    id: "other",
    name: "Reaching past the data",
    tell: "Every number stayed accurate; the claim still went further than the numbers support. Name the exact step the words took beyond the data.",
  },
};

// Map a drill item's free-form device string to its family. Keyword rules,
// ordered most-specific first so a string that could match two families lands
// on the sharper one. Unknown devices fall back to `other` (never throws).
export function overclaimFamily(device: string): OverclaimFamily {
  const d = device.toLowerCase();
  if (/base[\s-]?rate|denominator|out of how many/.test(d)) return OVERCLAIM_FAMILIES.base_rate;
  if (/residual|without a control|attribut|single[\s-]?cause|one (factor|driver|cause)/.test(d))
    return OVERCLAIM_FAMILIES.single_cause;
  if (/extrapolat|project|sample to the|generaliz|to the population|forward|trend/.test(d))
    return OVERCLAIM_FAMILIES.extrapolation;
  if (/noisy|settled|point estimate|certain|guarantee|\bwill\b|\bis over\b/.test(d))
    return OVERCLAIM_FAMILIES.certainty;
  if (/caus|associat|correlat|because|drove|drives|led to/.test(d)) return OVERCLAIM_FAMILIES.cause;
  return OVERCLAIM_FAMILIES.other;
}
