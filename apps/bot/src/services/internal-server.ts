/**
 * Internal HTTP Server
 *
 * Tiny listener for direct API→bot calls that need instant execution
 * (the action queue is polled every 30s - this is the fast path for
 * things like admin "remove bot from server").
 *
 * Auth: same INTERNAL_API_KEY the bot already uses to call the API.
 * Only loopback/private-network callers should reach this port - it
 * is never exposed publicly (compose keeps it on the frontend net).
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import type { BotClient } from '../client';
import logger from '../config/logger';
import { env } from '../config/env';
import { apiClient } from '../utils/api-client';

function send(res: ServerResponse, status: number, body: unknown): void {
    const json = JSON.stringify(body);
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(json);
}

function authorized(req: IncomingMessage): boolean {
    return !!env.INTERNAL_API_KEY && req.headers['x-api-key'] === env.INTERNAL_API_KEY;
}

async function handleLeave(client: BotClient, guildId: string, res: ServerResponse): Promise<void> {
    const guild =
        client.guilds.cache.get(guildId)
        ?? await client.guilds.fetch(guildId).catch(() => null);

    if (!guild) {
        // Bot is not in the guild - goal already met, but the DB row may
        // still be marked active (bot left while offline/manual kick).
        await apiClient.unregisterGuild(guildId).catch(() => undefined);
        return send(res, 200, { success: true, left: true, already: true });
    }

    await guild.leave(); // fires guildDelete → unregisters via API
    // Belt & suspenders: mark inactive directly in case the event path lags.
    await apiClient.unregisterGuild(guildId).catch(() => undefined);
    logger.info(`🚪 Left guild ${guild.name} (${guild.id}) via instant API call`);
    send(res, 200, { success: true, left: true });
}

export function startInternalServer(client: BotClient): void {
    const port = env.BOT_INTERNAL_PORT;

    const server = createServer((req, res) => {
        void (async () => {
            try {
                if (!authorized(req)) {
                    return send(res, 401, { error: 'Unauthorized' });
                }

                const leaveMatch = req.method === 'POST' && req.url?.match(/^\/internal\/guilds\/(\d+)\/leave$/);
                if (leaveMatch) {
                    return await handleLeave(client, leaveMatch[1], res);
                }

                if (req.method === 'GET' && req.url === '/internal/health') {
                    return send(res, 200, { ok: true, guilds: client.guilds.cache.size });
                }

                send(res, 404, { error: 'Not found' });
            } catch (error) {
                logger.warn({ error, url: req.url }, 'Internal request failed');
                send(res, 500, { error: 'Internal error' });
            }
        })();
    });

    server.listen(port, () => {
        logger.info(`🔒 Internal server listening on port ${port}`);
    });
    server.unref();
}
