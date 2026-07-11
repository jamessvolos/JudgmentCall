// The Record — grades and credentials for the Training Room, derived on every
// read as pure folds over DrillAttempt rows. Nothing here is stored state: a
// stamp IS its recomputation, so the record can never desync or inflate, and
// every criterion is monotone (later rows can never un-earn it). Drill-only
// vocabulary lives here by design — this module may be imported ONLY by
// repo.ts (server), the drill API route, and the drill client. The single
// string allowed off /drill is the composed grade label (fidelity-neutral
// English by construction).

import { FIDELITY_SKILLS, CRAFT_SKILLS, SKILL_IDS } from "./teaching";
import { fieldServesFaithful } from "./drill-grade";
import { GRADE_META, CREDENTIAL_DEFS, type GradeMeta, type CredentialDef } from "./drill-credentials-meta";

/** The attempt row shape every fold reads — a projection of DrillAttempt ⋈ DrillItem. */
export type CredAttempt = {
  drillItemId: string;
  correct: boolean;
  createdAt: Date;
  ratingAfter: number | null;
  namedSkill: string | null;
  mode: string; // "" = the item's own mode; "field" = single-telling re-serve
  item: { skill: string; difficulty: number; mode: string };
};

const effectiveMode = (a: CredAttempt) => a.mode || a.item.mode;

// ---------------------------------------------------------------------------
// THE GRADES — floors on the selection ladder's own cut points (1240/1340 are
// getNextDrillItem's tier boundaries; 1500 is the old "Sharp eye" line), each
// with an evidence gate so a lucky streak can't bank a seat. A grade is earned
// iff some prefix of the attempt history ends at/above the floor while its
// rows satisfy the gate; the conferral date is the earning attempt's own
// timestamp. Pre-instrument rows (ratingAfter null) are handled by a virtual
// terminal row at the live rating, so existing learners are graded on their
// real record from day one.

export type GradeId = GradeMeta["n"];
export type Grade = GradeMeta;
export const GRADES: Grade[] = GRADE_META;
export type { CredentialDef };
export const CREDENTIALS: CredentialDef[] = CREDENTIAL_DEFS;

type GateEvidence = {
  calls: number;
  fidelityCatch: boolean;
  craftCatch: boolean;
  skillsFaced: Set<string>;
  midCatches: number; // correct at difficulty >= 2
  d3Catches: number; // correct at difficulty 3
  fidelityMidCatch: boolean;
  craftMidCatch: boolean;
  d3CatchSkills: Set<string>;
};

function gateMet(g: Grade, e: GateEvidence): boolean {
  switch (g.n) {
    case 1:
      return true;
    case 2:
      return e.calls >= 10 && e.fidelityCatch && e.craftCatch;
    case 3:
      return e.calls >= 25 && e.skillsFaced.size >= SKILL_IDS.length && e.midCatches >= 5;
    case 4:
      return e.calls >= 40 && e.d3Catches >= 5 && e.fidelityMidCatch && e.craftMidCatch;
    case 5:
      return e.calls >= 60 && e.d3CatchSkills.size >= 6;
  }
}

export type GradeStanding = {
  grade: Grade;
  earnedAt: Date | null; // null only for Grade I
  /** one mono line naming the nearest unmet conjunct of the next grade; null at Grade V */
  nextGate: string | null;
};

export function gradeFor(
  attempts: CredAttempt[],
  liveRating: number,
  now: Date = new Date()
): GradeStanding {
  const e: GateEvidence = {
    calls: 0,
    fidelityCatch: false,
    craftCatch: false,
    skillsFaced: new Set(),
    midCatches: 0,
    d3Catches: 0,
    fidelityMidCatch: false,
    craftMidCatch: false,
    d3CatchSkills: new Set(),
  };
  const fid = new Set<string>(FIDELITY_SKILLS);
  const earned = new Map<GradeId, Date>();

  const consider = (rating: number | null, at: Date) => {
    if (rating === null) return;
    for (const g of GRADES) {
      if (g.floor === null || earned.has(g.n)) continue;
      if (rating >= g.floor && gateMet(g, e)) earned.set(g.n, at);
    }
  };

  for (const a of attempts) {
    e.calls++;
    e.skillsFaced.add(a.item.skill);
    if (a.correct) {
      const isFid = fid.has(a.item.skill);
      if (isFid) e.fidelityCatch = true;
      else e.craftCatch = true;
      if (a.item.difficulty >= 2) {
        e.midCatches++;
        if (isFid) e.fidelityMidCatch = true;
        else e.craftMidCatch = true;
      }
      if (a.item.difficulty === 3) {
        e.d3Catches++;
        e.d3CatchSkills.add(a.item.skill);
      }
    }
    consider(a.ratingAfter, a.createdAt);
  }
  // virtual terminal row: the live rating against the full-history evidence,
  // so pre-instrument records certify without a ratingAfter trail.
  consider(liveRating, now);

  let current: Grade = GRADES[0];
  for (const g of GRADES) if (g.floor === null || earned.has(g.n)) current = g;

  const next = GRADES.find((g) => g.n === current.n + 1) ?? null;
  let nextGate: string | null = null;
  if (next && next.floor !== null) {
    const missing: string[] = [];
    if (liveRating < next.floor) missing.push(`reading at ${Math.round(liveRating)} of ${next.floor}`);
    if (next.n === 2) {
      if (e.calls < 10) missing.push(`${10 - e.calls} more graded calls`);
      if (!e.fidelityCatch) missing.push("a fidelity-family catch");
      if (!e.craftCatch) missing.push("a craft-family catch");
    } else if (next.n === 3) {
      if (e.calls < 25) missing.push(`${25 - e.calls} more calls`);
      if (e.skillsFaced.size < SKILL_IDS.length)
        missing.push(`${SKILL_IDS.length - e.skillsFaced.size} patterns unfaced`);
      if (e.midCatches < 5) missing.push(`${5 - e.midCatches} more catches above the easy tier`);
    } else if (next.n === 4) {
      if (e.calls < 40) missing.push(`${40 - e.calls} more calls`);
      if (e.d3Catches < 5) missing.push(`${5 - e.d3Catches} more subtle-tier catches`);
      if (!e.fidelityMidCatch) missing.push("a mid-tier fidelity catch");
      if (!e.craftMidCatch) missing.push("a mid-tier craft catch");
    } else if (next.n === 5) {
      if (e.calls < 60) missing.push(`${60 - e.calls} more calls`);
      if (e.d3CatchSkills.size < 6)
        missing.push(`subtle catches in ${6 - e.d3CatchSkills.size} more patterns`);
    }
    nextGate = `GRADE ${next.roman} at ${next.floor} · needs ${missing[0] ?? "the floor held"}`;
  }

  return { grade: current, earnedAt: current.floor === null ? null : (earned.get(current.n) ?? null), nextGate };
}

/** The one string allowed off /drill (poster credential line): neutral English only. */
export function drillGradeLabel(attempts: CredAttempt[], liveRating: number): string {
  const { grade } = gradeFor(attempts, liveRating);
  return `Grade ${grade.roman} · ${grade.title}`;
}

// ---------------------------------------------------------------------------
// THE RECORD — 12 stamps. Each is a monotone predicate over the attempt rows;
// earnedAt is the createdAt of the row whose inclusion first satisfies it.
// COMPETENCE stamps (accent ink) are all about correct calls; EXPLORATION
// stamps (muted ink) certify coverage of the curriculum — never attendance.

export type Conferral = { code: string; earnedAt: Date | null };

export function conferrals(sessionId: string, attempts: CredAttempt[]): Conferral[] {
  const fid = new Set<string>(FIDELITY_SKILLS);
  const earned = new Map<string, Date>();
  const mark = (code: string, at: Date) => {
    if (!earned.has(code)) earned.set(code, at);
  };

  // running state, one pass
  let streak = 0;
  let d3Correct = 0;
  const d3CorrectSkills = new Set<string>();
  let namedCaught = 0;
  let fieldCorrect = 0;
  const fieldCorrectSkills = new Set<string>();
  let cleanHands = 0;
  let ledgersPerfect = 0;
  let ledgersPerfectMid = 0;
  const skillsFaced = new Set<string>();
  const benches = new Set<string>();
  let deepFid = false;
  let deepCraft = false;
  // per-skill windows for the seals + correction
  const perSkill = new Map<
    string,
    { recent: boolean[]; window4of5: boolean; midCatch: boolean; behind: boolean; wasBehind: boolean; wins: number; losses: number; consec: number }
  >();
  for (const s of SKILL_IDS) {
    perSkill.set(s, { recent: [], window4of5: false, midCatch: false, behind: false, wasBehind: false, wins: 0, losses: 0, consec: 0 });
  }
  const sealDone = (skills: readonly string[]) =>
    skills.every((s) => {
      const st = perSkill.get(s)!;
      return st.window4of5 && st.midCatch;
    });

  for (const a of attempts) {
    const at = a.createdAt;
    const skill = a.item.skill;
    const isFid = fid.has(skill);
    const st = perSkill.get(skill);

    // 1 · CLEAN SWEEP
    streak = a.correct ? streak + 1 : 0;
    if (streak >= 8) mark("clean_sweep", at);

    // 2 · THE FINE PRINT
    if (a.correct && a.item.difficulty === 3) {
      d3Correct++;
      d3CorrectSkills.add(skill);
    }
    if (d3Correct >= 10 && d3CorrectSkills.size >= 4) mark("fine_print", at);

    // 3/4 · SEALS — existential 4-of-5 window per skill + a mid-tier catch
    if (st) {
      st.recent.push(a.correct);
      if (st.recent.length > 5) st.recent.shift();
      if (st.recent.length === 5 && st.recent.filter(Boolean).length >= 4) st.window4of5 = true;
      if (a.correct && a.item.difficulty >= 2) st.midCatch = true;
      if (sealDone(FIDELITY_SKILLS)) mark("fidelity_seal", at);
      if (sealDone(CRAFT_SKILLS)) mark("craft_seal", at);

      // 6 · THE CORRECTION — ever behind on this skill, then 3 straight catches
      if (a.correct) {
        st.wins++;
        st.consec++;
      } else {
        st.losses++;
        st.consec = 0;
      }
      if (st.losses > st.wins) st.wasBehind = true;
      if (st.wasBehind && st.consec >= 3) mark("correction", at);
    }

    // 5 · NAMED AND CAUGHT
    if (a.correct && a.namedSkill === skill) namedCaught++;
    if (namedCaught >= 10) mark("named_caught", at);

    // 7/8 · FIELD stamps
    if (a.mode === "field") {
      if (a.correct) {
        fieldCorrect++;
        fieldCorrectSkills.add(skill);
        if (fieldServesFaithful(sessionId, a.drillItemId)) cleanHands++;
      }
      if (fieldCorrect >= 10 && fieldCorrectSkills.size >= 4) mark("cold_reader", at);
      if (cleanHands >= 8) mark("clean_hands", at);
    }

    // 9 · THE AUDITOR
    if (effectiveMode(a) === "ledger" && a.correct) {
      ledgersPerfect++;
      if (a.item.difficulty >= 2) ledgersPerfectMid++;
      if (ledgersPerfect >= 5 && ledgersPerfectMid >= 2) mark("auditor", at);
    }

    // 10/11/12 · EXPLORATION
    skillsFaced.add(skill);
    if (skillsFaced.size >= SKILL_IDS.length) mark("rounds", at);
    benches.add(effectiveMode(a));
    if (benches.size >= 5) mark("all_benches", at);
    if (a.item.difficulty === 3) {
      if (isFid) deepFid = true;
      else deepCraft = true;
      if (deepFid && deepCraft) mark("deep_end", at);
    }
  }

  return CREDENTIALS.map((c) => ({ code: c.code, earnedAt: earned.get(c.code) ?? null }));
}
