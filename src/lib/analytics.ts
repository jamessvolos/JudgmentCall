// Published statistics (spec §6), computed the way a reviewer would demand:
// - Only decided, attention-passing, non-repeat, single-attribute-contrast votes.
// - Win rates are per VALUE-PAIR ("number_first vs implication_first" is a
//   different claim than "number_first vs question_first"), with Wilson 95%
//   intervals, suppressed below MIN_N (shown as "collecting n/MIN_N").
// - Fidelity contrasts never appear in public stats; they feed the admin-only
//   overclaim view.
// - Elo is per-finding UI sugar only: variants never compete across findings,
//   so the leaderboard is top-variant-per-finding, never global.

import {
  getAnalyticsComparisons,
  getDecidedComparisonSlots,
  getFindingsWithVariantStats,
  getTotals,
} from "./repo";
import { VALUE_LABELS, ATTRIBUTE_LABELS, type AttributeKey, type Segment } from "./types";

export const MIN_N = 30;

export type Interval = { lo: number; hi: number };

/** Wilson 95% score interval for a binomial proportion. */
export function wilson(wins: number, n: number, z = 1.96): Interval | null {
  if (n === 0) return null;
  const p = wins / n;
  const d = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return { lo: Math.max(0, center - half), hi: Math.min(1, center + half) };
}

export type ValuePairStat = {
  attribute: AttributeKey;
  attributeLabel: string;
  valueA: string; // alphabetically first value of the pair
  valueB: string;
  valueALabel: string;
  valueBLabel: string;
  winsA: number;
  n: number;
  rateA: number | null; // null while suppressed
  interval: Interval | null;
  suppressed: boolean; // n < MIN_N — show "collecting n/MIN_N"
};

type Tally = Map<string, { attribute: AttributeKey; valueA: string; valueB: string; winsA: number; n: number }>;

function tallyToStats(tally: Tally): ValuePairStat[] {
  return [...tally.values()]
    .map((t) => {
      const suppressed = t.n < MIN_N;
      return {
        attribute: t.attribute,
        attributeLabel: ATTRIBUTE_LABELS[t.attribute],
        valueA: t.valueA,
        valueB: t.valueB,
        valueALabel: VALUE_LABELS[t.valueA] ?? t.valueA,
        valueBLabel: VALUE_LABELS[t.valueB] ?? t.valueB,
        winsA: t.winsA,
        n: t.n,
        rateA: suppressed ? null : t.winsA / t.n,
        interval: suppressed ? null : wilson(t.winsA, t.n),
        suppressed,
      };
    })
    .sort((a, b) => b.n - a.n || a.attribute.localeCompare(b.attribute));
}

export type AnalyticsSnapshot = {
  totals: { comparisons: number; sessions: number; countedVotes: number };
  attributeStats: ValuePairStat[]; // all segments, fidelity excluded
  segmentStats: Partial<Record<Segment, ValuePairStat[]>>; // executive + analyst cuts
  leaderboard: {
    findingId: string;
    findingTitle: string;
    text: string;
    elo: number;
    wins: number;
    losses: number;
  }[];
};

export type OverclaimSnapshot = {
  overall: { overclaimWins: number; n: number; interval: Interval | null; suppressed: boolean };
  bySegment: { segment: string; overclaimWins: number; n: number; interval: Interval | null; suppressed: boolean }[];
  positionBias: { leftWins: number; n: number; leftRate: number | null; interval: Interval | null };
};

export async function computeAnalytics(): Promise<AnalyticsSnapshot> {
  const [comparisons, findings, totals] = await Promise.all([
    getAnalyticsComparisons(),
    getFindingsWithVariantStats(),
    getTotals(),
  ]);

  const overall: Tally = new Map();
  const perSegment: Partial<Record<Segment, Tally>> = { executive: new Map(), analyst: new Map() };

  for (const c of comparisons) {
    const attrs = c.contrastAttrs.split(",").filter(Boolean) as AttributeKey[];
    if (attrs.length !== 1) continue;
    const attr = attrs[0];
    if (attr === "fidelity") continue; // admin-only experiment

    const winner = c.winnerId === c.variantAId ? c.variantA : c.variantB;
    const loser = c.winnerId === c.variantAId ? c.variantB : c.variantA;
    const [valueA, valueB] = [winner[attr], loser[attr]].sort();
    const key = `${attr}:${valueA}|${valueB}`;

    for (const tally of [overall, perSegment[c.segment as Segment]]) {
      if (!tally) continue;
      const t = tally.get(key) ?? { attribute: attr, valueA, valueB, winsA: 0, n: 0 };
      t.n++;
      if (winner[attr] === valueA) t.winsA++;
      tally.set(key, t);
    }
  }

  return {
    totals: { ...totals, countedVotes: comparisons.length },
    attributeStats: tallyToStats(overall),
    segmentStats: {
      executive: tallyToStats(perSegment.executive!),
      analyst: tallyToStats(perSegment.analyst!),
    },
    leaderboard: findings
      .filter((f) => f.variants.length > 0)
      .map((f) => {
        const top = f.variants[0]; // already sorted by elo desc
        return {
          findingId: f.id,
          findingTitle: f.title,
          text: top.text,
          elo: top.elo,
          wins: top.wins,
          losses: top.losses,
        };
      }),
  };
}

export async function computeOverclaim(): Promise<OverclaimSnapshot> {
  const [comparisons, slots] = await Promise.all([
    getAnalyticsComparisons(),
    getDecidedComparisonSlots(),
  ]);

  const fidelity = comparisons.filter((c) => c.contrastAttrs === "fidelity");
  const count = (subset: typeof fidelity) => {
    const n = subset.length;
    const overclaimWins = subset.filter((c) => {
      const winner = c.winnerId === c.variantAId ? c.variantA : c.variantB;
      return winner.fidelity === "overclaimed";
    }).length;
    return { overclaimWins, n, interval: n >= MIN_N ? wilson(overclaimWins, n) : null, suppressed: n < MIN_N };
  };

  const segments = [...new Set(fidelity.map((c) => c.segment))].sort();
  const leftWins = slots.filter((s) => s.winnerId === s.variantAId).length;
  const n = slots.length;

  return {
    overall: count(fidelity),
    bySegment: segments.map((segment) => ({
      segment,
      ...count(fidelity.filter((c) => c.segment === segment)),
    })),
    positionBias: {
      leftWins,
      n,
      leftRate: n > 0 ? leftWins / n : null,
      interval: n > 0 ? wilson(leftWins, n) : null,
    },
  };
}
