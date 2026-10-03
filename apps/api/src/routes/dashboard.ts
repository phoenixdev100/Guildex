/**
 * Dashboard Stats Routes
 * 
 * Provides statistics and data for the dashboard
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from '@discord-platform/database';
import { authenticateOrInternal } from '../middleware/auth';
import { getAllowedGuildIds, discordUserId } from '../middleware/guild-access';
import { env } from '../config/env';
import type { FastifyRequest } from 'fastify';

declare module 'fastify' {
    interface FastifyRequest {
        allowedGuildIds?: Set<string> | null;
    }
}

/** Global bot config may only be touched by the configured super admin. */
function isSuperAdminRequest(request: FastifyRequest): boolean {
    if (!env.SUPER_ADMIN_ID) return request.isInternal === true;
    return discordUserId(request) === env.SUPER_ADMIN_ID;
}

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
    app.addHook('preHandler', authenticateOrInternal);

    // Resolve which guilds the calling user may manage (null = unrestricted
    // internal caller). Computed once per request.
    app.addHook('preHandler', async (request) => {
        request.allowedGuildIds = await getAllowedGuildIds(request);
    });

    /**
     * GET /api/dashboard/me
     * Current user's identity + role - the dashboard uses this to
     * show the owner-only admin navigation.
     */
    app.get('/me', async (request) => {
        return {
            discordId: discordUserId(request),
            isSuperAdmin: isSuperAdminRequest(request),
        };
    });

    /**
     * GET /api/dashboard/admin/overview
     * Global platform stats across ALL guilds - super admin only.
     */
    app.get('/admin/overview', async (request, reply) => {
        if (!isSuperAdminRequest(request)) {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        try {
            const [guilds, users, submissions, pendingSubs, blacklist, commandStats] = await Promise.all([
                prisma.guild.findMany({
                    include: { _count: { select: { users: true, modules: { where: { isEnabled: true } } } } },
                    orderBy: { joinedAt: 'desc' },
                }),
                prisma.user.count(),
                prisma.applicationSubmission.count(),
                prisma.applicationSubmission.count({ where: { status: 'pending' } }),
                prisma.applicationBlacklist.count(),
                prisma.customCommand.aggregate({ _sum: { usageCount: true } }),
            ]);

            return {
                totalGuilds: guilds.length,
                activeGuilds: guilds.filter(g => g.isActive).length,
                totalUsers: users,
                totalSubmissions: submissions,
                pendingSubmissions: pendingSubs,
                blacklistedUsers: blacklist,
                commandsUsed: commandStats._sum.usageCount ?? 0,
                guilds: guilds.map(g => ({
                    id: g.id,
                    name: g.name,
                    icon: g.icon,
                    ownerId: g.ownerId,
                    isActive: g.isActive,
                    joinedAt: g.joinedAt,
                    memberCount: g._count.users,
                    enabledModules: g._count.modules,
                })),
            };
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch overview' });
        }
    });

    /**
     * POST /api/dashboard/admin/guilds/:guildId/leave
     * Queue a LEAVE_GUILD action - the bot's action poller picks it up
     * within ~30s and calls guild.leave(). Super admin only; server
     * owners/admins cannot use this (they kick manually in Discord).
     */
    app.post('/admin/guilds/:guildId/leave', async (request, reply) => {
        if (!isSuperAdminRequest(request)) {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const { guildId } = request.params as { guildId: string };
        try {
            const guild = await prisma.guild.findUnique({
                where: { id: guildId },
                select: { isActive: true },
            });
            if (!guild || !guild.isActive) {
                return reply.status(404).send({ error: 'Guild not found or bot already left' });
            }

            const existing = await prisma.botAction.findFirst({
                where: { guildId, type: 'LEAVE_GUILD', status: 'pending' },
                select: { id: true },
            });
            if (existing) return { success: true, queued: true, id: existing.id };

            const action = await prisma.botAction.create({
                data: {
                    type: 'LEAVE_GUILD',
                    guildId,
                    requestedBy: discordUserId(request),
                },
            });
            return { success: true, queued: true, id: action.id };
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to queue guild leave' });
        }
    });

    /**
     * GET /api/dashboard/stats
     * Get overall dashboard statistics
     */
    app.get('/stats', async (request, reply) => {
        try {
            const allowed = request.allowedGuildIds === undefined ? new Set<string>() : request.allowedGuildIds;
            const guildFilter = allowed === null ? {} : { guildId: { in: [...allowed] } };

            // Get total guilds
            const totalGuilds = await prisma.guild.count({
                where: allowed === null ? { isActive: true } : { isActive: true, id: { in: [...allowed] } }
            });

            // Get total enabled modules across allowed guilds
            const enabledModules = await prisma.guildModule.count({
                where: { isEnabled: true, ...guildFilter }
            });

            // Get total users known to the bot
            const totalUsers = await prisma.user.count();

            // Get total custom command executions
            const commandStats = await prisma.customCommand.aggregate({
                _sum: {
                    usageCount: true
                }
            });
            const commandsUsed = commandStats._sum.usageCount || 0;

            return {
                servers: totalGuilds,
                modules: enabledModules,
                commands: commandsUsed,
                users: totalUsers
            };
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch stats' });
        }
    });

    /**
     * GET /api/dashboard/guilds
     * Get all guilds with their module status
     */
    app.get('/guilds', async (request, reply) => {
        try {
            const allowed = request.allowedGuildIds === undefined ? new Set<string>() : request.allowedGuildIds;
            const guilds = await prisma.guild.findMany({
                where: allowed === null ? { isActive: true } : { isActive: true, id: { in: [...allowed] } },
                include: {
                    modules: {
                        include: {
                            module: true
                        }
                    },
                    _count: {
                        select: {
                            users: true,
                            customCommands: true
                        }
                    }
                },
                orderBy: {
                    joinedAt: 'desc'
                }
            });

            return guilds.map(guild => ({
                id: guild.id,
                name: guild.name,
                icon: guild.icon,
                ownerId: guild.ownerId,
                isPremium: guild.isPremium,
                premiumTier: guild.premiumTier,
                joinedAt: guild.joinedAt,
                memberCount: guild._count.users,
                commandCount: guild._count.customCommands,
                enabledModules: guild.modules.filter(m => m.isEnabled).length,
                totalModules: guild.modules.length
            }));
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch guilds' });
        }
    });

    /**
     * GET /api/dashboard/modules
     * Get all modules with their status across guilds
     */
    app.get('/modules', async (request, reply) => {
        try {
            const allowed = request.allowedGuildIds === undefined ? new Set<string>() : request.allowedGuildIds;
            const modules = await prisma.module.findMany({
                include: {
                    guilds: {
                        where: allowed === null
                            ? { guild: { isActive: true } }
                            : { guild: { isActive: true }, guildId: { in: [...allowed] } }
                    }
                }
            });

            return modules.map(module => ({
                id: module.id,
                name: module.name,
                description: module.description,
                category: module.category,
                isDefault: module.isDefault,
                enabledInGuilds: module.guilds.filter(g => g.isEnabled).length,
                totalGuilds: module.guilds.length
            }));
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch modules' });
        }
    });

    /**
     * GET /api/dashboard/activity
     * Get recent activity from audit logs
     */
    app.get('/activity', async (request, reply) => {
        try {
            const allowed = request.allowedGuildIds === undefined ? new Set<string>() : request.allowedGuildIds;
            const scoped = allowed === null ? {} : { guildId: { in: [...allowed] } };

            // Fetch recent audit logs for activity feed
            const recentLogs = await prisma.auditLog.findMany({
                take: 10,
                where: scoped,
                orderBy: {
                    createdAt: 'desc'
                },
                include: {
                    guild: {
                        select: {
                            name: true
                        }
                    },
                    user: {
                        select: {
                            username: true
                        }
                    }
                }
            });

            if (recentLogs.length > 0) {
                return recentLogs.map(log => ({
                    id: log.id,
                    action: log.action,
                    server: log.guild.name,
                    user: log.user.username,
                    time: log.createdAt,
                    icon: getActionIcon(log.action)
                }));
            }

            // Fallback if no logs: return recent guild joins as before
            const recentGuilds = await prisma.guild.findMany({
                where: allowed === null ? { isActive: true } : { isActive: true, id: { in: [...allowed] } },
                orderBy: { joinedAt: 'desc' },
                take: 5,
                select: {
                    id: true,
                    name: true,
                    joinedAt: true
                }
            });

            return recentGuilds.map(guild => ({
                id: guild.id,
                action: 'Server joined',
                server: guild.name,
                time: guild.joinedAt,
                icon: '🎉'
            }));
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch activity' });
        }
    });

    /**
     * PUT /api/dashboard/modules/:id
     * Toggle module default status
     */
    app.put('/modules/:id', async (request, reply) => {
        if (!isSuperAdminRequest(request)) {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const { id } = request.params as { id: string };
        const { isDefault } = request.body as { isDefault: boolean };

        try {
            const module = await prisma.module.update({
                where: { id },
                data: { isDefault }
            });
            return module;
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to update module' });
        }
    });

    /**
     * GET /api/dashboard/logs
     * Get paginated audit logs
     */
    app.get('/logs', async (request, reply) => {
        const { page = 1, limit = 50 } = request.query as { page: number, limit: number };
        const skip = (page - 1) * limit;
        const allowed = request.allowedGuildIds === undefined ? new Set<string>() : request.allowedGuildIds;
        const scoped = allowed === null ? {} : { guildId: { in: [...allowed] } };

        try {
            const [logs, total] = await prisma.$transaction([
                prisma.auditLog.findMany({
                    skip,
                    take: Number(limit),
                    where: scoped,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        guild: { select: { name: true } },
                        user: { select: { username: true } }
                    }
                }),
                prisma.auditLog.count({ where: scoped })
            ]);

            return {
                logs: logs.map(log => ({
                    id: log.id,
                    action: log.action,
                    server: log.guild.name,
                    user: log.user.username,
                    resource: log.resource,
                    time: log.createdAt,
                    icon: getActionIcon(log.action)
                })),
                pagination: {
                    total,
                    pages: Math.ceil(total / limit),
                    current: Number(page)
                }
            };
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch logs' });
        }
    });

    /**
     * GET /api/dashboard/settings
     * Get system configuration - super admin only
     */
    app.get('/settings', async (request, reply) => {
        if (!isSuperAdminRequest(request)) {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        try {
            const configs = await prisma.systemConfig.findMany();
            // Convert array of configs to a single object
            return configs.reduce((acc, curr) => ({
                ...acc,
                [curr.key]: curr.value
            }), {});
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch settings' });
        }
    });

    /**
     * POST /api/dashboard/settings
     * Update system configuration - super admin only
     */
    app.post('/settings', async (request, reply) => {
        if (!isSuperAdminRequest(request)) {
            return reply.status(403).send({ error: 'Forbidden' });
        }
        const settings = request.body as Record<string, any>;

        try {
            const updates = Object.entries(settings).map(([key, value]) =>
                prisma.systemConfig.upsert({
                    where: { key },
                    update: { value },
                    create: { key, value }
                })
            );

            await prisma.$transaction(updates);
            return { success: true };
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to update settings' });
        }
    });
}

function getActionIcon(action: string): string {
    if (action.includes('ban') || action.includes('kick')) return '🔨';
    if (action.includes('mute') || action.includes('timeout')) return '🔇';
    if (action.includes('delete')) return '🗑️';
    if (action.includes('update')) return '📝';
    if (action.includes('create')) return '✨';
    return '📋';
}
