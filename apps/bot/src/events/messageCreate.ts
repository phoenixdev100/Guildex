/**
 * Message Create Event Handler
 * 
 * Handles bot mentions and shows welcome/info message
 */

import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { BotClient } from '../client';
import logger from '../config/logger';
import { apiClient } from '../utils/api-client';
import { trackMessage } from '../utils/analytics';

// Per-guild XP cooldowns and module status cache
const xpCooldowns = new Map<string, number>();
const moduleCache = new Map<string, { enabled: boolean; checkedAt: number }>();
const XP_COOLDOWN_MS = 60_000;
const MODULE_CACHE_TTL_MS = 300_000;

interface AfkRecord {
    reason: string;
    since: string;
}

async function isAfkModuleEnabled(guildId: string, now: number): Promise<boolean> {
    const modKey = `${guildId}:afk`;
    let mod = moduleCache.get(modKey);
    if (!mod || now - mod.checkedAt > MODULE_CACHE_TTL_MS) {
        const enabled = await apiClient.isModuleEnabled(guildId, 'afk');
        mod = { enabled, checkedAt: now };
        moduleCache.set(modKey, mod);
    }
    return mod.enabled;
}

function timeAgo(date: string): string {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

/**
 * AFK tracking: clears the author's AFK status when they speak,
 * and notifies when someone pings an AFK member.
 */
async function handleAfk(message: Message): Promise<void> {
    const guildId = message.guild!.id;
    const userId = message.author.id;
    const now = Date.now();

    if (!(await isAfkModuleEnabled(guildId, now))) return;

    // 1) Author spoke → clear their AFK status if set
    try {
        const res = await apiClient.get<{ data: { afk: AfkRecord | null } }>(
            `/guilds/${guildId}/afk/${userId}`
        );
        if (res.data?.afk) {
            await apiClient.delete(`/guilds/${guildId}/afk/${userId}`);
            if (message.channel.isSendable()) {
                await message.channel.send({
                    content: `👋 Welcome back ${message.author}! I removed your AFK status.`,
                }).catch(() => {});
            }
        }
    } catch {
        // AFK lookup failed — non-critical
    }

    // 2) Notify when mentioned users are AFK
    const mentioned = [...message.mentions.users.values()].filter(u => !u.bot && u.id !== userId);
    if (mentioned.length === 0) return;

    const notices: string[] = [];
    for (const user of mentioned.slice(0, 5)) {
        try {
            const res = await apiClient.get<{ data: { afk: AfkRecord | null } }>(
                `/guilds/${guildId}/afk/${user.id}`
            );
            if (res.data?.afk) {
                notices.push(`💤 **${user.username}** is AFK: ${res.data.afk.reason} — *${timeAgo(res.data.afk.since)}*`);
            }
        } catch {
            // skip failed lookups
        }
    }

    if (notices.length > 0 && message.channel.isSendable()) {
        await message.channel.send({ content: notices.join('\n') }).catch(() => {});
    }
}

interface XpResponse {
    success?: boolean;
    data?: { leveledUp?: boolean; newLevel?: number; xp?: number };
}

async function awardXp(message: Message): Promise<void> {
    const guildId = message.guild!.id;
    const userId = message.author.id;
    const key = `${guildId}:${userId}`;

    const now = Date.now();
    const last = xpCooldowns.get(key) ?? 0;
    if (now - last < XP_COOLDOWN_MS) return;
    xpCooldowns.set(key, now);

    // Check leveling module (cached)
    const modKey = `${guildId}:leveling`;
    let mod = moduleCache.get(modKey);
    if (!mod || now - mod.checkedAt > MODULE_CACHE_TTL_MS) {
        const enabled = await apiClient.isModuleEnabled(guildId, 'leveling');
        mod = { enabled, checkedAt: now };
        moduleCache.set(modKey, mod);
    }
    if (!mod.enabled) return;

    const amount = 15 + Math.floor(Math.random() * 10); // 15-24 XP
    const res = await apiClient.post<XpResponse>(
        `/guilds/${guildId}/leveling/${userId}/xp`,
        { amount }
    );

    if (res.data?.leveledUp && message.channel.isSendable()) {
        await message.channel.send({
            content: `🎉 ${message.author} leveled up to **level ${res.data.newLevel}**!`,
        }).catch(() => {});
    }
}

export async function handleMessageCreate(
    client: BotClient,
    message: Message
): Promise<void> {
    // Ignore bot messages
    if (message.author.bot) return;

    // Award XP + handle AFK for guild messages (fire-and-forget)
    if (message.guild) {
        trackMessage(message.guild.id, message.channelId, message.author.id);
        awardXp(message).catch(() => {});
        handleAfk(message).catch(() => {});
    }

    // Check if bot is mentioned
    const botMention = `<@${client.user?.id}>`;
    const botMentionNickname = `<@!${client.user?.id}>`;

    if (message.content === botMention || message.content === botMentionNickname ||
        message.content.startsWith(botMention) || message.content.startsWith(botMentionNickname)) {

        try {
            const totalCommands = client.commands.size;
            const totalServers = client.guilds.cache.size;
            const totalUsers = client.users.cache.size;

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setAuthor({
                    name: `${client.user?.username} - Your All-in-One Discord Bot`,
                    iconURL: client.user?.displayAvatarURL()
                })
                .setDescription(
                    `### 👋 Hey ${message.author}! Thanks for summoning me!\n\n` +
                    `I'm a **powerful multi-purpose bot** with **${totalCommands} commands** across **32+ categories**. ` +
                    `From moderation to music, games to AI - I've got everything you need!\n\n` +
                    `┌─────────────────────────────────┐\n` +
                    `│ 🎯 **Quick Start Guide**       │\n` +
                    `└─────────────────────────────────┘\n` +
                    `> **Step 1:** Type \`/help\` to explore all commands\n` +
                    `> **Step 2:** Use \`/setup\` to configure the bot\n` +
                    `> **Step 3:** Type \`/\` to see command suggestions\n\n` +
                    `┌─────────────────────────────────┐\n` +
                    `│ ⭐ **Popular Features**        │\n` +
                    `└─────────────────────────────────┘`
                )
                .addFields(
                    {
                        name: '🛡️ Moderation & Safety',
                        value: '`/ban` `/kick` `/mute` `/warn`\n`/antispam` `/antiraid` `/filter`',
                        inline: true
                    },
                    {
                        name: '💰 Economy & Leveling',
                        value: '`/balance` `/daily` `/shop`\n`/rank` `/leaderboard` `/work`',
                        inline: true
                    },
                    {
                        name: '🎮 Fun & Games',
                        value: '`/trivia` `/chess` `/tictactoe`\n`/akinator` `/wordle` `/8ball`',
                        inline: true
                    },
                    {
                        name: '🎵 Music Player',
                        value: '`/play` `/queue` `/skip`\n`/pause` `/resume` `/volume`',
                        inline: true
                    },
                    {
                        name: '🤖 AI Assistant',
                        value: '`/ai chat` `/ai image` `/ai code`\n`/translate` `/summarize`',
                        inline: true
                    },
                    {
                        name: '⚙️ Server Setup',
                        value: '`/setup` `/autorole` `/welcome`\n`/logs` `/verification` `/backup`',
                        inline: true
                    }
                )
                .addFields({
                    name: '\u200b',
                    value:
                        `┌─────────────────────────────────┐\n` +
                        `│ � **Bot Statistics**           │\n` +
                        `└─────────────────────────────────┘\n` +
                        `🌐 **Servers:** \`${totalServers}\` | 👥 **Users:** \`${totalUsers}\` | 📝 **Commands:** \`${totalCommands}\`\n` +
                        `⚡ **Uptime:** \`${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m\` | 🏓 **Ping:** \`${client.ws.ping}ms\``,
                    inline: false
                })
                .setThumbnail(client.user?.displayAvatarURL() || '')
                .setImage('https://i.imgur.com/AfFp7pu.png') // Add a banner image (you can replace this)
                .setFooter({
                    text: `Requested by ${message.author.tag} • Made with ❤️`,
                    iconURL: message.author.displayAvatarURL()
                })
                .setTimestamp();

            const row1 = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Commands')
                        .setStyle(ButtonStyle.Primary)
                        .setCustomId('view_commands')
                        .setEmoji('📚'),
                    new ButtonBuilder()
                        .setLabel('Setup')
                        .setStyle(ButtonStyle.Success)
                        .setCustomId('setup_bot')
                        .setEmoji('⚙️'),
                    new ButtonBuilder()
                        .setLabel('Games')
                        .setStyle(ButtonStyle.Secondary)
                        .setCustomId('play_games')
                        .setEmoji('🎮'),
                    new ButtonBuilder()
                        .setLabel('Music')
                        .setStyle(ButtonStyle.Secondary)
                        .setCustomId('music_player')
                        .setEmoji('🎵')
                );

            const row2 = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Dashboard')
                        .setStyle(ButtonStyle.Link)
                        .setURL('https://discord.com')
                        .setEmoji('🔗'),
                    new ButtonBuilder()
                        .setLabel('Support')
                        .setStyle(ButtonStyle.Link)
                        .setURL('https://discord.gg/discord')
                        .setEmoji('❓'),
                    new ButtonBuilder()
                        .setLabel('Invite')
                        .setStyle(ButtonStyle.Link)
                        .setURL(`https://discord.com/api/oauth2/authorize?client_id=${client.user?.id}&permissions=8&scope=bot%20applications.commands`)
                        .setEmoji('➕'),
                    new ButtonBuilder()
                        .setLabel('Vote')
                        .setStyle(ButtonStyle.Link)
                        .setURL('https://top.gg')
                        .setEmoji('⭐')
                );

            await message.reply({
                embeds: [embed],
                components: [row1, row2]
            });

            logger.debug({ user: message.author.tag, guild: message.guild?.name }, 'Bot mentioned');
        } catch (error) {
            logger.error({ error }, 'Failed to send mention response');
        }
    }
}
