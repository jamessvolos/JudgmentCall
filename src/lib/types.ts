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

// The six attribute columns are plain strings in the DB (SQLite has no native
// enums), so rows come back as `string`. This is the one sanctioned narrowing
// to AttributeProfile: validate every field against the canonical value lists
// and THROW on mismatch — these rows are written by our own seed/generation
// paths, so an unknown value is data corruption worth a loud failure, never a
// silent cast. Cheap by design (array includes over 2–3 values; no zod).
const ATTRIBUTE_VALUES: Record<AttributeKey, readonly string[]> = {
  leadType: LEAD_TYPES,
  lengthBand: LENGTH_BANDS,
  caveatPlacement: CAVEAT_PLACEMENTS,
  quantification: QUANTIFICATIONS,
  soWhat: SO_WHATS,
  fidelity: FIDELITIES,
};

export function toAttributeProfile(v: {
  leadType: string;
  lengthBand: string;
  caveatPlacement: string;
  quantification: string;
  soWhat: string;
  fidelity: string;
}): AttributeProfile {
  for (const key of ATTRIBUTE_KEYS) {
    if (!ATTRIBUTE_VALUES[key].includes(v[key])) {
      throw new Error(`corrupt attribute profile: ${key}="${v[key]}" is not one of [${ATTRIBUTE_VALUES[key].join(", ")}]`);
    }
  }
  return v as AttributeProfile;
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

// Kept as value tuples (not plain unions) so promoting them back to runtime
// validators stays a one-word change; today only the derived types are used.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- type source only
const VARIANT_STATUSES = ["pending", "approved", "rejected"] as const;
export type VariantStatus = (typeof VARIANT_STATUSES)[number];
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- type source only
const VARIANT_SOURCES = ["seed", "generated"] as const;
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

// Judge scoring (ROADMAP §2): a vote is "gold" when the pair already has a
// strong consensus among OTHER sessions; agreement with that consensus is the
// judge-quality signal. Re-weights analysis only — never gates voting.
export const GOLD_MIN_N = 20;
export const GOLD_MAJORITY = 0.8;
export const JUDGE_MIN_GOLD = 3;
