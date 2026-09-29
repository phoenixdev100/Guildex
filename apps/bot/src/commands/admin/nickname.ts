/**
 * Nickname Command
 *
 * Change a member's nickname.
 */

import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command';

export const nickname: Command = {
    data: new SlashCommandBuilder()
        .setName('nickname')
        .setDescription('Change a user nickname')
        .setDMPermission(false)
        .addUserOption(option =>
            option.setName('user').setDescription('User to change nickname').setRequired(true)
        )
        .addStringOption(option =>
            option.setName('nickname').setDescription('New nickname (leave empty to reset)').setRequired(false)
        ),
    requiredPermission: PermissionFlagsBits.ManageNicknames,
    category: 'admin',

    async execute(interaction) {
        if (!interaction.guild) return;

        const user = interaction.options.getUser('user', true);
        const nickname = interaction.options.getString('nickname'); // null resets it

        try {
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            if (!member) {
                await interaction.reply({ content: '❌ That user is not in this server.', flags: MessageFlags.Ephemeral });
                return;
            }

            if (member.id === interaction.guild.ownerId) {
                await interaction.reply({ content: '❌ I cannot change the server owner\'s nickname.', flags: MessageFlags.Ephemeral });
                return;
            }

            const me = interaction.guild.members.me ?? await interaction.guild.members.fetchMe();
            if (member.roles.highest.position >= me.roles.highest.position) {
                await interaction.reply({ content: '❌ I cannot change this member\'s nickname - their role is at or above mine.', flags: MessageFlags.Ephemeral });
                return;
            }

            await interaction.deferReply();

            const oldNick = member.displayName;
            await member.setNickname(nickname, `Nickname changed by ${interaction.user.tag}`);

            const embed = new EmbedBuilder()
                .setColor(0x57f287)
                .setTitle('✅ Nickname Updated')
                .addFields(
                    { name: 'Member', value: `${member.user.tag}`, inline: true },
                    { name: 'Old Nickname', value: oldNick, inline: true },
                    { name: 'New Nickname', value: nickname ?? member.user.username + ' (reset)', inline: true },
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error: any) {
            console.error('nickname command error:', error);
            const content = `❌ Failed to change nickname: ${error.message ?? 'Unknown error'}`;
            if (interaction.deferred) {
                await interaction.editReply({ content });
            } else {
                await interaction.reply({ content, flags: MessageFlags.Ephemeral });
            }
        }
    }
};
