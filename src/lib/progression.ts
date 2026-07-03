// Progression + skill math. Server-side only (API routes compute, clients
// receive strings/numbers).
//
// THE GUARDRAIL, in code as well as docs: nothing in this module is ever read
// by analytics. XP rewards volume and coverage — how much and where people
// vote — never WHAT they prefer. There is deliberately no XP for agreeing
// with the crowd on a live contrast: paying for conformity would corrupt the
// preference measurement this product exists to make.

export const XP = {
  vote: 10, // any decided, non-repeat vote — identical for every contrast type,
  // including the hidden fidelity contrast, so XP can never fingerprint a pair
  firstContrast: 15, // session's first vote on a contrast key (coverage)
  frontier: 10, // contrast is among the study's most-starved cells
  runComplete: 25, // every 10th vote
  daily: 20, // first vote of the (UTC) day
  drill: 15, // correct overclaim drill — a separate world from the study
} as const;

export type XpKind = keyof typeof XP;

// Editorial ladder, matching the Desk Edition masthead voice.
export const LEVELS = [
  { at: 0, title: "Stringer" },
  { at: 250, title: "Desk Assistant" },
  { at: 750, title: "Beat Reporter" },
  { at: 1600, title: "Section Editor" },
  { at: 3000, title: "Managing Editor" },
  { at: 5000, title: "Editor-in-Chief" },
] as const;

export type LevelInfo = {
  level: number; // 1-based
  title: string;
  at: number; // xp floor of this level
  nextAt: number | null; // xp needed for the next title; null at the top
};

export function levelFor(xp: number): LevelInfo {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].at) i++;
  return {
    level: i + 1,
    title: LEVELS[i].title,
    at: LEVELS[i].at,
    nextAt: i + 1 < LEVELS.length ? LEVELS[i + 1].at : null,
  };
}

// ---------------------------------------------------------------------------
// Judge ability (skill track): a Rasch-style update per gold vote.
//
// A gold pair's difficulty is its consensus margin: matching a 95/5 pair is
// easy (difficulty strongly negative), matching a 65/35 lean is genuinely
// hard. P(agree) = sigmoid(ability + logit(consensusShare)); the ability
// nudges toward the surprise, like a chess rating.

const ABILITY_K = 0.35;
const ABILITY_CLAMP = 3;

export function logit(p: number): number {
  const q = Math.min(0.99, Math.max(0.01, p));
  return Math.log(q / (1 - q));
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function updateAbility(
  current: number | null,
  consensusShare: number,
  agreed: boolean
): number {
  const ability = current ?? 0;
  const expected = sigmoid(ability + logit(consensusShare));
  const next = ability + ABILITY_K * ((agreed ? 1 : 0) - expected);
  return Math.max(-ABILITY_CLAMP, Math.min(ABILITY_CLAMP, next));
}

/** Human-readable judge rank; needs enough golds before saying anything. */
export function judgeRank(ability: number | null, goldCount: number): string | null {
  if (ability === null || goldCount < 3) return null;
  if (goldCount >= 10 && ability >= 1.2) return "Master Judge";
  if (goldCount >= 5 && ability >= 0.5) return "Calibrated Judge";
  if (ability >= 0) return "Steady Judge";
  return "Finding the range";
}

// ---------------------------------------------------------------------------
// Drill rating (chess-puzzles analog): plain Elo between the session and the
// item. The item's rating moves too, so item difficulty is learned from play.

const DRILL_K = 32;

export function drillElo(
  sessionRating: number,
  itemRating: number,
  correct: boolean
): { session: number; item: number } {
  const expected = 1 / (1 + Math.pow(10, (itemRating - sessionRating) / 400));
  const score = correct ? 1 : 0;
  return {
    session: sessionRating + DRILL_K * (score - expected),
    item: itemRating + DRILL_K * ((1 - score) - (1 - expected)),
  };
}
