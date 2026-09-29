-- Migration: feature fixes
-- 1) permissions table becomes per-user override records (guildId/userId/effect/conditions)
-- 2) new auto_roles table
-- 3) new reaction_roles table
-- (guild_users relation field names were renamed in Prisma only - no DDL needed)

-- AlterTable: permissions
ALTER TABLE "permissions"
    ADD COLUMN "guildId" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "userId" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "effect" TEXT NOT NULL DEFAULT 'allow',
    ADD COLUMN "conditions" JSONB;

-- Drop old unique constraint on (resource, action)
DROP INDEX IF EXISTS "permissions_resource_action_key";

-- New indexes on permissions
CREATE UNIQUE INDEX "permissions_guildId_userId_resource_action_key"
    ON "permissions"("guildId", "userId", "resource", "action");
CREATE INDEX "permissions_guildId_idx" ON "permissions"("guildId");
CREATE INDEX "permissions_userId_idx" ON "permissions"("userId");

-- CreateTable: auto_roles
CREATE TABLE "auto_roles" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auto_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auto_roles_guildId_roleId_key" ON "auto_roles"("guildId", "roleId");
CREATE INDEX "auto_roles_guildId_idx" ON "auto_roles"("guildId");

ALTER TABLE "auto_roles"
    ADD CONSTRAINT "auto_roles_guildId_fkey"
    FOREIGN KEY ("guildId") REFERENCES "guilds"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: reaction_roles
CREATE TABLE "reaction_roles" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" TEXT,
    "emoji" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reaction_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reaction_roles_guildId_messageId_emoji_key"
    ON "reaction_roles"("guildId", "messageId", "emoji");
CREATE INDEX "reaction_roles_guildId_idx" ON "reaction_roles"("guildId");
CREATE INDEX "reaction_roles_messageId_idx" ON "reaction_roles"("messageId");

ALTER TABLE "reaction_roles"
    ADD CONSTRAINT "reaction_roles_guildId_fkey"
    FOREIGN KEY ("guildId") REFERENCES "guilds"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
