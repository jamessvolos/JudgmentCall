// Bounded retry for transaction-level DB contention.
//
// A load test against the local SQLite build surfaced vote-settle failures
// under concurrent writers (write serialization). SQLite's global write lock is
// a local-only artifact — production runs Postgres — but it exposed a real gap:
// the vote settle path (recordVote's $transaction) had NO retry on transient
// contention. On Postgres, a SERIALIZABLE/deadlock abort (SQLSTATE 40001/40P01,
// surfaced by Prisma as P2034) would bubble up as a 500 and silently drop that
// vote from the ledger — a study-integrity defect, not just a latency blip.
//
// SAFETY — why retrying here cannot double-record:
// We retry ONLY errors that GUARANTEE the transaction rolled back before the
// error was raised (serialization failure, deadlock victim, write-conflict,
// lock timeout). A rolled-back transaction wrote nothing, so re-running the
// whole closure is equivalent to running it once. We NEVER retry on:
//   - validation / not-found / unique-constraint (P2002) errors — these mean
//     the work was rejected on its merits, and P2002 in particular is the
//     idempotency signal the vote route already treats as a settled no-op
//     (clientVoteId is UNIQUE), so a retry would just re-hit it.
//   - unknown / opaque errors — if we can't prove rollback, we must not retry,
//     or a committed-but-unacknowledged transaction could be double-applied.
// The residual commit-then-connection-drop case (transaction committed, ack
// lost) is covered separately by the clientVoteId UNIQUE constraint + the vote
// route's P2002 idempotent handling, not by this helper.

import { Prisma } from "@prisma/client";

// Postgres transient-rollback SQLSTATEs.
//   40001 serialization_failure, 40P01 deadlock_detected, 55P03 lock_not_available
const TRANSIENT_PG_CODES = new Set(["40001", "40P01", "55P03"]);

// Substrings that identify a guaranteed-rollback contention error across
// engines when a structured code isn't available (SQLite via better-sqlite3,
// some driver-wrapped Postgres errors).
const TRANSIENT_MESSAGE = /database is locked|database table is locked|sqlite_busy|write conflict|deadlock|could not serialize|serialization failure|lock timeout|lock_not_available/i;

/**
 * True only for errors that guarantee the transaction rolled back and is safe
 * to re-run in full. Everything else (validation, P2002, not-found, unknown)
 * returns false so the caller surfaces it unchanged.
 */
export function isTransientDbError(e: unknown): boolean {
  // Prisma's explicit write-conflict/deadlock signal.
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2034") return true;
    // Postgres SQLSTATE is carried in meta.code for raw/passthrough errors.
    const pg = (e.meta as { code?: unknown } | undefined)?.code;
    if (typeof pg === "string" && TRANSIENT_PG_CODES.has(pg)) return true;
    // A P2002 (unique violation) is deliberately NOT transient — it's the
    // idempotency path. Fall through to message check for other codes.
  }
  // Some drivers wrap contention as an unknown-request error with the SQLSTATE
  // or a well-known phrase only in the message.
  if (
    e instanceof Prisma.PrismaClientKnownRequestError ||
    e instanceof Prisma.PrismaClientUnknownRequestError ||
    e instanceof Error
  ) {
    return TRANSIENT_MESSAGE.test(e.message);
  }
  return false;
}

// Deterministic backoff. Math.random() is unavailable in some sandboxed
// contexts and non-reproducible; a per-attempt jitter derived from a rolling
// counter is enough to desynchronise contending writers without it.
let jitterSeed = 0;
function backoffMs(attempt: number): number {
  const base = 8 * 2 ** attempt; // 8, 16, 32, 64 ms
  jitterSeed = (jitterSeed * 1103515245 + 12345) & 0x7fffffff;
  const jitter = jitterSeed % base; // 0..base-1 ms
  return base + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run `fn` (typically a prisma.$transaction call) up to `attempts` times,
 * retrying ONLY on transient contention errors with jittered exponential
 * backoff. Any non-transient error, or exhaustion of attempts, re-throws the
 * original error so callers and route handlers behave exactly as before.
 */
export async function withTxRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1 && isTransientDbError(e)) {
        await sleep(backoffMs(i));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}
