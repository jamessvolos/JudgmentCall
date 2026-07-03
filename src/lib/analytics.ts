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
  getJudgeScores,
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
  // countedVotes = decided, attention-passing, non-repeat votes on single
  // CRAFT-attribute contrasts — exactly what the tables below sum to, so the
  // headline can never be used to infer the hidden experiment's sample size
  // by subtraction. votingSessions = distinct sessions among those votes.
  totals: { countedVotes: number; votingSessions: number };
  segmentComposition: { segment: string; counted: number }[];
  positionBias: { leftWins: number; n: number; leftRate: number | null; interval: Interval | null };
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
  // Robustness: same rate weighting each vote by its session's judgeScore
  // (unscored sessions weight 1). Published numbers stay unweighted; this
  // shows whether low-quality judges move the result.
  weightedOverallRate: number | null;
  judgeHistogram: { bucket: string; sessions: number }[];
  // The training quasi-experiment: same rate split by whether the voter had
  // completed >=1 overclaim drill before casting the vote (stamped at vote
  // time, not retroactively). "Does training judges reduce the overclaim
  // win rate?" is itself a publishable finding.
  byTraining: {
    naive: { overclaimWins: number; n: number; interval: Interval | null; suppressed: boolean };
    trained: { overclaimWins: number; n: number; interval: Interval | null; suppressed: boolean };
  };
  bySegment: { segment: string; overclaimWins: number; n: number; interval: Interval | null; suppressed: boolean }[];
  positionBias: { leftWins: number; n: number; leftRate: number | null; interval: Interval | null };
};

export async function computeAnalytics(): Promise<AnalyticsSnapshot> {
  const [comparisons, findings, slots] = await Promise.all([
    getAnalyticsComparisons(),
    getFindingsWithVariantStats(),
    getDecidedComparisonSlots(),
  ]);

  const overall: Tally = new Map();
  const perSegment: Partial<Record<Segment, Tally>> = { executive: new Map(), analyst: new Map() };
  const countedSessions = new Set<string>();
  const segmentCounts = new Map<string, number>();
  let countedVotes = 0;

  for (const c of comparisons) {
    const attrs = c.contrastAttrs.split(",").filter(Boolean) as AttributeKey[];
    if (attrs.length !== 1) continue;
    const attr = attrs[0];
    if (attr === "fidelity") continue; // admin-only experiment
    countedVotes++;
    countedSessions.add(c.sessionId);
    segmentCounts.set(c.segment, (segmentCounts.get(c.segment) ?? 0) + 1);

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

  const leftWins = slots.filter((x) => x.winnerId === x.variantAId).length;
  return {
    totals: { countedVotes, votingSessions: countedSessions.size },
    segmentComposition: [...segmentCounts.entries()]
      .map(([segment, counted]) => ({ segment, counted }))
      .sort((a, b) => b.counted - a.counted),
    positionBias: {
      leftWins,
      n: slots.length,
      leftRate: slots.length > 0 ? leftWins / slots.length : null,
      interval: slots.length > 0 ? wilson(leftWins, slots.length) : null,
    },
    attributeStats: tallyToStats(overall),
    segmentStats: {
      executive: tallyToStats(perSegment.executive!),
      analyst: tallyToStats(perSegment.analyst!),
    },
    // Public board: FAITHFUL variants only. The overclaimed plant can win its
    // head-to-heads — that's the experiment — but the study's own exhibit must
    // never quote a telling designed to exceed the data.
    leaderboard: findings
      .map((f) => ({ ...f, variants: f.variants.filter((v) => v.fidelity === "faithful") }))
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
  const [comparisons, slots, judges] = await Promise.all([
    getAnalyticsComparisons(),
    getDecidedComparisonSlots(),
    getJudgeScores(),
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

  let wWins = 0;
  let wTotal = 0;
  for (const c of fidelity) {
    const w = judges.get(c.sessionId) ?? 1;
    wTotal += w;
    const winner = c.winnerId === c.variantAId ? c.variantA : c.variantB;
    if (winner.fidelity === "overclaimed") wWins += w;
  }
  const buckets = [0, 0, 0, 0]; // <0.5, 0.5-0.8, >=0.8, unscored handled separately
  let unscored = 0;
  for (const score of judges.values()) {
    if (score === null) unscored++;
    else if (score < 0.5) buckets[0]++;
    else if (score < 0.8) buckets[1]++;
    else buckets[2]++;
  }

  return {
    overall: count(fidelity),
    weightedOverallRate: wTotal > 0 ? wWins / wTotal : null,
    byTraining: {
      naive: count(fidelity.filter((c) => !c.postDrill)),
      trained: count(fidelity.filter((c) => c.postDrill)),
    },
    judgeHistogram: [
      { bucket: "<0.5", sessions: buckets[0] },
      { bucket: "0.5–0.8", sessions: buckets[1] },
      { bucket: "≥0.8", sessions: buckets[2] },
      { bucket: "unscored", sessions: unscored },
    ],
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

export type CoverageCell = { key: string; label: string; bySegment: Record<string, number> };

/** Value-pair x segment coverage grid (admin heatmap). Craft contrasts only. */
export async function computeCoverageGrid(): Promise<CoverageCell[]> {
  const comparisons = await getAnalyticsComparisons();
  const cells = new Map<string, CoverageCell>();
  for (const c of comparisons) {
    const attrs = c.contrastAttrs.split(",").filter(Boolean) as AttributeKey[];
    if (attrs.length !== 1 || attrs[0] === "fidelity") continue;
    const attr = attrs[0];
    const winner = c.winnerId === c.variantAId ? c.variantA : c.variantB;
    const loser = c.winnerId === c.variantAId ? c.variantB : c.variantA;
    const [va, vb] = [winner[attr], loser[attr]].sort();
    const key = `${attr}:${va}|${vb}`;
    const cell = cells.get(key) ?? {
      key,
      label: `${VALUE_LABELS[va] ?? va} vs ${VALUE_LABELS[vb] ?? vb}`,
      bySegment: {},
    };
    cell.bySegment[c.segment] = (cell.bySegment[c.segment] ?? 0) + 1;
    cells.set(key, cell);
  }
  return [...cells.values()].sort((a, b) => a.key.localeCompare(b.key));
}
