/**
 * RoleAll Command
 *
 * Add or remove a role for every member of the server.
 * Processes members in batches to respect rate limits.
 */

import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command';

export const roleall: Command = {
    data: new SlashCommandBuilder()
        .setName('roleall')
        .setDescription('Add or remove a role for ALL server members')
        .setDMPermission(false)
        .addRoleOption(o => o.setName('role').setDescription('Role to apply').setRequired(true))
        .addStringOption(o =>
            o.setName('action').setDescription('Add or remove the role').setRequired(true)
                .addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' })
        ),
    requiredPermission: PermissionFlagsBits.ManageRoles,
    category: 'admin',

    async execute(interaction) {
        if (!interaction.guild) return;

        const raw = interaction.options.getRole('role', true);
        const role = interaction.guild.roles.cache.get(raw.id);
        const action = interaction.options.getString('action', true) as 'add' | 'remove';

        if (!role) {
            await interaction.reply({ content: '❌ Could not resolve that role.', flags: MessageFlags.Ephemeral });
            return;
        }

        if (role.id === interaction.guild.id || role.managed) {
            await interaction.reply({ content: '❌ Cannot mass-apply @everyone or a managed (bot/integration) role.', flags: MessageFlags.Ephemeral });
            return;
        }

        const me = interaction.guild.members.me ?? await interaction.guild.members.fetchMe();
        if (role.position >= me.roles.highest.position) {
            await interaction.reply({ content: '❌ That role is at or above my highest role - I cannot manage it.', flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.deferReply();

        try {
            const members = await interaction.guild.members.fetch();
            const targets = members.filter(m => !m.user.bot && (action === 'add' ? !m.roles.cache.has(role.id) : m.roles.cache.has(role.id)));

            let done = 0, failed = 0;
            const BATCH = 5;
            const list = [...targets.values()];

            for (let i = 0; i < list.length; i += BATCH) {
                const results = await Promise.allSettled(
                    list.slice(i, i + BATCH).map(m =>
                        action === 'add' ? m.roles.add(role) : m.roles.remove(role)
                    )
                );
                for (const r of results) r.status === 'fulfilled' ? done++ : failed++;
            }

            const embed = new EmbedBuilder()
                .setColor(0x57f287)
                .setTitle('✅ Mass Role Update Complete')
                .addFields(
                    { name: 'Role', value: `<@&${role.id}>`, inline: true },
                    { name: 'Action', value: action === 'add' ? 'Added' : 'Removed', inline: true },
                    { name: 'Results', value: `${done} updated • ${failed} failed`, inline: true },
                )
                .setFooter({ text: `Requested by ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error: any) {
            console.error('roleall error:', error);
            await interaction.editReply({ content: `❌ Failed: ${error.message ?? 'Unknown error'}` });
        }
    },
};
