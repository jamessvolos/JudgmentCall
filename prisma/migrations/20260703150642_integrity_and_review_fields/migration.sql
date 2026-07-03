-- AlterTable
ALTER TABLE "Session" ADD COLUMN "referrer" TEXT;
ALTER TABLE "Session" ADD COLUMN "utmSource" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Comparison" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "findingId" TEXT NOT NULL,
    "variantAId" TEXT NOT NULL,
    "variantBId" TEXT NOT NULL,
    "winnerId" TEXT,
    "sessionId" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "contrastAttrs" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "lowAttention" BOOLEAN NOT NULL DEFAULT false,
    "isRepeat" BOOLEAN NOT NULL DEFAULT false,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comparison_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Comparison_variantAId_fkey" FOREIGN KEY ("variantAId") REFERENCES "Variant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Comparison_variantBId_fkey" FOREIGN KEY ("variantBId") REFERENCES "Variant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Comparison_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Variant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Comparison_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Comparison" ("contrastAttrs", "createdAt", "findingId", "id", "latencyMs", "lowAttention", "segment", "sessionId", "variantAId", "variantBId", "winnerId") SELECT "contrastAttrs", "createdAt", "findingId", "id", "latencyMs", "lowAttention", "segment", "sessionId", "variantAId", "variantBId", "winnerId" FROM "Comparison";
DROP TABLE "Comparison";
ALTER TABLE "new_Comparison" RENAME TO "Comparison";
CREATE INDEX "Comparison_sessionId_idx" ON "Comparison"("sessionId");
CREATE INDEX "Comparison_findingId_idx" ON "Comparison"("findingId");
CREATE TABLE "new_Variant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "findingId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "leadType" TEXT NOT NULL,
    "lengthBand" TEXT NOT NULL,
    "caveatPlacement" TEXT NOT NULL,
    "quantification" TEXT NOT NULL,
    "soWhat" TEXT NOT NULL,
    "fidelity" TEXT NOT NULL DEFAULT 'faithful',
    "status" TEXT NOT NULL DEFAULT 'approved',
    "source" TEXT NOT NULL DEFAULT 'seed',
    "version" INTEGER NOT NULL DEFAULT 1,
    "selfCheck" TEXT,
    "elo" REAL NOT NULL DEFAULT 1200,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Variant_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Variant" ("caveatPlacement", "elo", "fidelity", "findingId", "id", "leadType", "lengthBand", "losses", "quantification", "soWhat", "text", "wins") SELECT "caveatPlacement", "elo", "fidelity", "findingId", "id", "leadType", "lengthBand", "losses", "quantification", "soWhat", "text", "wins" FROM "Variant";
DROP TABLE "Variant";
ALTER TABLE "new_Variant" RENAME TO "Variant";
CREATE INDEX "Variant_findingId_idx" ON "Variant"("findingId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
