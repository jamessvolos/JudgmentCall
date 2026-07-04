/**
 * Offline unit test for the transient-DB-error predicate + retry wrapper.
 * No database is touched — we construct the error shapes Prisma/drivers throw
 * and assert which ones are retry-eligible. The safety property under test:
 * ONLY guaranteed-rollback contention errors retry; every merit-rejection
 * error (validation, not-found, unique/P2002 idempotency) passes through
 * untouched. Run: npx tsx scripts/tx-retry.test.ts
 */
import { Prisma } from "@prisma/client";
import { isTransientDbError, withTxRetry } from "../src/lib/tx-retry";

let failures = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = got === want;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` — got ${got}, want ${want}`}`);
  if (!ok) failures++;
};

const known = (code: string, meta?: Record<string, unknown>, message = code) =>
  new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: "test", meta });

// --- isTransientDbError: the transient (retry-eligible) set ---
eq("P2034 write-conflict/deadlock is transient", isTransientDbError(known("P2034")), true);
eq("PG 40001 serialization_failure via meta is transient", isTransientDbError(known("P2010", { code: "40001" })), true);
eq("PG 40P01 deadlock_detected via meta is transient", isTransientDbError(known("P2010", { code: "40P01" })), true);
eq("PG 55P03 lock_not_available via meta is transient", isTransientDbError(known("P2010", { code: "55P03" })), true);
eq("SQLite 'database is locked' message is transient", isTransientDbError(new Error("SQLITE_BUSY: database is locked")), true);
eq("'could not serialize access' message is transient", isTransientDbError(new Error('could not serialize access due to concurrent update')), true);
eq("'deadlock' message is transient", isTransientDbError(new Error("deadlock detected")), true);
eq("unknown-request wrapper with lock message is transient", isTransientDbError(new Prisma.PrismaClientUnknownRequestError("write conflict on table", { clientVersion: "test" })), true);

// --- isTransientDbError: everything else must NOT retry ---
eq("P2002 unique violation is NOT transient (idempotency path)", isTransientDbError(known("P2002", { target: ["clientVoteId"] })), false);
eq("P2025 not-found is NOT transient", isTransientDbError(known("P2025")), false);
eq("P2003 FK violation is NOT transient", isTransientDbError(known("P2003")), false);
eq("validation error is NOT transient", isTransientDbError(new Prisma.PrismaClientValidationError("Invalid `prisma.x` invocation", { clientVersion: "test" })), false);
eq("generic Error is NOT transient", isTransientDbError(new Error("something unrelated broke")), false);
eq("plain string is NOT transient", isTransientDbError("database is locked"), false);
eq("null is NOT transient", isTransientDbError(null), false);
eq("undefined is NOT transient", isTransientDbError(undefined), false);

// --- withTxRetry: behavioural contract ---
async function run() {
  // 1) Transient failures are retried and can succeed on a later attempt.
  let calls = 0;
  const result = await withTxRetry(async () => {
    calls++;
    if (calls < 3) throw known("P2034");
    return "settled";
  });
  eq("retries transient until success (attempts used)", calls, 3);
  eq("returns the eventual success value", result, "settled");

  // 2) Non-transient errors are NOT retried — fail fast on first throw.
  let calls2 = 0;
  let threw2: unknown = null;
  try {
    await withTxRetry(async () => {
      calls2++;
      throw known("P2002");
    });
  } catch (e) {
    threw2 = e;
  }
  eq("does not retry a non-transient error", calls2, 1);
  eq("re-throws the original non-transient error", threw2 instanceof Prisma.PrismaClientKnownRequestError, true);

  // 3) Exhausting the attempt budget re-throws the last transient error.
  let calls3 = 0;
  let threw3: unknown = null;
  try {
    await withTxRetry(async () => {
      calls3++;
      throw known("P2034");
    }, 4);
  } catch (e) {
    threw3 = e;
  }
  eq("retries up to the attempt cap then gives up", calls3, 4);
  eq("re-throws the last error after exhaustion", (threw3 as Prisma.PrismaClientKnownRequestError)?.code, "P2034");

  // 4) A clean success runs exactly once.
  let calls4 = 0;
  await withTxRetry(async () => {
    calls4++;
    return 1;
  });
  eq("success path runs the closure exactly once", calls4, 1);
}

run().then(() => {
  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
});
