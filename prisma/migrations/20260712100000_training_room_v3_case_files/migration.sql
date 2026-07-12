-- Training Room v3: case files as ordinary DrillItems grouped by caseId,
-- served in caseSeq order as their own sitting and excluded from every
-- normal pool by the "" default.
ALTER TABLE "DrillItem" ADD COLUMN "caseId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DrillItem" ADD COLUMN "caseSeq" INTEGER NOT NULL DEFAULT 0;
