-- Training Room v3: case-file grouping columns.
ALTER TABLE "DrillItem" ADD COLUMN "caseId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DrillItem" ADD COLUMN "caseSeq" INTEGER NOT NULL DEFAULT 0;
