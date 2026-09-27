/**
 * Analytics Command
 *
 * Server analytics: overview, member growth, engagement,
 * top channels/commands, user stats, and activity leaderboard.
 * Data is collected continuously by the bot's analytics tracker.
 */

import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command';
import { apiClient } from '../../utils/api-client';

interface DailyRow { date: string; joins: number; leaves: number; messages: number; commands: number }
interface AnalyticsData {
    daily: DailyRow[];
    totals: { joins: number; leaves: number; messages: number; commands: number };
}
interface ChannelRow { channelId: string; messages: number }
interface CommandRow { command: string; count: number }
interface UserRow { userId: string; messages: number; commands: number }

function sparkline(values: number[], width = 14): string {
    if (values.length === 0) return 'no data';
    const max = Math.max(...values, 1);
    return values.slice(-width).map(v => {
        const h = Math.round((v / max) * 7);
        return '▁▂▃▄▅▆▇█'[h];
    }).join('');
}

function bar(value: number, max: number, len = 12): string {
    const filled = Math.round((value / Math.max(max, 1)) * len);
    return '█'.repeat(filled) + '░'.repeat(len - filled);
}

function sum(rows: DailyRow[], key: keyof Omit<DailyRow, 'date'>): number {
    return rows.reduce((a, r) => a + r[key], 0);
}

function fmtDate(d: string): string {
    return new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

async function fetchAnalytics(guildId: string, days = 30): Promise<AnalyticsData | null> {
    try {
        const res = await apiClient.get<{ success: boolean; data: AnalyticsData }>(
            `/guilds/${guildId}/analytics?days=${days}`
        );
        return res.data ?? null;
    } catch {
        return null;
    }
}

export const analytics: Command = {
    data: new SlashCommandBuilder()
        .setName('analytics')
        .setDescription('Server analytics')
        .setDMPermission(false)
        .addSubcommand(s => s.setName('server').setDescription('Server overview — members, channels, activity'))
        .addSubcommand(s => s.setName('growth').setDescription('Member growth — joins vs leaves over 14 days'))
        .addSubcommand(s => s.setName('engagement').setDescription('Message & command activity over 14 days'))
        .addSubcommand(s =>
            s.setName('user').setDescription('Activity stats for a member')
                .addUserOption(o => o.setName('member').setDescription('Member to inspect').setRequired(false)))
        .addSubcommand(s => s.setName('channels').setDescription('Most active channels'))
        .addSubcommand(s => s.setName('commands').setDescription('Most used commands'))
        .addSubcommand(s => s.setName('leaderboard').setDescription('Most active members')),
    category: 'analytics',

    async execute(interaction) {
        if (!interaction.guild) return;
        const guildId = interaction.guild.id;
        const sub = interaction.options.getSubcommand();

        await interaction.deferReply();

        try {
            switch (sub) {
                case 'server': {
                    const guild = await interaction.guild.fetch();
                    const data = await fetchAnalytics(guildId, 7);
                    const week = data ? {
                        joins: sum(data.daily, 'joins'),
                        leaves: sum(data.daily, 'leaves'),
                        messages: sum(data.daily, 'messages'),
                        commands: sum(data.daily, 'commands'),
                    } : null;

                    const embed = new EmbedBuilder()
                        .setColor('#5865F2')
                        .setTitle(`📊 ${guild.name} — Overview`)
                        .setThumbnail(guild.iconURL())
                        .addFields(
                            { name: '👥 Members', value: `${guild.memberCount.toLocaleString()}`, inline: true },
                            { name: '📺 Channels', value: `${guild.channels.cache.size}`, inline: true },
                            { name: '🎭 Roles', value: `${guild.roles.cache.size}`, inline: true },
                            { name: '💎 Boosts', value: `${guild.premiumSubscriptionCount ?? 0} (Tier ${guild.premiumTier})`, inline: true },
                            { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
                            { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
                        );

                    if (week && (week.joins || week.messages)) {
                        embed.addFields(
                            { name: '── Last 7 Days ──', value: '\u200b' },
                            { name: '📥 Joins', value: `${week.joins}`, inline: true },
                            { name: '📤 Leaves', value: `${week.leaves}`, inline: true },
                            { name: '📈 Net', value: `${week.joins - week.leaves >= 0 ? '+' : ''}${week.joins - week.leaves}`, inline: true },
                            { name: '💬 Messages', value: `${week.messages}`, inline: true },
                            { name: '⚡ Commands', value: `${week.commands}`, inline: true },
                            { name: '\u200b', value: '\u200b', inline: true },
                        );
                    } else {
                        embed.setFooter({ text: 'Analytics tracking just started — trends appear as data accumulates' });
                    }

                    await interaction.editReply({ embeds: [embed] });
                    break;
                }

                case 'growth': {
                    const data = await fetchAnalytics(guildId, 14);
                    if (!data || data.daily.length === 0) {
                        await interaction.editReply('📈 No analytics data yet — tracking starts collecting once the bot is online. Check back tomorrow.');
                        break;
                    }
                    const joins = data.daily.map(d => d.joins);
                    const leaves = data.daily.map(d => d.leaves);
                    const net = sum(data.daily, 'joins') - sum(data.daily, 'leaves');
                    const retention = sum(data.daily, 'joins') > 0
                        ? Math.round(((sum(data.daily, 'joins') - sum(data.daily, 'leaves')) / sum(data.daily, 'joins')) * 100)
                        : 0;

                    const embed = new EmbedBuilder()
                        .setColor('#57F287')
                        .setTitle(`📈 Member Growth — ${interaction.guild.name}`)
                        .setDescription(
                            `**Joins (14d):** ${sum(data.daily, 'joins')}  •  **Leaves:** ${sum(data.daily, 'leaves')}  •  **Net:** ${net >= 0 ? '+' : ''}${net}\n` +
                            `**Retention:** ${retention}%\n\n` +
                            `**Joins:**  ${sparkline(joins)}\n**Leaves:** ${sparkline(leaves)}\n` +
                            `*${fmtDate(data.daily[0].date)} → ${fmtDate(data.daily[data.daily.length - 1].date)}*`
                        )
                        .addFields({
                            name: 'Busiest join days',
                            value: data.daily.filter(d => d.joins > 0).sort((a, b) => b.joins - a.joins).slice(0, 3)
                                .map(d => `• ${fmtDate(d.date)} — ${d.joins} joined`).join('\n') || 'No joins tracked yet',
                        });

                    await interaction.editReply({ embeds: [embed] });
                    break;
                }

                case 'engagement': {
                    const data = await fetchAnalytics(guildId, 14);
                    if (!data || data.daily.length === 0) {
                        await interaction.editReply('💬 No activity data yet — check back after the bot has tracked some messages.');
                        break;
                    }
                    const msgs = data.daily.map(d => d.messages);
                    const cmds = data.daily.map(d => d.commands);
                    const avgMsg = Math.round(sum(data.daily, 'messages') / data.daily.length);

                    let topChannels = '';
                    try {
                        const res = await apiClient.get<{ data: { channels: ChannelRow[] } }>(`/guilds/${guildId}/analytics/channels`);
                        topChannels = res.data.channels.slice(0, 3).map((c, i) => `${['🥇', '🥈', '🥉'][i]} <#${c.channelId}> — ${c.messages} msgs`).join('\n');
                    } catch { /* ignore */ }

                    const embed = new EmbedBuilder()
                        .setColor('#FEE75C')
                        .setTitle(`💬 Engagement — ${interaction.guild.name}`)
                        .setDescription(
                            `**Messages (14d):** ${sum(data.daily, 'messages')}  •  **Avg/day:** ${avgMsg}\n` +
                            `**Commands run:** ${sum(data.daily, 'commands')}\n\n` +
                            `**Messages:** ${sparkline(msgs)}\n**Commands:** ${sparkline(cmds)}\n` +
                            `*${fmtDate(data.daily[0].date)} → ${fmtDate(data.daily[data.daily.length - 1].date)}*`
                        );
                    if (topChannels) embed.addFields({ name: 'Top channels', value: topChannels });

                    await interaction.editReply({ embeds: [embed] });
                    break;
                }

                case 'user': {
                    const target = interaction.options.getUser('member') ?? interaction.user;
                    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
                    try {
                        const res = await apiClient.get<{ data: { messages: number; commands: number; rank: number | null } }>(
                            `/guilds/${guildId}/analytics/user/${target.id}`
                        );
                        const s = res.data;
                        const embed = new EmbedBuilder()
                            .setColor('#EB459E')
                            .setTitle(`👤 ${target.username} — Activity`)
                            .setThumbnail(target.displayAvatarURL())
                            .addFields(
                                { name: '💬 Messages', value: `${s.messages}`, inline: true },
                                { name: '⚡ Commands', value: `${s.commands}`, inline: true },
                                { name: '🏆 Rank', value: s.rank ? `#${s.rank}` : 'Unranked', inline: true },
                                { name: '📅 Joined server', value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown', inline: true },
                                { name: '🎂 Account created', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true },
                            );
                        await interaction.editReply({ embeds: [embed] });
                    } catch {
                        await interaction.editReply(`No stats recorded for **${target.username}** yet.`);
                    }
                    break;
                }

                case 'channels': {
                    const res = await apiClient.get<{ data: { channels: ChannelRow[] } }>(`/guilds/${guildId}/analytics/channels`);
                    const rows = res.data.channels;
                    if (!rows.length) { await interaction.editReply('No channel activity tracked yet.'); break; }
                    const max = rows[0].messages;
                    const embed = new EmbedBuilder()
                        .setColor('#5865F2')
                        .setTitle(`📺 Most Active Channels — ${interaction.guild.name}`)
                        .setDescription(rows.map((c, i) =>
                            `**${i + 1}.** <#${c.channelId}>\n${bar(c.messages, max)} ${c.messages} messages`
                        ).join('\n'));
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }

                case 'commands': {
                    const res = await apiClient.get<{ data: { commands: CommandRow[] } }>(`/guilds/${guildId}/analytics/commands`);
                    const rows = res.data.commands;
                    if (!rows.length) { await interaction.editReply('No command usage tracked yet.'); break; }
                    const max = rows[0].count;
                    const embed = new EmbedBuilder()
                        .setColor('#5865F2')
                        .setTitle(`⚡ Most Used Commands — ${interaction.guild.name}`)
                        .setDescription(rows.map((c, i) =>
                            `**${i + 1}.** /${c.command}\n${bar(c.count, max)} ${c.count} uses`
                        ).join('\n'));
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }

                case 'leaderboard': {
                    const res = await apiClient.get<{ data: { leaderboard: UserRow[] } }>(`/guilds/${guildId}/analytics/leaderboard`);
                    const rows = res.data.leaderboard;
                    if (!rows.length) { await interaction.editReply('No member activity tracked yet.'); break; }
                    const max = rows[0].messages;
                    const embed = new EmbedBuilder()
                        .setColor('#FFD700')
                        .setTitle(`🏆 Activity Leaderboard — ${interaction.guild.name}`)
                        .setDescription(rows.map((u, i) =>
                            `${['🥇', '🥈', '🥉'][i] ?? `**${i + 1}.**`} <@${u.userId}>\n${bar(u.messages, max)} ${u.messages} msgs • ${u.commands} cmds`
                        ).join('\n'))
                        .setFooter({ text: 'Based on tracked message & command activity' });
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }

                default:
                    await interaction.editReply('Unknown subcommand.');
            }
        } catch (error: any) {
            console.error('analytics command error:', error);
            const msg = '❌ Could not load analytics — the API may be unreachable.';
            if (interaction.deferred || interaction.replied) await interaction.editReply(msg).catch(() => {});
            else await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    }
};
