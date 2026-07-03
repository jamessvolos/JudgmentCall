// Mechanical validators for generated variant sets (M2). Same rules and
// tokenization as the seed validator — see docs/ATTRIBUTES.md for the rubric.
// Hard failures trigger a repair turn; lint items go to the admin reviewer.

import {
  ATTRIBUTE_KEYS,
  bandFor,
  wordCount,
  type AttributeProfile,
} from "../types";
import type { FindingPlan } from "./planner";

export type GeneratedVariant = {
  slot: number;
  text: string;
  tags: AttributeProfile;
  claims: { claim: string; support: string }[];
  entailment: "entailed" | "exceeds";
};

export type ValidationResult = {
  errors: string[]; // hard failures — regenerate the named slots
  lints: string[]; // soft flags — surfaced to the human reviewer
};

const CAUSAL_LEXICON = /\b(because|caused|drove|will\b|guarantees?|expect(?:s|ed)? .{0,20}to|is why|proves)\b/i;

function extractNumbers(text: string): string[] {
  return text.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
}

export function validateGeneration(
  plan: FindingPlan,
  variants: GeneratedVariant[],
  truthSummary: string,
  contextSnippet: string
): ValidationResult {
  const errors: string[] = [];
  const lints: string[] = [];
  const truthNumbers = new Set(extractNumbers(`${truthSummary} ${contextSnippet}`));

  if (variants.length !== plan.length) {
    errors.push(`expected ${plan.length} variants, got ${variants.length}`);
    return { errors, lints };
  }

  for (const planned of plan) {
    const v = variants.find((x) => x.slot === planned.slot);
    if (!v) {
      errors.push(`slot ${planned.slot}: missing`);
      continue;
    }
    // Echoed tags must equal the injected plan — tags are decided by the
    // planner, never by the model.
    for (const key of ATTRIBUTE_KEYS) {
      if (v.tags[key] !== planned.profile[key]) {
        errors.push(
          `slot ${v.slot}: tag ${key} is "${v.tags[key]}", plan says "${planned.profile[key]}"`
        );
      }
    }
    const words = wordCount(v.text);
    if (bandFor(words) !== planned.profile.lengthBand) {
      errors.push(
        `slot ${v.slot}: ${words} words is "${bandFor(words)}", plan says "${planned.profile.lengthBand}"`
      );
    }
    if (planned.profile.leadType === "question_first" && !/^[^.!]*\?/.test(v.text.trim())) {
      errors.push(`slot ${v.slot}: question_first but the first sentence doesn't end with "?"`);
    }
    // Numeric audit: every number in the text must appear in the truth
    // summary or snippet (rounded variants may only use qualitative or
    // truth-derived figures; flag rather than fail those).
    for (const num of extractNumbers(v.text)) {
      if (!truthNumbers.has(num)) {
        (planned.profile.quantification === "precise" ? errors : lints).push(
          `slot ${v.slot}: number "${num}" not found in truthSummary/contextSnippet`
        );
      }
    }
    // Self-check consistency.
    const expected = planned.profile.fidelity === "overclaimed" ? "exceeds" : "entailed";
    if (v.entailment !== expected) {
      errors.push(`slot ${v.slot}: entailment "${v.entailment}", expected "${expected}"`);
    }
    if (v.claims.length === 0) {
      errors.push(`slot ${v.slot}: empty claims ledger`);
    }
    // Causal/extrapolative lexicon in FAITHFUL variants → reviewer attention.
    if (planned.profile.fidelity === "faithful" && CAUSAL_LEXICON.test(v.text)) {
      lints.push(`slot ${v.slot}: faithful variant contains causal/extrapolative language — review`);
    }
  }

  // Design property: >=5 single-attribute pairs (guaranteed by the planner,
  // re-checked here in case slots were dropped).
  let singleContrasts = 0;
  for (let i = 0; i < variants.length; i++) {
    for (let j = i + 1; j < variants.length; j++) {
      const diff = ATTRIBUTE_KEYS.filter((k) => variants[i].tags[k] !== variants[j].tags[k]);
      if (diff.length === 1) singleContrasts++;
    }
  }
  if (singleContrasts < 5) {
    errors.push(`only ${singleContrasts} single-attribute pairs (need >= 5)`);
  }

  return { errors, lints };
}
