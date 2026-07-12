-- AlterTable
ALTER TABLE "QuizAttempt" ADD COLUMN "confidence" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_QuizItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "track" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'mcq',
    "scenario" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "choices" TEXT NOT NULL,
    "payload" TEXT,
    "explanation" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "rating" REAL NOT NULL DEFAULT 1200,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_QuizItem" ("attempts", "choices", "createdAt", "difficulty", "explanation", "id", "prompt", "rating", "scenario", "status", "title", "topic", "track") SELECT "attempts", "choices", "createdAt", "difficulty", "explanation", "id", "prompt", "rating", "scenario", "status", "title", "topic", "track" FROM "QuizItem";
DROP TABLE "QuizItem";
ALTER TABLE "new_QuizItem" RENAME TO "QuizItem";
CREATE UNIQUE INDEX "QuizItem_title_key" ON "QuizItem"("title");
CREATE INDEX "QuizItem_track_status_idx" ON "QuizItem"("track", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
