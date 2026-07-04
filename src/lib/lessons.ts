// Micro-lessons for the run review: one short, neutral note per CRAFT
// attribute, shown when a reader's taste diverges most from their own
// segment. Server-side only.
//
// Deliberately covers the five craft attributes and nothing else — the
// fidelity dimension and its vocabulary must never ship to a client, so it
// has no entry here and never will.

import type { AttributeKey, Segment } from "./types";

export const LESSONS: Partial<Record<AttributeKey, string>> = {
  leadType:
    "Where a telling starts sets what a reader checks. A number-first lead invites verification; an implication-first lead invites action; a question-first lead invites the reader to reason before being told. None is 'right' — but mismatching your audience costs attention in the first second.",
  lengthBand:
    "Length trades completeness against retention. Short tellings get repeated in meetings; long ones survive scrutiny afterward. The craft question is which failure you can afford: being under-quoted or being under-read.",
  caveatPlacement:
    "A caveat placed up front changes how every following number is read; the same caveat at the end reads as fine print. Omitting it entirely is faster — and quietly moves the risk of over-reading onto the audience.",
  quantification:
    "Precise figures ('31.4%') signal auditability; rounded ones ('about a third') signal confidence in the direction over the digits. Qualitative wording travels furthest and verifies least. Match precision to how the number will be reused — reserve the exact digit for when it's load-bearing (a covenant, a threshold, a reconciliation), and round to what you'd defend when the direction is the point.",
  soWhat:
    "An explicit so-what tells the reader what to do; an implied one trusts them to conclude it. Explicit direction speeds decisions and invites pushback; implication flatters expertise and risks the point being missed.",
};

// The convictions are defaults, not laws — the reader's job flips several
// (INSIGHT-PRINCIPLES "Audience is the flip switch"). When a reader's own
// segment is one the doc names, append a short coda that says WHY the lesson
// weighs more for them. Craft only, never fidelity; only the doc-specified
// flips get a coda (data_leader / other read the base lesson).
const AUDIENCE_CODA: Partial<Record<Segment, Partial<Record<AttributeKey, string>>>> = {
  executive: {
    leadType:
      "For an executive audience this only sharpens: they act on the first clause, so a number buried past it is one they may never reach.",
    soWhat:
      "For an executive audience a missing so-what isn't a stylistic choice — it hands the decision to whoever speaks next.",
  },
  analyst: {
    caveatPlacement:
      "For an analyst audience the up-front hedge is itself the competence signal; an unstated limit reads as one you didn't notice.",
    quantification:
      "For an analyst audience — the study's verification layer — precise figures are exactly what they check you against.",
  },
};

/**
 * The micro-lesson for an attribute, with an audience-specific coda where the
 * desk's convictions flip by reader. Returns undefined for attributes with no
 * lesson (fidelity has none, by design). Craft only.
 */
export function lessonFor(attribute: AttributeKey, segment: Segment): string | undefined {
  const base = LESSONS[attribute];
  if (!base) return undefined;
  const coda = AUDIENCE_CODA[segment]?.[attribute];
  return coda ? `${base} ${coda}` : base;
}
