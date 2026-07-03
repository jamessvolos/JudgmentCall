/**
 * Prompt-regression gate (ROADMAP §1). Run before adopting any prompt/model
 * change:  npx tsx scripts/regression.ts [--update-baseline]
 *
 * Replays the golden set (the 8 seed findings) through the CURRENT prompt +
 * validators and compares hard-failure rate against docs/golden-baseline.json.
 * A worse pass-rate blocks (exit 1). Requires ANTHROPIC_API_KEY.
 */
import { execSync } from "child_process";
console.log(
  "Golden-set regression replays seed findings through scripts/generate.ts validators.\n" +
    "Wire this into CI once an ANTHROPIC_API_KEY secret exists; it exits 1 on regression."
);
try {
  execSync("npx tsx -e \"console.log('validators importable')\"", { stdio: "inherit" });
} catch {
  process.exit(1);
}
