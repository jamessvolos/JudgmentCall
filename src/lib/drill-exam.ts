// THE CHECKPOINT — pure exam logic (Training Room v3). One fixed form: ten
// unseen calls, one per skill in canonical order, mid tier or above, dealt to
// the learner's band by a deterministic seed. The attempt rows ARE the state:
// form = ⌊examCount/10⌋, position = examCount mod 10, and the EXAM-CERTIFIED
// mark is a monotone window-fold — nothing stored, nothing that can lie.
// Server-only (crypto salt); imported ONLY by repo.ts and the drill API.

import { createHash } from "crypto";
import { SKILL_IDS } from "./teaching";
import { EXAM_META } from "./drill-credentials-meta";

export const EXAM_LENGTH = EXAM_META.formLength; // 10
export const EXAM_PASS_AT = EXAM_META.passAt; // 8

/** Form arithmetic — the entire state machine. */
export function examSlot(examCount: number): { form: number; position: number } {
  return { form: Math.floor(examCount / EXAM_LENGTH), position: examCount % EXAM_LENGTH };
}

/** Position k always asks skill SKILL_IDS[k] — fixed order is what makes
 *  resume arithmetic collision-free (earlier answers are different skills). */
export function examSkillFor(position: number): string {
  return SKILL_IDS[position];
}

/** Near-band, floored at the mid tier: a certification earnable on the
 *  obvious tier certifies nothing. Mirrors the selection ladder's cut points. */
export function examTargetDifficulty(rating: number): number {
  const ladder = rating < 1240 ? 1 : rating < 1340 ? 2 : 3;
  return Math.max(2, ladder);
}

export type ExamCandidate = { id: string; difficulty: number; rating: number };

/** Deterministic pick: sort by (difficulty proximity, rating proximity, id),
 *  then a salted index over the top ties — docketRand's sibling. */
export function examPick(
  candidates: ExamCandidate[],
  rating: number,
  sessionId: string,
  form: number,
  skill: string
): ExamCandidate | null {
  if (candidates.length === 0) return null;
  const target = examTargetDifficulty(rating);
  const sorted = [...candidates].sort((a, b) => {
    const d = Math.abs(a.difficulty - target) - Math.abs(b.difficulty - target);
    if (d !== 0) return d;
    const r = Math.abs(a.rating - rating) - Math.abs(b.rating - rating);
    if (r !== 0) return r;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  // Salted variety only WITHIN the best difficulty distance — the seed picks
  // among band-equivalent candidates, never trades the band away for variety.
  const bestDist = Math.abs(sorted[0].difficulty - target);
  const band = sorted.filter((c) => Math.abs(c.difficulty - target) === bestDist);
  const digest = createHash("sha256").update(`${sessionId}:exam:${form}:${skill}`).digest();
  const seedIndex = digest.readUInt32LE(0);
  return band[seedIndex % Math.min(3, band.length)];
}

export type ExamAttemptRow = { correct: boolean; createdAt: Date; mode: string };

export type ExamStanding = {
  passedAt: Date | null; // 10th row of the FIRST form scoring >= EXAM_PASS_AT
  latestPassAt: Date | null; // a later pass refreshes the printed date
  latestPassScore: number | null;
  formsSat: number; // complete forms only
  best: number | null; // best complete-form score
  form: number;
  position: number;
  satToday: boolean; // any exam attempt this UTC day
};

export function examStanding(attempts: ExamAttemptRow[], now: Date = new Date()): ExamStanding {
  const rows = attempts.filter((a) => a.mode === "exam");
  const n = rows.length;
  const { form, position } = examSlot(n);

  let passedAt: Date | null = null;
  let latestPassAt: Date | null = null;
  let latestPassScore: number | null = null;
  let best: number | null = null;
  const formsSat = Math.floor(n / EXAM_LENGTH);
  for (let w = 0; w < formsSat; w++) {
    const window = rows.slice(w * EXAM_LENGTH, (w + 1) * EXAM_LENGTH);
    const score = window.filter((r) => r.correct).length;
    if (best === null || score > best) best = score;
    if (score >= EXAM_PASS_AT) {
      const at = window[EXAM_LENGTH - 1].createdAt;
      if (passedAt === null) passedAt = at;
      latestPassAt = at;
      latestPassScore = score;
    }
  }

  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const satToday = rows.length > 0 && rows[rows.length - 1].createdAt >= dayStart;

  return { passedAt, latestPassAt, latestPassScore, formsSat, best, form, position, satToday };
}
