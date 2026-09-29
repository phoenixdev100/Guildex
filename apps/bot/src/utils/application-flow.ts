/**
 * Application Flow
 *
 * Interactive application system: modal Q&A pages → submission →
 * staff-channel embed with Accept/Deny buttons → role assignment + DM.
 *
 * CustomId scheme:
 *   app_pick_<sessionId>      select menu - choose form
 *   app_modal_<sessionId>     modal page submit
 *   app_next_<sessionId>      button - next question page
 *   app_accept_<subId>        staff button - accept
 *   app_deny_<subId>          staff button - open deny-reason modal
 *   app_denyreason_<subId>    modal - deny reason
 *   app_withdraw_<subId>      user button - withdraw own application
 */

import {
    ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
    ModalActionRowComponentBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle,
    PermissionFlagsBits, StringSelectMenuBuilder,
    type ButtonInteraction, type ModalSubmitInteraction, type StringSelectMenuInteraction,
    type ChatInputCommandInteraction, type GuildMember, type TextChannel,
} from 'discord.js';
import type { BotClient } from '../client';
import { apiClient } from './api-client';
import logger from '../config/logger';

const PAGE_SIZE = 5; // Discord modal limit
const SESSION_TTL_MS = 15 * 60_000;

export interface AppForm {
    id: string;
    guildId: string;
    name: string;
    description?: string | null;
    questions: { label: string; style?: 'short' | 'paragraph'; required?: boolean; placeholder?: string }[];
    staffRoleId?: string | null;
    acceptedRoleId?: string | null;
    logChannelId?: string | null;
    isOpen: boolean;
    cooldownHours: number;
}

export interface AppSubmission {
    id: string;
    formId: string;
    guildId: string;
    userId: string;
    answers: { question: string; answer: string }[];
    status: string;
    reviewerId?: string | null;
    reason?: string | null;
    createdAt: string;
    form?: AppForm;
}

interface Session {
    id: string;
    guildId: string;
    userId: string;
    formId: string | null;
    answers: { question: string; answer: string }[];
    page: number;
    createdAt: number;
}

const sessions = new Map<string, Session>();

function newSessionId(): string {
    return Math.random().toString(36).slice(2, 10);
}

function getSession(id: string): Session | null {
    const s = sessions.get(id);
    if (!s) return null;
    if (Date.now() - s.createdAt > SESSION_TTL_MS) {
        sessions.delete(id);
        return null;
    }
    return s;
}

export async function fetchForms(guildId: string, openOnly = false): Promise<AppForm[]> {
    try {
        const res = await apiClient.get<{ data: { forms: AppForm[] } }>(
            `/guilds/${guildId}/applications/forms${openOnly ? '?open=true' : ''}`
        );
        return res.data.forms ?? [];
    } catch {
        return [];
    }
}

export async function fetchForm(guildId: string, nameOrId: string): Promise<AppForm | null> {
    const forms = await fetchForms(guildId);
    const lower = nameOrId.toLowerCase();
    return forms.find(f => f.id === nameOrId) ?? forms.find(f => f.name.toLowerCase() === lower) ?? null;
}

/** Does this member count as a reviewer for the form? ManageGuild or configured staff role. */
export function canReview(member: GuildMember, form?: AppForm | null): boolean {
    if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
    if (form?.staffRoleId && member.roles.cache.has(form.staffRoleId)) return true;
    return false;
}

function buildModal(session: Session, form: AppForm): ModalBuilder | null {
    const start = session.page * PAGE_SIZE;
    const qs = form.questions.slice(start, start + PAGE_SIZE);
    if (qs.length === 0) return null;

    const modal = new ModalBuilder()
        .setCustomId(`app_modal_${session.id}`)
        .setTitle(`${form.name} (${session.page + 1}/${Math.ceil(form.questions.length / PAGE_SIZE)})`.slice(0, 45));

    for (let i = 0; i < qs.length; i++) {
        const q = qs[i];
        modal.addComponents(
            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId(`q_${start + i}`)
                    .setLabel(q.label.slice(0, 45))
                    .setStyle(q.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
                    .setRequired(q.required !== false)
                    .setPlaceholder((q.placeholder ?? '').slice(0, 100))
                    .setMaxLength(q.style === 'paragraph' ? 1000 : 300)
            )
        );
    }
    return modal;
}

/** Entry: /apply - pick form or jump straight to modal. */
export async function startApplication(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId!;
    const forms = await fetchForms(guildId, true);
    const usable = forms.filter(f => f.questions.length > 0);

    if (usable.length === 0) {
        await interaction.reply({
            content: forms.length === 0
                ? '📝 No application forms are set up yet - ask staff to run `/appsetup create`.'
                : '📝 No application forms are open right now.',
            ephemeral: true,
        });
        return;
    }

    const session: Session = {
        id: newSessionId(), guildId, userId: interaction.user.id,
        formId: null, answers: [], page: 0, createdAt: Date.now(),
    };
    sessions.set(session.id, session);

    if (usable.length === 1) {
        session.formId = usable[0].id;
        const modal = buildModal(session, usable[0]);
        if (modal) { await interaction.showModal(modal); return; }
        sessions.delete(session.id);
        await interaction.reply({ content: '❌ That form has no questions configured.', ephemeral: true });
        return;
    }

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`app_pick_${session.id}`)
        .setPlaceholder('Choose an application')
        .addOptions(usable.slice(0, 25).map(f => ({
            label: f.name.slice(0, 100),
            description: (f.description ?? `${f.questions.length} questions`).slice(0, 100),
            value: f.id,
        })));

    await interaction.reply({
        content: '📝 **Which application would you like to fill out?**',
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
        ephemeral: true,
    });
}

/** Select menu: user picked a form → show first modal page. */
export async function handleApplicationSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    if (!interaction.customId.startsWith('app_pick_')) return;
    const session = getSession(interaction.customId.slice(9));
    if (!session || session.userId !== interaction.user.id) {
        await interaction.reply({ content: '❌ Session expired - run `/apply` again.', ephemeral: true }).catch(() => {});
        return;
    }
    const form = (await fetchForms(session.guildId, true)).find(f => f.id === interaction.values[0]);
    if (!form || form.questions.length === 0) {
        await interaction.update({ content: '❌ That form is no longer available.', components: [] }).catch(() => {});
        return;
    }
    session.formId = form.id;
    const modal = buildModal(session, form);
    if (!modal) {
        await interaction.update({ content: '❌ Form has no questions.', components: [] }).catch(() => {});
        return;
    }
    await interaction.showModal(modal);
}

/** Modal submit: store page answers → next page button or final submit. */
export async function handleApplicationModal(client: BotClient, interaction: ModalSubmitInteraction): Promise<void> {
    const { customId } = interaction;

    // Deny-reason modal
    if (customId.startsWith('app_denyreason_')) {
        await handleDenyReasonModal(client, interaction, customId.slice(15));
        return;
    }
    if (!customId.startsWith('app_modal_')) return;

    const session = getSession(customId.slice(10));
    if (!session || session.userId !== interaction.user.id) {
        await interaction.reply({ content: '❌ Session expired - run `/apply` again.', ephemeral: true }).catch(() => {});
        return;
    }

    const form = (await fetchForms(session.guildId)).find(f => f.id === session.formId);
    if (!form) {
        await interaction.reply({ content: '❌ That form no longer exists.', ephemeral: true }).catch(() => {});
        return;
    }

    // Collect this page's answers
    const start = session.page * PAGE_SIZE;
    const qs = form.questions.slice(start, start + PAGE_SIZE);
    for (let i = 0; i < qs.length; i++) {
        session.answers[start + i] = {
            question: qs[i].label,
            answer: interaction.fields.getTextInputValue(`q_${start + i}`),
        };
    }

    const totalPages = Math.ceil(form.questions.length / PAGE_SIZE);
    if (session.page + 1 < totalPages) {
        session.page++;
        const next = new ButtonBuilder()
            .setCustomId(`app_next_${session.id}`)
            .setLabel(`Continue - page ${session.page + 1}/${totalPages}`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('➡️');
        await interaction.reply({
            content: `✅ Page ${session.page}/${totalPages} saved. Click below to continue.`,
            components: [new ActionRowBuilder<ButtonBuilder>().addComponents(next)],
            ephemeral: true,
        });
        return;
    }

    // Final page → submit
    await interaction.deferReply({ ephemeral: true });
    try {
        const res = await apiClient.post<{ data: { submission: AppSubmission } }>(
            `/guilds/${session.guildId}/applications/forms/${form.id}/submit`,
            { userId: session.userId, answers: session.answers.filter(Boolean) }
        );
        sessions.delete(session.id);
        const sub = res.data.submission;
        await interaction.editReply(`✅ **Application submitted!** (${form.name})\nStaff will review it shortly - you'll get a DM with the result.`);
        await postSubmissionToStaff(client, form, sub);
    } catch (error: any) {
        sessions.delete(session.id);
        const apiMsg = error?.response?.data?.error ?? error?.message ?? 'Unknown error';
        await interaction.editReply(`❌ Could not submit: ${apiMsg}`).catch(() => {});
    }
}

/** "Next page" button → next modal. */
async function handleNextPage(interaction: ButtonInteraction): Promise<void> {
    const session = getSession(interaction.customId.slice(9));
    if (!session || session.userId !== interaction.user.id) {
        await interaction.reply({ content: '❌ Session expired - run `/apply` again.', ephemeral: true }).catch(() => {});
        return;
    }
    const form = (await fetchForms(session.guildId)).find(f => f.id === session.formId);
    const modal = form ? buildModal(session, form) : null;
    if (!modal) {
        await interaction.reply({ content: '❌ Form unavailable.', ephemeral: true }).catch(() => {});
        return;
    }
    await interaction.showModal(modal);
}

/** Post a submission embed with Accept/Deny buttons to the form's log channel. */
async function postSubmissionToStaff(client: BotClient, form: AppForm, sub: AppSubmission): Promise<void> {
    if (!form.logChannelId) return;
    try {
        const channel = await client.channels.fetch(form.logChannelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const user = await client.users.fetch(sub.userId).catch(() => null);
        const embed = new EmbedBuilder()
            .setColor('#FEE75C')
            .setTitle(`📨 New Application - ${form.name}`)
            .setThumbnail(user?.displayAvatarURL() ?? null)
            .setDescription(sub.answers.map(a => `**${a.question}**\n${a.answer}`).join('\n\n').slice(0, 3900))
            .addFields(
                { name: 'Applicant', value: `<@${sub.userId}>`, inline: true },
                { name: 'Submitted', value: `<t:${Math.floor(new Date(sub.createdAt).getTime() / 1000)}:R>`, inline: true },
                { name: 'ID', value: `\`${sub.id}\``, inline: true },
            )
            .setFooter({ text: 'Pending review' });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`app_accept_${sub.id}`).setLabel('Accept').setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId(`app_deny_${sub.id}`).setLabel('Deny').setStyle(ButtonStyle.Danger).setEmoji('❌'),
        );
        await (channel as TextChannel).send({ embeds: [embed], components: [row] });
    } catch (error) {
        logger.warn({ error, formId: form.id }, 'Failed to post application to staff channel');
    }
}

/** Resolve a submission + its form from the API. */
async function getSubmission(guildId: string, subId: string): Promise<AppSubmission | null> {
    try {
        const res = await apiClient.get<{ data: { submission: AppSubmission } }>(
            `/guilds/${guildId}/applications/submissions/${subId}`
        );
        return res.data.submission;
    } catch {
        return null;
    }
}

/** After review: update embed, assign role on accept, DM applicant. */
async function finalizeReview(
    client: BotClient,
    interaction: ButtonInteraction | ModalSubmitInteraction,
    sub: AppSubmission,
    status: 'accepted' | 'denied',
    reason?: string
): Promise<void> {
    const form = sub.form;
    const reviewer = interaction.user;

    // Assign role on accept
    let roleNote = '';
    if (status === 'accepted' && form?.acceptedRoleId) {
        try {
            const member = await interaction.guild!.members.fetch(sub.userId);
            await member.roles.add(form.acceptedRoleId, `Application accepted by ${reviewer.tag}`);
            roleNote = `\n🎖️ Role <@&${form.acceptedRoleId}> assigned.`;
        } catch {
            roleNote = '\n⚠️ Could not assign the accepted role (check hierarchy).';
        }
    }

    // Update the original staff embed
    try {
        const embed = EmbedBuilder.from(interaction.message!.embeds[0])
            .setColor(status === 'accepted' ? '#57F287' : '#ED4245')
            .setFooter({
                text: `${status === 'accepted' ? '✅ Accepted' : '❌ Denied'} by ${reviewer.tag}${reason ? ` - ${reason}` : ''}`,
            });
        await interaction.message!.edit({ embeds: [embed], components: [] });
    } catch { /* message may be gone */ }

    // DM the applicant
    try {
        const user = await client.users.fetch(sub.userId);
        await user.send(
            status === 'accepted'
                ? `🎉 Your **${form?.name ?? 'application'}** in **${interaction.guild!.name}** was **accepted**!${roleNote}`
                : `Your **${form?.name ?? 'application'}** in **${interaction.guild!.name}** was **denied**.${reason ? `\nReason: ${reason}` : ''}`
        );
    } catch { /* DMs closed */ }
}

/** All app_* button routing. */
export async function handleApplicationButton(client: BotClient, interaction: ButtonInteraction): Promise<void> {
    const { customId } = interaction;
    if (!interaction.guildId || !interaction.guild) return;

    try {
        if (customId.startsWith('app_next_')) {
            await handleNextPage(interaction);
            return;
        }

        if (customId.startsWith('app_withdraw_')) {
            const subId = customId.slice(13);
            if (interaction.user.id !== (await getSubmission(interaction.guildId, subId))?.userId) {
                await interaction.reply({ content: '❌ This is not your application.', ephemeral: true }).catch(() => {});
                return;
            }
            await apiClient.post(`/guilds/${interaction.guildId}/applications/submissions/${subId}/review`, {
                reviewerId: interaction.user.id, action: 'withdraw',
            });
            await interaction.update({ content: '↩️ Application withdrawn.', embeds: [], components: [] }).catch(() => {});
            return;
        }

        if (customId.startsWith('app_accept_')) {
            const subId = customId.slice(11);
            const sub = await getSubmission(interaction.guildId, subId);
            if (!sub) { await interaction.reply({ content: '❌ Submission not found.', ephemeral: true }); return; }
            if (!canReview(interaction.member as GuildMember, sub.form)) {
                await interaction.reply({ content: '❌ You need Manage Server or the form\'s staff role to review.', ephemeral: true });
                return;
            }
            if (sub.status !== 'pending') {
                await interaction.reply({ content: `ℹ️ Already ${sub.status}.`, ephemeral: true });
                return;
            }
            try {
                const res = await apiClient.post<{ data: { submission: AppSubmission } }>(
                    `/guilds/${interaction.guildId}/applications/submissions/${subId}/review`,
                    { reviewerId: interaction.user.id, action: 'accept' }
                );
                await finalizeReview(client, interaction, res.data.submission, 'accepted');
                await interaction.reply({ content: `✅ Accepted <@${sub.userId}>'s application.`, ephemeral: true });
            } catch (error: any) {
                await interaction.reply({ content: `❌ ${error?.response?.data?.error ?? 'Review failed'}`, ephemeral: true }).catch(() => {});
            }
            return;
        }

        if (customId.startsWith('app_deny_')) {
            const subId = customId.slice(9);
            const sub = await getSubmission(interaction.guildId, subId);
            if (!sub) { await interaction.reply({ content: '❌ Submission not found.', ephemeral: true }); return; }
            if (!canReview(interaction.member as GuildMember, sub.form)) {
                await interaction.reply({ content: '❌ You need Manage Server or the form\'s staff role to review.', ephemeral: true });
                return;
            }
            if (sub.status !== 'pending') {
                await interaction.reply({ content: `ℹ️ Already ${sub.status}.`, ephemeral: true });
                return;
            }
            const modal = new ModalBuilder()
                .setCustomId(`app_denyreason_${subId}`)
                .setTitle('Deny Application')
                .addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                    new TextInputBuilder()
                        .setCustomId('reason')
                        .setLabel('Reason (optional)')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(false)
                        .setMaxLength(500)
                ));
            await interaction.showModal(modal);
            return;
        }
    } catch (error) {
        logger.error({ error, customId }, 'Application button failed');
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Something went wrong.', ephemeral: true }).catch(() => {});
        }
    }
}

/** Deny-reason modal submit → deny the submission. */
async function handleDenyReasonModal(client: BotClient, interaction: ModalSubmitInteraction, subId: string): Promise<void> {
    const reason = interaction.fields.getTextInputValue('reason') || undefined;
    const sub = await getSubmission(interaction.guildId!, subId);
    if (!sub) { await interaction.reply({ content: '❌ Submission not found.', ephemeral: true }); return; }
    if (!canReview(interaction.member as GuildMember, sub.form)) {
        await interaction.reply({ content: '❌ Insufficient permissions.', ephemeral: true });
        return;
    }
    if (sub.status !== 'pending') {
        await interaction.reply({ content: `ℹ️ Already ${sub.status}.`, ephemeral: true });
        return;
    }
    try {
        const res = await apiClient.post<{ data: { submission: AppSubmission } }>(
            `/guilds/${interaction.guildId}/applications/submissions/${subId}/review`,
            { reviewerId: interaction.user.id, action: 'deny', reason }
        );
        await finalizeReview(client, interaction, res.data.submission, 'denied', reason);
        await interaction.reply({ content: `❌ Denied <@${sub.userId}>'s application${reason ? ` - ${reason}` : ''}.`, ephemeral: true });
    } catch (error: any) {
        await interaction.reply({ content: `❌ ${error?.response?.data?.error ?? 'Review failed'}`, ephemeral: true }).catch(() => {});
    }
}
