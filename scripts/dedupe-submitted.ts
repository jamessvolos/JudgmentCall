// One-shot cleanup, safe to run any time: delete SUBMITTED findings with NO
// variants that duplicate an earlier finding's (sourceUrl, title). Never
// touches findings that have variants or votes — only unstarted duplicates.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const submitted = await prisma.finding.findMany({
    where: { status: "submitted", variants: { none: {} }, sourceUrl: { not: null } },
    orderBy: { retrievedAt: "asc" },
  });
  const seen = new Set<string>();
  let removed = 0;
  for (const f of submitted) {
    const key = `${f.sourceUrl}|${f.title}`;
    if (seen.has(key)) {
      await prisma.finding.delete({ where: { id: f.id } });
      console.log(`removed duplicate: ${f.title} (${f.id})`);
      removed++;
    } else {
      seen.add(key);
    }
  }
  console.log(`dedupe complete: ${removed} removed, ${seen.size} kept`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
