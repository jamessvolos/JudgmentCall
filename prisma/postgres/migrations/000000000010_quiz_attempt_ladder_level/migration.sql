-- THE LADDER: the seniority rung (0 entry · 1 senior · 2 principal) computed
-- at grade time and stored on the attempt, same species of fact as `correct`.
ALTER TABLE "QuizAttempt" ADD COLUMN "level" INTEGER;
