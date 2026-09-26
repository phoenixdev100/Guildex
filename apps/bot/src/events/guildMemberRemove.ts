/**
 * Guild Member Remove Event Handler
 *
 * Tracks member leaves for analytics.
 */

import type { GuildMember, PartialGuildMember } from 'discord.js';
import type { BotClient } from '../client';
import { trackLeave } from '../utils/analytics';

export async function handleGuildMemberRemove(
    _client: BotClient,
    member: GuildMember | PartialGuildMember
): Promise<void> {
    trackLeave(member.guild.id);
}
