/**
 * AIModerate Command
 *
 * AI-powered moderation check - is this text safe to post?
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '../../types/command';
import { aiModerate } from '../../utils/ai';

export const moderate: Command = {
    data: new SlashCommandBuilder()
        .setName('aimoderate')
        .setDescription('Check if text is safe (AI moderation)')
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('text').setDescription('Text to moderate').setRequired(true).setMaxLength(1000)
        ),
    category: 'ai',

    async execute(interaction) {
        if (!interaction.guild) return;

        const text = interaction.options.getString('text', true);
        await interaction.deferReply();

        try {
            const { verdict, details } = await aiModerate(text);

            const colors: Record<string, number> = { SAFE: 0x57f287, WARN: 0xfee75c, UNSAFE: 0xed4245 };
            const icons: Record<string, string> = { SAFE: '✅', WARN: '⚠️', UNSAFE: '🚫' };

            const embed = new EmbedBuilder()
                .setColor(colors[verdict] ?? 0xfee75c)
                .setTitle(`${icons[verdict] ?? '⚠️'} Moderation: ${verdict}`)
                .setDescription(details)
                .addFields({ name: 'Checked text', value: `> ${text.slice(0, 500)}` })
                .setFooter({ text: `Requested by ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error: any) {
            console.error('aimoderate error:', error);
            await interaction.editReply({ content: `❌ Moderation check failed: ${error.message ?? 'Unknown error'}` });
        }
    },
};
