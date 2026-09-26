-- CreateTable
CREATE TABLE "guild_daily_stats" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "joins" INTEGER NOT NULL DEFAULT 0,
    "leaves" INTEGER NOT NULL DEFAULT 0,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "commands" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "command_stats" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "command_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_stats" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_stats" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "commands" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guild_daily_stats_guildId_date_key" ON "guild_daily_stats"("guildId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "command_stats_guildId_command_key" ON "command_stats"("guildId", "command");

-- CreateIndex
CREATE UNIQUE INDEX "channel_stats_guildId_channelId_key" ON "channel_stats"("guildId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "user_stats_guildId_userId_key" ON "user_stats"("guildId", "userId");

-- AddForeignKey
ALTER TABLE "guild_daily_stats" ADD CONSTRAINT "guild_daily_stats_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "command_stats" ADD CONSTRAINT "command_stats_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_stats" ADD CONSTRAINT "channel_stats_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

