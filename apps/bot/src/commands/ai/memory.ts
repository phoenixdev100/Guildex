/**
 * Memory Command
 *
 * Per-user AI memory for /ai chat - remembers your conversation
 * so follow-ups have context. In-memory (resets on bot restart).
 */

import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command';
import { getMemory, clearMemory } from '../../utils/ai';

export const memory: Command = {
    data: new SlashCommandBuilder()
        .setName('memory')
        .setDescription('AI chat memory settings')
        .setDMPermission(false)
        .addSubcommand(subcommand => subcommand.setName('enable').setDescription('Remember your chat context'))
        .addSubcommand(subcommand => subcommand.setName('disable').setDescription('Stop remembering'))
        .addSubcommand(subcommand => subcommand.setName('clear').setDescription('Wipe your chat memory')),
    category: 'ai',

    async execute(interaction) {
        if (!interaction.guild) return;

        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        try {
            if (sub === 'enable') {
                getMemory(userId).enabled = true;
                await interaction.reply({
                    content: '🧠 **AI memory enabled** - `/ai chat` will now remember your conversation (last 10 messages). Use `/memory clear` anytime to wipe it.',
                    flags: MessageFlags.Ephemeral,
                });
            } else if (sub === 'disable') {
                getMemory(userId).enabled = false;
                await interaction.reply({
                    content: '🧠 **AI memory disabled** - each `/ai chat` is now a fresh conversation.',
                    flags: MessageFlags.Ephemeral,
                });
            } else if (sub === 'clear') {
                clearMemory(userId);
                await interaction.reply({
                    content: '🧹 **Memory cleared** - your AI conversation history is gone.',
                    flags: MessageFlags.Ephemeral,
                });
            } else {
                await interaction.reply({ content: '❌ Unknown subcommand.', flags: MessageFlags.Ephemeral });
            }
        } catch (error: any) {
            console.error('memory command error:', error);
            const content = '❌ Something went wrong updating your memory settings.';
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    },
};
