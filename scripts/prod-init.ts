// One-time production bootstrap, run during every Vercel build: seed the
// database ONLY if it has no findings. Never reseeds — a reseed wipes votes,
// so growth of the pool goes through scripts/generate.ts + /admin/review.
import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import { syncDrillItems } from "../prisma/drills";

const prisma = new PrismaClient();

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
  // variants, votes, or item ratings — only drill-item content fields.
  const n = await syncDrillItems(prisma);
  console.log(`prod-init: synced ${n} drill items.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
