// The House View: the desk's preregistered call on every craft contrast —
// written BEFORE the data, dated, and never edited once votes accumulate
// (changing a call requires a new dated entry; the old one stays in git
// history, which is the point). A study of judgment should have the nerve to
// make calls of its own: each stance is rendered live on /results next to the
// room's caliper, and the room is free to overrule the desk in public.
//
// Craft only, deliberately: the desk takes no public position on the hidden
// experiment, and no fidelity vocabulary may ever appear in this module.
// Server-side only — stances reach clients as strings inside API payloads and
// server-rendered pages, never as this module.

import type { AttributeKey } from "./types";

export type HouseStance = {
  attribute: AttributeKey;
  valueA: string; // alphabetically first value of the pair (matches ValuePairStat)
  valueB: string;
  pick: string; // must equal valueA or valueB
  line: string; // the desk's one-sentence case, in its own voice
  registered: string; // ISO date the call went on the record
};

const REGISTERED = "2026-07-04";

const s = (
  attribute: AttributeKey,
  pair: [string, string],
  pick: string,
  line: string
): HouseStance => {
  const [valueA, valueB] = [...pair].sort();
  return { attribute, valueA, valueB, pick, line, registered: REGISTERED };
};

export const HOUSE_VIEW: HouseStance[] = [
  // Lead: the desk wants the goods first. Numbers beat implications beat questions.
  s(
    "leadType",
    ["number_first", "implication_first"],
    "number_first",
    "Lead with the figure. A telling that hides its number is asking for trust it hasn't earned yet."
  ),
  s(
    "leadType",
    ["number_first", "question_first"],
    "number_first",
    "A question at the top is a delay. The reader came for the answer."
  ),
  s(
    "leadType",
    ["implication_first", "question_first"],
    "implication_first",
    "If you won't open with the number, at least open with the stakes — a question does neither."
  ),
  // Length: the desk cuts. Every time.
  s(
    "lengthBand",
    ["short", "medium"],
    "short",
    "If it can't survive being short, it isn't an insight yet — it's a paragraph looking for one."
  ),
  s(
    "lengthBand",
    ["medium", "long"],
    "medium",
    "Past forty words you're not informing the reader, you're supervising them."
  ),
  s(
    "lengthBand",
    ["short", "long"],
    "short",
    "The long version survives scrutiny; the short version survives the meeting. Meetings decide things."
  ),
  // Caveats: up front, always — and a late caveat still beats a missing one.
  s(
    "caveatPlacement",
    ["upfront", "trailing"],
    "upfront",
    "State the catch before the claim. A caveat after the applause is fine print."
  ),
  s(
    "caveatPlacement",
    ["upfront", "omitted"],
    "upfront",
    "Omitting the caveat doesn't remove the risk — it just moves it onto whoever repeats you."
  ),
  s(
    "caveatPlacement",
    ["trailing", "omitted"],
    "trailing",
    "A caveat in the last line is weak medicine, but it's medicine."
  ),
  // Numbers: rounded beats precise beats vibes.
  s(
    "quantification",
    ["precise", "rounded"],
    "rounded",
    "Round to what you'd defend in a hallway. Decimal places read as confidence and audit as noise — unless the digit itself is the point, like a covenant or a threshold."
  ),
  s(
    "quantification",
    ["precise", "qualitative"],
    "precise",
    "'Sharply' is a mood. If there's a number, show a number."
  ),
  s(
    "quantification",
    ["rounded", "qualitative"],
    "rounded",
    "'About a third' can be checked. 'Substantially' can only be believed."
  ),
  // So-what: say it.
  s(
    "soWhat",
    ["explicit", "implied"],
    "explicit",
    "Say what you'd do about it. An implied so-what is a decision delegated to whoever talks next."
  ),
];

/** Stance for a sorted value pair, or null (multi-attribute and non-craft contrasts have no stance). */
export function stanceFor(
  attribute: string,
  valueA: string,
  valueB: string
): HouseStance | null {
  return (
    HOUSE_VIEW.find(
      (h) => h.attribute === attribute && h.valueA === valueA && h.valueB === valueB
    ) ?? null
  );
}
