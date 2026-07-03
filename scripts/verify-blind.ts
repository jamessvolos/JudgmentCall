/**
 * Blind second-pass verifier (ROADMAP-2 §1). Requires ANTHROPIC_API_KEY.
 *   npx tsx scripts/verify-blind.ts
 *
 * For each finding with generated variants: a fresh claude-haiku-4-5 context
 * gets ONLY truthSummary + contextSnippet + the six texts (no tags, no
 * self-check, no knowledge of which is the plant) and labels each variant's
 * fidelity + leadType. Reports two PROMPT-health metrics:
 *  - overclaim detectability: verifier should catch the intended overclaim and
 *    zero faithful ones (misses = too subtle; false alarms = faithful text drifting)
 *  - tag agreement: persistent disagreement on an attribute means the rubric
 *    definition is ambiguous — fix the definition, not the outputs.
 */
import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const client = new Anthropic();

async function main() {
  const findings = await prisma.finding.findMany({
    where: { variants: { some: { source: "generated" } } },
    include: { variants: { where: { source: "generated" } } },
  });
  if (findings.length === 0) {
    console.log("no generated variants to verify");
    return;
  }
  let ocHit = 0, ocFalse = 0, leadAgree = 0, total = 0;
  for (const f of findings) {
    const texts = f.variants.map((v, i) => `${i + 1}. ${v.text}`).join("\n");
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1500,
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object", additionalProperties: false, required: ["variants"],
            properties: { variants: { type: "array", items: {
              type: "object", additionalProperties: false,
              required: ["index", "fidelity", "leadType"],
              properties: {
                index: { type: "integer" },
                fidelity: { type: "string", enum: ["faithful", "overclaimed"] },
                leadType: { type: "string", enum: ["number_first", "implication_first", "question_first"] },
              } } } },
          },
        },
      },
      messages: [{
        role: "user",
        content: `TRUTH: ${f.truthSummary}\nDATA: ${f.contextSnippet}\n\nFor each numbered telling below, judge independently: does it exceed the truth (overclaimed) or stay within it (faithful)? And what leads its first non-caveat clause: the number, the implication, or a question?\n\n${texts}`,
      }],
    });
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") continue;
    const verdicts = JSON.parse(text.text).variants as { index: number; fidelity: string; leadType: string }[];
    for (const v of f.variants) {
      const idx = f.variants.indexOf(v) + 1;
      const verdict = verdicts.find((x) => x.index === idx);
      if (!verdict) continue;
      total++;
      if (v.fidelity === "overclaimed" && verdict.fidelity === "overclaimed") ocHit++;
      if (v.fidelity === "faithful" && verdict.fidelity === "overclaimed") ocFalse++;
      if (v.leadType === verdict.leadType) leadAgree++;
    }
  }
  console.log(`variants verified: ${total}`);
  console.log(`overclaim detectability: hits ${ocHit}, false alarms ${ocFalse} (want high/zero)`);
  console.log(`leadType agreement: ${((leadAgree / Math.max(1, total)) * 100).toFixed(0)}%`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
