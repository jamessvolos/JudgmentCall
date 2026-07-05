-- Training modes + skills: extend DrillItem for spot/fix/calibrate across fidelity+craft skills.
ALTER TABLE "DrillItem" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'spot';
ALTER TABLE "DrillItem" ADD COLUMN "skill" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DrillItem" ADD COLUMN "difficulty" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "DrillItem" ADD COLUMN "promptText" TEXT;
ALTER TABLE "DrillItem" ADD COLUMN "choices" TEXT;
CREATE UNIQUE INDEX "DrillItem_title_key" ON "DrillItem"("title");
