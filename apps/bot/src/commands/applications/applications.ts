/**
 * Applications Command (staff)
 *
 * Manage submitted applications: list, view, accept, deny,
 * stats, and the application blacklist.
 */

import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command';
import { apiClient } from '../../utils/api-client';
import type { AppSubmission } from '../../utils/application-flow';

const STATUS_ICON: Record<string, string> = {
    pending: '🟡', accepted: '🟢', denied: '🔴', withdrawn: '⚪',
};

export const applications: Command = {
    data: new SlashCommandBuilder()
        .setName('applications')
        .setDescription('Manage server applications (staff)')
        .setDMPermission(false)
        .addSubcommand(s => s.setName('list').setDescription('List applications')
            .addStringOption(o => o.setName('status').setDescription('Filter').setRequired(false)
                .addChoices(
                    { name: 'Pending', value: 'pending' }, { name: 'Accepted', value: 'accepted' },
                    { name: 'Denied', value: 'denied' }, { name: 'Withdrawn', value: 'withdrawn' })))
        .addSubcommand(s => s.setName('view').setDescription('View one application')
            .addStringOption(o => o.setName('id').setDescription('Submission ID').setRequired(true)))
        .addSubcommand(s => s.setName('accept').setDescription('Accept an application')
            .addStringOption(o => o.setName('id').setDescription('Submission ID').setRequired(true)))
        .addSubcommand(s => s.setName('deny').setDescription('Deny an application')
            .addStringOption(o => o.setName('id').setDescription('Submission ID').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Reason for denial').setRequired(false)))
        .addSubcommand(s => s.setName('stats').setDescription('Application statistics'))
        .addSubcommandGroup(g => g.setName('blacklist').setDescription('Application blacklist')
            .addSubcommand(s => s.setName('add').setDescription('Block a user from applying')
                .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
                .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)))
            .addSubcommand(s => s.setName('remove').setDescription('Unblock a user')
                .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
            .addSubcommand(s => s.setName('list').setDescription('View blacklisted users'))),
    requiredPermission: PermissionFlagsBits.ManageGuild,
    category: 'applications',

    async execute(interaction) {
        if (!interaction.guild) return;
        const guildId = interaction.guild.id;
        const group = interaction.options.getSubcommandGroup(false);
        const sub = interaction.options.getSubcommand();

        await interaction.deferReply();

        try {
            // ── Blacklist group ───────────────────────────────────
            if (group === 'blacklist') {
                if (sub === 'add') {
                    const user = interaction.options.getUser('user', true);
                    const reason = interaction.options.getString('reason') ?? undefined;
                    await apiClient.post(`/guilds/${guildId}/applications/blacklist`, { userId: user.id, reason });
                    await interaction.editReply(`🚫 **${user.username}** blacklisted from applications${reason ? ` — ${reason}` : ''}.`);
                } else if (sub === 'remove') {
                    const user = interaction.options.getUser('user', true);
                    try {
                        await apiClient.delete(`/guilds/${guildId}/applications/blacklist/${user.id}`);
                        await interaction.editReply(`✅ **${user.username}** removed from the blacklist.`);
                    } catch {
                        await interaction.editReply(`ℹ️ **${user.username}** isn't blacklisted.`);
                    }
                } else if (sub === 'list') {
                    const res = await apiClient.get<{ data: { blacklist: { userId: string; reason?: string; createdAt: string }[] } }>(
                        `/guilds/${guildId}/applications/blacklist`
                    );
                    const rows = res.data.blacklist ?? [];
                    const embed = new EmbedBuilder()
                        .setColor('#ED4245')
                        .setTitle('🚫 Application Blacklist')
                        .setDescription(rows.length
                            ? rows.map(r => `<@${r.userId}>${r.reason ? ` — *${r.reason}*` : ''} • <t:${Math.floor(new Date(r.createdAt).getTime() / 1000)}:R>`).join('\n')
                            : 'No blacklisted users.');
                    await interaction.editReply({ embeds: [embed] });
                }
                return;
            }

            // ── Single submission actions ─────────────────────────
            if (sub === 'view' || sub === 'accept' || sub === 'deny') {
                const id = interaction.options.getString('id', true);
                const res = await apiClient.get<{ data: { submission: AppSubmission & { form: any } } }>(
                    `/guilds/${guildId}/applications/submissions/${id}`
                ).catch(() => null);
                if (!res?.data?.submission) { await interaction.editReply('❌ Submission not found.'); return; }
                const submission = res.data.submission;

                if (sub === 'view') {
                    const embed = new EmbedBuilder()
                        .setColor(submission.status === 'accepted' ? '#57F287' : submission.status === 'denied' ? '#ED4245' : '#FEE75C')
                        .setTitle(`📄 Application — ${submission.form?.name ?? 'Form'}`)
                        .setDescription((submission.answers as { question: string; answer: string }[])
                            .map(a => `**${a.question}**\n${a.answer}`).join('\n\n').slice(0, 3900) || '*No answers*')
                        .addFields(
                            { name: 'Applicant', value: `<@${submission.userId}>`, inline: true },
                            { name: 'Status', value: `${STATUS_ICON[submission.status] ?? ''} ${submission.status}`, inline: true },
                            { name: 'Submitted', value: `<t:${Math.floor(new Date(submission.createdAt).getTime() / 1000)}:R>`, inline: true },
                        );
                    if (submission.reviewerId) embed.addFields({ name: 'Reviewed by', value: `<@${submission.reviewerId}>`, inline: true });
                    if (submission.reason) embed.addFields({ name: 'Reason', value: submission.reason, inline: true });
                    await interaction.editReply({ embeds: [embed] });
                    return;
                }

                if (submission.status !== 'pending') {
                    await interaction.editReply(`ℹ️ This application is already **${submission.status}**.`);
                    return;
                }

                const action = sub === 'accept' ? 'accept' : 'deny';
                const reason = interaction.options.getString('reason') ?? undefined;
                const review = await apiClient.post<{ data: { submission: AppSubmission & { form: any } } }>(
                    `/guilds/${guildId}/applications/submissions/${id}/review`,
                    { reviewerId: interaction.user.id, action, reason }
                ).catch((e: any) => e?.response?.data?.error ?? null);
                if (typeof review !== 'object' || !review?.data) {
                    await interaction.editReply(`❌ ${typeof review === 'string' ? review : 'Review failed'}.`);
                    return;
                }

                // Assign role on accept + notify
                let extra = '';
                if (action === 'accept' && review.data.submission.form?.acceptedRoleId) {
                    try {
                        const member = await interaction.guild.members.fetch(submission.userId);
                        await member.roles.add(review.data.submission.form.acceptedRoleId, `Application accepted by ${interaction.user.tag}`);
                        extra = ` • role <@&${review.data.submission.form.acceptedRoleId}> assigned`;
                    } catch { extra = ' • ⚠️ role assignment failed (check hierarchy)'; }
                }
                try {
                    const user = await interaction.client.users.fetch(submission.userId);
                    await user.send(action === 'accept'
                        ? `🎉 Your **${submission.form?.name}** application in **${interaction.guild.name}** was **accepted**!`
                        : `Your **${submission.form?.name}** application in **${interaction.guild.name}** was **denied**.${reason ? `\nReason: ${reason}` : ''}`);
                } catch { /* DMs closed */ }

                await interaction.editReply(`${action === 'accept' ? '✅ Accepted' : '❌ Denied'} <@${submission.userId}>'s application${reason ? ` — ${reason}` : ''}.${extra}`);
                return;
            }

            // ── List / stats ──────────────────────────────────────
            if (sub === 'list') {
                const status = interaction.options.getString('status') ?? 'pending';
                const res = await apiClient.get<{ data: { submissions: (AppSubmission & { form?: { name: string } })[] } }>(
                    `/guilds/${guildId}/applications/submissions?status=${status}`
                );
                const rows = res.data.submissions ?? [];
                const embed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle(`📋 ${status[0].toUpperCase() + status.slice(1)} Applications`)
                    .setDescription(rows.length
                        ? rows.slice(0, 15).map(s =>
                            `${STATUS_ICON[s.status] ?? ''} <@${s.userId}> — **${s.form?.name ?? 'Form'}** • <t:${Math.floor(new Date(s.createdAt).getTime() / 1000)}:R> • \`${s.id}\``
                        ).join('\n')
                        : `No ${status} applications.`);
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            if (sub === 'stats') {
                const res = await apiClient.get<{ data: { counts: Record<string, number>; forms: { id: string; name: string; isOpen: boolean }[] } }>(
                    `/guilds/${guildId}/applications/stats`
                );
                const { counts, forms } = res.data;
                const embed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle(`📊 Application Stats — ${interaction.guild.name}`)
                    .addFields(
                        { name: '🟡 Pending', value: `${counts.pending ?? 0}`, inline: true },
                        { name: '🟢 Accepted', value: `${counts.accepted ?? 0}`, inline: true },
                        { name: '🔴 Denied', value: `${counts.denied ?? 0}`, inline: true },
                        { name: '⚪ Withdrawn', value: `${counts.withdrawn ?? 0}`, inline: true },
                        { name: '📝 Forms', value: `${forms.length} (${forms.filter(f => f.isOpen).length} open)`, inline: true },
                    );
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            await interaction.editReply('Unknown subcommand.');
        } catch (error: any) {
            console.error('applications command error:', error);
            const content = `❌ ${error?.response?.data?.error ?? 'Something went wrong'}`;
            if (interaction.deferred || interaction.replied) await interaction.editReply(content).catch(() => {});
            else await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    }
};
