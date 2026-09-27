/**
 * Personality Command
 *
 * Set the personality the AI uses when chatting with you.
 */

import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command';
import { getMemory, personalityKeys } from '../../utils/ai';

export const personality: Command = {
    data: new SlashCommandBuilder()
        .setName('personality')
        .setDescription('Set your AI chat personality')
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('type').setDescription('Personality type').setRequired(true)
                .addChoices(...personalityKeys().map(k => ({ name: k[0].toUpperCase() + k.slice(1), value: k })))
        ),
    category: 'ai',

    async execute(interaction) {
        if (!interaction.guild) return;

        const type = interaction.options.getString('type', true);

        try {
            getMemory(interaction.user.id).personality = type;

            const previews: Record<string, string> = {
                default: 'Balanced, helpful, friendly.',
                professional: 'Formal, precise, structured.',
                casual: 'Chill and relaxed, like a friend.',
                funny: 'Witty — answers with humor.',
                roast: 'Playfully roasts you while answering.',
            };

            await interaction.reply({
                content: `🎭 Personality set to **${type}** — ${previews[type] ?? ''}\nTry it with \`/ai chat\`.`,
                flags: MessageFlags.Ephemeral,
            });
        } catch (error: any) {
            console.error('personality command error:', error);
            const content = '❌ Something went wrong setting your personality.';
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    },
};
