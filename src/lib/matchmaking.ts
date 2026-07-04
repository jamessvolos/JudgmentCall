// Server-side pair selection (spec §5):
//   1. Pick a random finding, weighted toward fewest logged comparisons.
//   2. Within it, prefer pairs differing on exactly ONE attribute (tolerate two).
//   3. Among those, prioritize the contrast with the fewest total comparisons.
//   4. Tie-break by closest Elo, then random.
//   5. Never repeat a pair for the same session (fall back across findings;
//      if a session has exhausted every pair in the pool, repeats are allowed
//      rather than dead-ending the swipe loop).

import {
  getFindingComparisonCounts,
  getFindingsWithVariantsByIds,
  getSeenPairKeys,
  getContrastCounts,
  getSessionContrastCounts,
  getServingConfig,
  type Finding,
  type ServingConfig,
  type Variant,
} from "./repo";
import { attributeDiff, type AttributeKey, type AttributeProfile } from "./types";

export type SelectedPair = {
  finding: Finding;
  variantA: Variant;
  variantB: Variant;
  contrastAttrs: AttributeKey[];
};

export function pairKey(idA: string, idB: string): string {
  return [idA, idB].sort().join("|");
}

export function contrastKey(attrs: AttributeKey[]): string {
  return [...attrs].sort().join(",");
}

type CandidatePair = {
  a: Variant;
  b: Variant;
  diff: AttributeKey[];
  key: string;
};

function enumeratePairs(variants: Variant[]): CandidatePair[] {
  const pairs: CandidatePair[] = [];
  for (let i = 0; i < variants.length; i++) {
    for (let j = i + 1; j < variants.length; j++) {
      const a = variants[i];
      const b = variants[j];
      const diff = attributeDiff(a as unknown as AttributeProfile, b as unknown as AttributeProfile);
      pairs.push({ a, b, diff, key: pairKey(a.id, b.id) });
    }
  }
  return pairs;
}

/**
 * Weighted sample: weight 1/(1+count) so under-sampled findings are favored
 * but every finding keeps a nonzero chance (the "random" in "random,
 * weighted"). Real-sourced findings get a further realBoost multiplier — once
 * the review gate approves real-data variants, they crowd out fictional seeds
 * without ever fully retiring them. Returns finding ids in sampled order for
 * fallback iteration.
 */
function sampleFindingOrder(
  counts: { findingId: string; count: number; real: boolean }[],
  realBoost: number
): string[] {
  const pool = counts.map((c) => ({
    id: c.findingId,
    weight: (c.real ? Math.max(1, realBoost) : 1) / (1 + c.count),
  }));
  const order: string[] = [];
  while (pool.length > 0) {
    const total = pool.reduce((sum, p) => sum + p.weight, 0);
    let roll = Math.random() * total;
    let picked = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      roll -= pool[i].weight;
      if (roll <= 0) {
        picked = i;
        break;
      }
    }
    order.push(pool[picked].id);
    pool.splice(picked, 1);
  }
  return order;
}

// How loudly a contrast announces itself to a reader scanning two cards.
// Length and lead differences are visible before a single word is parsed;
// caveat and number treatment take a sentence; so-what and fidelity take a
// careful read. Early votes are steered toward the loud end so a new
// session's first impression is "these two are really different" — the
// subtler contrasts arrive once the session is invested. Server-side only.
const SALIENCE: Record<AttributeKey, number> = {
  lengthBand: 0,
  leadType: 0,
  caveatPlacement: 1,
  quantification: 1,
  soWhat: 2,
  fidelity: 2,
};

function pickBest(
  candidates: CandidatePair[],
  contrastCounts: Map<string, number>,
  sessionContrasts: Map<string, number>,
  policy: ServingConfig,
  early: boolean
): CandidatePair {
  // Session variety first (a contrast this session hasn't judged beats one it
  // has — this is what feeds the personal results card), then — early in a
  // session — visual salience, then global coverage, then closest Elo, then
  // random. Variety-before-salience means an early run still walks the
  // attribute space (loudest first) instead of replaying length pairs.
  // The fidelity contrast (the flagship overclaim experiment) is up-weighted
  // globally: its count is halved, so matchmaking keeps preferring it until it
  // has roughly twice the votes of other contrasts.
  const scored = candidates.map((c) => {
    const key = contrastKey(c.diff);
    const raw = contrastCounts.get(key) ?? 0;
    const isFidelity = c.diff.length === 1 && c.diff[0] === "fidelity";
    return {
      c,
      sessionSeen: sessionContrasts.get(key) ?? 0,
      salience: early ? Math.min(...c.diff.map((a) => SALIENCE[a])) : 0,
      coverage: isFidelity ? raw / Math.max(1, policy.fidelityBoost) : raw,
      eloGap: Math.abs(c.a.elo - c.b.elo),
      jitter: Math.random(),
    };
  });
  scored.sort(
    (x, y) =>
      x.sessionSeen - y.sessionSeen ||
      x.salience - y.salience ||
      x.coverage - y.coverage ||
      x.eloGap - y.eloGap ||
      x.jitter - y.jitter
  );
  return scored[0].c;
}

export async function selectPair(
  sessionId: string,
  deckId: string | null = null
): Promise<SelectedPair | null> {
  const [findingCounts, seen, contrastCounts, sessionContrasts, policy] = await Promise.all([
    getFindingComparisonCounts(deckId),
    getSeenPairKeys(sessionId),
    getContrastCounts(),
    getSessionContrastCounts(sessionId),
    getServingConfig(),
  ]);
  if (findingCounts.length === 0) return null;

  // Early-session fidelity cap: fidelity-contrast votes are invisible on the
  // personal results card (the experiment is blind), so if they dominate a
  // new session's first votes the 10-vote payoff moment shows almost nothing.
  // After 2 fidelity pairs, a session sees no more of them until it has cast
  // 10 votes — the flagship experiment still gets its up-weighted share from
  // sessions that keep going.
  const sessionVotes = [...sessionContrasts.values()].reduce((a, b) => a + b, 0);
  const fidelityVotes = sessionContrasts.get("fidelity") ?? 0;
  const early = sessionVotes < policy.capUntilVotes;
  const capFidelity = early && fidelityVotes >= policy.earlyFidelityCap;

  const findingOrder = sampleFindingOrder(findingCounts, policy.realBoost);
  // One round-trip for every candidate's approved variants — the walk below
  // is then pure memory (perf wave 1: kills the per-finding query chain).
  const findingsById = await getFindingsWithVariantsByIds(findingOrder);

  // Two passes: first excluding pairs this session has seen, then (only if the
  // whole pool is exhausted) allowing repeats.
  for (const allowRepeats of [false, true]) {
    for (const findingId of findingOrder) {
      const finding = findingsById.get(findingId);
      if (!finding || finding.variants.length < 2) continue;

      const available = enumeratePairs(finding.variants).filter(
        (p) => allowRepeats || !seen.has(p.key)
      );
      if (available.length === 0) continue;

      // Prefer single-attribute contrasts, tolerate two, take anything last.
      const singles = available.filter((p) => p.diff.length === 1);
      const doubles = available.filter((p) => p.diff.length === 2);
      let tier = singles.length > 0 ? singles : doubles.length > 0 ? doubles : available;
      if (capFidelity) {
        const nonFidelity = tier.filter((p) => !(p.diff.length === 1 && p.diff[0] === "fidelity"));
        if (nonFidelity.length > 0) tier = nonFidelity;
      }

      const best = pickBest(tier, contrastCounts, sessionContrasts, policy, early);

      // Randomize left/right so position bias doesn't correlate with identity.
      const flip = Math.random() < 0.5;
      return {
        finding,
        variantA: flip ? best.b : best.a,
        variantB: flip ? best.a : best.b,
        contrastAttrs: best.diff,
      };
    }
  }

  return null;
}
