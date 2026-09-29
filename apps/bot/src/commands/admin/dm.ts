/**
 * DM Command
 *
 * Send a direct message to a user as the bot.
 */

import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command';

export const dm: Command = {
    data: new SlashCommandBuilder()
        .setName('dm')
        .setDescription('DM a user as the bot')
        .setDMPermission(false)
        .addUserOption(option =>
            option.setName('user').setDescription('User to DM').setRequired(true)
        )
        .addStringOption(option =>
            option.setName('message').setDescription('Message to send').setRequired(true)
        ),
    requiredPermission: PermissionFlagsBits.ManageGuild,
    category: 'admin',

    async execute(interaction) {
        if (!interaction.guild) return;

        const user = interaction.options.getUser('user', true);
        const message = interaction.options.getString('message', true);

        if (user.bot) {
            await interaction.reply({ content: '❌ You cannot DM a bot.', flags: MessageFlags.Ephemeral });
            return;
        }

        // Defer first - user.send can exceed the 3s interaction window
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const embed = new EmbedBuilder()
                .setColor(0x5865f2)
                .setTitle(`📩 Message from ${interaction.guild.name}`)
                .setDescription(message)
                .setFooter({ text: `Sent by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            await user.send({ embeds: [embed] });
            await interaction.editReply({ content: `✅ DM sent to ${user.tag}.` });
        } catch (error: any) {
            // Discord throws when the user has DMs disabled or blocked the bot
            await interaction.editReply({
                content: `❌ Could not DM ${user.tag} - they may have DMs disabled.`,
            });
        }
    }
};
