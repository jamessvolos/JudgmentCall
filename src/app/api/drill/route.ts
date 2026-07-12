import { withTiming } from "@/lib/timing";
import {
  faithfulSideFor,
  fieldServesFaithful,
  isCorrectDrillCall,
  isCorrectFieldCall,
  isCorrectLedger,
  parseChoices,
  isCorrectChoice,
  correctChoiceIndex,
} from "@/lib/drill-grade";
import { NextResponse } from "next/server";
import {
  getDrillItem,
  getDrillStanding,
  getNextDrillItem,
  getSession,
  hasAttemptedDrill,
  recordDrillAttempt,
  recordDrillNaming,
} from "@/lib/repo";
import { SKILL_IDS } from "@/lib/teaching";

// The Training Room API — a separate world from the study (clearly labeled in
// the UI, items never served in the voting pool, attempts never in analytics),
// so immediate right/wrong feedback and full reveals are safe here and only
// here. Serves five exercise modes:
//   spot      — which of two tellings exceeds the data (sides shuffled per
//               session+item so the answer re-derives at grade time)
//   fix       — pick the best repair from shuffled choices
//   calibrate — pick the strongest claim the data supports
//   field     — ONE telling, no pair: stays in bounds or exceeds the data.
//               An attempt mode over the fidelity spot pool (salted separately,
//               so a learner who met the pair can't infer which text they got).
//   ledger    — one telling broken into claims; stamp every claim HOLDS or
//               EXCEEDS, then close the ledger. Exact-set grading.
// Every GET also carries The Record (grade + credentials), derived fresh from
// the attempt rows — nothing stored, nothing to desync.

function defaultPrompt(mode: string): string {
  if (mode === "fix") return "Pick the rewrite that stays true to the data without going soft.";
  if (mode === "calibrate") return "What is the strongest claim this data supports?";
  if (mode === "field") return "No pair to lean on — does this telling stay in bounds, or exceed the data?";
  if (mode === "ledger") return "Stamp every claim: does it hold, or does it exceed the data?";
  return "Which telling goes beyond what the data supports?";
}

// Fisher-Yates over indices; order is per-serve (the original index rides along
// each choice, so a reshuffle on refresh can't affect grading).
function shuffled<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// GET /api/drill?sessionId=...&mode=...&skill=...&docket=1 — next item.
// mode/skill are optional focus filters; docket seeds the draw from
// (session, UTC date, progress) so today's edition reprints identically.
async function getHandler(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const mode = searchParams.get("mode") ?? undefined;
  const skill = searchParams.get("skill") ?? undefined;
  const docket = searchParams.get("docket") === "1";
  const caseId = searchParams.get("caseId") ?? undefined;
  const exam = searchParams.get("exam") === "1";
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  const session = await getSession(sessionId);
  if (!session) return NextResponse.json({ error: "unknown session" }, { status: 404 });

  const [{ item, remaining, skillProgress, sitting, examBlocked }, standing] = await Promise.all([
    getNextDrillItem(sessionId, { mode, skill, docket, caseId, exam }),
    getDrillStanding(sessionId),
  ]);
  const record = {
    grade: {
      n: standing.grade.grade.n,
      roman: standing.grade.grade.roman,
      title: standing.grade.grade.title,
      earnedAt: standing.grade.earnedAt,
    },
    nextGate: standing.grade.nextGate,
    credentials: standing.credentials,
    exam: standing.exam,
    cases: standing.cases,
    ...(sitting ? { sitting } : {}),
    ...(examBlocked ? { examBlocked } : {}),
  };
  if (!item) {
    // Cleared the (filtered) pool: return the per-skill map for the recap.
    return NextResponse.json({
      item: null,
      remaining: 0,
      drillRating: Math.round(session.drillRating),
      drillCount: session.drillCount,
      skillProgress,
      ...record,
    });
  }

  const isField = mode === "field";
  const base = {
    exam: exam || undefined,
    caseId: caseId || undefined,
    id: item.id,
    mode: isField ? "field" : item.mode,
    skill: item.skill,
    difficulty: item.difficulty,
    title: item.title,
    contextSnippet: item.contextSnippet,
    sourceLabel: item.sourceLabel,
    prompt: isField
      ? defaultPrompt("field")
      : (item.promptText ?? defaultPrompt(item.mode)),
  };

  let payload: Record<string, unknown> = base;
  if (isField) {
    // one telling, dealt by the field salt; the pair never crosses the wire.
    payload = {
      ...base,
      t: fieldServesFaithful(sessionId, item.id) ? item.faithfulText : item.overclaimedText,
    };
  } else if (item.mode === "spot") {
    const faithful = faithfulSideFor(sessionId, item.id);
    payload = {
      ...base,
      a: faithful === "a" ? item.faithfulText : item.overclaimedText,
      b: faithful === "b" ? item.faithfulText : item.overclaimedText,
    };
  } else if (item.mode === "ledger") {
    // claims are prose in reading order — never shuffled; truth stays server-side.
    const claims = parseChoices(item.choices).map((c, i) => ({ i, text: c.text }));
    payload = { ...base, claims };
  } else {
    // fix / calibrate — send shuffled { i, text }; never the answer.
    const choices = parseChoices(item.choices).map((c, i) => ({ i, text: c.text }));
    payload = { ...base, choices: shuffled(choices) };
  }

  return NextResponse.json({
    item: payload,
    remaining,
    drillRating: Math.round(session.drillRating),
    drillCount: session.drillCount,
    skillProgress,
    ...record,
  });
}

// POST /api/drill — grade an attempt.
// Body: { sessionId, drillId, latencyMs, picked?: "a"|"b", pickedIndex?: number,
//         fieldCall?: "bounds"|"exceeds", stamps?: boolean[] }
async function postHandler(request: Request) {
  const body = await request.json().catch(() => null);
  const { sessionId, drillId, picked, pickedIndex, fieldCall, stamps, latencyMs, exam } = body ?? {};
  if (typeof sessionId !== "string" || typeof drillId !== "string") {
    return NextResponse.json({ error: "invalid drill payload" }, { status: 400 });
  }
  const [session, item] = await Promise.all([getSession(sessionId), getDrillItem(drillId)]);
  if (!session || !item) {
    return NextResponse.json({ error: "unknown session or drill" }, { status: 404 });
  }
  const isField = fieldCall !== undefined;
  const isExam = exam === true;
  if (isExam) {
    // The mark must mean the form was sat in order: recompute the position's
    // deterministic pick and refuse a hand-picked drillId or a blocked form.
    const expected = await getNextDrillItem(sessionId, { exam: true });
    if (expected.examBlocked || !expected.item || expected.item.id !== drillId) {
      return NextResponse.json({ error: "the form moved" }, { status: 409 });
    }
  }
  if (await hasAttemptedDrill(sessionId, drillId, { field: isField })) {
    return NextResponse.json({ error: "already attempted" }, { status: 409 });
  }

  const latency = Number.isFinite(latencyMs) ? Math.max(0, Math.round(latencyMs)) : 0;

  let correct: boolean;
  let reveal: Record<string, unknown>;
  let responseMode = item.mode;
  if (isField) {
    if (fieldCall !== "bounds" && fieldCall !== "exceeds") {
      return NextResponse.json({ error: "invalid pick" }, { status: 400 });
    }
    if (item.mode !== "spot") {
      return NextResponse.json({ error: "not a field item" }, { status: 400 });
    }
    const servedFaithful = fieldServesFaithful(sessionId, item.id);
    correct = isCorrectFieldCall(fieldCall, servedFaithful);
    responseMode = "field";
    reveal = {
      servedFaithful, // the truth stamp for the one telling on screen
      device: item.device,
      explanation: item.explanation,
    };
  } else if (item.mode === "spot") {
    if (picked !== "a" && picked !== "b") {
      return NextResponse.json({ error: "invalid pick" }, { status: 400 });
    }
    const faithfulSide = faithfulSideFor(sessionId, item.id);
    correct = isCorrectDrillCall(picked, faithfulSide);
    reveal = { faithfulSide, device: item.device, explanation: item.explanation };
  } else if (item.mode === "ledger") {
    const claims = parseChoices(item.choices);
    if (
      !Array.isArray(stamps) ||
      stamps.length !== claims.length ||
      stamps.some((s) => typeof s !== "boolean")
    ) {
      return NextResponse.json({ error: "invalid stamps" }, { status: 400 });
    }
    correct = isCorrectLedger(claims, stamps);
    reveal = {
      // full claims (with the truth stamp) are safe now the filing is committed
      claims: claims.map((c, i) => ({
        i,
        text: c.text,
        exceeds: c.correct,
        stamped: stamps[i],
        rationale: c.rationale,
      })),
      device: item.device,
      explanation: item.explanation,
    };
  } else {
    const choices = parseChoices(item.choices);
    if (typeof pickedIndex !== "number" || pickedIndex < 0 || pickedIndex >= choices.length) {
      return NextResponse.json({ error: "invalid pick" }, { status: 400 });
    }
    correct = isCorrectChoice(choices, pickedIndex);
    reveal = {
      // full choices (with the answer) are safe now the pick is committed
      choices: choices.map((c, i) => ({ i, text: c.text, correct: c.correct, rationale: c.rationale })),
      correctIndex: correctChoiceIndex(choices),
      pickedIndex,
      device: item.device,
      explanation: item.explanation,
    };
  }

  const result = await recordDrillAttempt({
    sessionId,
    drillItemId: drillId,
    correct,
    latencyMs: latency,
    mode: isField ? "field" : isExam ? "exam" : "",
  });

  return NextResponse.json({
    correct,
    mode: responseMode,
    skill: item.skill,
    ...reveal,
    drillRating: Math.round(result.drillRating),
    ratingDelta: Math.round(result.ratingDelta),
    drillCount: result.drillCount,
    xp: result.xp,
  });
}

// PATCH /api/drill — persist the ungraded naming beat (write-once per attempt).
// Fire-and-forget from the client; never touches the rating or the reveal.
async function patchHandler(request: Request) {
  const body = await request.json().catch(() => null);
  const { sessionId, drillId, namedSkill } = body ?? {};
  if (
    typeof sessionId !== "string" ||
    typeof drillId !== "string" ||
    typeof namedSkill !== "string" ||
    !(SKILL_IDS as readonly string[]).includes(namedSkill)
  ) {
    return NextResponse.json({ error: "invalid naming payload" }, { status: 400 });
  }
  await recordDrillNaming(sessionId, drillId, namedSkill);
  return NextResponse.json({ ok: true });
}

export const GET = withTiming("drill", getHandler);
export const POST = withTiming("drill", postHandler);
export const PATCH = withTiming("drill", patchHandler);
