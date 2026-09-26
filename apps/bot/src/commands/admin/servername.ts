/**
 * ServerName Command
 *
 * Rename the server.
 */

import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command';

export const servername: Command = {
    data: new SlashCommandBuilder()
        .setName('servername')
        .setDescription('Rename the server')
        .setDMPermission(false)
        .addStringOption(o => o.setName('name').setDescription('New server name').setRequired(true).setMinLength(2).setMaxLength(100)),
    requiredPermission: PermissionFlagsBits.ManageGuild,
    category: 'admin',

    async execute(interaction) {
        if (!interaction.guild) return;

        const name = interaction.options.getString('name', true);
        const oldName = interaction.guild.name;

        try {
            await interaction.guild.setName(name, `Renamed by ${interaction.user.tag}`);
            await interaction.reply({ content: `✅ Server renamed: **${oldName}** → **${name}**` });
        } catch (error: any) {
            console.error('servername error:', error);
            const content = `❌ Failed to rename: ${error.message ?? 'Unknown error'}`;
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    },
};
