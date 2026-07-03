-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "contextSnippet" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "truthSummary" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Variant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "findingId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "leadType" TEXT NOT NULL,
    "lengthBand" TEXT NOT NULL,
    "caveatPlacement" TEXT NOT NULL,
    "quantification" TEXT NOT NULL,
    "soWhat" TEXT NOT NULL,
    "fidelity" TEXT NOT NULL DEFAULT 'faithful',
    "elo" REAL NOT NULL DEFAULT 1200,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Variant_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comparison" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comparison_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Comparison_variantAId_fkey" FOREIGN KEY ("variantAId") REFERENCES "Variant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Comparison_variantBId_fkey" FOREIGN KEY ("variantBId") REFERENCES "Variant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Comparison_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Variant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Comparison_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "segment" TEXT NOT NULL,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Variant_findingId_idx" ON "Variant"("findingId");

-- CreateIndex
CREATE INDEX "Comparison_sessionId_idx" ON "Comparison"("sessionId");

-- CreateIndex
CREATE INDEX "Comparison_findingId_idx" ON "Comparison"("findingId");
