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

/** Index of the single correct choice, or -1. */
export function correctChoiceIndex(choices: StoredChoice[]): number {
  return choices.findIndex((c) => c.correct);
}
