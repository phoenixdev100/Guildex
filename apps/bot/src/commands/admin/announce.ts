/**
 * Announce Command
 *
 * Send an announcement embed to a channel, with optional
 * @everyone / @here ping (dropdown choice) or a role mention.
 */

import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command';

export const announce: Command = {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Make an announcement')
        .setDMPermission(false)
        .addChannelOption(option =>
            option.setName('channel').setDescription('Channel to announce in').setRequired(true)
        )
        .addStringOption(option =>
            option.setName('message').setDescription('Announcement message').setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('ping')
                .setDescription('Who to ping with the announcement')
                .setRequired(false)
                .addChoices(
                    { name: '@everyone', value: 'everyone' },
                    { name: '@here', value: 'here' },
                )
        )
        .addRoleOption(option =>
            option.setName('role').setDescription('Role to mention (optional)').setRequired(false)
        )
        .addStringOption(option =>
            option.setName('title').setDescription('Announcement title').setRequired(false)
        ),
    requiredPermission: PermissionFlagsBits.ManageGuild,
    category: 'admin',

    async execute(interaction) {
        if (!interaction.guild) return;

        const channel = interaction.options.getChannel('channel', true);
        const message = interaction.options.getString('message', true);
        const title = interaction.options.getString('title') ?? '📢 Announcement';
        const ping = interaction.options.getString('ping'); // 'everyone' | 'here' | null
        const role = interaction.options.getRole('role');

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

            // Build the ping line: @everyone / @here and/or a role mention
            const mentions: string[] = [];
            if (ping === 'everyone') mentions.push('@everyone');
            if (ping === 'here') mentions.push('@here');
            if (role) mentions.push(`<@&${role.id}>`);
            const mentionText = mentions.join(' ');

            const embed = new EmbedBuilder()
                .setColor(0x5865f2)
                .setTitle(title)
                .setDescription(message)
                .setFooter({ text: `Announced by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            await channel.send({ content: mentionText || undefined, embeds: [embed] });

            const pingDesc = mentions.length > 0 ? ` with ${mentions.join(' + ')}` : '';
            await interaction.editReply({ content: `✅ Announcement sent to ${channel}${pingDesc}.` });
        } catch (error: any) {
            console.error('announce command error:', error);
            const content = `❌ Failed to send announcement: ${error.message ?? 'Unknown error'}`;
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content }).catch(() => {});
            } else {
                await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};
