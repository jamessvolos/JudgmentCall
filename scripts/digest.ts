/**
 * Operator digest (ROADMAP-2 §2). Run on a schedule:  npx tsx scripts/digest.ts
 * Prints daily deltas; POSTs the same JSON to DIGEST_WEBHOOK_URL if set.
 */
import { PrismaClient } from "@prisma/client";
import { MIN_N } from "../src/lib/analytics";

const prisma = new PrismaClient();

async function main() {
  const dayAgo = new Date(Date.now() - 86400_000);
  const [votes24h, sessions24h, pending, snapshots] = await Promise.all([
    prisma.comparison.count({ where: { createdAt: { gte: dayAgo }, deckId: null } }),
    prisma.session.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.variant.count({ where: { status: "pending" } }),
    prisma.analysisSnapshot.findMany({ orderBy: { createdAt: "desc" }, take: 2 }),
  ]);

  // n>=MIN_N crossings between the two latest snapshots: "you can publish X now".
  const crossings: string[] = [];
  if (snapshots.length === 2) {
    const [latest, prev] = snapshots.map(
      (s) => JSON.parse(s.coverage).pairs as Record<string, number>
    );
    for (const [key, n] of Object.entries(latest)) {
      if (key.startsWith("all|") && n >= MIN_N && (prev[key] ?? 0) < MIN_N) {
        crossings.push(key.slice(4));
      }
    }
  }

  const digest = { votes24h, sessions24h, pendingReview: pending, publishableCrossings: crossings };
  console.log(JSON.stringify(digest, null, 2));
  if (crossings.length) console.log(`\n>>> You can publish: ${crossings.join(", ")}`);

  const hook = process.env.DIGEST_WEBHOOK_URL;
  if (hook) {
    await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(digest),
    });
    console.log("posted to webhook");
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
