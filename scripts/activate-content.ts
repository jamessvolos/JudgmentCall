// Promote any content still behind the (now-removed) human review gate:
// every `pending` variant becomes `approved`, and every `submitted` finding
// that has at least one variant becomes `active`, so it serves. Idempotent and
// safe to run any time — it only ever moves pending -> approved and
// submitted -> active; it never touches an explicitly `rejected` variant.
//
//   npx tsx scripts/activate-content.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const variants = await prisma.variant.updateMany({
    where: { status: "pending" },
    data: { status: "approved" },
  });
  // Only activate submitted findings that actually have servable variants.
  const submitted = await prisma.finding.findMany({
    where: { status: "submitted", variants: { some: { status: "approved" } } },
    select: { id: true, title: true },
  });
  for (const f of submitted) {
    await prisma.finding.update({ where: { id: f.id }, data: { status: "active" } });
    console.log(`activated: ${f.title}`);
  }
  console.log(
    `done: ${variants.count} variant(s) approved, ${submitted.length} finding(s) activated`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
