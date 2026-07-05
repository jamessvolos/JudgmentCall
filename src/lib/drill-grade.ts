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
