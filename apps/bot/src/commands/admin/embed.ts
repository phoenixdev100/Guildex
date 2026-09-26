/**
 * Embed Command
 *
 * Create and post a custom embed message.
 */

import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags, ChannelType } from 'discord.js';
import type { Command } from '../../types/command';

export const embed: Command = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Create a custom embed message')
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('title').setDescription('Embed title').setRequired(true)
        )
        .addStringOption(option =>
            option.setName('description').setDescription('Embed description').setRequired(true)
        )
        .addStringOption(option =>
            option.setName('color').setDescription('Embed color (hex, e.g. #5865F2)').setRequired(false)
        )
        .addChannelOption(option =>
            option.setName('channel').setDescription('Channel to post in (default: this one)').addChannelTypes(ChannelType.GuildText).setRequired(false)
        )
        .addStringOption(option =>
            option.setName('footer').setDescription('Embed footer text').setRequired(false)
        )
        .addStringOption(option =>
            option.setName('image').setDescription('Image URL for the embed').setRequired(false)
        )
        .addStringOption(option =>
            option.setName('thumbnail').setDescription('Thumbnail URL for the embed').setRequired(false)
        ),
    requiredPermission: PermissionFlagsBits.ManageGuild,
    category: 'admin',

    async execute(interaction) {
        if (!interaction.guild) return;

        const title = interaction.options.getString('title', true);
        const description = interaction.options.getString('description', true);
        const colorInput = interaction.options.getString('color');
        const footer = interaction.options.getString('footer');
        const image = interaction.options.getString('image');
        const thumbnail = interaction.options.getString('thumbnail');
        const channel = interaction.options.getChannel('channel') ?? interaction.channel;

        try {
            let color = 0x5865f2;
            if (colorInput) {
                const hex = colorInput.trim().replace(/^#/, '');
                if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
                    await interaction.reply({ content: '❌ Invalid color. Use a hex code like `#5865F2`.', flags: MessageFlags.Ephemeral });
                    return;
                }
                color = parseInt(hex, 16);
            }

            if (image && !/^https?:\/\/\S+$/i.test(image)) {
                await interaction.reply({ content: '❌ Image must be a valid http(s) URL.', flags: MessageFlags.Ephemeral });
                return;
            }
            if (thumbnail && !/^https?:\/\/\S+$/i.test(thumbnail)) {
                await interaction.reply({ content: '❌ Thumbnail must be a valid http(s) URL.', flags: MessageFlags.Ephemeral });
                return;
            }

            if (!channel || !('send' in channel)) {
                await interaction.reply({ content: '❌ That channel is not a text channel.', flags: MessageFlags.Ephemeral });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(title)
                .setDescription(description)
                .setTimestamp();

            if (footer) embed.setFooter({ text: footer });
            if (image) embed.setImage(image);
            if (thumbnail) embed.setThumbnail(thumbnail);

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            await channel.send({ embeds: [embed] });
            await interaction.editReply({ content: `✅ Embed posted in ${channel}.` });
        } catch (error: any) {
            console.error('embed command error:', error);
            const content = `❌ Failed to create embed: ${error.message ?? 'Unknown error'}`;
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content }).catch(() => {});
            } else {
                await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};
