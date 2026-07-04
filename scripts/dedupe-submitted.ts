// Cleanup, safe to run any time: delete SUBMITTED findings that duplicate an
// earlier finding's (sourceUrl, title) when doing so destroys no work —
// either the duplicate has no variants yet, or every variant is still
// pending review AND nothing has ever been voted on it. Findings with any
// approved/rejected variant or any comparison are never touched.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const submitted = await prisma.finding.findMany({
    where: { status: "submitted", sourceUrl: { not: null } },
    orderBy: { retrievedAt: "asc" },
    include: { variants: { select: { status: true } }, comparisons: { select: { id: true }, take: 1 } },
  });
  const seen = new Set<string>();
  let removed = 0;
  for (const f of submitted) {
    const key = `${f.sourceUrl}|${f.title}`;
    if (!seen.has(key)) {
      seen.add(key);
      continue;
    }
    const untouched =
      f.comparisons.length === 0 && f.variants.every((v) => v.status === "pending");
    if (!untouched) {
      console.log(`kept duplicate with reviewed/voted content: ${f.title} (${f.id})`);
      continue;
    }
    await prisma.variant.deleteMany({ where: { findingId: f.id } });
    await prisma.finding.delete({ where: { id: f.id } });
    console.log(`removed duplicate: ${f.title} (${f.id}, ${f.variants.length} pending variants)`);
    removed++;
  }
  console.log(`dedupe complete: ${removed} removed, ${seen.size} kept`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
