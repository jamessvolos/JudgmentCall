-- AlterTable
ALTER TABLE "Comparison" ADD COLUMN "clientVoteId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Comparison_clientVoteId_key" ON "Comparison"("clientVoteId");

