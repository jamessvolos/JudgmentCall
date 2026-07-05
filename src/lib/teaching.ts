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

// ---------------------------------------------------------------------------
// The SKILLS registry — the Training Room's curriculum of judgment. Two
// families: FIDELITY (the claim exceeds the data — the five overclaim moves)
// and CRAFT (the telling is honest but poorly made — how an insight is
// communicated). Each skill carries a display name, a short chip label, a
// transferable "tell" (how to catch it next), and a "concept" blurb for the
// curriculum card. Concepts are drawn from INSIGHT-PRINCIPLES.md.
//
// BLINDING: like the rest of this module, drill-world only. Never import into a
// voting/study surface.

export type SkillId =
  | "cause"
  | "single_cause"
  | "extrapolation"
  | "certainty"
  | "base_rate"
  | "buried_lede"
  | "false_precision"
  | "missing_sowhat"
  | "absent_caveat"
  | "padding";

export type SkillFamily = "fidelity" | "craft";

export type Skill = {
  id: SkillId;
  family: SkillFamily;
  name: string; // display name
  short: string; // chip label
  tell: string; // how to catch it next time
  concept: string; // one- to two-sentence teaching blurb (curriculum card)
};

export const SKILLS: Record<SkillId, Skill> = {
  // FIDELITY — the claim goes past the data (shares vocabulary with the study's
  // overclaim devices; see OVERCLAIM_FAMILIES above).
  cause: {
    id: "cause",
    family: "fidelity",
    name: "Cause from correlation",
    short: "Causation",
    tell: OVERCLAIM_FAMILIES.cause.tell,
    concept:
      "Two things moving together isn't one moving the other. A causal claim needs an experiment or a ruled-out alternative — otherwise it's an association wearing causal grammar.",
  },
  single_cause: {
    id: "single_cause",
    family: "fidelity",
    name: "Single-cause story",
    short: "Single cause",
    tell: OVERCLAIM_FAMILIES.single_cause.tell,
    concept:
      "When several drivers moved at once, crediting one is a choice, not a finding. Look for the drivers that got quietly dropped from the story.",
  },
  extrapolation: {
    id: "extrapolation",
    family: "fidelity",
    name: "Overreach",
    short: "Overreach",
    tell: OVERCLAIM_FAMILIES.extrapolation.tell,
    concept:
      "A line drawn through one or two points, or from a narrow sample to everyone. Ask how many observations there are — and whether they'd hold outside the slice measured.",
  },
  certainty: {
    id: "certainty",
    family: "fidelity",
    name: "Certainty inflation",
    short: "Certainty",
    tell: OVERCLAIM_FAMILIES.certainty.tell,
    concept:
      "A noisy or provisional reading spoken as settled. Watch for 'is / will / guarantees' where the data only supports 'so far' and 'may'.",
  },
  base_rate: {
    id: "base_rate",
    family: "fidelity",
    name: "Base-rate neglect",
    short: "Base rate",
    tell: OVERCLAIM_FAMILIES.base_rate.tell,
    concept:
      "A raw count with no denominator reads as a rate. Ask 'out of how many?' — the rate can move the opposite way from the count.",
  },
  // CRAFT — the telling is faithful but badly made (INSIGHT-PRINCIPLES failure
  // taxonomy: how much of the number's real information survives to a decision).
  buried_lede: {
    id: "buried_lede",
    family: "craft",
    name: "Buried lede",
    short: "Buried lede",
    tell: "The load-bearing number should arrive first. If the reader wades to sentence three to learn what happened, most won't.",
    concept:
      "Lead with the figure. A telling that opens with throat-clearing spends the reader's attention before the point ever lands.",
  },
  false_precision: {
    id: "false_precision",
    family: "craft",
    name: "False precision",
    short: "Precision",
    tell: "Decimals imply a certainty the data rarely has. Round to what you'd defend in a hallway; reserve exact digits for when the digit is the point.",
    concept:
      "'31.4%' on data that supports 'about a third' reads as rigor and audits as noise. Precision should match what the measurement can support, no more.",
  },
  missing_sowhat: {
    id: "missing_sowhat",
    family: "craft",
    name: "Missing so-what",
    short: "So-what",
    tell: "A true, well-caveated fact that names no move leaves the reader to guess it. Say what you'd do about it.",
    concept:
      "An insight changes a decision. If the telling stops at the number and never reaches the action, the reader nods and does nothing.",
  },
  absent_caveat: {
    id: "absent_caveat",
    family: "craft",
    name: "Absent caveat",
    short: "Caveat",
    tell: "A missing limitation doesn't remove the risk — it transfers it to whoever repeats you. State the catch before the claim.",
    concept:
      "The strongest tellings disclose their own weakness first, then make the claim anyway. An omitted caveat is a silent liability.",
  },
  padding: {
    id: "padding",
    family: "craft",
    name: "Padding",
    short: "Padding",
    tell: "Length used as a proxy for rigor drowns the one number that matters. Cut until it survives being short.",
    concept:
      "If a finding can't survive being said in fifteen words, it isn't an insight yet — it's a paragraph looking for one.",
  },
};

export const FIDELITY_SKILLS: SkillId[] = [
  "cause",
  "single_cause",
  "extrapolation",
  "certainty",
  "base_rate",
];
export const CRAFT_SKILLS: SkillId[] = [
  "buried_lede",
  "false_precision",
  "missing_sowhat",
  "absent_caveat",
  "padding",
];
export const SKILL_IDS: SkillId[] = [...FIDELITY_SKILLS, ...CRAFT_SKILLS];

// Resolve a stored skill id to its Skill; unknown/legacy ids fall back to a
// generic descriptor so the UI never throws.
export function skillFor(id: string): Skill {
  return (
    SKILLS[id as SkillId] ?? {
      id: "extrapolation",
      family: "fidelity",
      name: "Reaching past the data",
      short: "Overreach",
      tell: OVERCLAIM_FAMILIES.other.tell,
      concept: "The claim went further than the numbers support.",
    }
  );
}
