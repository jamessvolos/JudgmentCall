-- AlterTable
ALTER TABLE "Finding" ADD COLUMN "retrievedAt" DATETIME;
ALTER TABLE "Finding" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "Finding" ADD COLUMN "staleAfter" DATETIME;

-- CreateTable
CREATE TABLE "ServingPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "config" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
