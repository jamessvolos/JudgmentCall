import { NextResponse } from "next/server";
import { computeAnalytics, MIN_N, type ValuePairStat } from "@/lib/analytics";
import { stanceFor } from "@/lib/house-view";
import { LESSONS } from "@/lib/lessons";
import { judgeRank, levelFor } from "@/lib/progression";
import { computePersonalResults } from "@/lib/results";
import { getLastRunComparisons, getPairConsensus, getSession } from "@/lib/repo";
import {
  GOLD_MAJORITY,
  GOLD_MIN_N,
  VALUE_LABELS,
  type AttributeKey,
  type Segment,
} from "@/lib/types";

// GET /api/review?sessionId=... — the "match review" for the session's most
// recent run (its last 10 public-study votes).
//
// BLINDING RULES (this payload ships to the client — audit before changing):
// - Variant ids + texts only; tags never leave the server.
// - Crowd data attaches ONLY to contrasts already public on /results
//   (single craft attribute, n >= MIN_N). Everything else — suppressed craft
//   contrasts, multi-attribute pairs, AND every fidelity pair — collapses
//   into one indistinguishable "still collecting" state. Fidelity stats are
//   never published, so fidelity pairs blend into that state permanently.
// - Gold ("calibration") tags are allowed: they reveal a single pair's
//   majority, which the voter can never see again (no-repeat rule), and the
//   label class contains both craft and fidelity golds, so it separates
//   nothing.
// - Desk (House View) data attaches ONLY to calls that already carry a
//   published crowd tag — the same class, no new partition. Attaching it to
//   every craft single would split STILL COLLECTING into "has a desk view"
//   (suppressed craft) vs "doesn't" (fidelity + multi-attr), and a reader who
//   can spot multi-attribute pairs by eye could then isolate fidelity pairs.
// - Taste framing throughout: WITH THE ROOM / CONTRARIAN, never right/wrong —
//   craft preference has no correct answer, and grading it would train
//   conformity into the very data this product measures. The desk's stance is
//   an opinion on the record, not an answer key — "agreed" with it is styled
//   as concurrence, never as correctness.

type ReviewCall = {
  yourText: string | null; // null = passed ("can't decide")
  otherText: string;
  decided: boolean;
  excluded: boolean; // repeat or too-fast — logged but outside the study
  tag:
    | "WITH THE ROOM"
    | "CONTRARIAN"
    | "SPLIT ROOM"
    | "CALIBRATION — MATCHED"
    | "CALIBRATION — MISSED"
    | "STILL COLLECTING"
    | "PASSED"
    | "EXCLUDED";
  crowd: { yourPickShare: number; n: number } | null;
  // The desk's registered call on this contrast, and whether the voter sided
  // with it. Only ever set alongside a published crowd tag (see blinding).
  desk: { pick: string; agreed: boolean; line: string } | null;
};

function statFor(
  stats: ValuePairStat[],
  attr: AttributeKey,
  va: string,
  vb: string
): ValuePairStat | undefined {
  const [a, b] = [va, vb].sort();
  return stats.find((s) => s.attribute === attr && s.valueA === a && s.valueB === b);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  const session = await getSession(sessionId);
  if (!session) return NextResponse.json({ error: "unknown session" }, { status: 404 });

  const [run, analytics, personal] = await Promise.all([
    getLastRunComparisons(sessionId, 10),
    computeAnalytics(),
    computePersonalResults(sessionId),
  ]);

  const calls: ReviewCall[] = [];
  let goldTotal = 0;
  let goldMatched = 0;

  for (const c of run) {
    const decided = c.winnerId !== null;
    const excluded = c.isRepeat || c.lowAttention;
    const winner = c.winnerId === c.variantAId ? c.variantA : c.variantB;
    const loser = c.winnerId === c.variantAId ? c.variantB : c.variantA;
    const base = {
      yourText: decided ? winner.text : null,
      otherText: decided ? loser.text : c.variantA.text,
      decided,
      excluded,
      crowd: null as ReviewCall["crowd"],
      desk: null as ReviewCall["desk"],
    };

    if (!decided) {
      calls.push({ ...base, tag: "PASSED" });
      continue;
    }
    if (excluded) {
      calls.push({ ...base, tag: "EXCLUDED" });
      continue;
    }

    // Calibration votes: graded against today's consensus (more data than at
    // vote time). isGold was set when the vote was cast.
    if (c.isGold) {
      const consensus = await getPairConsensus(c.variantAId, c.variantBId, sessionId);
      const matched =
        consensus !== null &&
        consensus.n >= GOLD_MIN_N &&
        consensus.share >= GOLD_MAJORITY &&
        consensus.majorityWinnerId === c.winnerId;
      goldTotal++;
      if (matched) goldMatched++;
      calls.push({
        ...base,
        tag: matched ? "CALIBRATION — MATCHED" : "CALIBRATION — MISSED",
        // Settled reads may carry crowd position too (same caliper as taste
        // tags): your side's share of the room on this pair.
        crowd: consensus
          ? {
              yourPickShare:
                consensus.majorityWinnerId === c.winnerId ? consensus.share : 1 - consensus.share,
              n: consensus.n,
            }
          : null,
      });
      continue;
    }

    // Crowd comparison, only where the contrast is already public.
    const attrs = c.contrastAttrs.split(",").filter(Boolean) as AttributeKey[];
    if (attrs.length === 1 && attrs[0] !== "fidelity") {
      const attr = attrs[0];
      const stat = statFor(analytics.attributeStats, attr, winner[attr], loser[attr]);
      if (stat && !stat.suppressed && stat.rateA !== null) {
        const yourPickShare = winner[attr] === stat.valueA ? stat.rateA : 1 - stat.rateA;
        const tag =
          yourPickShare > 0.55 ? "WITH THE ROOM" : yourPickShare < 0.45 ? "CONTRARIAN" : "SPLIT ROOM";
        const stance = stanceFor(attr, stat.valueA, stat.valueB);
        calls.push({
          ...base,
          tag,
          crowd: { yourPickShare, n: stat.n },
          desk: stance
            ? { pick: stance.pick, agreed: winner[attr] === stance.pick, line: stance.line }
            : null,
        });
        continue;
      }
    }
    calls.push({ ...base, tag: "STILL COLLECTING" });
  }

  // Sharpest divergence: your solid preferences vs your own segment's
  // published rates; the largest gap earns the micro-lesson.
  const segStats = analytics.segmentStats[session.segment as Segment] ?? [];
  let divergence: {
    attributeLabel: string;
    valueLabel: string;
    you: number;
    segment: number;
    segmentN: number;
    lesson: string;
    desk: { pickLabel: string; line: string; youAgree: boolean } | null;
  } | null = null;
  for (const p of personal.preferences ?? []) {
    if (p.hedged) continue;
    const stat = segStats.find(
      (s) => s.attribute === p.attribute && (s.valueA === p.value || s.valueB === p.value) && !s.suppressed
    );
    if (!stat || stat.rateA === null) continue;
    const segShare = stat.valueA === p.value ? stat.rateA : 1 - stat.rateA;
    const you = p.picked / p.shown;
    const gap = Math.abs(you - segShare);
    if (!divergence || gap > Math.abs(divergence.you - divergence.segment)) {
      const lesson = LESSONS[p.attribute as AttributeKey];
      if (!lesson) continue;
      const stance = stanceFor(p.attribute, stat.valueA, stat.valueB);
      divergence = {
        attributeLabel: p.attributeLabel,
        valueLabel: p.valueLabel,
        you,
        segment: segShare,
        segmentN: stat.n,
        lesson,
        // Segment stats are already public, so quoting the desk here adds no
        // new class — just voice.
        desk: stance
          ? {
              pickLabel: VALUE_LABELS[stance.pick] ?? stance.pick,
              line: stance.line,
              youAgree: p.value === stance.pick,
            }
          : null,
      };
    }
  }

  // "What the room has learned": strongest published effects, faithful-only
  // public stats — the same numbers as /results.
  const learned = analytics.attributeStats
    .filter((s) => !s.suppressed && s.rateA !== null)
    .sort((a, b) => Math.abs(b.rateA! - 0.5) - Math.abs(a.rateA! - 0.5))
    .slice(0, 2)
    .map((s) => ({
      valueALabel: s.valueALabel,
      valueBLabel: s.valueBLabel,
      rateA: s.rateA!,
      n: s.n,
    }));

  // You vs the desk, counted over the same published calls that carry desk
  // markers — never over unpublished contrasts (see blinding note above).
  const deskCalls = calls.filter((c) => c.desk !== null);
  return NextResponse.json({
    runSize: run.length,
    calls,
    // Run accuracy needs >=3 calibration votes before it says anything.
    accuracy: goldTotal >= 3 ? { matched: goldMatched, total: goldTotal } : null,
    deskAlignment:
      deskCalls.length > 0
        ? { agreed: deskCalls.filter((c) => c.desk!.agreed).length, total: deskCalls.length }
        : null,
    divergence,
    learned,
    minN: MIN_N,
    progression: {
      xp: session.xp,
      level: levelFor(session.xp),
      judgeRank: judgeRank(session.judgeAbility, session.goldCount),
      goldCount: session.goldCount,
      drillRating: session.drillCount > 0 ? Math.round(session.drillRating) : null,
    },
  });
}
