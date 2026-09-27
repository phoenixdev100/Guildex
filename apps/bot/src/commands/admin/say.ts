/**
 * Say Command
 *
 * Make the bot send a plain-text message to a channel.
 */

import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } from 'discord.js';
import type { Command } from '../../types/command';

export const say: Command = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Make the bot say something')
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('message').setDescription('Message to send').setRequired(true)
        )
        .addChannelOption(option =>
            option.setName('channel').setDescription('Channel to send in (default: this one)').addChannelTypes(ChannelType.GuildText).setRequired(false)
        ),
    requiredPermission: PermissionFlagsBits.ManageGuild,
    category: 'admin',

    async execute(interaction) {
        if (!interaction.guild) return;

        const message = interaction.options.getString('message', true);
        const channel = interaction.options.getChannel('channel') ?? interaction.channel;

        try {
            if (!channel || !('send' in channel)) {
                await interaction.reply({ content: '❌ That channel is not a text channel.', flags: MessageFlags.Ephemeral });
                return;
            }

            const me = interaction.guild.members.me ?? await interaction.guild.members.fetchMe();
            const perms = 'permissionsFor' in channel ? channel.permissionsFor(me) : null;
            if (!perms?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel])) {
                await interaction.reply({ content: `❌ I don't have permission to send messages in ${channel}.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            await channel.send({ content: message });
            await interaction.editReply({ content: `✅ Message sent to ${channel}.` });
        } catch (error: any) {
            console.error('say command error:', error);
            const content = `❌ Failed to send message: ${error.message ?? 'Unknown error'}`;
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content }).catch(() => {});
            } else {
                await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};
