/**
 * Guild Routes
 * 
 * Handles guild registration and module management.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma, MODULE_DEFINITIONS } from '@discord-platform/database';
import { authenticateOrInternal } from '../middleware/auth';
import { getAllowedGuildIds, canAccessGuild } from '../middleware/guild-access';
import { ensureGuild } from '../services/ensure';
import { env } from '../config/env';

export async function guildRoutes(app: FastifyInstance): Promise<void> {
    app.addHook('preHandler', authenticateOrInternal);

    // Guild-scope enforcement: requests carrying a user's Discord token may
    // only touch guilds that user manages. Internal-key-only callers (the
    // bot) are unrestricted.
    app.addHook('preHandler', async (request, reply) => {
        const { guildId } = request.params as { guildId?: string };
        if (!guildId) return;
        const allowed = await getAllowedGuildIds(request);
        if (!canAccessGuild(allowed, guildId)) {
            return reply.status(403).send({ success: false, error: 'You do not have permission to manage this guild' });
        }
    });

    // Schema for guild registration
    const registerSchema = z.object({
        name: z.string(),
        icon: z.string().nullable(),
        ownerId: z.string(),
    });

    /**
     * POST /api/guilds/:guildId/register
     * Register or update a guild
     */
    app.post('/:guildId/register', async (request, reply) => {
        const { guildId } = request.params as { guildId: string };

        // Validate body
        const result = registerSchema.safeParse(request.body);
        if (!result.success) {
            return reply.status(400).send({ error: 'Invalid request body' });
        }

        const { name, icon, ownerId } = result.data;

        try {
            // Ensure every known module exists (single bulk insert)
            await prisma.module.createMany({
                data: MODULE_DEFINITIONS.map((mod) => ({
                    name: mod.name,
                    category: mod.category,
                    description: mod.description,
                    isDefault: mod.isDefault,
                })),
                skipDuplicates: true,
            });

            // Upsert guild
            const guild = await prisma.guild.upsert({
                where: { id: guildId },
                update: {
                    name,
                    icon,
                    ownerId,
                    isActive: true,
                    leftAt: null,
                },
                create: {
                    id: guildId,
                    name,
                    icon,
                    ownerId,
                },
            });

            // Ensure a GuildModule row exists for every module.
            // New guilds start with every module enabled so commands work
            // out of the box; admins can disable them per-module.
            const moduleRows = await prisma.module.findMany({
                where: { name: { in: MODULE_DEFINITIONS.map((m) => m.name) } },
            });

            await prisma.guildModule.createMany({
                data: moduleRows.map((m) => ({
                    guildId,
                    moduleId: m.id,
                    isEnabled: true,
                })),
                skipDuplicates: true,
            });

            return { success: true, guild };
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to register guild' });
        }
    });

    /**
     * POST /api/guilds/reconcile
     * Internal only - called by the bot on startup with its current
     * guild ids. Any guild still marked active but missing from the
     * list (kicked or deleted while the bot was offline) is marked
     * inactive so it drops out of select-server/admin views.
     */
    app.post('/reconcile', async (request, reply) => {
        if (request.isInternal !== true) {
            return reply.status(403).send({ error: 'Internal only' });
        }

        const parsed = z.object({ ids: z.array(z.string()).max(2000) }).safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Invalid body' });
        }

        try {
            const stale = await prisma.guild.updateMany({
                where: { isActive: true, id: { notIn: parsed.data.ids } },
                data: { isActive: false, leftAt: new Date() },
            });
            if (stale.count > 0) {
                request.log.info({ stale: stale.count }, 'Reconciled stale guilds');
            }
            return { success: true, deactivated: stale.count };
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to reconcile guilds' });
        }
    });

    /**
     * DELETE /api/guilds/:guildId/unregister
     * Mark a guild as inactive (bot left the server)
     */
    app.delete('/:guildId/unregister', async (request, reply) => {
        const { guildId } = request.params as { guildId: string };

        try {
            await prisma.guild.update({
                where: { id: guildId },
                data: {
                    isActive: false,
                    leftAt: new Date(),
                },
            });

            return { success: true };
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to unregister guild' });
        }
    });

    /**
     * GET /api/guilds/:guildId/modules
     * List all modules and their enabled state for a guild
     */
    app.get('/:guildId/modules', async (request, reply) => {
        const { guildId } = request.params as { guildId: string };

        try {
            const guildModules = await prisma.guildModule.findMany({
                where: { guildId },
                include: { module: true },
            });

            return {
                success: true,
                modules: guildModules.map((gm) => ({
                    name: gm.module.name,
                    category: gm.module.category,
                    description: gm.module.description,
                    enabled: gm.isEnabled,
                })),
            };
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch modules' });
        }
    });

    /**
     * PUT /api/guilds/:guildId/modules/:moduleName
     * Enable or disable a module for a guild
     */
    app.put('/:guildId/modules/:moduleName', async (request, reply) => {
        const { guildId, moduleName } = request.params as { guildId: string; moduleName: string };
        const { enabled } = (request.body ?? {}) as { enabled?: boolean };

        if (typeof enabled !== 'boolean') {
            return reply.status(400).send({ error: '`enabled` (boolean) is required' });
        }

        try {
            const definition = MODULE_DEFINITIONS.find((m) => m.name === moduleName);

            const module = await prisma.module.upsert({
                where: { name: moduleName },
                update: {},
                create: {
                    name: moduleName,
                    category: definition?.category ?? 'custom',
                    description: definition?.description ?? `${moduleName} module`,
                    isDefault: definition?.isDefault ?? false,
                },
            });

            const guildModule = await prisma.guildModule.upsert({
                where: {
                    guildId_moduleId: {
                        guildId,
                        moduleId: module.id,
                    },
                },
                update: { isEnabled: enabled },
                create: {
                    guildId,
                    moduleId: module.id,
                    isEnabled: enabled,
                },
            });

            return { success: true, module: moduleName, enabled: guildModule.isEnabled };
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to update module' });
        }
    });

    /**
     * GET /api/guilds/:guildId/modules/:moduleName
     * Check if a module is enabled
     */
    app.get('/:guildId/modules/:moduleName', async (request, reply) => {
        const { guildId, moduleName } = request.params as { guildId: string; moduleName: string };

        try {
            const guildModule = await prisma.guildModule.findFirst({
                where: {
                    guildId,
                    module: {
                        name: moduleName
                    }
                },
            });

            // Modules that have never been configured default to enabled
            return { enabled: guildModule?.isEnabled ?? true };
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to check module status' });
        }
    });

    /**
     * GET /api/guilds/:guildId/admin-role
     * Current bot-admin role for the guild (null = none configured)
     */
    app.get('/:guildId/admin-role', async (request) => {
        const { guildId } = request.params as { guildId: string };

        const guild = await prisma.guild.findUnique({
            where: { id: guildId },
            select: { adminRoleId: true },
        });

        return { success: true, data: { adminRoleId: guild?.adminRoleId ?? null } };
    });

    /**
     * PUT /api/guilds/:guildId/admin-role
     * Assign the bot-admin role - members holding it may use admin commands
     * (synced into Discord's command permissions by the bot).
     */
    app.put('/:guildId/admin-role', async (request, reply) => {
        const { guildId } = request.params as { guildId: string };
        const { roleId } = z.object({ roleId: z.string().nullable() }).parse(request.body);

        try {
            await ensureGuild(guildId);
            const guild = await prisma.guild.update({
                where: { id: guildId },
                data: { adminRoleId: roleId },
                select: { adminRoleId: true },
            });

            return { success: true, data: guild };
        } catch (error) {
            request.log.error({ error, guildId }, 'Failed to set admin role');
            return reply.status(500).send({ success: false, error: 'Failed to set admin role' });
        }
    });

    /**
     * GET /api/guilds/:guildId/discord-roles
     * Live role list from Discord (for the admin-role picker in the dashboard).
     */
    app.get('/:guildId/discord-roles', async (request, reply) => {
        const { guildId } = request.params as { guildId: string };

        if (!env.DISCORD_BOT_TOKEN) {
            return reply.status(503).send({ success: false, error: 'Bot token not configured on the API' });
        }

        try {
            const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
                headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
            });

            if (!res.ok) {
                const body = await res.text().catch(() => '');
                request.log.warn({ status: res.status, body, guildId }, 'Discord roles fetch failed');
                return reply.status(res.status).send({ success: false, error: 'Failed to fetch roles from Discord' });
            }

            const roles = (await res.json()) as Array<{
                id: string; name: string; color: number; position: number; managed: boolean;
            }>;

            return {
                success: true,
                data: roles
                    .filter(r => r.id !== guildId) // exclude @everyone
                    .sort((a, b) => b.position - a.position)
                    .map(r => ({ id: r.id, name: r.name, color: r.color, position: r.position, managed: r.managed })),
            };
        } catch (error) {
            request.log.error({ error, guildId }, 'Failed to fetch Discord roles');
            return reply.status(500).send({ success: false, error: 'Failed to fetch roles' });
        }
    });

    /**
     * GET /api/guilds/:guildId/discord-channels
     * Live channel list from Discord (for config pickers in the dashboard).
     */
    app.get('/:guildId/discord-channels', async (request, reply) => {
        const { guildId } = request.params as { guildId: string };

        if (!env.DISCORD_BOT_TOKEN) {
            return reply.status(503).send({ success: false, error: 'Bot token not configured on the API' });
        }

        try {
            const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
                headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
            });

            if (!res.ok) {
                const body = await res.text().catch(() => '');
                request.log.warn({ status: res.status, body, guildId }, 'Discord channels fetch failed');
                return reply.status(res.status).send({ success: false, error: 'Failed to fetch channels from Discord' });
            }

            const channels = (await res.json()) as Array<{
                id: string; name: string; type: number; position: number;
            }>;

            return {
                success: true,
                data: channels
                    .filter(c => c.type === 0) // text channels only
                    .sort((a, b) => a.position - b.position)
                    .map(c => ({ id: c.id, name: c.name })),
            };
        } catch (error) {
            request.log.error({ error, guildId }, 'Failed to fetch Discord channels');
            return reply.status(500).send({ success: false, error: 'Failed to fetch channels' });
        }
    });
}
