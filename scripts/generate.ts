/**
 * M2 variant generation pipeline (spec §4).
 *
 * Usage:
 *   npx tsx scripts/generate.ts findings.json
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
import { planFinding, type FindingPlan } from "../src/lib/generation/planner";
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
- The one OVERCLAIMED variant: keep every number accurate and keep all other attributes exactly as declared — including a short TOKEN caveat in the same position as its paired faithful base variant, so the caveatPlacement tag stays honest. The overclaim must live in language, not data: pick ONE device — (a) causal language on correlational data, (b) single-cause attribution, (c) extrapolating a trend forward, (d) certainty inflation ("guarantees", "is over"). Target: a domain expert should object; a hurried reader should not notice. Never cartoonish, never a new fact.

ATTRIBUTE DEFINITIONS (authoritative rubric)
${rubric}

WORD COUNT TARGETS
A word is any whitespace-separated token containing a letter or digit ("$2.84B" is one word; a bare em-dash is not). Aim mid-band and never land within 2 words of a boundary: short 12-16 words, medium 28-40, long 50-70.

SELF-CHECK
For each variant, before the entailment verdict, list every factual claim with the exact supporting phrase from TRUTH_SUMMARY or CONTEXT_SNIPPET. If a claim lacks support, rewrite the variant (faithful) or record it as "OVERCLAIM: <device>" (overclaimed only). entailment is "entailed" for faithful variants, "exceeds" for the overclaimed one.

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
  return `FINDING
title: ${finding.title}
TRUTH_SUMMARY: ${finding.truthSummary}
CONTEXT_SNIPPET: ${finding.contextSnippet}
sourceLabel: ${finding.sourceLabel}

PLAN (write text to each profile exactly; echo the tags verbatim)
${planText}`;
}

async function callModel(system: string, messages: Anthropic.MessageParam[]) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    messages,
  });
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error(`no text block (stop: ${response.stop_reason})`);
  return JSON.parse(text.text).variants as GeneratedVariant[];
}

async function generateFinding(finding: InputFinding, seedIndex: number): Promise<void> {
  const plan = planFinding(seedIndex);
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

  await prisma.finding.create({
    data: {
      title: finding.title,
      domain: finding.domain,
      contextSnippet: finding.contextSnippet,
      sourceLabel: finding.sourceLabel,
      truthSummary: finding.truthSummary,
      variants: {
        create: variants.map((v) => ({
          text: v.text,
          ...v.tags,
          status: "pending", // the human review gate — never served until approved
          source: "generated",
          selfCheck: JSON.stringify({ claims: v.claims, entailment: v.entailment, lints: result.lints }),
        })),
      },
    },
  });
  console.log(`  written as pending (${result.lints.length} lints for review)`);
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("usage: npx tsx scripts/generate.ts findings.json");
    process.exit(1);
  }
  const findings: InputFinding[] = JSON.parse(readFileSync(path, "utf8"));
  const existing = await prisma.finding.count();
  for (let i = 0; i < findings.length; i++) {
    console.log(`Generating: ${findings[i].title}`);
    await generateFinding(findings[i], existing + i);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
