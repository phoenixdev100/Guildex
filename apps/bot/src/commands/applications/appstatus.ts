/**
 * AppStatus Command
 *
 * View your own application submissions + withdraw a pending one.
 */

import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { Command } from '../../types/command';
import { apiClient } from '../../utils/api-client';
import type { AppSubmission } from '../../utils/application-flow';

const STATUS_ICON: Record<string, string> = {
    pending: '🟡 Pending', accepted: '🟢 Accepted', denied: '🔴 Denied', withdrawn: '⚪ Withdrawn',
};

export const appstatus: Command = {
    data: new SlashCommandBuilder()
        .setName('appstatus')
        .setDescription('Check the status of your applications')
        .setDMPermission(false),
    category: 'applications',

    async execute(interaction) {
        if (!interaction.guild) return;
        await interaction.deferReply({ ephemeral: true });

        try {
            const res = await apiClient.get<{ data: { submissions: AppSubmission[] } }>(
                `/guilds/${interaction.guild.id}/applications/submissions?userId=${interaction.user.id}`
            );
            const subs = res.data.submissions ?? [];

            if (subs.length === 0) {
                await interaction.editReply('📝 You haven\'t submitted any applications yet. Use `/apply` to start one.');
                return;
            }

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('📋 Your Applications')
                .setDescription(subs.slice(0, 10).map(s =>
                    `${STATUS_ICON[s.status] ?? s.status} **${(s as any).form?.name ?? 'Form'}**\n` +
                    `Submitted <t:${Math.floor(new Date(s.createdAt).getTime() / 1000)}:R>` +
                    (s.reason ? ` - *${s.reason}*` : '')
                ).join('\n\n'));

            const pending = subs.find(s => s.status === 'pending');
            const components = pending
                ? [new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`app_withdraw_${pending.id}`)
                        .setLabel('Withdraw pending application')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('↩️')
                )]
                : [];

            await interaction.editReply({ embeds: [embed], components });
        } catch (error: any) {
            console.error('appstatus command error:', error);
            await interaction.editReply('❌ Could not load your applications - the API may be unreachable.').catch(() => {});
        }
    }
};
