// Attribute vocabulary shared by the seed script, matchmaking, analytics and UI.
// Stored as plain strings in SQLite (no native enums); these consts + types are
// the single source of truth for valid values.

export const LEAD_TYPES = ["number_first", "implication_first", "question_first"] as const;
export const LENGTH_BANDS = ["short", "medium", "long"] as const;
export const CAVEAT_PLACEMENTS = ["upfront", "trailing", "omitted"] as const;
export const QUANTIFICATIONS = ["precise", "rounded", "qualitative"] as const;
export const SO_WHATS = ["explicit", "implied"] as const;
export const FIDELITIES = ["faithful", "overclaimed"] as const;
export const SEGMENTS = ["executive", "analyst", "data_leader", "other"] as const;
export const DOMAINS = ["earnings", "econ", "sports", "ops"] as const;

export type LeadType = (typeof LEAD_TYPES)[number];
export type LengthBand = (typeof LENGTH_BANDS)[number];
export type CaveatPlacement = (typeof CAVEAT_PLACEMENTS)[number];
export type Quantification = (typeof QUANTIFICATIONS)[number];
export type SoWhat = (typeof SO_WHATS)[number];
export type Fidelity = (typeof FIDELITIES)[number];
export type Segment = (typeof SEGMENTS)[number];
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

// Votes faster than this are flagged lowAttention (still counted in Elo,
// excludable in analytics later).
export const LOW_ATTENTION_MS = 800;

// Personal results card unlocks after this many votes.
export const RESULTS_AT_VOTES = 10;

// Below this many observations for an attribute, the results card hedges.
export const MIN_OBS_FOR_CLAIM = 3;
