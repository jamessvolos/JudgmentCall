// Attribute vocabulary shared by the seed script, matchmaking, analytics and UI.
// Stored as plain strings in SQLite (no native enums); these consts + types are
// the single source of truth for valid values.

export const LEAD_TYPES = ["number_first", "implication_first", "question_first"] as const;
export const LENGTH_BANDS = ["short", "medium", "long"] as const;
export const CAVEAT_PLACEMENTS = ["upfront", "trailing", "omitted"] as const;
export const QUANTIFICATIONS = ["precise", "rounded", "qualitative"] as const;
export const SO_WHATS = ["explicit", "implied"] as const;
export const FIDELITIES = ["faithful", "overclaimed"] as const;
export const DOMAINS = ["earnings", "econ", "sports", "ops"] as const;
// Segments + RESULTS_AT_VOTES live in client-constants.ts (client-bundle safe)
// and are re-exported here for server code.
import { SEGMENTS, type Segment } from "./client-constants";
export { SEGMENTS, RESULTS_AT_VOTES, type Segment } from "./client-constants";

export type LeadType = (typeof LEAD_TYPES)[number];
export type LengthBand = (typeof LENGTH_BANDS)[number];
export type CaveatPlacement = (typeof CAVEAT_PLACEMENTS)[number];
export type Quantification = (typeof QUANTIFICATIONS)[number];
export type SoWhat = (typeof SO_WHATS)[number];
export type Fidelity = (typeof FIDELITIES)[number];
export type Domain = (typeof DOMAINS)[number];

// The craft attributes every variant is tagged with, in comparison order.
export const ATTRIBUTE_KEYS = [
  "leadType",
  "lengthBand",
  "caveatPlacement",
  "quantification",
  "soWhat",
  "fidelity",
] as const;

export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];

export type AttributeProfile = {
  leadType: LeadType;
  lengthBand: LengthBand;
  caveatPlacement: CaveatPlacement;
  quantification: Quantification;
  soWhat: SoWhat;
  fidelity: Fidelity;
};

export function isSegment(value: unknown): value is Segment {
  return typeof value === "string" && (SEGMENTS as readonly string[]).includes(value);
}

/** Attribute keys on which two variants differ. */
export function attributeDiff(
  a: Pick<AttributeProfile, AttributeKey>,
  b: Pick<AttributeProfile, AttributeKey>
): AttributeKey[] {
  return ATTRIBUTE_KEYS.filter((key) => a[key] !== b[key]);
}

// Human-readable labels for the personal results card.
export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  leadType: "Lead",
  lengthBand: "Length",
  caveatPlacement: "Caveats",
  quantification: "Numbers",
  soWhat: "So-what",
  fidelity: "Fidelity",
};

export const VALUE_LABELS: Record<string, string> = {
  number_first: "number-first",
  implication_first: "implication-first",
  question_first: "question-first",
  short: "short",
  medium: "medium-length",
  long: "long",
  upfront: "caveats up front",
  trailing: "caveats at the end",
  omitted: "no caveats",
  precise: "precise figures",
  rounded: "rounded figures",
  qualitative: "qualitative wording",
  explicit: "an explicit so-what",
  implied: "an implied so-what",
  faithful: "strictly faithful",
  overclaimed: "punchy-but-overclaimed",
};

export const VARIANT_STATUSES = ["pending", "approved", "rejected"] as const;
export type VariantStatus = (typeof VARIANT_STATUSES)[number];
export const VARIANT_SOURCES = ["seed", "generated"] as const;
export type VariantSource = (typeof VARIANT_SOURCES)[number];

// ---------------------------------------------------------------------------
// Canonical tokenization for length bands. Seed validation, the M2 generation
// validator, and the admin screen MUST all use these — divergent word counting
// is the #1 source of spurious tag mismatches.

/** A word is any whitespace-separated token containing a letter or digit ("$2.84B" is one word). */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
}

/** short <20 words, medium 20–45, long >45. */
export function bandFor(words: number): LengthBand {
  return words < 20 ? "short" : words <= 45 ? "medium" : "long";
}

// Votes faster than this are flagged lowAttention (still counted in Elo,
// excludable in analytics later).
export const LOW_ATTENTION_MS = 800;

// Integrity limits (spec §9): hard cap on vote rate per session, and a
// "can't decide" throttle — more than 2 of the last 5 votes undecided forces
// a pick on the next one.
export const MAX_VOTES_PER_MINUTE = 30;
export const CANT_DECIDE_WINDOW = 5;
export const CANT_DECIDE_MAX_IN_WINDOW = 2;

// Below this many observations for an attribute, the results card hedges.
export const MIN_OBS_FOR_CLAIM = 3;
