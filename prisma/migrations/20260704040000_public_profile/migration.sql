-- AlterTable
ALTER TABLE "Session" ADD COLUMN "publicSlug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Session_publicSlug_key" ON "Session"("publicSlug");

