// One-time production bootstrap, run during every Vercel build: seed the
// database ONLY if it has no findings. Never reseeds — a reseed wipes votes,
// so growth of the pool goes through scripts/generate.ts + /admin/review.
import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import { syncDrillItems } from "../prisma/drills";
import { syncQuizItems } from "../prisma/quiz";

const prisma = new PrismaClient();

// Retry a flaky-network step: 3 attempts with 2s/4s backoff. The synced steps
// are idempotent upserts, so a retry after a partial failure is safe.
async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const backoffMs = [2000, 4000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= backoffMs.length) throw e;
      console.warn(
        `prod-init: ${label} failed (attempt ${attempt + 1}/${backoffMs.length + 1}) — retrying in ${backoffMs[attempt] / 1000}s.`,
        e
      );
      await new Promise((r) => setTimeout(r, backoffMs[attempt]));
    }
  }
}

async function main() {
  const findings = await prisma.finding.count();
  if (findings === 0) {
    console.log("prod-init: empty database — seeding once.");
    execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
  } else {
    console.log(`prod-init: database already seeded (${findings} findings) — skipping full seed.`);
  }
  // ALWAYS sync training content (idempotent upsert by title) so the Training
  // Room pool ships on every deploy without a reseed. Never touches findings,
  // variants, votes, or item ratings — only drill-item content fields. One
  // dropped connection must not fail the deploy: the whole sync retries.
  const { n, q } = await withRetry("content sync", async () => {
    const n = await syncDrillItems(prisma);
    const q = await syncQuizItems(prisma);
    return { n, q };
  });
  console.log(`prod-init: synced ${n} drill items.`);
  console.log(`prod-init: synced ${q} quiz items.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
