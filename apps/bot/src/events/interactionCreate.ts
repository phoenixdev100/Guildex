/**
 * Interaction Create Event Handler
 * 
 * Handles all interactions (slash commands, buttons, modals, etc.).
 */

import type { Interaction } from 'discord.js';
import type { BotClient } from '../client';
import logger from '../config/logger';
import { apiClient } from '../utils/api-client';
import { getAdminRoleId } from '../utils/admin-role';
import { trackCommand } from '../utils/analytics';

export async function handleInteractionCreate(
    client: BotClient,
    interaction: Interaction
): Promise<void> {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
        const command = client.getCommand(interaction.commandName);

        if (!command) {
            logger.warn(`Unknown command: ${interaction.commandName}`);
            return;
        }

        // Check if in guild
        if (!interaction.guildId) {
            await interaction.reply({
                content: '❌ This command can only be used in a server.',
                ephemeral: true,
            });
            return;
        }

        // Track command usage for analytics
        trackCommand(interaction.guildId, interaction.commandName, interaction.user.id);

        // Check if module is enabled (optional - if API is down, allow command)
        // Exempt critical commands that should always work
        const exemptCommands = ['setup', 'help', 'ping', 'botinfo', 'serverinfo', 'userinfo'];
        const shouldCheckModule = command.category && !exemptCommands.includes(interaction.commandName);

        if (shouldCheckModule) {
            try {
                const moduleEnabled = await apiClient.isModuleEnabled(
                    interaction.guildId,
                    command.category
                );

                if (!moduleEnabled) {
                    await interaction.reply({
                        content: `❌ The **${command.category}** module is not enabled on this server. Use \`/setup\` to enable it.`,
                        ephemeral: true,
                    });
                    return;
                }
            } catch (error) {
                // If API is unavailable, allow command to execute
                logger.warn({ error, category: command.category }, 'Failed to check module status, allowing command');
            }
        }

        // Permission check: requiredPermission is enforced manually so the
        // guild's dashboard-assigned admin role also grants access.
        if (command.requiredPermission) {
            const hasPerm = interaction.memberPermissions?.has(command.requiredPermission as any) ?? false;
            if (!hasPerm) {
                const adminRoleId = await getAdminRoleId(interaction.guildId);
                const memberRoles = (interaction.member as any)?.roles;
                const hasAdminRole = adminRoleId
                    ? (memberRoles?.cache?.has?.(adminRoleId) ?? (Array.isArray(memberRoles) && memberRoles.includes(adminRoleId)))
                    : false;

                if (!hasAdminRole) {
                    await interaction.reply({
                        content: '❌ You need the required permission — or the server\'s configured admin role — to use this command.',
                        ephemeral: true,
                    });
                    return;
                }
            }
        }

        // Check cooldown
        const cooldown = client.isOnCooldown(interaction.user.id, command.data.name);
        if (cooldown !== null) {
            await interaction.reply({
                content: `⏱️ Please wait ${cooldown.toFixed(1)} seconds before using this command again.`,
                ephemeral: true,
            });
            return;
        }

        // Execute command
        try {
            logger.debug(
                {
                    command: interaction.commandName,
                    user: interaction.user.tag,
                    guild: interaction.guild?.name,
                },
                'Executing command'
            );

            await command.execute(interaction);
        } catch (error) {
            logger.error(
                {
                    error,
                    command: interaction.commandName,
                    user: interaction.user.tag,
                },
                'Command execution failed'
            );

            const errorMessage = {
                content: '❌ An error occurred while executing this command.',
                ephemeral: true,
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    }

    // Handle button interactions
    if (interaction.isButton()) {
        logger.debug(
            {
                customId: interaction.customId,
                user: interaction.user.tag,
            },
            'Button interaction'
        );

        try {
            // Handle bot mention buttons
            if (interaction.customId === 'view_commands') {
                await interaction.reply({
                    content: '📚 **Available Commands**\n\nUse `/help` to view all available commands organized by category!',
                    ephemeral: true
                });
            } else if (interaction.customId === 'setup_bot') {
                await interaction.reply({
                    content: '⚙️ **Quick Setup**\n\nUse `/setup` to run the interactive setup wizard and configure the bot for your server!',
                    ephemeral: true
                });
            } else if (interaction.customId === 'play_games') {
                await interaction.reply({
                    content: '🎮 **Games**\n\nTry these game commands:\n• `/game trivia` - Play trivia\n• `/game wordle` - Play Wordle\n• `/game chess` - Play chess\n• `/game blackjack` - Play blackjack\n\nAnd many more!',
                    ephemeral: true
                });
            } else if (interaction.customId === 'music_player') {
                await interaction.reply({
                    content: '🎵 **Music Player**\n\nTry these music commands:\n• `/music play` - Play a song\n• `/music queue` - View queue\n• `/music skip` - Skip song\n• `/music pause` - Pause playback\n\nAnd many more!',
                    ephemeral: true
                });
            }
        } catch (error) {
            logger.error({ error, customId: interaction.customId }, 'Button interaction failed');
        }
    }

    // Handle select menu interactions
    if (interaction.isStringSelectMenu()) {
        logger.debug(
            {
                customId: interaction.customId,
                user: interaction.user.tag,
            },
            'Select menu interaction'
        );

        try {
            // Handle setup wizard select menu
            if (interaction.customId === 'setup_module') {
                const selectedModule = interaction.values[0];

                const moduleInfo: Record<string, { title: string; description: string; emoji: string }> = {
                    moderation: {
                        title: 'Moderation Setup',
                        emoji: '🛡️',
                        description: 'Configure moderation settings, auto-mod, logging, and more.'
                    },
                    welcome: {
                        title: 'Welcome System Setup',
                        emoji: '👋',
                        description: 'Setup welcome and goodbye messages for new members.'
                    },
                    leveling: {
                        title: 'Leveling Setup',
                        emoji: '⭐',
                        description: 'Configure the XP and leveling system for your server.'
                    },
                    economy: {
                        title: 'Economy Setup',
                        emoji: '💰',
                        description: 'Setup the economy system with currency and shop.'
                    },
                    tickets: {
                        title: 'Tickets Setup',
                        emoji: '🎫',
                        description: 'Configure the support ticket system.'
                    },
                    verification: {
                        title: 'Verification Setup',
                        emoji: '✅',
                        description: 'Setup member verification to protect your server.'
                    }
                };

                const info = moduleInfo[selectedModule];

                if (info) {
                    await interaction.update({
                        content: `${info.emoji} **${info.title}**\n\n${info.description}\n\n**This feature is currently being developed!**\n\nIn the meantime, you can:\n• Use specific setup commands like \`/verification setup\`\n• Use \`/autorole\` to setup auto-roles\n• Use \`/reactionrole\` to setup reaction roles\n• Use \`/logs\` to setup logging`,
                        components: []
                    });
                } else {
                    await interaction.update({
                        content: '❌ Unknown module selected.',
                        components: []
                    });
                }
            }
            // Help command select menu is handled in the help command itself via collector
        } catch (error) {
            logger.error({ error, customId: interaction.customId }, 'Select menu interaction failed');

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred while processing this interaction.',
                    ephemeral: true
                });
            }
        }
    }

    // Handle modal submissions
    if (interaction.isModalSubmit()) {
        logger.debug(
            {
                customId: interaction.customId,
                user: interaction.user.tag,
            },
            'Modal submission'
        );
        // Modal handlers will be implemented in modules
    }
}
