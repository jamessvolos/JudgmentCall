/**
 * Offline unit test for the overclaim-family classifier. Every `device` string
 * currently in the drill data must land on a sensible family, and unknown
 * strings must fall back without throwing. Run: npx tsx scripts/teaching.test.ts
 */
import { overclaimFamily, OVERCLAIM_FAMILIES } from "../src/lib/teaching";

let failures = 0;
const eq = (name: string, got: string, want: string) => {
  const ok = got === want;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` — got ${got}, want ${want}`}`);
  if (!ok) failures++;
};

// The six device strings live in the drill data today.
eq("causal language on an association", overclaimFamily("causal language on an association").id, "cause");
eq("attributing a residual without a control", overclaimFamily("attributing a residual without a control").id, "single_cause");
eq("extrapolating a selected sample to the population", overclaimFamily("extrapolating a selected sample to the population").id, "extrapolation");
eq("unsupported projection from a weak effect", overclaimFamily("unsupported projection from a weak effect").id, "extrapolation");
eq("treating a noisy point estimate as settled", overclaimFamily("treating a noisy point estimate as settled").id, "certainty");
eq("ignoring the base rate", overclaimFamily("ignoring the base rate").id, "base_rate");

// Canonical phrasings from INSIGHT-PRINCIPLES map too.
eq("trend extrapolation", overclaimFamily("trend extrapolation").id, "extrapolation");
eq("certainty inflation", overclaimFamily("certainty inflation").id, "certainty");
eq("single-cause attribution", overclaimFamily("single-cause attribution").id, "single_cause");

// Unknown → other, never throws; and every family has name + tell.
eq("unknown device falls back", overclaimFamily("something entirely new").id, "other");
const complete = Object.values(OVERCLAIM_FAMILIES).every((f) => f.name.length > 0 && f.tell.length > 20);
console.log(`  ${complete ? "ok  " : "FAIL"} every family has a name + a transferable tell`);
if (!complete) failures++;

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
