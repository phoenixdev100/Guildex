/**
 * Analytics Routes
 *
 * Bot feeds batched counters via POST /api/analytics/flush;
 * commands and dashboard read aggregated series.
 */

import { FastifyInstance } from 'fastify';
import { prisma } from '@discord-platform/database';
import { authenticateOrInternal } from '../middleware/auth';
import { ensureGuild } from '../services/ensure';

const utcToday = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

interface FlushBody {
    guildId: string;
    joins?: number;
    leaves?: number;
    messages?: number;
    commands?: number;
    channels?: Record<string, number>;                    // channelId → message count
    commandCounts?: Record<string, number>;               // command name → count
    users?: Record<string, { messages?: number; commands?: number }>; // userId → counters
}

export async function analyticsRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authenticateOrInternal);

    /** Batched counter flush from the bot (called every ~30s + on joins/leaves). */
    app.post<{ Body: FlushBody }>('/analytics/flush', async (req) => {
        const { guildId, joins = 0, leaves = 0, messages = 0, commands = 0 } = req.body ?? {};
        if (!guildId) return { success: false, error: 'guildId required' };
        const body = req.body as FlushBody;
        const date = utcToday();

        await ensureGuild(guildId);

        await prisma.guildDailyStat.upsert({
            where: { guildId_date: { guildId, date } },
            create: { guildId, date, joins, leaves, messages, commands },
            update: { joins: { increment: joins }, leaves: { increment: leaves }, messages: { increment: messages }, commands: { increment: commands } },
        });

        if (body.channels) {
            for (const [channelId, count] of Object.entries(body.channels)) {
                if (!count) continue;
                await prisma.channelStat.upsert({
                    where: { guildId_channelId: { guildId, channelId } },
                    create: { guildId, channelId, messages: count },
                    update: { messages: { increment: count } },
                });
            }
        }

        if (body.commandCounts) {
            for (const [command, count] of Object.entries(body.commandCounts)) {
                if (!count) continue;
                await prisma.commandStat.upsert({
                    where: { guildId_command: { guildId, command } },
                    create: { guildId, command, count },
                    update: { count: { increment: count } },
                });
            }
        }

        if (body.users) {
            for (const [userId, c] of Object.entries(body.users)) {
                const m = c.messages ?? 0, cmd = c.commands ?? 0;
                if (!m && !cmd) continue;
                await prisma.userStat.upsert({
                    where: { guildId_userId: { guildId, userId } },
                    create: { guildId, userId, messages: m, commands: cmd },
                    update: { messages: { increment: m }, commands: { increment: cmd } },
                });
            }
        }

        return { success: true };
    });

    /** Last N days of daily stats + all-time totals. */
    app.get<{ Params: { guildId: string }; Querystring: { days?: string } }>(
        '/guilds/:guildId/analytics',
        async (req) => {
            const { guildId } = req.params;
            const days = Math.min(90, Math.max(1, parseInt(req.query.days ?? '30', 10) || 30));

            const since = new Date();
            since.setUTCDate(since.getUTCDate() - days);
            const sinceStr = since.toISOString().slice(0, 10);

            const [daily, totals] = await Promise.all([
                prisma.guildDailyStat.findMany({
                    where: { guildId, date: { gte: sinceStr } },
                    orderBy: { date: 'asc' },
                }),
                prisma.guildDailyStat.aggregate({
                    where: { guildId },
                    _sum: { joins: true, leaves: true, messages: true, commands: true },
                }),
            ]);

            return {
                success: true,
                data: {
                    daily,
                    totals: {
                        joins: totals._sum.joins ?? 0,
                        leaves: totals._sum.leaves ?? 0,
                        messages: totals._sum.messages ?? 0,
                        commands: totals._sum.commands ?? 0,
                    },
                },
            };
        }
    );

    /** Top channels by message count. */
    app.get<{ Params: { guildId: string } }>('/guilds/:guildId/analytics/channels', async (req) => {
        const rows = await prisma.channelStat.findMany({
            where: { guildId: req.params.guildId },
            orderBy: { messages: 'desc' },
            take: 10,
        });
        return { success: true, data: { channels: rows } };
    });

    /** Top commands by usage. */
    app.get<{ Params: { guildId: string } }>('/guilds/:guildId/analytics/commands', async (req) => {
        const rows = await prisma.commandStat.findMany({
            where: { guildId: req.params.guildId },
            orderBy: { count: 'desc' },
            take: 10,
        });
        return { success: true, data: { commands: rows } };
    });

    /** Per-user stats + leaderboard. */
    app.get<{ Params: { guildId: string; userId: string } }>(
        '/guilds/:guildId/analytics/user/:userId',
        async (req) => {
            const { guildId, userId } = req.params;
            const [stat, rankRow] = await Promise.all([
                prisma.userStat.findUnique({ where: { guildId_userId: { guildId, userId } } }),
                prisma.userStat.count({
                    where: { guildId, messages: { gt: (await prisma.userStat.findUnique({ where: { guildId_userId: { guildId, userId } } }))?.messages ?? 0 } },
                }),
            ]);
            return {
                success: true,
                data: {
                    messages: stat?.messages ?? 0,
                    commands: stat?.commands ?? 0,
                    rank: stat ? rankRow + 1 : null,
                },
            };
        }
    );

    /** Leaderboard - top members by messages. */
    app.get<{ Params: { guildId: string } }>('/guilds/:guildId/analytics/leaderboard', async (req) => {
        const rows = await prisma.userStat.findMany({
            where: { guildId: req.params.guildId },
            orderBy: { messages: 'desc' },
            take: 10,
        });
        return { success: true, data: { leaderboard: rows } };
    });
}
