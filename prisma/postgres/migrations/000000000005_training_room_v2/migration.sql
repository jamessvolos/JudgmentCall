-- Training Room v2: auditable progression columns on DrillAttempt.
ALTER TABLE "DrillAttempt" ADD COLUMN "ratingAfter" DOUBLE PRECISION;
ALTER TABLE "DrillAttempt" ADD COLUMN "namedSkill" TEXT;
ALTER TABLE "DrillAttempt" ADD COLUMN "mode" TEXT NOT NULL DEFAULT '';
