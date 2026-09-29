/**
 * Command Structure
 * 
 * Base types and interfaces for slash commands.
 */

import type {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    SlashCommandSubcommandsOnlyBuilder,
    SlashCommandOptionsOnlyBuilder,
} from 'discord.js';
import type { BotClient } from '../client';

/**
 * Command execution context
 */
export interface CommandContext {
    interaction: ChatInputCommandInteraction;
    client: BotClient;
}

/**
 * Command definition
 */
export interface Command {
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder;
    category: string; // Category name (e.g., 'moderation', 'utility', 'automod', 'leveling', 'economy', 'tickets')
    permissions?: string[]; // Required permissions
    /**
     * Discord permission bitfield required to run this command.
     * Enforced manually in interactionCreate - members holding the
     * guild's dashboard-assigned admin role also pass. (Cannot use
     * setDefaultMemberPermissions, since Discord-side gating would
     * block admin-role members from ever invoking the command.)
     */
    requiredPermission?: bigint;
    cooldown?: number; // Cooldown in seconds
    execute: (interaction: ChatInputCommandInteraction) => Promise<void | any>;
}

/**
 * Command category for organization
 */
export enum CommandCategory {
    MODERATION = 'moderation',
    UTILITY = 'utility',
    AUTOMOD = 'automod',
    LEVELING = 'leveling',
    ECONOMY = 'economy',
    TICKETS = 'tickets',
    ADMIN = 'admin',
}
