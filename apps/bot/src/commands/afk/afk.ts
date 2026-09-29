/**
 * AFK Command
 *
 * /afk set [reason]   - mark yourself AFK (auto-clears on your next message)
 * /afk remove         - clear your AFK status
 * /afk status [user]  - check if someone is AFK
 */

import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command';
import { apiClient } from '../../utils/api-client';
import { getAdminRoleId } from '../../utils/admin-role';

function timeAgo(date: string | Date): string {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

export const afk: Command = {
    data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('Manage your AFK status')
        .setDMPermission(false)
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Set your AFK status')
                .addStringOption(o =>
                    o.setName('reason').setDescription('Why are you AFK?').setRequired(false).setMaxLength(200)
                )
        )
        .addSubcommand(sub =>
            sub.setName('remove').setDescription('Clear your AFK status')
        )
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Check AFK status (defaults to you)')
                .addUserOption(o => o.setName('user').setDescription('User to check').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('list').setDescription('List all AFK members in this server (staff)')
        ),
    category: 'afk',

    async execute(interaction) {
        if (!interaction.guild) return;

        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            if (sub === 'set') {
                const reason = interaction.options.getString('reason') ?? 'AFK';
                await apiClient.put(`/guilds/${guildId}/afk/${userId}`, { reason });

                const embed = new EmbedBuilder()
                    .setColor(0xfee75c)
                    .setTitle('� You are now AFK')
                    .setDescription(`**Reason:** ${reason}`)
                    .setFooter({ text: 'Send any message to automatically remove your AFK status' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } else if (sub === 'remove') {
                await apiClient.delete(`/guilds/${guildId}/afk/${userId}`);
                await interaction.editReply({ content: '✅ Your AFK status has been removed. Welcome back!' });
            } else if (sub === 'status') {
                const target = interaction.options.getUser('user') ?? interaction.user;
                const res = await apiClient.get<{ data: { afk: { reason: string; since: string } | null } }>(
                    `/guilds/${guildId}/afk/${target.id}`
                );

                const afk = res.data?.afk;
                if (!afk) {
                    await interaction.editReply({ content: `✅ ${target.id === userId ? 'You are' : `**${target.tag}** is`} not AFK.` });
                    return;
                }

                const embed = new EmbedBuilder()
                    .setColor(0xfee75c)
                    .setTitle('💤 AFK Status')
                    .setDescription(`**${target.tag}** is AFK`)
                    .addFields(
                        { name: 'Reason', value: afk.reason, inline: true },
                        { name: 'Since', value: timeAgo(afk.since), inline: true },
                    )
                    .setThumbnail(target.displayAvatarURL())
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } else if (sub === 'list') {
                // Staff-only: ManageMessages or the configured admin role
                const hasPerm = interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) ?? false;
                if (!hasPerm) {
                    const adminRoleId = await getAdminRoleId(guildId);
                    const memberRoles = (interaction.member as any)?.roles;
                    const hasAdminRole = adminRoleId
                        ? (memberRoles?.cache?.has?.(adminRoleId) ?? (Array.isArray(memberRoles) && memberRoles.includes(adminRoleId)))
                        : false;
                    if (!hasAdminRole) {
                        await interaction.editReply({ content: '❌ Only staff can view the AFK list.' });
                        return;
                    }
                }

                const res = await apiClient.get<{ data: { afkUsers: Array<{ userId: string; reason: string; since: string }> } }>(
                    `/guilds/${guildId}/afk`
                );
                const list = res.data?.afkUsers ?? [];

                if (list.length === 0) {
                    await interaction.editReply({ content: '✅ Nobody is AFK right now.' });
                    return;
                }

                const lines = list.map(a => `<@${a.userId}> - ${a.reason} *(${timeAgo(a.since)})*`);
                const embed = new EmbedBuilder()
                    .setColor(0xfee75c)
                    .setTitle(`💤 AFK Members (${list.length})`)
                    .setDescription(lines.join('\n').slice(0, 4000))
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            }
        } catch (error: any) {
            console.error('afk command error:', error);
            await interaction.editReply({
                content: `❌ Something went wrong: ${error.response?.data?.error ?? error.message ?? 'Unknown error'}`,
            });
        }
    },
};
