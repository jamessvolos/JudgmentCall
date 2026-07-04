// Deterministic star planner (M2). The HARNESS designs the 6-variant set;
// the model only writes prose to each declared profile. Tags are therefore
// correct by construction — an echo mismatch is a validation failure, not a
// judgment call.
//
// Plan shape per finding: BASE + 5 spokes. One spoke is always the fidelity
// contrast (the flagship experiment). The other 4 change exactly one craft
// attribute each, with one attribute "doubled" (two spokes varying the same
// 3-valued attribute also differ from EACH OTHER on one attribute, yielding
// 6-7 clean pairs per finding instead of 5).
//
// Base profiles and contrasted attributes rotate with `seedIndex` so that
// across a growing deck every attribute VALUE-PAIR keeps appearing in clean
// contrasts (the fix for the star design's base-value-only confound).

import {
  ATTRIBUTE_KEYS,
  CAVEAT_PLACEMENTS,
  LEAD_TYPES,
  LENGTH_BANDS,
  QUANTIFICATIONS,
  SO_WHATS,
  type AttributeKey,
  type AttributeProfile,
} from "../types";

export type PlannedVariant = {
  slot: number; // 1-based; slot 1 is the base
  role: "base" | "spoke";
  changedAttribute: AttributeKey | null; // vs base; null for the base itself
  profile: AttributeProfile;
};

export type FindingPlan = PlannedVariant[];

const CRAFT_KEYS = ATTRIBUTE_KEYS.filter((k) => k !== "fidelity") as Exclude<
  AttributeKey,
  "fidelity"
>[];

const VALUES: Record<(typeof CRAFT_KEYS)[number], readonly string[]> = {
  leadType: LEAD_TYPES,
  lengthBand: LENGTH_BANDS,
  caveatPlacement: CAVEAT_PLACEMENTS,
  quantification: QUANTIFICATIONS,
  soWhat: SO_WHATS,
};

function rotate<T>(values: readonly T[], by: number): T {
  return values[by % values.length];
}

/**
 * The real-data guard: fidelity plants (deliberately overclaimed tellings)
 * are never attached to findings about real, NAMED entities — an overclaim
 * about an actual company's filing is a false statement about a real firm,
 * not a craft experiment. Aggregate/macro sources (FRED, BLS) and fictional
 * findings keep the fidelity spoke.
 */
export function fidelityAllowed(finding: { sourceUrl?: string | null }): boolean {
  return !finding.sourceUrl?.includes("sec.gov");
}

/**
 * Plan the 6-variant set for the finding at `seedIndex` (its position in the
 * generated deck — pass a monotonically increasing counter). Deterministic:
 * the same index always yields the same plan, so regeneration is reproducible.
 */
export function planFinding(
  seedIndex: number,
  coverageHints?: Exclude<AttributeKey, "fidelity">[], // starvation-ranked, thinnest first
  opts?: { allowFidelity?: boolean }
): FindingPlan {
  const allowFidelity = opts?.allowFidelity ?? true;
  // Rotate the base profile so no attribute value is "always the base".
  const base: AttributeProfile = {
    leadType: rotate(LEAD_TYPES, seedIndex),
    lengthBand: "medium", // medium base gives short AND long clean contrasts
    caveatPlacement: rotate(CAVEAT_PLACEMENTS, seedIndex + 1),
    quantification: rotate(QUANTIFICATIONS, seedIndex + 2),
    soWhat: rotate(SO_WHATS, seedIndex),
    fidelity: "faithful",
  };

  // Rotate which attribute gets doubled and which 4 craft attributes are
  // contrasted this finding (one of the five sits out each time). When the
  // analysis job supplies coverage hints, the starved attribute gets doubled
  // and the best-covered one sits out — learning changes WHICH contrasts we
  // sample, never which values we prefer to generate.
  const doubled = coverageHints?.[0] ?? CRAFT_KEYS[seedIndex % CRAFT_KEYS.length];
  let skipped =
    coverageHints && coverageHints.length >= 2
      ? coverageHints[coverageHints.length - 1]
      : CRAFT_KEYS[(seedIndex + 2) % CRAFT_KEYS.length];
  if (skipped === doubled) skipped = CRAFT_KEYS.find((k) => k !== doubled)!;
  const singles = CRAFT_KEYS.filter((k) => k !== doubled && k !== skipped);

  const plan: FindingPlan = [
    { slot: 1, role: "base", changedAttribute: null, profile: { ...base } },
  ];
  let slot = 2;

  // Two spokes on the doubled attribute (its two non-base values, or for
  // 2-valued attributes just the one alternative + promote a single).
  const altValues = VALUES[doubled].filter((v) => v !== base[doubled]);
  for (const value of altValues.slice(0, 2)) {
    plan.push({
      slot: slot++,
      role: "spoke",
      changedAttribute: doubled,
      profile: { ...base, [doubled]: value },
    });
  }

  // Single spokes: up to 4 craft spokes when the fidelity spoke follows,
  // one extra when it doesn't (named-entity findings) so the star stays
  // 6 variants and the craft coverage actually widens.
  const craftBudget = allowFidelity ? 5 : 6;
  // When the doubled attribute only had one alternative (2-valued) the
  // skipped attribute is promoted back in so the star stays full.
  for (const key of [...singles, skipped]) {
    if (plan.length >= craftBudget) break;
    const alt = VALUES[key].find((v) => v !== base[key])!;
    plan.push({
      slot: slot++,
      role: "spoke",
      changedAttribute: key,
      profile: { ...base, [key]: alt },
    });
  }

  // The fidelity spoke: identical profile to base, overclaimed. Skipped for
  // real named-entity findings (see fidelityAllowed).
  if (allowFidelity) {
    plan.push({
      slot: slot++,
      role: "spoke",
      changedAttribute: "fidelity",
      profile: { ...base, fidelity: "overclaimed" },
    });
  }

  return plan;
}
