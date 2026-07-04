/**
 * Offline unit test for isFatalApiError — the predicate that decides whether a
 * generation batch should stop early (bad key / no credits) or keep going past
 * a transient per-finding error. No network. Run: npx tsx scripts/generate-fatal.test.ts
 */
import { isFatalApiError } from "./generate-util";

let failures = 0;
const check = (name: string, cond: boolean) => {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}`);
  if (!cond) failures++;
};

// Fatal: the exact error the live pipeline hit (400 + credit balance message).
check(
  "400 credit-balance is fatal",
  isFatalApiError({ status: 400, message: "Your credit balance is too low to access the Anthropic API." })
);
check("401 auth is fatal", isFatalApiError({ status: 401, message: "invalid x-api-key" }));
check("403 permission is fatal", isFatalApiError({ status: 403, message: "forbidden" }));
check("400 quota is fatal", isFatalApiError({ status: 400, message: "monthly quota exceeded" }));

// Not fatal: keep going past these.
check("429 rate-limit is NOT fatal (retry/continue)", !isFatalApiError({ status: 429, message: "rate limited" }));
check("529 overloaded is NOT fatal", !isFatalApiError({ status: 529, message: "overloaded" }));
check(
  "400 validation (no billing words) is NOT fatal",
  !isFatalApiError({ status: 400, message: "messages.0: text content blocks must be non-empty" })
);
check("500 server error is NOT fatal", !isFatalApiError({ status: 500, message: "internal" }));
check("plain Error is NOT fatal", !isFatalApiError(new Error("socket hang up")));
check("undefined is NOT fatal", !isFatalApiError(undefined));

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
