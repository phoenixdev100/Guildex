/**
 * AppSetup Command (admin)
 *
 * Build and configure application forms: questions, staff role,
 * accepted role, review channel, open/close, cooldown.
 */

import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags, ChannelType } from 'discord.js';
import type { Command } from '../../types/command';
import { apiClient } from '../../utils/api-client';
import { fetchForm, fetchForms, type AppForm } from '../../utils/application-flow';

const MAX_QUESTIONS = 10;

export const appsetup: Command = {
    data: new SlashCommandBuilder()
        .setName('appsetup')
        .setDescription('Configure application forms (admin)')
        .setDMPermission(false)
        .addSubcommand(s => s.setName('create').setDescription('Create a form')
            .addStringOption(o => o.setName('name').setDescription('Form name (e.g. Staff Application)').setRequired(true).setMaxLength(45))
            .addStringOption(o => o.setName('description').setDescription('Shown to applicants').setRequired(false))
            .addRoleOption(o => o.setName('staff-role').setDescription('Role allowed to review').setRequired(false))
            .addRoleOption(o => o.setName('accepted-role').setDescription('Role granted on acceptance').setRequired(false))
            .addChannelOption(o => o.setName('log-channel').setDescription('Channel for new submissions').setRequired(false)
                .addChannelTypes(ChannelType.GuildText)))
        .addSubcommand(s => s.setName('list').setDescription('List all forms'))
        .addSubcommand(s => s.setName('addquestion').setDescription('Add a question (max 10, 5 per modal page)')
            .addStringOption(o => o.setName('form').setDescription('Form name').setRequired(true))
            .addStringOption(o => o.setName('question').setDescription('Question text').setRequired(true).setMaxLength(45))
            .addStringOption(o => o.setName('style').setDescription('Answer length').setRequired(false)
                .addChoices({ name: 'Short (1 line)', value: 'short' }, { name: 'Paragraph', value: 'paragraph' }))
            .addBooleanOption(o => o.setName('required').setDescription('Required? (default yes)').setRequired(false))
            .addStringOption(o => o.setName('placeholder').setDescription('Hint text').setRequired(false)))
        .addSubcommand(s => s.setName('questions').setDescription('List a form\'s questions')
            .addStringOption(o => o.setName('form').setDescription('Form name').setRequired(true)))
        .addSubcommand(s => s.setName('removequestion').setDescription('Remove a question by number')
            .addStringOption(o => o.setName('form').setDescription('Form name').setRequired(true))
            .addIntegerOption(o => o.setName('number').setDescription('Question #').setRequired(true).setMinValue(1)))
        .addSubcommand(s => s.setName('open').setDescription('Open a form for submissions')
            .addStringOption(o => o.setName('form').setDescription('Form name').setRequired(true)))
        .addSubcommand(s => s.setName('close').setDescription('Stop accepting submissions')
            .addStringOption(o => o.setName('form').setDescription('Form name').setRequired(true)))
        .addSubcommand(s => s.setName('setcooldown').setDescription('Hours before a user can re-apply')
            .addStringOption(o => o.setName('form').setDescription('Form name').setRequired(true))
            .addIntegerOption(o => o.setName('hours').setDescription('Cooldown hours (0 = none)').setRequired(true).setMinValue(0).setMaxValue(720)))
        .addSubcommand(s => s.setName('setchannel').setDescription('Set the staff review channel')
            .addStringOption(o => o.setName('form').setDescription('Form name').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true).addChannelTypes(ChannelType.GuildText)))
        .addSubcommand(s => s.setName('delete').setDescription('Delete a form and its submissions')
            .addStringOption(o => o.setName('form').setDescription('Form name').setRequired(true))),
    requiredPermission: PermissionFlagsBits.ManageGuild,
    category: 'applications',

    async execute(interaction) {
        if (!interaction.guild) return;
        const guildId = interaction.guild.id;
        const sub = interaction.options.getSubcommand();

        await interaction.deferReply({ ephemeral: true });

        const needForm = async (): Promise<AppForm | null> => {
            const name = interaction.options.getString('form', true);
            const form = await fetchForm(guildId, name);
            if (!form) await interaction.editReply(`❌ No form named **${name}**. Check \`/appsetup list\`.`).catch(() => {});
            return form;
        };

        try {
            switch (sub) {
                case 'create': {
                    const name = interaction.options.getString('name', true);
                    const existing = await fetchForm(guildId, name);
                    if (existing) { await interaction.editReply(`❌ A form named **${name}** already exists.`); return; }
                    const res = await apiClient.post<{ data: { form: AppForm } }>(`/guilds/${guildId}/applications/forms`, {
                        name,
                        description: interaction.options.getString('description'),
                        staffRoleId: interaction.options.getRole('staff-role')?.id,
                        acceptedRoleId: interaction.options.getRole('accepted-role')?.id,
                        logChannelId: interaction.options.getChannel('log-channel')?.id,
                    });
                    const f = res.data.form;
                    await interaction.editReply(
                        `✅ Form **${f.name}** created.\n` +
                        `Next: add questions with \`/appsetup addquestion\`, then staff see submissions in ${f.logChannelId ? `<#${f.logChannelId}>` : 'a channel you set with `/appsetup setchannel`'}.`
                    );
                    return;
                }

                case 'list': {
                    const forms = await fetchForms(guildId);
                    const embed = new EmbedBuilder()
                        .setColor('#5865F2')
                        .setTitle(`📝 Application Forms - ${interaction.guild.name}`)
                        .setDescription(forms.length
                            ? forms.map(f =>
                                `${f.isOpen ? '🟢' : '🔴'} **${f.name}** - ${f.questions.length}q • ${(f as any)._count?.submissions ?? 0} pending` +
                                `${f.logChannelId ? `\n   ↳ reviews → <#${f.logChannelId}>` : ''}` +
                                `${f.acceptedRoleId ? ` • accept → <@&${f.acceptedRoleId}>` : ''}`
                            ).join('\n')
                            : 'No forms yet - create one with `/appsetup create`.');
                    await interaction.editReply({ embeds: [embed] });
                    return;
                }

                case 'addquestion': {
                    const form = await needForm(); if (!form) return;
                    if (form.questions.length >= MAX_QUESTIONS) {
                        await interaction.editReply(`❌ Max ${MAX_QUESTIONS} questions per form (Discord modal limit).`);
                        return;
                    }
                    const q = {
                        label: interaction.options.getString('question', true),
                        style: (interaction.options.getString('style') ?? 'short') as 'short' | 'paragraph',
                        required: interaction.options.getBoolean('required') ?? true,
                        placeholder: interaction.options.getString('placeholder') ?? undefined,
                    };
                    const questions = [...form.questions, q];
                    await apiClient.patch(`/guilds/${guildId}/applications/forms/${form.id}`, { questions });
                    await interaction.editReply(`✅ Question ${questions.length} added to **${form.name}**: *${q.label}*`);
                    return;
                }

                case 'questions': {
                    const form = await needForm(); if (!form) return;
                    const embed = new EmbedBuilder()
                        .setColor('#5865F2')
                        .setTitle(`❓ ${form.name} - Questions (${form.questions.length})`)
                        .setDescription(form.questions.length
                            ? form.questions.map((q, i) =>
                                `**${i + 1}.** ${q.label}\n   ↳ ${q.style ?? 'short'}${q.required === false ? ' • optional' : ''} • page ${Math.floor(i / 5) + 1}`
                            ).join('\n')
                            : 'No questions yet - add with `/appsetup addquestion`.');
                    await interaction.editReply({ embeds: [embed] });
                    return;
                }

                case 'removequestion': {
                    const form = await needForm(); if (!form) return;
                    const n = interaction.options.getInteger('number', true);
                    if (n > form.questions.length) {
                        await interaction.editReply(`❌ Form only has ${form.questions.length} questions.`);
                        return;
                    }
                    const removed = form.questions[n - 1];
                    await apiClient.patch(`/guilds/${guildId}/applications/forms/${form.id}`, {
                        questions: form.questions.filter((_, i) => i !== n - 1),
                    });
                    await interaction.editReply(`✅ Removed question ${n}: *${removed.label}*`);
                    return;
                }

                case 'open':
                case 'close': {
                    const form = await needForm(); if (!form) return;
                    await apiClient.patch(`/guilds/${guildId}/applications/forms/${form.id}`, { isOpen: sub === 'open' });
                    await interaction.editReply(`${sub === 'open' ? '🟢' : '🔴'} Form **${form.name}** is now ${sub === 'open' ? 'open' : 'closed'} for submissions.`);
                    return;
                }

                case 'setcooldown': {
                    const form = await needForm(); if (!form) return;
                    const hours = interaction.options.getInteger('hours', true);
                    await apiClient.patch(`/guilds/${guildId}/applications/forms/${form.id}`, { cooldownHours: hours });
                    await interaction.editReply(`✅ Cooldown for **${form.name}** set to **${hours}h**.`);
                    return;
                }

                case 'setchannel': {
                    const form = await needForm(); if (!form) return;
                    const channel = interaction.options.getChannel('channel', true);
                    await apiClient.patch(`/guilds/${guildId}/applications/forms/${form.id}`, { logChannelId: channel.id });
                    await interaction.editReply(`✅ Submissions for **${form.name}** now post to <#${channel.id}>.`);
                    return;
                }

                case 'delete': {
                    const form = await needForm(); if (!form) return;
                    await apiClient.delete(`/guilds/${guildId}/applications/forms/${form.id}`);
                    await interaction.editReply(`🗑️ Form **${form.name}** and its submissions deleted.`);
                    return;
                }

                default:
                    await interaction.editReply('Unknown subcommand.');
            }
        } catch (error: any) {
            console.error('appsetup command error:', error);
            const content = `❌ ${error?.response?.data?.error ?? 'Something went wrong'}`;
            if (interaction.deferred || interaction.replied) await interaction.editReply(content).catch(() => {});
            else await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    }
};
