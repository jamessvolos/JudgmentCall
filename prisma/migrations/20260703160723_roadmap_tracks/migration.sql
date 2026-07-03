-- CreateTable
CREATE TABLE "Deck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerSessionId" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Deck_ownerSessionId_fkey" FOREIGN KEY ("ownerSessionId") REFERENCES "Session" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AnalysisSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "method" TEXT NOT NULL,
    "coefficients" TEXT NOT NULL,
    "coverage" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
    "isGold" BOOLEAN NOT NULL DEFAULT false,
    "deckId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comparison_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Comparison_variantAId_fkey" FOREIGN KEY ("variantAId") REFERENCES "Variant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Comparison_variantBId_fkey" FOREIGN KEY ("variantBId") REFERENCES "Variant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Comparison_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Variant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Comparison_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Comparison" ("contrastAttrs", "createdAt", "findingId", "id", "ipHash", "isRepeat", "latencyMs", "lowAttention", "segment", "sessionId", "userAgent", "variantAId", "variantBId", "winnerId") SELECT "contrastAttrs", "createdAt", "findingId", "id", "ipHash", "isRepeat", "latencyMs", "lowAttention", "segment", "sessionId", "userAgent", "variantAId", "variantBId", "winnerId" FROM "Comparison";
DROP TABLE "Comparison";
ALTER TABLE "new_Comparison" RENAME TO "Comparison";
CREATE INDEX "Comparison_sessionId_idx" ON "Comparison"("sessionId");
CREATE INDEX "Comparison_findingId_idx" ON "Comparison"("findingId");
CREATE TABLE "new_Finding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "contextSnippet" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "truthSummary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "deckId" TEXT,
    CONSTRAINT "Finding_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Finding" ("contextSnippet", "domain", "id", "sourceLabel", "title", "truthSummary") SELECT "contextSnippet", "domain", "id", "sourceLabel", "title", "truthSummary" FROM "Finding";
DROP TABLE "Finding";
ALTER TABLE "new_Finding" RENAME TO "Finding";
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "segment" TEXT NOT NULL,
    "referrer" TEXT,
    "utmSource" TEXT,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "goldCount" INTEGER NOT NULL DEFAULT 0,
    "goldAgreement" INTEGER NOT NULL DEFAULT 0,
    "judgeScore" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Session" ("createdAt", "id", "referrer", "segment", "utmSource", "voteCount") SELECT "createdAt", "id", "referrer", "segment", "utmSource", "voteCount" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Deck_slug_key" ON "Deck"("slug");
