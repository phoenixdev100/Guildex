/**
 * Toxicity Command
 *
 * Score how toxic a piece of text is (0-100).
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '../../types/command';
import { aiToxicity } from '../../utils/ai';

export const toxicity: Command = {
    data: new SlashCommandBuilder()
        .setName('toxicity')
        .setDescription('Score text toxicity (0-100)')
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('text').setDescription('Text to score').setRequired(true).setMaxLength(1000)
        ),
    category: 'ai',

    async execute(interaction) {
        if (!interaction.guild) return;

        const text = interaction.options.getString('text', true);
        await interaction.deferReply();

        try {
            const { score, label } = await aiToxicity(text);
            const bars = Math.round(score / 10);
            const meter = '█'.repeat(bars) + '░'.repeat(10 - bars);

            const embed = new EmbedBuilder()
                .setColor(score >= 70 ? 0xed4245 : score >= 40 ? 0xfee75c : 0x57f287)
                .setTitle('🧪 Toxicity Score')
                .setDescription(`**${score}/100** - ${label}\n\`${meter}\``)
                .addFields({ name: 'Text', value: `> ${text.slice(0, 500)}` })
                .setFooter({ text: `Requested by ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error: any) {
            console.error('toxicity error:', error);
            await interaction.editReply({ content: `❌ Toxicity check failed: ${error.message ?? 'Unknown error'}` });
        }
    },
};
