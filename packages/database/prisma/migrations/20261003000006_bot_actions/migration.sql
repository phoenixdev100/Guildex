-- CreateTable
CREATE TABLE "bot_actions" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedBy" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "bot_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bot_actions_status_createdAt_idx" ON "bot_actions"("status", "createdAt");

