// Drill grading — the single source of truth for which side is faithful and
// what counts as a correct call. Kept as a pure, dependency-light module so the
// GET (serving) and POST (grading) handlers can't drift, and so the grading
// direction is locked by a test (it was inverted from launch with nothing to
// catch it — a learner who correctly caught the overclaim was told they were
// wrong).

import { createHash } from "crypto";

/**
 * Which side (a/b) the FAITHFUL telling renders on for a (session, item) pair —
 * deterministic, so the answer re-derives at grade time without storing
 * per-serve state. Even first digest byte → faithful first (side "a").
 */
export function faithfulSideFor(sessionId: string, itemId: string): "a" | "b" {
  const h = createHash("sha256").update(`${sessionId}:${itemId}`).digest();
  return h[0] % 2 === 0 ? "a" : "b";
}

/** The OVERCLAIMED side — the telling that exceeds the data. */
export function overclaimedSideFor(sessionId: string, itemId: string): "a" | "b" {
  return faithfulSideFor(sessionId, itemId) === "a" ? "b" : "a";
}

/**
 * The drill task is "spot the telling that EXCEEDS the data." A correct call
 * therefore picks the OVERCLAIMED side — the one that is NOT faithful. This
 * must stay in agreement with the on-screen question ("Which telling exceeds
 * the data?") and the "spot the overclaim" framing.
 */
export function isCorrectDrillCall(picked: "a" | "b", faithfulSide: "a" | "b"): boolean {
  return picked !== faithfulSide;
}

// ---------------------------------------------------------------------------
// Choice-based modes (fix / calibrate). Choices are stored as a JSON array on
// the item; exactly one has correct:true. The serving path sends only { i, text }
// (shuffled, no answer leaked); the grader re-parses and checks the picked
// original index — so the correct answer never crosses the wire before the
// learner commits.

export type StoredChoice = { text: string; correct: boolean; rationale: string };

/** Parse an item's stored choices JSON; never throws (returns [] on bad data). */
export function parseChoices(json: string | null | undefined): StoredChoice[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    if (!Array.isArray(v)) return [];
    return v.filter(
      (c) =>
        c &&
        typeof c.text === "string" &&
        typeof c.correct === "boolean" &&
        typeof c.rationale === "string"
    );
  } catch {
    return [];
  }
}

/** A picked original index is correct iff that choice is the one flagged correct. */
export function isCorrectChoice(choices: StoredChoice[], pickedIndex: number): boolean {
  return !!choices[pickedIndex]?.correct;
}

// ---------------------------------------------------------------------------
// FIELD READ — single-telling absolute judgment over fidelity spot items. The
// served side derives from its own salted hash (distinct from faithfulSideFor's
// salt), so a learner who met the pair in spot can't infer which text they've
// been dealt, and the answer re-derives at grade time with no stored state.

/** True iff the FAITHFUL telling is the one served for this (session, item) field read. */
export function fieldServesFaithful(sessionId: string, itemId: string): boolean {
  const h = createHash("sha256").update(`${sessionId}:${itemId}:field`).digest();
  return h[0] % 2 === 0;
}

/**
 * A field call is correct iff the verdict matches the served telling:
 * "bounds" on the faithful text, "exceeds" on the overclaimed one. Calling a
 * clean telling "exceeds" is wrong on purpose — the mode trains against
 * reflexive cynicism as much as against credulity.
 */
export function isCorrectFieldCall(call: "bounds" | "exceeds", servedFaithful: boolean): boolean {
  return (call === "bounds") === servedFaithful;
}

// ---------------------------------------------------------------------------
// THE LEDGER — one telling broken into claims; every claim must be stamped
// HOLDS (false) or EXCEEDS (true). Rides the StoredChoice shape verbatim:
// correct:true means "this claim exceeds the data". All-or-nothing — the
// rating needs one boolean; the reveal is granular so partial understanding is
// taught without being scored.

/** stamps[i] = true means the learner stamped claim i EXCEEDS. Exact match only. */
export function isCorrectLedger(choices: StoredChoice[], stamps: boolean[]): boolean {
  return (
    choices.length > 0 &&
    stamps.length === choices.length &&
    choices.every((c, i) => c.correct === stamps[i])
  );
}

/** Index of the single correct choice, or -1. */
export function correctChoiceIndex(choices: StoredChoice[]): number {
  return choices.findIndex((c) => c.correct);
}

// ---------------------------------------------------------------------------
// COMPOSE — the generative mode. The learner BUILDS the lede: each slot (in
// reading order — THE MOVE · THE LINK · THE SCOPE) offers fragment options, and
// the strongest assembly that never overreaches is the ONE correct answer.
// Timidity is graded as hard as overreach: a lede that stays fully in-bounds
// but went soft in any slot is wrong. Rides the same `choices` JSON column,
// serialized as an array of slots. Authoring guarantees a UNIQUE strongest-safe
// option per slot (asserted in drill-content.test.ts), so the target is a
// single exactly-computable value.

export type ComposeOption = { text: string; strength: number; overreach: boolean; rationale: string };
export type ComposeSlot = { label: string; options: ComposeOption[] };

/** Parse compose slots JSON; never throws (returns [] on bad data). */
export function parseComposeSlots(json: string | null | undefined): ComposeSlot[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    if (!Array.isArray(v)) return [];
    const okOption = (o: unknown): o is ComposeOption => {
      const r = o as Record<string, unknown>;
      return (
        !!r &&
        typeof r.text === "string" &&
        typeof r.strength === "number" &&
        typeof r.overreach === "boolean" &&
        typeof r.rationale === "string"
      );
    };
    return v.filter(
      (s) =>
        s &&
        typeof s.label === "string" &&
        Array.isArray(s.options) &&
        s.options.length >= 2 &&
        s.options.every(okOption)
    );
  } catch {
    return [];
  }
}

/**
 * The strongest safe option index in a slot: the highest-strength option that
 * does not overreach. -1 if the slot has no safe option. With the uniqueness
 * invariant there are never ties; a tie would resolve to the first.
 */
export function composeSafeIndex(slot: ComposeSlot): number {
  let best = -1;
  let bestStrength = -Infinity;
  slot.options.forEach((o, i) => {
    if (!o.overreach && o.strength > bestStrength) {
      bestStrength = o.strength;
      best = i;
    }
  });
  return best;
}

/** The max-safe total: the strongest safe strength summed across every slot. */
export function composeMaxSafe(slots: ComposeSlot[]): number {
  return slots.reduce((sum, s) => {
    const i = composeSafeIndex(s);
    return sum + (i >= 0 ? s.options[i].strength : 0);
  }, 0);
}

/**
 * A composed lede is correct iff EVERY fragment stays in bounds AND every slot
 * is pushed to its strongest safe strength (assembly total == max-safe total).
 * assembly[i] is the picked option index for slot i. One overreaching fragment
 * fails the whole lede; so does one timid slot.
 */
export function isCorrectCompose(slots: ComposeSlot[], assembly: number[]): boolean {
  if (slots.length === 0 || assembly.length !== slots.length) return false;
  const picked = assembly.map((j, i) => slots[i]?.options[j]);
  if (picked.some((o) => !o)) return false;
  if (picked.some((o) => o!.overreach)) return false;
  const total = picked.reduce((s, o) => s + o!.strength, 0);
  return total === composeMaxSafe(slots);
}
