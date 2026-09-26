/**
 * Guild Member Add Event Handler
 *
 * Assigns configured autoroles to new members.
 */

import type { GuildMember } from 'discord.js';
import type { BotClient } from '../client';
import logger from '../config/logger';
import { apiClient } from '../utils/api-client';
import { trackJoin } from '../utils/analytics';

interface AutorolesResponse {
    success?: boolean;
    data?: { autoroles?: { roleId: string }[] };
}

export async function handleGuildMemberAdd(
    _client: BotClient,
    member: GuildMember
): Promise<void> {
    try {
        trackJoin(member.guild.id);
        const response = await apiClient.get<AutorolesResponse>(
            `/guilds/${member.guild.id}/autoroles`
        );

        const autoroles = response.data?.autoroles ?? [];
        if (autoroles.length === 0) return;

        for (const { roleId } of autoroles) {
            const role = member.guild.roles.cache.get(roleId);
            if (!role) continue;

            try {
                await member.roles.add(role, 'Autorole');
            } catch (error) {
                logger.warn({ error, roleId, memberId: member.id }, 'Failed to assign autorole');
            }
        }
    } catch (error) {
        logger.debug({ error, guildId: member.guild.id }, 'Autorole lookup failed');
    }
}
