/**
 * Heatmap Command
 *
 * Activity heatmap - messages grouped by day of week,
 * rendered as an intensity map. Helps spot peak activity days.
 */

import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command';
import { apiClient } from '../../utils/api-client';

interface DailyRow { date: string; joins: number; leaves: number; messages: number; commands: number }

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const INTENSITY = ['⬛', '🟦', '🟩', '🟨', '🟧', '🟥'];

function intensityCell(value: number, max: number): string {
    if (value === 0) return INTENSITY[0];
    const idx = Math.min(INTENSITY.length - 1, Math.ceil((value / max) * INTENSITY.length) - 1);
    return INTENSITY[Math.max(1, idx)];
}

export const heatmap: Command = {
    data: new SlashCommandBuilder()
        .setName('heatmap')
        .setDescription('Activity heatmap - busiest days of the week')
        .setDMPermission(false)
        .addIntegerOption(o =>
            o.setName('days').setDescription('Days of history (7-90, default 30)').setMinValue(7).setMaxValue(90)),
    category: 'analytics',

    async execute(interaction) {
        if (!interaction.guild) return;
        const days = interaction.options.getInteger('days') ?? 30;

        await interaction.deferReply();

        try {
            const res = await apiClient.get<{ data: { daily: DailyRow[] } }>(
                `/guilds/${interaction.guild.id}/analytics?days=${days}`
            );
            const daily = res.data.daily ?? [];

            if (!daily.length) {
                await interaction.editReply('🗺️ No activity data yet - the heatmap fills in as the bot tracks messages.');
                return;
            }

            // Aggregate messages by weekday (getUTCDay: 0=Sun → rotate to Mon-first)
            const byDay = new Array(7).fill(0);
            for (const d of daily) {
                const wd = (new Date(d.date + 'T00:00:00Z').getUTCDay() + 6) % 7; // Mon=0
                byDay[wd] += d.messages;
            }
            const max = Math.max(...byDay, 1);
            const busiest = byDay.indexOf(Math.max(...byDay));
            const total = byDay.reduce((a: number, b: number) => a + b, 0);

            const grid = WEEKDAYS.map((name, i) =>
                `${name} ${intensityCell(byDay[i], max)} **${byDay[i].toLocaleString()}**`
            ).join('\n');

            const embed = new EmbedBuilder()
                .setColor('#FF6B35')
                .setTitle(`�️ Activity Heatmap - ${interaction.guild.name}`)
                .setDescription(grid)
                .addFields(
                    { name: '🔥 Busiest day', value: WEEKDAYS[busiest], inline: true },
                    { name: '💬 Total messages', value: total.toLocaleString(), inline: true },
                    { name: '📅 Window', value: `${daily.length} days tracked`, inline: true },
                )
                .setFooter({ text: '⬛ none  🟦 quiet  🟩 moderate  🟨 busy  🟧 very busy  🟥 peak' });

            await interaction.editReply({ embeds: [embed] });
        } catch (error: any) {
            console.error('heatmap command error:', error);
            const msg = '❌ Could not load analytics - the API may be unreachable.';
            if (interaction.deferred || interaction.replied) await interaction.editReply(msg).catch(() => {});
            else await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    }
};
