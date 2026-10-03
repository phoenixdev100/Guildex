/**
 * Bot Action Queue Routes
 *
 * Internal-only endpoints used by the bot's action poller. Dashboard
 * endpoints queue actions (e.g. LEAVE_GUILD); the bot polls /pending,
 * executes them against Discord, and reports back via /:id/complete.
 *
 * Same pattern as /reminders/pending - the API is the single
 * source of truth and the bot just executes.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@discord-platform/database';
import { authenticateOrInternal } from '../middleware/auth';
import { z } from 'zod';

const completeSchema = z.object({
    status: z.enum(['completed', 'failed']),
    error: z.string().optional(),
});

/** Only internal callers (x-api-key) may touch the action queue. */
async function requireInternal(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await authenticateOrInternal(request, reply);
    if (reply.sent) return;
    if (request.isInternal !== true) {
        return reply.status(403).send({ error: 'Internal only' });
    }
}

export async function botActionRoutes(app: FastifyInstance): Promise<void> {
    app.addHook('preHandler', requireInternal);

    /**
     * GET /api/bot-actions/pending
     * Oldest-first pending actions for the bot to execute.
     */
    app.get('/pending', async () => {
        const actions = await prisma.botAction.findMany({
            where: { status: 'pending' },
            orderBy: { createdAt: 'asc' },
            take: 50,
            select: { id: true, type: true, guildId: true, createdAt: true },
        });
        return actions;
    });

    /**
     * POST /api/bot-actions/:id/complete
     * Mark an action completed/failed after the bot attempts it.
     */
    app.post('/:id/complete', async (request, reply) => {
        const { id } = request.params as { id: string };
        const parsed = completeSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Invalid body' });
        }

        try {
            await prisma.botAction.update({
                where: { id },
                data: {
                    status: parsed.data.status,
                    error: parsed.data.error ?? null,
                    completedAt: new Date(),
                },
            });
            return { success: true };
        } catch (error) {
            request.log.error(error);
            return reply.status(404).send({ error: 'Action not found' });
        }
    });
}
