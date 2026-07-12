-- Training tracks: an isolated multiple-choice training world (statistics,
-- data-engineering architecture). Separate from the overclaim drill AND from
-- the study — attempts never enter analytics, items never serve in the pool.

-- CreateTable
CREATE TABLE "QuizItem" (
    "id" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "choices" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 1200,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "quizItemId" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "correct" BOOLEAN NOT NULL,
    "choiceIndex" INTEGER NOT NULL DEFAULT -1,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "ratingAfter" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuizItem_title_key" ON "QuizItem"("title");

-- CreateIndex
CREATE INDEX "QuizItem_track_status_idx" ON "QuizItem"("track", "status");

-- CreateIndex
CREATE INDEX "QuizAttempt_sessionId_track_idx" ON "QuizAttempt"("sessionId", "track");

-- CreateIndex
CREATE INDEX "QuizAttempt_quizItemId_idx" ON "QuizAttempt"("quizItemId");

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizItemId_fkey" FOREIGN KEY ("quizItemId") REFERENCES "QuizItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
