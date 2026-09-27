/**
 * Applications Routes
 *
 * Form CRUD, submissions, review actions, and blacklist for the
 * guild application system (staff applications, whitelist requests, etc).
 */

import { FastifyInstance } from 'fastify';
import { prisma } from '@discord-platform/database';
import { authenticateOrInternal } from '../middleware/auth';
import { ensureGuild } from '../services/ensure';

interface Question {
    label: string;
    style?: 'short' | 'paragraph';
    required?: boolean;
    placeholder?: string;
}

interface FormBody {
    name: string;
    description?: string;
    questions?: Question[];
    staffRoleId?: string | null;
    acceptedRoleId?: string | null;
    logChannelId?: string | null;
    isOpen?: boolean;
    cooldownHours?: number;
}

export async function applicationRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authenticateOrInternal);

    // ── Forms ──────────────────────────────────────────────────────

    /** List forms (optionally only open ones). */
    app.get<{ Params: { guildId: string }; Querystring: { open?: string } }>(
        '/guilds/:guildId/applications/forms',
        async (req) => {
            const where: any = { guildId: req.params.guildId };
            if (req.query.open === 'true') where.isOpen = true;
            const forms = await prisma.applicationForm.findMany({
                where,
                orderBy: { createdAt: 'asc' },
                include: { _count: { select: { submissions: { where: { status: 'pending' } } } } },
            });
            return { success: true, data: { forms } };
        }
    );

    /** Create a form. */
    app.post<{ Params: { guildId: string }; Body: FormBody }>(
        '/guilds/:guildId/applications/forms',
        async (req, reply) => {
            const { guildId } = req.params;
            const body = req.body ?? ({} as FormBody);
            if (!body.name?.trim()) {
                return reply.code(400).send({ success: false, error: 'Form name is required' });
            }
            await ensureGuild(guildId);
            const form = await prisma.applicationForm.create({
                data: {
                    guildId,
                    name: body.name.trim(),
                    description: body.description?.trim() || null,
                    questions: (body.questions ?? []) as any,
                    staffRoleId: body.staffRoleId || null,
                    acceptedRoleId: body.acceptedRoleId || null,
                    logChannelId: body.logChannelId || null,
                    isOpen: body.isOpen ?? true,
                    cooldownHours: body.cooldownHours ?? 0,
                },
            });
            return { success: true, data: { form } };
        }
    );

    /** Update a form (any subset of fields). */
    app.patch<{ Params: { guildId: string; formId: string }; Body: Partial<FormBody> }>(
        '/guilds/:guildId/applications/forms/:formId',
        async (req, reply) => {
            const { guildId, formId } = req.params;
            const body = req.body ?? {};
            const existing = await prisma.applicationForm.findFirst({ where: { id: formId, guildId } });
            if (!existing) return reply.code(404).send({ success: false, error: 'Form not found' });

            const data: any = {};
            if (body.name !== undefined) data.name = body.name.trim();
            if (body.description !== undefined) data.description = body.description?.trim() || null;
            if (body.questions !== undefined) data.questions = body.questions as any;
            if (body.staffRoleId !== undefined) data.staffRoleId = body.staffRoleId || null;
            if (body.acceptedRoleId !== undefined) data.acceptedRoleId = body.acceptedRoleId || null;
            if (body.logChannelId !== undefined) data.logChannelId = body.logChannelId || null;
            if (body.isOpen !== undefined) data.isOpen = body.isOpen;
            if (body.cooldownHours !== undefined) data.cooldownHours = body.cooldownHours;

            const form = await prisma.applicationForm.update({ where: { id: formId }, data });
            return { success: true, data: { form } };
        }
    );

    /** Delete a form (submissions cascade). */
    app.delete<{ Params: { guildId: string; formId: string } }>(
        '/guilds/:guildId/applications/forms/:formId',
        async (req, reply) => {
            const { guildId, formId } = req.params;
            const existing = await prisma.applicationForm.findFirst({ where: { id: formId, guildId } });
            if (!existing) return reply.code(404).send({ success: false, error: 'Form not found' });
            await prisma.applicationForm.delete({ where: { id: formId } });
            return { success: true };
        }
    );

    // ── Submissions ────────────────────────────────────────────────

    /** Submit an application. Enforces open state, blacklist, pending-dup, cooldown. */
    app.post<{ Params: { guildId: string; formId: string }; Body: { userId: string; answers: { question: string; answer: string }[] } }>(
        '/guilds/:guildId/applications/forms/:formId/submit',
        async (req, reply) => {
            const { guildId, formId } = req.params;
            const { userId, answers } = req.body ?? {};

            if (!userId) return reply.code(400).send({ success: false, error: 'userId required' });

            const form = await prisma.applicationForm.findFirst({ where: { id: formId, guildId } });
            if (!form) return reply.code(404).send({ success: false, error: 'Form not found' });
            if (!form.isOpen) return reply.code(400).send({ success: false, error: 'This application is closed', code: 'CLOSED' });

            const blacklisted = await prisma.applicationBlacklist.findUnique({
                where: { guildId_userId: { guildId, userId } },
            });
            if (blacklisted) {
                return reply.code(403).send({
                    success: false,
                    error: `You are blacklisted from applying${blacklisted.reason ? `: ${blacklisted.reason}` : ''}`,
                    code: 'BLACKLISTED',
                });
            }

            const pending = await prisma.applicationSubmission.findFirst({
                where: { formId, userId, status: 'pending' },
            });
            if (pending) {
                return reply.code(400).send({ success: false, error: 'You already have a pending application for this form', code: 'PENDING_EXISTS' });
            }

            if (form.cooldownHours > 0) {
                const last = await prisma.applicationSubmission.findFirst({
                    where: { formId, userId },
                    orderBy: { createdAt: 'desc' },
                });
                if (last) {
                    const waitMs = form.cooldownHours * 3600_000;
                    const elapsed = Date.now() - last.createdAt.getTime();
                    if (elapsed < waitMs) {
                        const hoursLeft = Math.ceil((waitMs - elapsed) / 3600_000);
                        return reply.code(400).send({
                            success: false,
                            error: `You can apply again in ~${hoursLeft}h`,
                            code: 'COOLDOWN',
                        });
                    }
                }
            }

            await ensureGuild(guildId);
            const submission = await prisma.applicationSubmission.create({
                data: { formId, guildId, userId, answers: (answers ?? []) as any },
            });
            return { success: true, data: { submission } };
        }
    );

    /** List submissions (filterable by status/user). */
    app.get<{ Params: { guildId: string }; Querystring: { status?: string; userId?: string; formId?: string } }>(
        '/guilds/:guildId/applications/submissions',
        async (req) => {
            const { status, userId, formId } = req.query;
            const where: any = { guildId: req.params.guildId };
            if (status) where.status = status;
            if (userId) where.userId = userId;
            if (formId) where.formId = formId;
            const submissions = await prisma.applicationSubmission.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: 50,
                include: { form: { select: { name: true } } },
            });
            return { success: true, data: { submissions } };
        }
    );

    /** Submission detail. */
    app.get<{ Params: { guildId: string; subId: string } }>(
        '/guilds/:guildId/applications/submissions/:subId',
        async (req, reply) => {
            const sub = await prisma.applicationSubmission.findFirst({
                where: { id: req.params.subId, guildId: req.params.guildId },
                include: { form: true },
            });
            if (!sub) return reply.code(404).send({ success: false, error: 'Submission not found' });
            return { success: true, data: { submission: sub } };
        }
    );

    /** Review action: accept / deny / withdraw (own). */
    app.post<{ Params: { guildId: string; subId: string }; Body: { reviewerId: string; action: 'accept' | 'deny' | 'withdraw'; reason?: string } }>(
        '/guilds/:guildId/applications/submissions/:subId/review',
        async (req, reply) => {
            const { guildId, subId } = req.params;
            const { reviewerId, action, reason } = req.body ?? {};

            if (!reviewerId || !['accept', 'deny', 'withdraw'].includes(action)) {
                return reply.code(400).send({ success: false, error: 'reviewerId and action (accept|deny|withdraw) required' });
            }

            const sub = await prisma.applicationSubmission.findFirst({
                where: { id: subId, guildId },
                include: { form: true },
            });
            if (!sub) return reply.code(404).send({ success: false, error: 'Submission not found' });
            if (sub.status !== 'pending') {
                return reply.code(400).send({ success: false, error: `Application already ${sub.status}`, code: 'ALREADY_REVIEWED' });
            }
            if (action === 'withdraw' && sub.userId !== reviewerId) {
                return reply.code(403).send({ success: false, error: 'You can only withdraw your own application' });
            }

            const status = action === 'accept' ? 'accepted' : action === 'deny' ? 'denied' : 'withdrawn';
            const updated = await prisma.applicationSubmission.update({
                where: { id: subId },
                data: {
                    status,
                    reviewerId: action === 'withdraw' ? null : reviewerId,
                    reason: reason ?? null,
                    reviewedAt: action === 'withdraw' ? null : new Date(),
                },
                include: { form: true },
            });
            return { success: true, data: { submission: updated } };
        }
    );

    /** Stats per form. */
    app.get<{ Params: { guildId: string } }>('/guilds/:guildId/applications/stats', async (req) => {
        const { guildId } = req.params;
        const [byStatus, forms] = await Promise.all([
            prisma.applicationSubmission.groupBy({
                by: ['status'],
                where: { guildId },
                _count: true,
            }),
            prisma.applicationForm.findMany({ where: { guildId }, select: { id: true, name: true, isOpen: true } }),
        ]);
        const counts = Object.fromEntries(byStatus.map(s => [s.status, s._count]));
        return { success: true, data: { counts, forms } };
    });

    // ── Blacklist ──────────────────────────────────────────────────

    app.get<{ Params: { guildId: string } }>('/guilds/:guildId/applications/blacklist', async (req) => {
        const rows = await prisma.applicationBlacklist.findMany({
            where: { guildId: req.params.guildId },
            orderBy: { createdAt: 'desc' },
        });
        return { success: true, data: { blacklist: rows } };
    });

    app.post<{ Params: { guildId: string }; Body: { userId: string; reason?: string } }>(
        '/guilds/:guildId/applications/blacklist',
        async (req, reply) => {
            const { guildId } = req.params;
            const { userId, reason } = req.body ?? {};
            if (!userId) return reply.code(400).send({ success: false, error: 'userId required' });
            await ensureGuild(guildId);
            const entry = await prisma.applicationBlacklist.upsert({
                where: { guildId_userId: { guildId, userId } },
                create: { guildId, userId, reason: reason ?? null },
                update: { reason: reason ?? null },
            });
            return { success: true, data: { entry } };
        }
    );

    app.delete<{ Params: { guildId: string; userId: string } }>(
        '/guilds/:guildId/applications/blacklist/:userId',
        async (req, reply) => {
            const { guildId, userId } = req.params;
            const existing = await prisma.applicationBlacklist.findUnique({
                where: { guildId_userId: { guildId, userId } },
            });
            if (!existing) return reply.code(404).send({ success: false, error: 'User not blacklisted' });
            await prisma.applicationBlacklist.delete({ where: { id: existing.id } });
            return { success: true };
        }
    );
}
