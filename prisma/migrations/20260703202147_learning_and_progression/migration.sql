-- CreateTable
CREATE TABLE "XpEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "XpEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DrillItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "contextSnippet" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "faithfulText" TEXT NOT NULL,
    "overclaimedText" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "rating" REAL NOT NULL DEFAULT 1200,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DrillAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "drillItemId" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DrillAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DrillAttempt_drillItemId_fkey" FOREIGN KEY ("drillItemId") REFERENCES "DrillItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "postDrill" BOOLEAN NOT NULL DEFAULT false,
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
INSERT INTO "new_Comparison" ("contrastAttrs", "createdAt", "deckId", "findingId", "id", "ipHash", "isGold", "isRepeat", "latencyMs", "lowAttention", "segment", "sessionId", "userAgent", "variantAId", "variantBId", "winnerId") SELECT "contrastAttrs", "createdAt", "deckId", "findingId", "id", "ipHash", "isGold", "isRepeat", "latencyMs", "lowAttention", "segment", "sessionId", "userAgent", "variantAId", "variantBId", "winnerId" FROM "Comparison";
DROP TABLE "Comparison";
ALTER TABLE "new_Comparison" RENAME TO "Comparison";
CREATE INDEX "Comparison_sessionId_idx" ON "Comparison"("sessionId");
CREATE INDEX "Comparison_findingId_idx" ON "Comparison"("findingId");
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "segment" TEXT NOT NULL,
    "referrer" TEXT,
    "utmSource" TEXT,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "goldCount" INTEGER NOT NULL DEFAULT 0,
    "goldAgreement" INTEGER NOT NULL DEFAULT 0,
    "judgeScore" REAL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "judgeAbility" REAL,
    "drillRating" REAL NOT NULL DEFAULT 1200,
    "drillCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Session" ("createdAt", "goldAgreement", "goldCount", "id", "judgeScore", "referrer", "segment", "utmSource", "voteCount") SELECT "createdAt", "goldAgreement", "goldCount", "id", "judgeScore", "referrer", "segment", "utmSource", "voteCount" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "XpEvent_sessionId_idx" ON "XpEvent"("sessionId");

-- CreateIndex
CREATE INDEX "DrillAttempt_sessionId_idx" ON "DrillAttempt"("sessionId");

-- CreateIndex
CREATE INDEX "DrillAttempt_drillItemId_idx" ON "DrillAttempt"("drillItemId");
