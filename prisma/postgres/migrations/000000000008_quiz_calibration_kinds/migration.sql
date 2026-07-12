-- Training Rooms 10x: conviction capture + new interaction kinds.
ALTER TABLE "QuizItem" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'mcq';
ALTER TABLE "QuizItem" ADD COLUMN "payload" TEXT;
ALTER TABLE "QuizAttempt" ADD COLUMN "confidence" INTEGER;
