/**
 * Buffered analytics tracker.
 * Counters accumulate in memory and flush to the API every 30s
 * (and once on shutdown) so high-volume events don't hammer it.
 */

import { apiClient } from './api-client';
import { logger } from '../config/logger';

interface GuildCounters {
    joins: number;
    leaves: number;
    messages: number;
    commands: number;
    channels: Map<string, number>;
    commandCounts: Map<string, number>;
    users: Map<string, { messages: number; commands: number }>;
}

const pending = new Map<string, GuildCounters>();
let timer: NodeJS.Timeout | null = null;

function bucket(guildId: string): GuildCounters {
    let g = pending.get(guildId);
    if (!g) {
        g = { joins: 0, leaves: 0, messages: 0, commands: 0, channels: new Map(), commandCounts: new Map(), users: new Map() };
        pending.set(guildId, g);
    }
    return g;
}

export function trackMessage(guildId: string, channelId: string, userId: string): void {
    const g = bucket(guildId);
    g.messages++;
    g.channels.set(channelId, (g.channels.get(channelId) ?? 0) + 1);
    const u = g.users.get(userId) ?? { messages: 0, commands: 0 };
    u.messages++;
    g.users.set(userId, u);
}

export function trackCommand(guildId: string, commandName: string, userId: string): void {
    const g = bucket(guildId);
    g.commands++;
    g.commandCounts.set(commandName, (g.commandCounts.get(commandName) ?? 0) + 1);
    const u = g.users.get(userId) ?? { messages: 0, commands: 0 };
    u.commands++;
    g.users.set(userId, u);
}

export function trackJoin(guildId: string): void {
    bucket(guildId).joins++;
}

export function trackLeave(guildId: string): void {
    bucket(guildId).leaves++;
}

export async function flushAnalytics(): Promise<void> {
    if (pending.size === 0) return;
    const batch = new Map(pending);
    pending.clear();

    await Promise.allSettled(
        [...batch.entries()].map(([guildId, g]) =>
            apiClient.post('/analytics/flush', {
                guildId,
                joins: g.joins,
                leaves: g.leaves,
                messages: g.messages,
                commands: g.commands,
                channels: Object.fromEntries(g.channels),
                commandCounts: Object.fromEntries(g.commandCounts),
                users: Object.fromEntries(g.users),
            })
        )
    ).then((results) => {
        results.forEach((r, i) => {
            if (r.status === 'rejected') {
                logger.warn(`Analytics flush failed for guild ${[...batch.keys()][i]}: ${r.reason?.message ?? r.reason}`);
            }
        });
    });
}

export function startAnalyticsFlusher(): void {
    if (timer) return;
    timer = setInterval(() => { flushAnalytics().catch(() => {}); }, 30_000);
    timer.unref();
    logger.info('Analytics tracker started (30s flush interval)');
}
