/**
 * Guild Feature Routes
 *
 * Autoroles, reaction roles and tickets - the bot-facing endpoints
 * backing the corresponding slash commands and event handlers.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticateOrInternal } from '../middleware/auth';
import { ensureGuild } from '../services/ensure';

const autoroleSchema = z.object({
    roleId: z.string().min(1),
});

const reactionRoleMessageSchema = z.object({
    messageId: z.string().min(1),
    channelId: z.string().min(1),
    title: z.string().optional(),
    description: z.string().optional(),
});

const reactionRoleSchema = z.object({
    emoji: z.string().min(1),
    roleId: z.string().min(1),
});

const ticketCreateSchema = z.object({
    channelId: z.string().min(1),
    userId: z.string().min(1),
    subject: z.string().min(1),
});

const ticketCloseSchema = z.object({
    closedBy: z.string().min(1),
    reason: z.string().optional(),
});

const afkSchema = z.object({
    reason: z.string().max(200).optional(),
});

export async function featureRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authenticateOrInternal);

    // ============================================================================
    // AUTO ROLES
    // ============================================================================

    // List autoroles
    app.get('/guilds/:guildId/autoroles', async (request, reply) => {
        const { guildId } = request.params as { guildId: string };

        try {
            const autoroles = await prisma.autoRole.findMany({
                where: { guildId },
                orderBy: { createdAt: 'asc' },
            });

            return { success: true, data: { autoroles } };
        } catch (error) {
            request.log.error({ error, guildId }, 'Failed to fetch autoroles');
            return reply.status(500).send({ success: false, error: 'Failed to fetch autoroles' });
        }
    });

    // Add an autorole
    app.post('/guilds/:guildId/autoroles', async (request, reply) => {
        const { guildId } = request.params as { guildId: string };
        const data = autoroleSchema.parse(request.body);

        try {
            await ensureGuild(guildId);

            const autorole = await prisma.autoRole.upsert({
                where: {
                    guildId_roleId: {
                        guildId,
                        roleId: data.roleId,
                    },
                },
                update: {},
                create: {
                    guildId,
                    roleId: data.roleId,
                },
            });

            return reply.status(201).send({ success: true, data: autorole });
        } catch (error) {
            request.log.error({ error, guildId }, 'Failed to add autorole');
            return reply.status(500).send({ success: false, error: 'Failed to add autorole' });
        }
    });

    // Remove an autorole
    app.delete('/guilds/:guildId/autoroles/:roleId', async (request, reply) => {
        const { guildId, roleId } = request.params as { guildId: string; roleId: string };

        try {
            await prisma.autoRole.deleteMany({
                where: { guildId, roleId },
            });

            return { success: true };
        } catch (error) {
            request.log.error({ error, guildId, roleId }, 'Failed to remove autorole');
            return reply.status(500).send({ success: false, error: 'Failed to remove autorole' });
        }
    });

    // ============================================================================
    // REACTION ROLES
    // ============================================================================

    // List reaction role messages (grouped by message)
    app.get('/guilds/:guildId/reactionroles', async (request, reply) => {
        const { guildId } = request.params as { guildId: string };

        try {
            const rows = await prisma.reactionRole.findMany({
                where: { guildId },
                orderBy: { createdAt: 'asc' },
            });

            // Group emoji->role bindings by message
            const byMessage = new Map<string, {
                messageId: string;
                channelId: string;
                title: string | null;
                roles: { emoji: string; roleId: string }[];
            }>();

            for (const row of rows) {
                let group = byMessage.get(row.messageId);
                if (!group) {
                    group = {
                        messageId: row.messageId,
                        channelId: row.channelId,
                        title: row.title,
                        roles: [],
                    };
                    byMessage.set(row.messageId, group);
                }
                group.roles.push({ emoji: row.emoji, roleId: row.roleId });
            }

            return { success: true, data: { reactionRoles: [...byMessage.values()] } };
        } catch (error) {
            request.log.error({ error, guildId }, 'Failed to fetch reaction roles');
            return reply.status(500).send({ success: false, error: 'Failed to fetch reaction roles' });
        }
    });

    // Register a reaction role message
    app.post('/guilds/:guildId/reactionroles', async (request, reply) => {
        const { guildId } = request.params as { guildId: string };
        const data = reactionRoleMessageSchema.parse(request.body);

        try {
            await ensureGuild(guildId);
            return reply.status(201).send({ success: true, data });
        } catch (error) {
            request.log.error({ error, guildId }, 'Failed to register reaction role message');
            return reply.status(500).send({ success: false, error: 'Failed to register reaction role message' });
        }
    });

    // Add an emoji->role binding to a message
    app.post('/guilds/:guildId/reactionroles/:messageId/roles', async (request, reply) => {
        const { guildId, messageId } = request.params as { guildId: string; messageId: string };
        const data = reactionRoleSchema.parse(request.body);
        const { channelId, title } = (request.body ?? {}) as { channelId?: string; title?: string };

        try {
            await ensureGuild(guildId);

            const binding = await prisma.reactionRole.upsert({
                where: {
                    guildId_messageId_emoji: {
                        guildId,
                        messageId,
                        emoji: data.emoji,
                    },
                },
                update: {
                    roleId: data.roleId,
                },
                create: {
                    guildId,
                    messageId,
                    channelId: channelId ?? 'unknown',
                    title,
                    emoji: data.emoji,
                    roleId: data.roleId,
                },
            });

            return reply.status(201).send({ success: true, data: binding });
        } catch (error) {
            request.log.error({ error, guildId, messageId }, 'Failed to add reaction role');
            return reply.status(500).send({ success: false, error: 'Failed to add reaction role' });
        }
    });

    // Remove an emoji->role binding from a message
    app.delete('/guilds/:guildId/reactionroles/:messageId/roles/:emoji', async (request, reply) => {
        const { guildId, messageId, emoji } = request.params as {
            guildId: string;
            messageId: string;
            emoji: string;
        };

        try {
            await prisma.reactionRole.deleteMany({
                where: {
                    guildId,
                    messageId,
                    emoji: decodeURIComponent(emoji),
                },
            });

            return { success: true };
        } catch (error) {
            request.log.error({ error, guildId, messageId }, 'Failed to remove reaction role');
            return reply.status(500).send({ success: false, error: 'Failed to remove reaction role' });
        }
    });

    // Look up the role bound to a message+emoji (used by the reaction handler)
    app.get('/guilds/:guildId/reactionroles/:messageId/:emoji', async (request, reply) => {
        const { guildId, messageId, emoji } = request.params as {
            guildId: string;
            messageId: string;
            emoji: string;
        };

        try {
            const binding = await prisma.reactionRole.findFirst({
                where: {
                    guildId,
                    messageId,
                    emoji: decodeURIComponent(emoji),
                },
            });

            return { success: true, data: binding };
        } catch (error) {
            request.log.error({ error, guildId, messageId }, 'Failed to look up reaction role');
            return reply.status(500).send({ success: false, error: 'Failed to look up reaction role' });
        }
    });

    // ============================================================================
    // TICKETS
    // ============================================================================

    // Create a ticket record (the channel is created by the bot)
    app.post('/guilds/:guildId/tickets', async (request, reply) => {
        const { guildId } = request.params as { guildId: string };
        const data = ticketCreateSchema.parse(request.body);

        try {
            await ensureGuild(guildId);

            const ticket = await prisma.ticket.create({
                data: {
                    guildId,
                    channelId: data.channelId,
                    userId: data.userId,
                    subject: data.subject,
                    status: 'open',
                },
            });

            return reply.status(201).send({ success: true, data: ticket });
        } catch (error) {
            request.log.error({ error, guildId }, 'Failed to create ticket');
            return reply.status(500).send({ success: false, error: 'Failed to create ticket' });
        }
    });

    // Close a ticket
    app.post('/guilds/:guildId/tickets/:channelId/close', async (request, reply) => {
        const { guildId, channelId } = request.params as { guildId: string; channelId: string };
        const data = ticketCloseSchema.parse(request.body);

        try {
            const ticket = await prisma.ticket.findUnique({
                where: { channelId },
            });

            if (!ticket || ticket.guildId !== guildId) {
                return reply.status(404).send({ success: false, error: 'Ticket not found' });
            }

            await prisma.ticket.update({
                where: { channelId },
                data: {
                    status: 'closed',
                    closedBy: data.closedBy,
                    closedAt: new Date(),
                },
            });

            return { success: true };
        } catch (error) {
            request.log.error({ error, guildId, channelId }, 'Failed to close ticket');
            return reply.status(500).send({ success: false, error: 'Failed to close ticket' });
        }
    });

    // List tickets for a guild
    app.get('/guilds/:guildId/tickets', async (request, reply) => {
        const { guildId } = request.params as { guildId: string };
        const { status } = request.query as { status?: string };

        try {
            const tickets = await prisma.ticket.findMany({
                where: {
                    guildId,
                    ...(status && { status }),
                },
                orderBy: { createdAt: 'desc' },
                take: 100,
            });

            return { success: true, data: { tickets } };
        } catch (error) {
            request.log.error({ error, guildId }, 'Failed to fetch tickets');
            return reply.status(500).send({ success: false, error: 'Failed to fetch tickets' });
        }
    });

    // ============================================================================
    // AFK STATUS
    // ============================================================================

    // Set AFK status (upsert - resets the timestamp if already AFK)
    app.put('/guilds/:guildId/afk/:userId', async (request, reply) => {
        const { guildId, userId } = request.params as { guildId: string; userId: string };
        const { reason } = afkSchema.parse(request.body);

        try {
            await ensureGuild(guildId);

            const afk = await prisma.afkStatus.upsert({
                where: { guildId_userId: { guildId, userId } },
                update: { reason: reason ?? 'AFK', since: new Date() },
                create: { guildId, userId, reason: reason ?? 'AFK' },
            });

            return { success: true, data: afk };
        } catch (error) {
            request.log.error({ error, guildId, userId }, 'Failed to set AFK status');
            return reply.status(500).send({ success: false, error: 'Failed to set AFK status' });
        }
    });

    // Get a user's AFK status (null when not AFK)
    app.get('/guilds/:guildId/afk/:userId', async (request) => {
        const { guildId, userId } = request.params as { guildId: string; userId: string };

        const afk = await prisma.afkStatus.findUnique({
            where: { guildId_userId: { guildId, userId } },
        });

        return { success: true, data: { afk } };
    });

    // Clear a user's AFK status
    app.delete('/guilds/:guildId/afk/:userId', async (request) => {
        const { guildId, userId } = request.params as { guildId: string; userId: string };

        await prisma.afkStatus.deleteMany({ where: { guildId, userId } });

        return { success: true };
    });

    // List all AFK users in a guild
    app.get('/guilds/:guildId/afk', async (request) => {
        const { guildId } = request.params as { guildId: string };

        const afkUsers = await prisma.afkStatus.findMany({
            where: { guildId },
            orderBy: { since: 'desc' },
            take: 100,
        });

        return { success: true, data: { afkUsers } };
    });
}
