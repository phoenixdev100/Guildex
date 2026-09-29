/**
 * Help Command
 *
 * Interactive help menu with a single A–Z category dropdown
 * (paged since Discord allows max 25 options per menu),
 * paginated command views and per-category theming.
 *
 * All embeds and components are precomputed once at invocation so
 * button clicks only do a map lookup - no rebuilding per render.
 */

import {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    ButtonInteraction,
    MessageFlags,
    Message,
} from 'discord.js';
import type { Command } from '../types/command';

const BRAND_COLOR = 0x5865f2;
const CATS_PER_MENU = 25; // Discord select-menu option limit
const MAX_EMBED_DESC = 3900; // stay safely under Discord's 4096-char description limit

// Category metadata: emoji + description + accent color
const categoryInfo: Record<string, { emoji: string; description: string; color: number }> = {
    moderation: { emoji: '🛡️', description: 'Moderation and safety tools', color: 0xed4245 },
    automod: { emoji: '🤖', description: 'Automatic moderation rules', color: 0xed4245 },
    security: { emoji: '🔒', description: 'Lockdown, raid mode, quarantine', color: 0x992d22 },
    admin: { emoji: '⚙️', description: 'Server administration commands', color: 0x5865f2 },
    setup: { emoji: '🔧', description: 'Server setup and configuration', color: 0x57f287 },
    logs: { emoji: '📝', description: 'Server event logging', color: 0x95a5a6 },
    tickets: { emoji: '🎫', description: 'Support ticket system', color: 0x5865f2 },
    reports: { emoji: '🚩', description: 'Report users to staff', color: 0xe67e22 },
    applications: { emoji: '📋', description: 'Staff application forms', color: 0x5865f2 },
    utility: { emoji: '🔨', description: 'Useful utility commands', color: 0xfee75c },
    stats: { emoji: '📈', description: 'Server statistics and counters', color: 0x00ced1 },
    analytics: { emoji: '📊', description: 'Server analytics', color: 0x00ced1 },
    customcommands: { emoji: '✏️', description: 'Custom server commands', color: 0x57f287 },
    autoresponder: { emoji: '💬', description: 'Auto-reply to triggers', color: 0x57f287 },
    counting: { emoji: '🔢', description: 'Counting channel game', color: 0x3498db },
    invites: { emoji: '✉️', description: 'Invite tracking and rewards', color: 0x7289da },
    notifications: { emoji: '🔔', description: 'YouTube/Twitch/Reddit alerts', color: 0xe74c3c },
    stickymessages: { emoji: '📌', description: 'Sticky channel messages', color: 0x95a5a6 },
    tags: { emoji: '🏷️', description: 'Saved text snippets', color: 0x5865f2 },
    tempvoice: { emoji: '🎙️', description: 'Join-to-create voice channels', color: 0x3498db },
    translation: { emoji: '🌐', description: 'Text translation', color: 0x1abc9c },
    dev: { emoji: '💻', description: 'Bot owner tools', color: 0x23272a },
    economy: { emoji: '💰', description: 'Currency, rewards and shop', color: 0xf1c40f },
    leveling: { emoji: '⭐', description: 'XP, levels and leaderboards', color: 0x9b59b6 },
    fun: { emoji: '🎮', description: 'Fun and entertainment', color: 0xeb459e },
    games: { emoji: '🎲', description: 'Interactive mini-games', color: 0xeb459e },
    music: { emoji: '🎵', description: 'Music player and queue', color: 0x1db954 },
    ai: { emoji: '🧠', description: 'AI-powered features', color: 0x00d9ff },
    community: { emoji: '👥', description: 'Community engagement', color: 0x57f287 },
    social: { emoji: '💕', description: 'Social interactions', color: 0xff69b4 },
    giveaway: { emoji: '🎁', description: 'Giveaway management', color: 0xf47fff },
    suggestions: { emoji: '💡', description: 'Suggestion system', color: 0xfee75c },
    voice: { emoji: '🔊', description: 'Voice channel management', color: 0x3498db },
    events: { emoji: '📅', description: 'Event scheduling', color: 0xe91e63 },
    search: { emoji: '🔍', description: 'Search and information', color: 0x00bfff },
    emoji: { emoji: '😀', description: 'Emoji management', color: 0xffd700 },
    image: { emoji: '🖼️', description: 'Image manipulation', color: 0x9b59b6 },
    starboard: { emoji: '🌟', description: 'Starboard highlights', color: 0xf1c40f },
    afk: { emoji: '💤', description: 'AFK status system', color: 0x95a5a6 },
    birthday: { emoji: '🎂', description: 'Birthday tracking', color: 0xff73fa },
    pets: { emoji: '🐾', description: 'Virtual pets', color: 0xe67e22 },
    marriage: { emoji: '💍', description: 'Marriage and family system', color: 0xff69b4 },
    confessions: { emoji: '🤫', description: 'Anonymous confessions', color: 0x2c3e50 },
    qotd: { emoji: '❓', description: 'Question of the day', color: 0x9b59b6 },
};

interface CommandEntry {
    name: string;
    description: string;
}

function buildMainEmbed(
    interaction: any,
    totalCommands: number,
    totalCategories: number
): EmbedBuilder {
    const botUser = interaction.client.user;

    return new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setAuthor({
            name: `${botUser?.username ?? 'Bot'} - Help Center`,
            iconURL: botUser?.displayAvatarURL() ?? undefined,
        })
        .setThumbnail(botUser?.displayAvatarURL({ size: 256 }) ?? null)
        .setDescription(
            '**Welcome to the help menu!** 👋\n\n' +
            'Browse all commands organized by category. Pick a category from the dropdown below to see what each command does.'
        )
        .addFields(
            { name: '📊 Commands', value: `**${totalCommands}**`, inline: true },
            { name: '📁 Categories', value: `**${totalCategories}**`, inline: true },
            { name: '🌐 Servers', value: `**${interaction.client.guilds.cache.size}**`, inline: true },
            {
                name: '💡 Quick Tips',
                value:
                    '• `/command` - run any command directly\n' +
                    '• Dropdown lists every category **A → Z**\n' +
                    '• Use **◀ ▶** to flip through the category list and long categories',
                inline: false,
            }
        )
        .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();
}

export const help: Command = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Browse all commands by category')
        .setDMPermission(true),
    category: 'utility',

    async execute(interaction: any) {
        try {
            const client = interaction.client;

            if (!client?.commands) {
                throw new Error('Bot client is not properly initialized');
            }

            // --- Precompute everything once: zero work per click ---

            const commandsByCategory: Record<string, CommandEntry[]> = {};
            for (const [name, command] of client.commands) {
                const category = (command as any).category || 'other';
                (commandsByCategory[category] ??= []).push({
                    name,
                    description: (command as any).data?.description ?? 'No description',
                });
            }
            for (const list of Object.values(commandsByCategory)) {
                list.sort((a, b) => a.name.localeCompare(b.name));
            }

            const allCategories = Object.keys(commandsByCategory).sort((a, b) => a.localeCompare(b));
            const catTotalPages = Math.max(1, Math.ceil(allCategories.length / CATS_PER_MENU));

            // Prebuilt select-menu row for each category-list page
            const menuRows: ActionRowBuilder<StringSelectMenuBuilder>[] = [];
            for (let cp = 0; cp < catTotalPages; cp++) {
                const pageCats = allCategories.slice(cp * CATS_PER_MENU, (cp + 1) * CATS_PER_MENU);
                menuRows.push(
                    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('help_category')
                            .setPlaceholder('📂 Select a category (A–Z)')
                            .addOptions(
                                pageCats.map((category) => ({
                                    label: category.charAt(0).toUpperCase() + category.slice(1),
                                    description: categoryInfo[category]?.description
                                        ?? `${commandsByCategory[category]?.length ?? 0} commands`,
                                    value: category,
                                    emoji: categoryInfo[category]?.emoji ?? '📁',
                                }))
                            )
                    )
                );
            }

            // Prebuilt category-nav rows for each page
            const catNavRows: ActionRowBuilder<ButtonBuilder>[] = [];
            for (let cp = 0; cp < catTotalPages; cp++) {
                catNavRows.push(
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder().setCustomId('help_home').setEmoji('🏠').setLabel('Home').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('help_all').setEmoji('📖').setLabel('All').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('help_catprev').setEmoji('◀️').setStyle(ButtonStyle.Primary).setDisabled(cp === 0),
                        new ButtonBuilder().setCustomId('help_catpage').setLabel(`${cp + 1}/${catTotalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
                        new ButtonBuilder().setCustomId('help_catnext').setEmoji('▶️').setStyle(ButtonStyle.Primary).setDisabled(cp >= catTotalPages - 1),
                    )
                );
            }

            // Prebuilt embed for every category - all commands on one page
            const categoryEmbeds = new Map<string, EmbedBuilder>();
            for (const category of allCategories) {
                const commands = commandsByCategory[category];
                const info = categoryInfo[category] ?? { emoji: '📁', description: 'Commands', color: BRAND_COLOR };

                let body = `${info.description}\n\n` +
                    commands.map((c) => `\`/${c.name}\` - ${c.description}`).join('\n');

                // Defensive: truncate if a category ever exceeds the embed limit
                if (body.length > MAX_EMBED_DESC) {
                    body = body.slice(0, MAX_EMBED_DESC - 30) + '\n*… truncated*';
                }

                categoryEmbeds.set(
                    category,
                    new EmbedBuilder()
                        .setColor(info.color)
                        .setTitle(`${info.emoji} ${category.charAt(0).toUpperCase() + category.slice(1)}`)
                        .setDescription(body)
                        .setFooter({
                            text: `${commands.length} commands • Category: ${category}`,
                            iconURL: interaction.user.displayAvatarURL(),
                        })
                );
            }

            const mainEmbed = buildMainEmbed(interaction, client.commands.size, allCategories.length);

            // "All Commands" directory - every category + all command names,
            // chunked across embeds to stay under Discord's limits
            const allEmbeds: EmbedBuilder[] = [];
            {
                let embed = new EmbedBuilder()
                    .setColor(BRAND_COLOR)
                    .setTitle('📖 All Commands - Full Directory');
                let used = 0;
                for (const category of allCategories) {
                    const info = categoryInfo[category] ?? { emoji: '📁', description: '', color: BRAND_COLOR };
                    const names = commandsByCategory[category].map((c) => `\`/${c.name}\``).join('  ');
                    const block = `**${info.emoji} ${category.charAt(0).toUpperCase() + category.slice(1)}** (${commandsByCategory[category].length})\n${names}\n\n`;

                    if (used + block.length > MAX_EMBED_DESC) {
                        allEmbeds.push(embed);
                        embed = new EmbedBuilder().setColor(BRAND_COLOR);
                        used = 0;
                    }
                    embed.setDescription((embed.data.description ?? '') + block);
                    used += block.length;
                }
                allEmbeds.push(embed);
                allEmbeds[allEmbeds.length - 1].setFooter({
                    text: `${client.commands.size} commands across ${allCategories.length} categories`,
                });
            }

            // --- Interactive state ---
            let view: 'home' | 'category' | 'all' = 'home';
            let currentCategory = allCategories[0] ?? '';
            let catPage = 0; // which slice of the A–Z list the dropdown shows

            const render = () => {
                const components: (ActionRowBuilder<StringSelectMenuBuilder> | ActionRowBuilder<ButtonBuilder>)[] = [
                    menuRows[catPage],
                    catNavRows[catPage],
                ];

                if (view === 'home') {
                    return { embeds: [mainEmbed], components };
                }
                if (view === 'all') {
                    return { embeds: allEmbeds, components };
                }

                return {
                    embeds: [categoryEmbeds.get(currentCategory)!],
                    components,
                };
            };

            const response = (await interaction.reply({
                ...render(),
                flags: MessageFlags.Ephemeral,
                fetchReply: true,
            })) as Message;

            const collector = response.createMessageComponentCollector({
                time: 300_000, // 5 minutes
            });

            collector.on('collect', (i: StringSelectMenuInteraction | ButtonInteraction) => {
                if (i.user.id !== interaction.user.id) {
                    void i.reply({ content: '❌ This menu is not for you!', flags: MessageFlags.Ephemeral });
                    return;
                }

                if (i.isStringSelectMenu()) {
                    currentCategory = i.values[0];
                    view = 'category';
                } else if (i.isButton()) {
                    switch (i.customId) {
                        case 'help_home':
                            view = 'home';
                            break;
                        case 'help_all':
                            view = 'all';
                            break;
                        case 'help_catprev':
                            catPage = Math.max(0, catPage - 1);
                            break;
                        case 'help_catnext':
                            catPage = Math.min(catTotalPages - 1, catPage + 1);
                            break;
                    }
                }

                // .catch: a failed update must not crash the bot via unhandledRejection
                void i.update(render()).catch(() => {});
            });

            collector.on('end', async () => {
                try {
                    // Disable components when the menu expires
                    const menu = ActionRowBuilder.from(menuRows[catPage]) as ActionRowBuilder<StringSelectMenuBuilder>;
                    menu.components.forEach((c) => c.setDisabled(true));
                    const nav = ActionRowBuilder.from(catNavRows[catPage]) as ActionRowBuilder<ButtonBuilder>;
                    nav.components.forEach((c) => c.setDisabled(true));
                    await interaction.editReply({ components: [menu, nav] });
                } catch {
                    // Message may have been deleted
                }
            });
        } catch (error) {
            console.error('Help command error:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle('❌ Error')
                .setDescription('An error occurred while loading the help menu. Please try again later.')
                .setTimestamp();

            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed], components: [] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            }
        }
    },
};
