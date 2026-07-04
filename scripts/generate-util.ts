/**
 * Pure, side-effect-free helpers for the generation batch runner, split out so
 * they can be unit-tested without importing scripts/generate.ts (which runs
 * main() and opens a Prisma connection on load). See scripts/generate-fatal.test.ts.
 */

/**
 * A fatal, non-retryable API error (bad key, exhausted credits, org disabled)
 * hits every subsequent call identically — there is no point grinding through
 * the rest of a 20-finding queue at ~4 min each. Stop the batch early on these;
 * keep going past anything else (a transient blip on one finding shouldn't
 * abandon the ones after it).
 */
export function isFatalApiError(e: unknown): boolean {
  const status = (e as { status?: number })?.status;
  const msg = ((e as { message?: string })?.message ?? String(e)).toLowerCase();
  if (status === 401 || status === 403) return true; // auth / permission
  if (status === 400 && /credit|billing|quota|balance/.test(msg)) return true; // out of credits
  return false;
}
