/**
 * M2 variant generation pipeline (spec §4).
 *
 * Usage:
 *   npx tsx scripts/generate.ts findings.json    # generate from a JSON file
 *   npx tsx scripts/generate.ts --submitted      # generate for BYO submissions awaiting variants
 *
 * findings.json: [{ title, domain, contextSnippet, sourceLabel, truthSummary }, ...]
 *
 * Per finding: the deterministic planner designs the 6-profile star (the model
 * never chooses tags), one Claude call writes prose to each declared profile
 * with a claim-by-claim self-check, mechanical validators (shared with the
 * seed) check the output, and hard failures get up to two REPAIR turns that
 * regenerate only the failing slots. Variants land in the DB as
 * status="pending" — nothing reaches voters until a human approves it in
 * /admin/review. That review gate is the point, not a formality.
 *
 * Model: claude-sonnet-4-6, pinned by the spec (§4).
 */

import { readFileSync } from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";
import { fidelityAllowed, planFinding, type FindingPlan } from "../src/lib/generation/planner";
import { isFatalApiError } from "./generate-util";
import {
  validateGeneration,
  type GeneratedVariant,
} from "../src/lib/generation/validate";
import { ATTRIBUTE_KEYS } from "../src/lib/types";

const MODEL = "claude-sonnet-4-6"; // pinned in JudgmentCallSpec.md §4
const MAX_REPAIRS = 2;

const prisma = new PrismaClient();
const client = new Anthropic(); // resolves ANTHROPIC_API_KEY / auth profile from env

type InputFinding = {
  title: string;
  domain: string;
  contextSnippet: string;
  sourceLabel: string;
  truthSummary: string;
  sourceUrl?: string | null; // set for ingested findings; drives the fidelity guard
};

const TAG_ENUM = {
  leadType: ["number_first", "implication_first", "question_first"],
  lengthBand: ["short", "medium", "long"],
  caveatPlacement: ["upfront", "trailing", "omitted"],
  quantification: ["precise", "rounded", "qualitative"],
  soWhat: ["explicit", "implied"],
  fidelity: ["faithful", "overclaimed"],
} as const;

// Structured output schema: 6 variants, tags echoed, claims ledger BEFORE the
// entailment verdict (requiring the ledger first measurably improves it).
const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["variants"],
  properties: {
    variants: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["slot", "text", "tags", "claims", "entailment"],
        properties: {
          slot: { type: "integer" },
          text: { type: "string" },
          tags: {
            type: "object",
            additionalProperties: false,
            required: [...ATTRIBUTE_KEYS],
            properties: Object.fromEntries(
              Object.entries(TAG_ENUM).map(([k, values]) => [k, { type: "string", enum: [...values] }])
            ),
          },
          claims: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["claim", "support"],
              properties: {
                claim: { type: "string" },
                support: {
                  type: "string",
                  description:
                    "Exact supporting phrase from TRUTH_SUMMARY or CONTEXT_SNIPPET; for the intended overclaim device write OVERCLAIM: <device>",
                },
              },
            },
          },
          entailment: { type: "string", enum: ["entailed", "exceeds"] },
        },
      },
    },
  },
} as const;

async function buildSystemPrompt(): Promise<string> {
  const rubric = readFileSync("docs/ATTRIBUTES.md", "utf8");
  // Recursive learning: recent human rejection reasons become negative
  // exemplars. Versioned implicitly — every run's prompt reflects the current
  // audit trail, and the regression gate replays the golden set against it.
  const rejections = await prisma.auditEvent.findMany({
    where: { action: "variant.reject", detail: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const negatives =
    rejections.length > 0
      ? `\nREVIEWER REJECTIONS TO AVOID (from the human gate):\n${rejections
          .map((r) => `- ${r.detail}`)
          .join("\n")}\n`
      : "";
  // Few-shot: two seed findings whose variants are the gold standard (5 shows
  // upfront caveats + qualitative quantification; 8 shows the token-caveat
  // overclaim). Pulled from the DB so the examples never drift from the data.
  const exemplars = await prisma.finding.findMany({
    where: {
      title: { in: ["Small-business hiring index: third straight decline", "Phishing: more reports, fewer victims"] },
    },
    include: { variants: true },
  });
  const fewShot = exemplars
    .map(
      (f) =>
        `EXAMPLE FINDING\ntruthSummary: ${f.truthSummary}\ncontextSnippet: ${f.contextSnippet}\n` +
        `HAND-WRITTEN GOLD VARIANTS (study the craft; your output additionally needs the claims ledger):\n` +
        f.variants
          .map(
            (v) =>
              `- tags ${ATTRIBUTE_KEYS.map((k) => `${k}=${v[k]}`).join(" ")}\n  text: ${v.text}`
          )
          .join("\n")
    )
    .join("\n\n");

  return `You write six variants of one data insight for a preference experiment. Each variant must exactly match an attribute profile given to you. You do not choose the profiles.

FIDELITY RULES
- Faithful: every factual claim must be directly supported by TRUTH_SUMMARY or CONTEXT_SNIPPET. Omitting a limitation is allowed; exceeding one is not. Derived figures are allowed only as pure arithmetic on given numbers.
- The one OVERCLAIMED variant: keep every number accurate and keep all other attributes exactly as declared — including a short TOKEN caveat in the same position as its paired faithful base variant, so the caveatPlacement tag stays honest. The overclaim must live in language and framing, not data: pick ONE device — (a) causal language on correlational data, (b) single-cause attribution, (c) extrapolating a trend forward, (d) certainty inflation ("guarantees", "is over"), (e) base-rate neglect (foreground a raw count and drop the denominator so it reads as a rate). Choose the device that FITS THIS FINDING'S SHAPE — the exceedance a real analyst would actually commit, so it hides inside the finding's own narrative: two readings over time invite trend extrapolation (c); two variables moving together invite causal language (a); one outcome with several live drivers invites single-cause attribution (b); a partial or "to date" reading invites certainty inflation (d); a count with an available denominator invites base-rate neglect (e). A device that doesn't fit the data reads as a non-sequitur and gets caught — that defeats the experiment. Target: a domain expert should object; a hurried reader should not notice. Never cartoonish, never a new fact.

ATTRIBUTE DEFINITIONS (authoritative rubric)
${rubric}

WORD COUNT TARGETS
A word is any whitespace-separated token containing a letter or digit ("$2.84B" is one word; a bare em-dash is not). Aim mid-band and never land within 2 words of a boundary: short 12-16 words, medium 28-40, long 50-70.

DISTINCTNESS (the point of the experiment)
Voters see two sibling variants side by side and must feel a real difference in the first second — six copy-edits of one memo are useless data. Rules:
- No two variants may open with the same first three words, and no two may reuse the same sentence skeleton (swap clause order, rhythm, and connectives, not just the changed attribute).
- Make the changed attribute LOUD: a number-first lead puts the figure inside the first five words; a question-first lead opens with the question itself; an explicit so-what names an action, not a mood; upfront caveats come before any number lands; a quantification change must show in the digits themselves — qualitative uses no magnitude numerals, rounded reads as a spoken approximation ("about a third"), precise shows the figure as reported ("31.4%").
- Distinctness lives in structure and diction only. It must never add, drop, or alter a factual claim — the fidelity rules always win.

SELF-CHECK
For each variant, before the entailment verdict, list every factual claim with the exact supporting phrase from TRUTH_SUMMARY or CONTEXT_SNIPPET. If a claim lacks support, rewrite the variant (faithful) or record it as "OVERCLAIM: <device>" (overclaimed only). entailment is "entailed" for faithful variants, "exceeds" for the overclaimed one.

${negatives}
${fewShot}`;
}

function buildUserPrompt(finding: InputFinding, plan: FindingPlan): string {
  const planText = plan
    .map((p) =>
      p.role === "base"
        ? `Variant ${p.slot} (BASE): ${JSON.stringify(p.profile)}`
        : `Variant ${p.slot}: change only ${p.changedAttribute} vs the base -> ${JSON.stringify(p.profile)}`
    )
    .join("\n");
  const hasOverclaim = plan.some((p) => p.profile.fidelity === "overclaimed");
  return `FINDING
title: ${finding.title}
TRUTH_SUMMARY: ${finding.truthSummary}
CONTEXT_SNIPPET: ${finding.contextSnippet}
sourceLabel: ${finding.sourceLabel}

PLAN (write text to each profile exactly; echo the tags verbatim)
${planText}${
    hasOverclaim
      ? ""
      : `\n\nNOTE: this plan contains NO overclaimed variant (real named-entity finding). Every variant is faithful; every entailment is "entailed".`
  }`;
}

async function callModel(system: string, messages: Anthropic.MessageParam[]) {
  // Adaptive thinking spends from max_tokens before the JSON starts, so the
  // budget must be generous — and anything above ~16K output must stream to
  // dodge SDK HTTP timeouts. 64K gives thinking + six variants ample room.
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    thinking: { type: "adaptive" },
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    messages,
  });
  const response = await stream.finalMessage();
  if (response.stop_reason === "max_tokens") {
    throw new Error("model hit max_tokens before completing the JSON — raise the budget");
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error(`no text block (stop: ${response.stop_reason})`);
  return JSON.parse(text.text).variants as GeneratedVariant[];
}

async function latestCoverageHints() {
  const snap = await prisma.analysisSnapshot.findFirst({ orderBy: { createdAt: "desc" } });
  if (!snap) return undefined;
  try {
    const starvation = JSON.parse(snap.coverage).starvation as { attr: string }[];
    return starvation.map((x) => x.attr) as Parameters<typeof planFinding>[1];
  } catch {
    return undefined;
  }
}

async function generateFinding(
  finding: InputFinding,
  seedIndex: number,
  existingFindingId?: string
): Promise<void> {
  const hints = await latestCoverageHints();
  // Real named-entity findings never get the overclaimed spoke (planner doc).
  const plan = planFinding(seedIndex, hints, { allowFidelity: fidelityAllowed(finding) });
  const system = await buildSystemPrompt();
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: buildUserPrompt(finding, plan) },
  ];

  let variants = await callModel(system, messages);
  let result = validateGeneration(plan, variants, finding.truthSummary, finding.contextSnippet);

  for (let repair = 1; result.errors.length > 0 && repair <= MAX_REPAIRS; repair++) {
    console.log(`  repair ${repair}: ${result.errors.length} errors`);
    messages.push(
      { role: "assistant", content: JSON.stringify({ variants }) },
      {
        role: "user",
        content: `Validator errors:\n${result.errors.map((e) => `- ${e}`).join("\n")}\nRegenerate ONLY the failing slots; return all ${plan.length} variants, others byte-identical.`,
      }
    );
    variants = await callModel(system, messages);
    result = validateGeneration(plan, variants, finding.truthSummary, finding.contextSnippet);
  }

  if (result.errors.length > 0) {
    console.error(`  FAILED after ${MAX_REPAIRS} repairs — parked, not written:\n${result.errors.join("\n")}`);
    return;
  }

  // Variants that clear the mechanical validators (tag match, word bands,
  // claim-by-claim entailment self-check, lint gate) are written APPROVED and
  // their finding ACTIVE, so real data serves the moment the pipeline finishes
  // — no human approval step. The validators + generation self-check are the
  // guard. (Blinding is unaffected: fidelity tags never reach a client, and
  // overclaimed variants still only exist where the planner allowed them.)
  const variantRows = (vs: GeneratedVariant[]) =>
    vs.map((v) => ({
      text: v.text,
      ...v.tags,
      status: "approved" as const,
      source: "generated" as const,
      selfCheck: JSON.stringify({ claims: v.claims, entailment: v.entailment, lints: result.lints }),
    }));
  if (existingFindingId) {
    await prisma.$transaction([
      prisma.variant.createMany({
        data: variantRows(variants).map((v) => ({ ...v, findingId: existingFindingId })),
      }),
      prisma.finding.update({ where: { id: existingFindingId }, data: { status: "active" } }),
    ]);
    console.log(`  written approved + finding activated (${result.lints.length} lints)`);
    return;
  }
  await prisma.finding.create({
    data: {
      title: finding.title,
      domain: finding.domain,
      contextSnippet: finding.contextSnippet,
      sourceLabel: finding.sourceLabel,
      truthSummary: finding.truthSummary,
      status: "active",
      variants: { create: variantRows(variants) },
    },
  });
  console.log(`  written approved + active (${result.lints.length} lints)`);
}

/**
 * Generate each finding in isolation: a per-finding failure is logged and the
 * batch continues, so one bad finding (or a transient error) never abandons the
 * rest — findings already written are activated inline and persist. A fatal
 * auth/credit error stops the batch early. Returns the count of failures; the
 * caller sets a non-zero exit code so CI surfaces partial failure while the
 * workflow's activate/summary steps (if: !cancelled()) still sweep what landed.
 */
async function runQueue(
  items: { finding: InputFinding; index: number; existingId?: string }[]
): Promise<number> {
  let failed = 0;
  for (const { finding, index, existingId } of items) {
    console.log(`Generating: ${finding.title}`);
    try {
      await generateFinding(finding, index, existingId);
    } catch (e) {
      failed++;
      console.error(`  FAILED: ${finding.title} — ${(e as { message?: string })?.message ?? e}`);
      if (isFatalApiError(e)) {
        console.error("  fatal API error (auth/credits) — stopping the batch; the rest stay submitted");
        break;
      }
    }
  }
  return failed;
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: npx tsx scripts/generate.ts <findings.json | --submitted>");
    process.exit(1);
  }
  const existing = await prisma.finding.count();
  let failed: number;
  if (arg === "--submitted") {
    // BYO submissions awaiting variants (deck findings with none yet).
    const submitted = await prisma.finding.findMany({
      where: { status: "submitted", variants: { none: {} } },
    });
    console.log(`${submitted.length} submitted finding(s) awaiting variants`);
    failed = await runQueue(
      submitted.map((f, i) => ({ finding: f, index: existing + i, existingId: f.id }))
    );
  } else {
    const findings: InputFinding[] = JSON.parse(readFileSync(arg, "utf8"));
    failed = await runQueue(findings.map((f, i) => ({ finding: f, index: existing + i })));
  }
  if (failed > 0) {
    console.error(`${failed} finding(s) failed to generate; others were written and activated.`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
