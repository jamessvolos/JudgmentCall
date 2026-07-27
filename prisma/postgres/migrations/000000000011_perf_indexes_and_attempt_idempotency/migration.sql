-- Perf indexes + attempt idempotency (postgres).
--
-- 1. Comparison(variantAId, variantBId): the gold-consensus groupBy runs per
--    decided vote and was a sequential scan without it. Comparison(deckId):
--    deck-scoped counts and public-study (deckId IS NULL) filters.
-- 2. Unique attempt keys on QuizAttempt(sessionId, quizItemId) and
--    DrillAttempt(sessionId, drillItemId, mode) — backstop for the routes'
--    already-attempted pre-checks so a raced double-submit becomes a P2002
--    (mapped to the same 409) instead of a duplicate ledger row.
--
-- Dedupe BEFORE creating the unique indexes: keep the EARLIEST row per key so
-- `migrate deploy` cannot fail on live data that already carries duplicates.

-- Dedupe QuizAttempt: keep the earliest attempt per (sessionId, quizItemId).
DELETE FROM "QuizAttempt" AS t
USING (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "sessionId", "quizItemId"
    ORDER BY "createdAt" ASC, "id" ASC
  ) AS rn
  FROM "QuizAttempt"
) AS d
WHERE t."id" = d."id" AND d.rn > 1;

-- Dedupe DrillAttempt: keep the earliest attempt per (sessionId, drillItemId, mode).
DELETE FROM "DrillAttempt" AS t
USING (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "sessionId", "drillItemId", "mode"
    ORDER BY "createdAt" ASC, "id" ASC
  ) AS rn
  FROM "DrillAttempt"
) AS d
WHERE t."id" = d."id" AND d.rn > 1;

-- CreateIndex
CREATE INDEX "Comparison_variantAId_variantBId_idx" ON "Comparison"("variantAId", "variantBId");

-- CreateIndex
CREATE INDEX "Comparison_deckId_idx" ON "Comparison"("deckId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttempt_sessionId_quizItemId_key" ON "QuizAttempt"("sessionId", "quizItemId");

-- CreateIndex
CREATE UNIQUE INDEX "DrillAttempt_sessionId_drillItemId_mode_key" ON "DrillAttempt"("sessionId", "drillItemId", "mode");
