/**
 * Recursive-learning analysis job (ROADMAP §1). Run nightly (cron/CI):
 *   npx tsx scripts/analyze.ts
 *
 * 1. Attribute effects, publication-grade: logistic model on clean decided
 *    single-craft-contrast votes. Because both variants in a counted vote
 *    share a finding and differ on exactly one attribute, per-finding
 *    intercepts cancel in the pairwise difference — the finding fixed effect
 *    is absorbed by construction, so a simple gradient fit on value-difference
 *    features is the BT-with-finding-FE estimate for this design.
 * 2. Coverage report: value-pair n per segment vs MIN_N — the demand signal
 *    that feeds planner targeting (which contrasts to sample, NEVER which
 *    values to prefer writing — that would collapse the experiment).
 *
 * Output: one AnalysisSnapshot row. Elo remains UI sugar.
 */

import { PrismaClient } from "@prisma/client";
import { MIN_N } from "../src/lib/analytics";
import { ATTRIBUTE_KEYS, type AttributeKey } from "../src/lib/types";

const prisma = new PrismaClient();

type Obs = { winnerValue: string; loserValue: string; attr: AttributeKey };

function fitLogistic(obs: Obs[]): Record<string, { beta: number; se: number }> {
  // Feature per attribute value; x = e(winnerValue) - e(loserValue); y = 1.
  const values = [...new Set(obs.flatMap((o) => [`${o.attr}:${o.winnerValue}`, `${o.attr}:${o.loserValue}`]))].sort();
  const idx = new Map(values.map((v, i) => [v, i]));
  const beta = new Array(values.length).fill(0);
  const L2 = 0.01;
  for (let iter = 0; iter < 300; iter++) {
    const grad = new Array(values.length).fill(0);
    for (const o of obs) {
      const iw = idx.get(`${o.attr}:${o.winnerValue}`)!;
      const il = idx.get(`${o.attr}:${o.loserValue}`)!;
      const p = 1 / (1 + Math.exp(-(beta[iw] - beta[il])));
      grad[iw] += 1 - p;
      grad[il] -= 1 - p;
    }
    for (let i = 0; i < beta.length; i++) beta[i] += 0.05 * (grad[i] - L2 * beta[i]);
  }
  // Approximate SEs from observed information (diagonal).
  const info = new Array(values.length).fill(L2);
  for (const o of obs) {
    const iw = idx.get(`${o.attr}:${o.winnerValue}`)!;
    const il = idx.get(`${o.attr}:${o.loserValue}`)!;
    const p = 1 / (1 + Math.exp(-(beta[iw] - beta[il])));
    info[iw] += p * (1 - p);
    info[il] += p * (1 - p);
  }
  return Object.fromEntries(values.map((v, i) => [v, { beta: beta[i], se: 1 / Math.sqrt(info[i]) }]));
}

async function main() {
  const comparisons = await prisma.comparison.findMany({
    where: { winnerId: { not: null }, lowAttention: false, isRepeat: false, deckId: null },
    include: { variantA: true, variantB: true },
  });

  const bySegment = new Map<string, Obs[]>();
  const coverage = new Map<string, number>(); // `${segment}|${attr}:${a}|${b}`
  for (const c of comparisons) {
    const attrs = c.contrastAttrs.split(",").filter(Boolean) as AttributeKey[];
    if (attrs.length !== 1 || attrs[0] === "fidelity") continue;
    const attr = attrs[0];
    const winner = c.winnerId === c.variantAId ? c.variantA : c.variantB;
    const loser = c.winnerId === c.variantAId ? c.variantB : c.variantA;
    const obs = { attr, winnerValue: winner[attr], loserValue: loser[attr] };
    for (const seg of ["all", c.segment]) {
      bySegment.set(seg, [...(bySegment.get(seg) ?? []), obs]);
    }
    const [va, vb] = [winner[attr], loser[attr]].sort();
    for (const seg of ["all", c.segment]) {
      const key = `${seg}|${attr}:${va}|${vb}`;
      coverage.set(key, (coverage.get(key) ?? 0) + 1);
    }
  }

  const coefficients = Object.fromEntries(
    [...bySegment.entries()].map(([seg, obs]) => [seg, { n: obs.length, effects: fitLogistic(obs) }])
  );

  // Starvation ranking: craft attributes ordered by how far their thinnest
  // value-pair is below MIN_N (overall cut) — feeds planner targeting.
  const starvation = ATTRIBUTE_KEYS.filter((k) => k !== "fidelity")
    .map((attr) => {
      const ns = [...coverage.entries()]
        .filter(([k]) => k.startsWith(`all|${attr}:`))
        .map(([, n]) => n);
      return { attr, minPairN: ns.length ? Math.min(...ns) : 0 };
    })
    .sort((a, b) => a.minPairN - b.minPairN);

  const snapshot = await prisma.analysisSnapshot.create({
    data: {
      method: "logistic-diff-v1 (finding FE absorbed by pairwise design)",
      coefficients: JSON.stringify(coefficients),
      coverage: JSON.stringify({
        minN: MIN_N,
        pairs: Object.fromEntries(coverage),
        starvation,
      }),
    },
  });
  console.log(`snapshot ${snapshot.id}: ${comparisons.length} clean votes`);
  console.log("starvation ranking:", starvation.map((s) => `${s.attr}(min ${s.minPairN})`).join("  "));
  for (const [v, e] of Object.entries(coefficients.all?.effects ?? {})) {
    const eff = e as { beta: number; se: number };
    console.log(`  ${v}: β=${eff.beta.toFixed(3)} ±${(1.96 * eff.se).toFixed(3)}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
