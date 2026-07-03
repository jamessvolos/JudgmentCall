// Micro-lessons for the run review: one short, neutral note per CRAFT
// attribute, shown when a reader's taste diverges most from their own
// segment. Server-side only.
//
// Deliberately covers the five craft attributes and nothing else — the
// fidelity dimension and its vocabulary must never ship to a client, so it
// has no entry here and never will.

import type { AttributeKey } from "./types";

export const LESSONS: Partial<Record<AttributeKey, string>> = {
  leadType:
    "Where a telling starts sets what a reader checks. A number-first lead invites verification; an implication-first lead invites action; a question-first lead invites the reader to reason before being told. None is 'right' — but mismatching your audience costs attention in the first second.",
  lengthBand:
    "Length trades completeness against retention. Short tellings get repeated in meetings; long ones survive scrutiny afterward. The craft question is which failure you can afford: being under-quoted or being under-read.",
  caveatPlacement:
    "A caveat placed up front changes how every following number is read; the same caveat at the end reads as fine print. Omitting it entirely is faster — and quietly moves the risk of over-reading onto the audience.",
  quantification:
    "Precise figures ('31.4%') signal auditability; rounded ones ('about a third') signal confidence in the direction over the digits. Qualitative wording travels furthest and verifies least. Match precision to how the number will be reused.",
  soWhat:
    "An explicit so-what tells the reader what to do; an implied one trusts them to conclude it. Explicit direction speeds decisions and invites pushback; implication flatters expertise and risks the point being missed.",
};
