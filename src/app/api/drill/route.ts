import { withTiming } from "@/lib/timing";
import {
  faithfulSideFor,
  isCorrectDrillCall,
  parseChoices,
  isCorrectChoice,
  correctChoiceIndex,
} from "@/lib/drill-grade";
import { NextResponse } from "next/server";
import {
  getDrillItem,
  getNextDrillItem,
  getSession,
  hasAttemptedDrill,
  recordDrillAttempt,
} from "@/lib/repo";

// The Training Room API — a separate world from the study (clearly labeled in
// the UI, items never served in the voting pool, attempts never in analytics),
// so immediate right/wrong feedback and full reveals are safe here and only
// here. Serves three exercise modes:
//   spot      — which of two tellings exceeds the data (sides shuffled per
//               session+item so the answer re-derives at grade time)
//   fix       — pick the best repair from shuffled choices
//   calibrate — pick the strongest claim the data supports
// For choice modes the served payload carries only { i, text } — the correct
// flag and rationale never cross the wire until the learner has committed.

function defaultPrompt(mode: string): string {
  if (mode === "fix") return "Pick the rewrite that stays true to the data without going soft.";
  if (mode === "calibrate") return "What is the strongest claim this data supports?";
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

// GET /api/drill?sessionId=...&mode=...&skill=... — next unattempted item.
// mode/skill are optional focus filters (dashboard mode picker / curriculum).
async function getHandler(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const mode = searchParams.get("mode") ?? undefined;
  const skill = searchParams.get("skill") ?? undefined;
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  const session = await getSession(sessionId);
  if (!session) return NextResponse.json({ error: "unknown session" }, { status: 404 });

  const { item, remaining, skillProgress } = await getNextDrillItem(sessionId, { mode, skill });
  if (!item) {
    // Cleared the (filtered) pool: return the per-skill map for the recap.
    return NextResponse.json({
      item: null,
      remaining: 0,
      drillRating: Math.round(session.drillRating),
      drillCount: session.drillCount,
      skillProgress,
    });
  }

  const base = {
    id: item.id,
    mode: item.mode,
    skill: item.skill,
    difficulty: item.difficulty,
    title: item.title,
    contextSnippet: item.contextSnippet,
    sourceLabel: item.sourceLabel,
    prompt: item.promptText ?? defaultPrompt(item.mode),
  };

  let payload: Record<string, unknown> = base;
  if (item.mode === "spot") {
    const faithful = faithfulSideFor(sessionId, item.id);
    payload = {
      ...base,
      a: faithful === "a" ? item.faithfulText : item.overclaimedText,
      b: faithful === "b" ? item.faithfulText : item.overclaimedText,
    };
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
  });
}

// POST /api/drill — grade an attempt.
// Body: { sessionId, drillId, latencyMs, picked?: "a"|"b", pickedIndex?: number }
async function postHandler(request: Request) {
  const body = await request.json().catch(() => null);
  const { sessionId, drillId, picked, pickedIndex, latencyMs } = body ?? {};
  if (typeof sessionId !== "string" || typeof drillId !== "string") {
    return NextResponse.json({ error: "invalid drill payload" }, { status: 400 });
  }
  const [session, item] = await Promise.all([getSession(sessionId), getDrillItem(drillId)]);
  if (!session || !item) {
    return NextResponse.json({ error: "unknown session or drill" }, { status: 404 });
  }
  if (await hasAttemptedDrill(sessionId, drillId)) {
    return NextResponse.json({ error: "already attempted" }, { status: 409 });
  }

  const latency = Number.isFinite(latencyMs) ? Math.max(0, Math.round(latencyMs)) : 0;

  let correct: boolean;
  let reveal: Record<string, unknown>;
  if (item.mode === "spot") {
    if (picked !== "a" && picked !== "b") {
      return NextResponse.json({ error: "invalid pick" }, { status: 400 });
    }
    const faithfulSide = faithfulSideFor(sessionId, item.id);
    correct = isCorrectDrillCall(picked, faithfulSide);
    reveal = { faithfulSide, device: item.device, explanation: item.explanation };
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
  });

  return NextResponse.json({
    correct,
    mode: item.mode,
    skill: item.skill,
    ...reveal,
    drillRating: Math.round(result.drillRating),
    ratingDelta: Math.round(result.ratingDelta),
    drillCount: result.drillCount,
    xp: result.xp,
  });
}

export const GET = withTiming("drill", getHandler);
export const POST = withTiming("drill", postHandler);
