-- CreateTable
CREATE TABLE "QuizItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "track" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "choices" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "rating" REAL NOT NULL DEFAULT 1200,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "quizItemId" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "correct" BOOLEAN NOT NULL,
    "choiceIndex" INTEGER NOT NULL DEFAULT -1,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "ratingAfter" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuizAttempt_quizItemId_fkey" FOREIGN KEY ("quizItemId") REFERENCES "QuizItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "QuizItem_title_key" ON "QuizItem"("title");

-- CreateIndex
CREATE INDEX "QuizItem_track_status_idx" ON "QuizItem"("track", "status");

-- CreateIndex
CREATE INDEX "QuizAttempt_sessionId_track_idx" ON "QuizAttempt"("sessionId", "track");

-- CreateIndex
CREATE INDEX "QuizAttempt_quizItemId_idx" ON "QuizAttempt"("quizItemId");
