/**
 * Context Command
 *
 * Analyze a piece of text - meaning, tone, sentiment, key points.
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '../../types/command';
import { aiAsk } from '../../utils/ai';

export const context: Command = {
    data: new SlashCommandBuilder()
        .setName('context')
        .setDescription('Analyze the context and meaning of text')
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('text').setDescription('Text to analyze').setRequired(true).setMaxLength(2000)
        ),
    category: 'ai',

    async execute(interaction) {
        if (!interaction.guild) return;

        const text = interaction.options.getString('text', true);
        await interaction.deferReply();

        try {
            const answer = await aiAsk(
                `Analyze this text. Cover: main meaning/intent, tone (formal/casual/aggressive/etc.), sentiment (positive/negative/neutral), and any key context a reader should know. Keep it structured and concise.`,
                text
            );

            const embed = new EmbedBuilder()
                .setColor(0x9b59b6)
                .setTitle('� Context Analysis')
                .setDescription(answer.slice(0, 4000))
                .addFields({ name: 'Analyzed text', value: `> ${text.slice(0, 500)}` })
                .setFooter({ text: `Requested by ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error: any) {
            console.error('context error:', error);
            await interaction.editReply({ content: `❌ Analysis failed: ${error.message ?? 'Unknown error'}` });
        }
    },
};
