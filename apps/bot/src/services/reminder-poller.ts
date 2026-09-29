/**
 * Reminder Poller
 *
 * Periodically fetches due reminders from the API and delivers them
 * to the channel where they were created. Replaces in-process
 * setTimeout delivery so reminders survive restarts and work for
 * any duration.
 */

import { ChannelType } from 'discord.js';
import type { BotClient } from '../client';
import logger from '../config/logger';
import { apiClient } from '../utils/api-client';

interface PendingReminder {
    id: string;
    userId: string;
    message: string;
    remindAt: string;
    channelId: string;
    guildId?: string | null;
}

const POLL_INTERVAL_MS = 30_000; // 30 seconds

async function deliverReminder(client: BotClient, reminder: PendingReminder): Promise<void> {
    const channel = await client.channels.fetch(reminder.channelId).catch(() => null);

    if (channel && (channel.type === ChannelType.GuildText || channel.type === ChannelType.DM)) {
        await channel.send({
            content: `<@${reminder.userId}> ⏰ **Reminder:** ${reminder.message}`,
        });
    }

    await apiClient.patch(
        `/users/${reminder.userId}/reminders/${reminder.id}/complete`
    );
}

async function pollReminders(client: BotClient): Promise<void> {
    const reminders = await apiClient.get<PendingReminder[]>('/reminders/pending');

    for (const reminder of reminders) {
        try {
            await deliverReminder(client, reminder);
        } catch (error) {
            logger.warn({ error, reminderId: reminder.id }, 'Failed to deliver reminder');
        }
    }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startReminderPoller(client: BotClient): void {
    if (intervalHandle) return;
    logger.info(`⏰ Reminder poller started (every ${POLL_INTERVAL_MS / 1000}s)`);

    const tick = async () => {
        try {
            await pollReminders(client);
        } catch (error) {
            // API down or other failure - try again next tick
            logger.debug({ error }, 'Reminder poll failed');
        }
    };

    // Run immediately, then on the interval
    void tick();
    intervalHandle = setInterval(tick, POLL_INTERVAL_MS);
    intervalHandle.unref(); // never keep the process alive just for polling
}

export function stopReminderPoller(): void {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
    }
}
