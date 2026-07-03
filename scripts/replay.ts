/**
 * Serving-policy replay baseline (ROADMAP-2 §1):  npx tsx scripts/replay.ts
 * Reports the observed values of the metrics a policy change must move —
 * the baseline any candidate ServingPolicy must beat in an A/B.
 */
import { PrismaClient } from "@prisma/client";
import { MIN_N } from "../src/lib/analytics";

const prisma = new PrismaClient();

async function main() {
  const comps = await prisma.comparison.findMany({
    where: { deckId: null },
    orderBy: { createdAt: "asc" },
    select: { sessionId: true, contrastAttrs: true, winnerId: true, isRepeat: true, lowAttention: true },
  });

  // Card-fill at vote 10: distinct craft contrasts in each session's first 10.
  const bySession = new Map<string, typeof comps>();
  for (const c of comps) bySession.set(c.sessionId, [...(bySession.get(c.sessionId) ?? []), c]);
  const fills: number[] = [];
  for (const votes of bySession.values()) {
    if (votes.length < 10) continue;
    const craft = votes
      .slice(0, 10)
      .filter((v) => v.winnerId && v.contrastAttrs && v.contrastAttrs !== "fidelity" && !v.contrastAttrs.includes(","));
    fills.push(new Set(craft.map((v) => v.contrastAttrs)).size);
  }
  const avgFill = fills.length ? fills.reduce((a, b) => a + b, 0) / fills.length : 0;

  const clean = comps.filter((c) => c.winnerId && !c.isRepeat && !c.lowAttention).length;
  const repeats = comps.filter((c) => c.isRepeat).length;
  const fid = comps.filter(
    (c) => c.winnerId && !c.isRepeat && !c.lowAttention && c.contrastAttrs === "fidelity"
  ).length;

  console.log(`sessions with >=10 votes: ${fills.length}`);
  console.log(`avg distinct craft contrasts in first 10 (card fill): ${avgFill.toFixed(2)} / 5`);
  console.log(`clean-vote share: ${((clean / Math.max(1, comps.length)) * 100).toFixed(1)}%  repeats: ${repeats}`);
  console.log(`fidelity share of clean votes: ${((fid / Math.max(1, clean)) * 100).toFixed(1)}%`);
  console.log(`publishability floor MIN_N=${MIN_N}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
