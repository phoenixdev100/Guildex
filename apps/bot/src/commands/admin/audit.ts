/**
 * Audit Command
 *
 * View recent audit-log entries - who did what in the server.
 */

import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags, AuditLogEvent } from 'discord.js';
import type { Command } from '../../types/command';

const ACTION_NAMES: Record<number, string> = {
    [AuditLogEvent.MemberKick]: 'Member Kick',
    [AuditLogEvent.MemberBanAdd]: 'Ban',
    [AuditLogEvent.MemberBanRemove]: 'Unban',
    [AuditLogEvent.ChannelCreate]: 'Channel Create',
    [AuditLogEvent.ChannelDelete]: 'Channel Delete',
    [AuditLogEvent.RoleCreate]: 'Role Create',
    [AuditLogEvent.RoleDelete]: 'Role Delete',
    [AuditLogEvent.MessageDelete]: 'Message Delete',
    [AuditLogEvent.MemberUpdate]: 'Member Update',
    [AuditLogEvent.EmojiCreate]: 'Emoji Create',
    [AuditLogEvent.EmojiDelete]: 'Emoji Delete',
};

export const audit: Command = {
    data: new SlashCommandBuilder()
        .setName('audit')
        .setDescription('View recent server audit log entries')
        .setDMPermission(false)
        .addStringOption(o =>
            o.setName('action').setDescription('Filter by action type').setRequired(false)
                .addChoices(
                    { name: 'Bans', value: 'ban' },
                    { name: 'Kicks', value: 'kick' },
                    { name: 'Channel changes', value: 'channel' },
                    { name: 'Role changes', value: 'role' },
                    { name: 'Message deletes', value: 'message' },
                )
        ),
    requiredPermission: PermissionFlagsBits.ViewAuditLog,
    category: 'admin',

    async execute(interaction) {
        if (!interaction.guild) return;

        const filter = interaction.options.getString('action');
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const typeMap: Record<string, AuditLogEvent[]> = {
            ban: [AuditLogEvent.MemberBanAdd, AuditLogEvent.MemberBanRemove],
            kick: [AuditLogEvent.MemberKick],
            channel: [AuditLogEvent.ChannelCreate, AuditLogEvent.ChannelDelete, AuditLogEvent.ChannelUpdate],
            role: [AuditLogEvent.RoleCreate, AuditLogEvent.RoleDelete, AuditLogEvent.RoleUpdate],
            message: [AuditLogEvent.MessageDelete, AuditLogEvent.MessageBulkDelete],
        };

        try {
            const me = interaction.guild.members.me ?? await interaction.guild.members.fetchMe();
            if (!me.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
                await interaction.editReply({ content: '❌ I need the **View Audit Log** permission.' });
                return;
            }

            const types = filter ? typeMap[filter] : undefined;
            const entries = await interaction.guild.fetchAuditLogs({ limit: 25 });
            let list = [...entries.entries.values()];
            if (types) list = list.filter(e => types.includes(e.action));
            list = list.slice(0, 12);

            const lines = list.map(e => {
                const action = ACTION_NAMES[e.action] ?? AuditLogEvent[e.action] ?? `Action ${e.action}`;
                const executor = e.executor?.tag ?? 'Unknown';
                const target = (e.target as any)?.tag ?? (e.target as any)?.name ?? e.targetId ?? 'N/A';
                const when = `<t:${Math.floor(e.createdTimestamp / 1000)}:R>`;
                return `**${action}** - ${executor} → ${target} • ${when}`;
            });

            const embed = new EmbedBuilder()
                .setColor(0x5865f2)
                .setTitle('📋 Recent Audit Log')
                .setDescription(lines.join('\n') || 'No matching entries found.')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error: any) {
            console.error('audit error:', error);
            await interaction.editReply({ content: `❌ Failed to fetch audit log: ${error.message ?? 'Unknown error'}` });
        }
    },
};
