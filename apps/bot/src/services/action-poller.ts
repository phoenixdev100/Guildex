/**
 * Bot Action Poller
 *
 * Polls the API's bot-action queue and executes Discord-side work that
 * only the bot can do (guild.leave(), future channel/role ops). Same
 * pattern as the reminder poller: API is the queue, bot is the executor.
 *
 * LEAVE_GUILD: triggered from the owner admin panel. guild.leave()
 * fires guildDelete, which unregisters the guild via the API - so the
 * dashboard/admin views update automatically.
 */

import type { BotClient } from '../client';
import logger from '../config/logger';
import { apiClient } from '../utils/api-client';

interface PendingAction {
    id: string;
    type: string;
    guildId: string;
    createdAt: string;
}

const POLL_INTERVAL_MS = 30_000; // 30 seconds

async function executeAction(client: BotClient, action: PendingAction): Promise<void> {
    switch (action.type) {
        case 'LEAVE_GUILD': {
            const guild =
                client.guilds.cache.get(action.guildId)
                ?? await client.guilds.fetch(action.guildId).catch(() => null);

            if (!guild) {
                // Bot is not in the guild - the goal is already met, but the
                // DB row may still be marked active (bot left while offline
                // or was kicked manually). Unregister before completing.
                await apiClient.unregisterGuild(action.guildId).catch(() => undefined);
                await apiClient.post(`/bot-actions/${action.id}/complete`, { status: 'completed' });
                return;
            }

            await guild.leave();
            // Belt & suspenders alongside the guildDelete → unregister path.
            await apiClient.unregisterGuild(action.guildId).catch(() => undefined);
            await apiClient.post(`/bot-actions/${action.id}/complete`, { status: 'completed' });
            logger.info(`🚪 Left guild ${guild.name} (${guild.id}) via admin action`);
            return;
        }
        default:
            logger.warn({ type: action.type }, 'Unknown bot action type - skipping');
            await apiClient.post(`/bot-actions/${action.id}/complete`, {
                status: 'failed',
                error: `unknown action type: ${action.type}`,
            });
    }
}

async function pollActions(client: BotClient): Promise<void> {
    const actions = await apiClient.get<PendingAction[]>('/bot-actions/pending');

    for (const action of actions) {
        try {
            await executeAction(client, action);
        } catch (error) {
            logger.warn({ error, actionId: action.id, type: action.type }, 'Bot action failed');
            await apiClient
                .post(`/bot-actions/${action.id}/complete`, {
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'unknown error',
                })
                .catch(() => undefined);
        }
    }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startActionPoller(client: BotClient): void {
    if (intervalHandle) return;
    logger.info(`⚙️  Bot action poller started (every ${POLL_INTERVAL_MS / 1000}s)`);

    const tick = async () => {
        try {
            await pollActions(client);
        } catch (error) {
            logger.debug({ error }, 'Action poll failed');
        }
    };

    void tick();
    intervalHandle = setInterval(tick, POLL_INTERVAL_MS);
    intervalHandle.unref();
}

export function stopActionPoller(): void {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
    }
}
