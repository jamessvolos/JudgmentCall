-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "contextSnippet" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "truthSummary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sourceUrl" TEXT,
    "retrievedAt" TIMESTAMP(3),
    "staleAfter" TIMESTAMP(3),
    "deckId" TEXT,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variant" (
    "id" TEXT NOT NULL,
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
    "elo" DOUBLE PRECISION NOT NULL DEFAULT 1200,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comparison" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "referrer" TEXT,
    "utmSource" TEXT,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "goldCount" INTEGER NOT NULL DEFAULT 0,
    "goldAgreement" INTEGER NOT NULL DEFAULT 0,
    "judgeScore" DOUBLE PRECISION,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "judgeAbility" DOUBLE PRECISION,
    "drillRating" DOUBLE PRECISION NOT NULL DEFAULT 1200,
    "drillCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrillItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contextSnippet" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "faithfulText" TEXT NOT NULL,
    "overclaimedText" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 1200,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrillItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrillAttempt" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "drillItemId" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrillAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deck" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerSessionId" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisSnapshot" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "coefficients" TEXT NOT NULL,
    "coverage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServingPolicy" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "config" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServingPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Variant_findingId_idx" ON "Variant"("findingId");

-- CreateIndex
CREATE INDEX "Comparison_sessionId_idx" ON "Comparison"("sessionId");

-- CreateIndex
CREATE INDEX "Comparison_findingId_idx" ON "Comparison"("findingId");

-- CreateIndex
CREATE INDEX "XpEvent_sessionId_idx" ON "XpEvent"("sessionId");

-- CreateIndex
CREATE INDEX "DrillAttempt_sessionId_idx" ON "DrillAttempt"("sessionId");

-- CreateIndex
CREATE INDEX "DrillAttempt_drillItemId_idx" ON "DrillAttempt"("drillItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Deck_slug_key" ON "Deck"("slug");

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_variantAId_fkey" FOREIGN KEY ("variantAId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_variantBId_fkey" FOREIGN KEY ("variantBId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpEvent" ADD CONSTRAINT "XpEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillAttempt" ADD CONSTRAINT "DrillAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillAttempt" ADD CONSTRAINT "DrillAttempt_drillItemId_fkey" FOREIGN KEY ("drillItemId") REFERENCES "DrillItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_ownerSessionId_fkey" FOREIGN KEY ("ownerSessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

