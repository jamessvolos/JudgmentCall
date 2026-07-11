-- Training Room v2: auditable progression columns on DrillAttempt.
-- ratingAfter makes grade certification a monotone fold over rows (no stored
-- state that can lie); namedSkill persists the ungraded naming beat; mode
-- distinguishes a Field re-serve from the item's own mode.
ALTER TABLE "DrillAttempt" ADD COLUMN "ratingAfter" REAL;
ALTER TABLE "DrillAttempt" ADD COLUMN "namedSkill" TEXT;
ALTER TABLE "DrillAttempt" ADD COLUMN "mode" TEXT NOT NULL DEFAULT '';
