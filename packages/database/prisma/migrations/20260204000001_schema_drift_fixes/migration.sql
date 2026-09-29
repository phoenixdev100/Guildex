-- Migration: reconcile live database drift with schema.prisma
-- Generated via `prisma migrate diff` against the live database.

-- AlterTable: economy_data - add streak/work tracking columns
ALTER TABLE "economy_data"
    ADD COLUMN "dailyStreak" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "lastWork" TIMESTAMP(3);

-- AlterTable: permissions - drop temp defaults added by previous migration
ALTER TABLE "permissions"
    ALTER COLUMN "guildId" DROP DEFAULT,
    ALTER COLUMN "userId" DROP DEFAULT;

-- AlterTable: warnings - issuedBy renamed to moderatorId (data preserved)
ALTER TABLE "warnings" ADD COLUMN "moderatorId" TEXT NOT NULL DEFAULT '';
UPDATE "warnings" SET "moderatorId" = "issuedBy";
ALTER TABLE "warnings" DROP COLUMN "issuedBy";
ALTER TABLE "warnings" ALTER COLUMN "moderatorId" DROP DEFAULT;

-- Backfill user rows so the warnings.moderatorId FK cannot fail
INSERT INTO "users" ("id", "username", "discriminator", "createdAt", "updatedAt")
SELECT DISTINCT w."moderatorId", 'migrated', '0', NOW(), NOW()
FROM "warnings" w
WHERE w."moderatorId" <> ''
  AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = w."moderatorId");

-- CreateTable: reminders
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "channelId" TEXT NOT NULL,
    "guildId" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reminders_userId_idx" ON "reminders"("userId");
CREATE INDEX "reminders_remindAt_idx" ON "reminders"("remindAt");
CREATE INDEX "reminders_completed_idx" ON "reminders"("completed");

-- AddForeignKey: warnings -> users
CREATE INDEX "warnings_moderatorId_idx" ON "warnings"("moderatorId");
ALTER TABLE "warnings"
    ADD CONSTRAINT "warnings_moderatorId_fkey"
    FOREIGN KEY ("moderatorId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: reminders -> users
ALTER TABLE "reminders"
    ADD CONSTRAINT "reminders_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
