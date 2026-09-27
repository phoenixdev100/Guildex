/**
 * Apply Command
 *
 * Start an application — picks a form, walks through modal
 * question pages, and submits for staff review.
 */

import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command';
import { startApplication } from '../../utils/application-flow';

export const apply: Command = {
    data: new SlashCommandBuilder()
        .setName('apply')
        .setDescription('Apply for a position/role in this server')
        .setDMPermission(false),
    category: 'applications',

    async execute(interaction) {
        if (!interaction.guild) return;
        try {
            await startApplication(interaction);
        } catch (error: any) {
            console.error('apply command error:', error);
            const content = '❌ Could not start the application — please try again.';
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};
