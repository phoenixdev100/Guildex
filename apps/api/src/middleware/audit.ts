/**
 * Audit Logging Middleware
 * 
 * Automatically logs all administrative actions.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { auditLogService } from '../services/audit-log';

/**
 * Actions that should be audited
 */
const AUDITED_ACTIONS = new Set([
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
]);

/**
 * Routes that should be excluded from auditing
 */
const EXCLUDED_ROUTES = new Set([
    '/api/auth/login',
    '/api/auth/callback',
    '/api/auth/logout',
    '/api/health',
]);

/**
 * Extract guild ID from request
 */
function extractGuildId(request: FastifyRequest): string | null {
    // Try params first
    const params = request.params as any;
    if (params?.guildId) return params.guildId;

    // Try body
    const body = request.body as any;
    if (body?.guildId) return body.guildId;

    // Try query
    const query = request.query as any;
    if (query?.guildId) return query.guildId;

    return null;
}

/**
 * Extract resource from route path
 */
function extractResource(path: string): string {
    // Remove /api/ prefix and extract resource
    const parts = path.replace('/api/', '').split('/');
    return parts[0] || 'unknown';
}

/**
 * Audit logging middleware.
 *
 * Registered on the `onResponse` hook so it runs after authentication
 * and the route handler - request.user and the final status code are
 * both available at that point.
 */
export async function auditLog(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    // Skip if not an audited action
    if (!AUDITED_ACTIONS.has(request.method)) {
        return;
    }

    // Skip excluded routes
    if (EXCLUDED_ROUTES.has(request.url.split('?')[0])) {
        return;
    }

    // Skip if no user (internal service calls are not user actions)
    if (!request.user) {
        return;
    }

    const guildId = extractGuildId(request);

    // Skip if no guild ID (system-level actions are audited separately)
    if (!guildId) {
        return;
    }

    // Only log successful requests (2xx status codes)
    if (reply.statusCode < 200 || reply.statusCode >= 300) {
        return;
    }

    const resource = extractResource(request.url);
    const action = `${resource}.${request.method.toLowerCase()}`;

    // Log asynchronously without blocking the response
    auditLogService.log({
        guildId,
        userId: request.user.id,
        action,
        resource,
        resourceId: (request.params as any)?.id,
        metadata: {
            method: request.method,
            path: request.url,
            statusCode: reply.statusCode,
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
    }).catch((error) => {
        request.log.error({ error }, 'Failed to create audit log');
    });
}
