import { withTiming } from "@/lib/timing";
import { parseChoices, isCorrectChoice, correctChoiceIndex } from "@/lib/drill-grade";
import { NextResponse } from "next/server";
import {
  getSession,
  getQuizItem,
  getNextQuizItem,
  getQuizStanding,
  hasAttemptedQuiz,
  recordQuizAttempt,
} from "@/lib/repo";
import { isTrackId } from "@/lib/train-tracks";

// The Training Tracks API — the two multiple-choice rooms (statistics,
// data-engineering architecture). A SEPARATE WORLD from the study: items never
// serve in the voting pool and attempts never enter analytics, so immediate
// right/wrong feedback and full reveals are safe here. Every GET also carries
// The Record (level + badges + topic map), derived fresh from the attempt rows
// — nothing stored, nothing to desync.

// Fisher-Yates over choices; the original index rides along each choice, so a
// reshuffle can never affect grading (the grader re-checks the picked original
// index server-side).
function shuffled<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// GET /api/train?sessionId=...&track=...&topic=... — next item + The Record.
async function getHandler(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const track = searchParams.get("track");
  const topic = searchParams.get("topic") ?? undefined;
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  if (!track || !isTrackId(track)) return NextResponse.json({ error: "unknown track" }, { status: 400 });
  const session = await getSession(sessionId);
  if (!session) return NextResponse.json({ error: "unknown session" }, { status: 404 });

  const [next, standing] = await Promise.all([
    getNextQuizItem(sessionId, track, { topic }),
    getQuizStanding(sessionId, track),
  ]);

  const record = { standing };
  if (!next.item) {
    return NextResponse.json({
      item: null,
      remaining: 0,
      liveRating: next.liveRating,
      count: next.count,
      ...record,
    });
  }
  const it = next.item;
  const choices = parseChoices(it.choices).map((c, i) => ({ i, text: c.text }));
  return NextResponse.json({
    item: {
      id: it.id,
      track: it.track,
      topic: it.topic,
      difficulty: it.difficulty,
      scenario: it.scenario,
      prompt: it.prompt,
      choices: shuffled(choices), // { i, text } only — never the answer
    },
    remaining: next.remaining,
    liveRating: next.liveRating,
    count: next.count,
    ...record,
  });
}

// POST /api/train — grade an attempt.
// Body: { sessionId, track, quizId, pickedIndex, latencyMs }
async function postHandler(request: Request) {
  const body = await request.json().catch(() => null);
  const { sessionId, track, quizId, pickedIndex, latencyMs } = body ?? {};
  if (typeof sessionId !== "string" || typeof quizId !== "string" || !isTrackId(track)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const [session, item] = await Promise.all([getSession(sessionId), getQuizItem(quizId)]);
  if (!session || !item) {
    return NextResponse.json({ error: "unknown session or item" }, { status: 404 });
  }
  if (item.track !== track) {
    return NextResponse.json({ error: "track mismatch" }, { status: 400 });
  }
  const choices = parseChoices(item.choices);
  if (typeof pickedIndex !== "number" || pickedIndex < 0 || pickedIndex >= choices.length) {
    return NextResponse.json({ error: "invalid pick" }, { status: 400 });
  }
  if (await hasAttemptedQuiz(sessionId, quizId)) {
    return NextResponse.json({ error: "already attempted" }, { status: 409 });
  }

  const latency = Number.isFinite(latencyMs) ? Math.max(0, Math.round(latencyMs)) : 0;
  const correct = isCorrectChoice(choices, pickedIndex);

  const result = await recordQuizAttempt({
    sessionId,
    quizItemId: quizId,
    track: item.track,
    topic: item.topic,
    difficulty: item.difficulty,
    correct,
    choiceIndex: pickedIndex,
    latencyMs: latency,
  });

  return NextResponse.json({
    correct,
    // full choices (with the answer + rationale) are safe now the pick is committed
    choices: choices.map((c, i) => ({ i, text: c.text, correct: c.correct, rationale: c.rationale })),
    correctIndex: correctChoiceIndex(choices),
    pickedIndex,
    explanation: item.explanation,
    topic: item.topic,
    liveRating: Math.round(result.liveRating),
    ratingDelta: Math.round(result.ratingDelta),
    count: result.count,
  });
}

export const GET = withTiming("train", getHandler);
export const POST = withTiming("train", postHandler);
