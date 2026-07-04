// One-time production bootstrap, run during every Vercel build: seed the
// database ONLY if it has no findings. Never reseeds — a reseed wipes votes,
// so growth of the pool goes through scripts/generate.ts + /admin/review.
import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const findings = await prisma.finding.count();
  if (findings > 0) {
    console.log(`prod-init: database already seeded (${findings} findings) — skipping.`);
    return;
  }
  console.log("prod-init: empty database — seeding once.");
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
