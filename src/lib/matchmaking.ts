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
  getFindingWithVariants,
  getSeenPairKeys,
  getContrastCounts,
  type Finding,
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
 * weighted"). Returns finding ids in sampled order for fallback iteration.
 */
function sampleFindingOrder(counts: { findingId: string; count: number }[]): string[] {
  const pool = counts.map((c) => ({ id: c.findingId, weight: 1 / (1 + c.count) }));
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

function pickBest(candidates: CandidatePair[], contrastCounts: Map<string, number>): CandidatePair {
  // Fewest total comparisons for the contrast → closest Elo → random.
  const scored = candidates.map((c) => ({
    c,
    coverage: contrastCounts.get(contrastKey(c.diff)) ?? 0,
    eloGap: Math.abs(c.a.elo - c.b.elo),
    jitter: Math.random(),
  }));
  scored.sort(
    (x, y) => x.coverage - y.coverage || x.eloGap - y.eloGap || x.jitter - y.jitter
  );
  return scored[0].c;
}

export async function selectPair(sessionId: string): Promise<SelectedPair | null> {
  const [findingCounts, seen, contrastCounts] = await Promise.all([
    getFindingComparisonCounts(),
    getSeenPairKeys(sessionId),
    getContrastCounts(),
  ]);
  if (findingCounts.length === 0) return null;

  const findingOrder = sampleFindingOrder(findingCounts);

  // Two passes: first excluding pairs this session has seen, then (only if the
  // whole pool is exhausted) allowing repeats.
  for (const allowRepeats of [false, true]) {
    for (const findingId of findingOrder) {
      const finding = await getFindingWithVariants(findingId);
      if (!finding || finding.variants.length < 2) continue;

      const available = enumeratePairs(finding.variants).filter(
        (p) => allowRepeats || !seen.has(p.key)
      );
      if (available.length === 0) continue;

      // Prefer single-attribute contrasts, tolerate two, take anything last.
      const singles = available.filter((p) => p.diff.length === 1);
      const doubles = available.filter((p) => p.diff.length === 2);
      const tier = singles.length > 0 ? singles : doubles.length > 0 ? doubles : available;

      const best = pickBest(tier, contrastCounts);

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
