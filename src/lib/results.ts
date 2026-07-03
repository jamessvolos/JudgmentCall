// Personal results card computation (spec §2/§6).
//
// Only single-attribute-contrast votes count: when the two cards differed on
// exactly one attribute, the vote cleanly attributes preference to that
// attribute's values. "Can't decide" votes and multi-attribute contrasts are
// ignored here (they still feed Elo and the raw log).
//
// Fidelity (faithful vs. overclaimed) is deliberately EXCLUDED from the card:
// the overclaim experiment is hidden from normal surfaces (spec §4) and
// telling users "you prefer overclaimed insights" would unblind it.

import { getSessionComparisons } from "./repo";
import {
  ATTRIBUTE_LABELS,
  MIN_OBS_FOR_CLAIM,
  VALUE_LABELS,
  type AttributeKey,
} from "./types";

export type AttributePreference = {
  attribute: AttributeKey;
  attributeLabel: string;
  value: string;
  valueLabel: string;
  picked: number; // times this value won when it was on screen
  shown: number; // times this value appeared in a single-contrast pair
  hedged: boolean; // true when below MIN_OBS_FOR_CLAIM
};

export type PersonalResults = {
  voteCount: number;
  decidedSingleContrasts: number;
  // What this session contributed to the PUBLIC study: decided,
  // attention-passing, non-repeat, single-craft-contrast votes. "excluded"
  // deliberately isn't broken down further — a per-reason breakdown would let
  // a voter infer the hidden experiment's arm.
  studyContribution: { counted: number; excluded: number };
  preferences: AttributePreference[];
};

export async function computePersonalResults(sessionId: string): Promise<PersonalResults> {
  const comparisons = await getSessionComparisons(sessionId);

  // stats[attribute][value] = { picked, shown }
  const stats = new Map<AttributeKey, Map<string, { picked: number; shown: number }>>();
  let decidedSingleContrasts = 0;
  let counted = 0;

  for (const c of comparisons) {
    if (!c.winnerId || c.isRepeat || c.lowAttention) continue;
    const attrs = c.contrastAttrs.split(",").filter(Boolean);
    if (attrs.length === 1 && attrs[0] !== "fidelity") counted++;
  }

  for (const c of comparisons) {
    if (!c.winnerId) continue;
    if (c.isRepeat) continue; // non-independent — the session already judged this pair
    const attrs = c.contrastAttrs.split(",").filter(Boolean) as AttributeKey[];
    if (attrs.length !== 1) continue;
    const attr = attrs[0];
    if (attr === "fidelity") continue; // hidden experiment — see header comment

    decidedSingleContrasts++;
    const winner = c.winnerId === c.variantAId ? c.variantA : c.variantB;
    const loser = c.winnerId === c.variantAId ? c.variantB : c.variantA;

    const byValue = stats.get(attr) ?? new Map();
    stats.set(attr, byValue);
    for (const variant of [winner, loser]) {
      const value = variant[attr];
      const s = byValue.get(value) ?? { picked: 0, shown: 0 };
      s.shown++;
      if (variant === winner) s.picked++;
      byValue.set(value, s);
    }
  }

  const preferences: AttributePreference[] = [];
  for (const [attr, byValue] of stats) {
    // The session's preferred value: highest pick rate, then most evidence.
    let best: AttributePreference | null = null;
    for (const [value, s] of byValue) {
      if (s.picked === 0) continue;
      const candidate: AttributePreference = {
        attribute: attr,
        attributeLabel: ATTRIBUTE_LABELS[attr],
        value,
        valueLabel: VALUE_LABELS[value] ?? value,
        picked: s.picked,
        shown: s.shown,
        hedged: s.shown < MIN_OBS_FOR_CLAIM,
      };
      if (
        !best ||
        candidate.picked / candidate.shown > best.picked / best.shown ||
        (candidate.picked / candidate.shown === best.picked / best.shown &&
          candidate.shown > best.shown)
      ) {
        best = candidate;
      }
    }
    if (best) preferences.push(best);
  }

  // Strongest, best-evidenced claims first.
  preferences.sort(
    (a, b) => b.picked / b.shown - a.picked / a.shown || b.shown - a.shown
  );

  return {
    voteCount: comparisons.length,
    decidedSingleContrasts,
    studyContribution: { counted, excluded: comparisons.length - counted },
    preferences,
  };
}
