import { PrismaClient } from "@prisma/client";

// Standard Next.js singleton pattern: dev hot-reload would otherwise open a
// new SQLite connection per reload.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  sqliteTuned?: boolean;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// SQLite (local/dev/self-hosted) concurrency tuning. Production runs Postgres
// (row-level MVCC — no global write lock), so this is a strict no-op there:
// the guard is the URL scheme, not NODE_ENV, because `next start` against a
// file: URL hits the same single-writer lock a load test exposes.
//
// WAL journal mode is stored in the database header, so this one-time PRAGMA
// makes the file permanently WAL: readers no longer block the writer, and the
// write lock hands off in microseconds instead of stalling other voters past
// Prisma's socket/transaction timeout. synchronous=NORMAL is the safe WAL
// companion (durable across app crashes; only a full OS crash mid-write can
// lose the last transaction — acceptable for a votes ledger, and irrelevant on
// Postgres). Best-effort: a failure here must never take the app down.
if (
  (process.env.DATABASE_URL ?? "").startsWith("file:") &&
  !globalForPrisma.sqliteTuned
) {
  globalForPrisma.sqliteTuned = true;
  (async () => {
    try {
      await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;");
      await prisma.$executeRawUnsafe("PRAGMA synchronous=NORMAL;");
      await prisma.$executeRawUnsafe("PRAGMA busy_timeout=8000;");
    } catch {
      // Non-fatal: worst case is the pre-WAL contention behaviour.
    }
  })();
}
