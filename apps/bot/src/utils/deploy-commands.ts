/**
 * Command Deployer
 * 
 * Deploys slash commands to Discord.
 */

import { REST, Routes } from 'discord.js';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { BotClient } from '../client';
import { env } from '../config/env';
import logger from '../config/logger';

// Hash file lives next to the bot package root (gitignored)
const HASH_FILE = join(__dirname, '..', '..', '.deploy-hash');

/**
 * Stable fingerprint of the deployable command set.
 * Only the first 100 commands actually get deployed (Discord limit),
 * so the hash covers exactly what would be sent.
 */
function computeCommandsHash(client: BotClient): string {
    const sorted = sortCommandsForDeploy(client);
    const payload = sorted.slice(0, 100).map((cmd) => cmd.data.toJSON());
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function hasCommandsChanged(client: BotClient): boolean {
    try {
        const stored = readFileSync(HASH_FILE, 'utf-8').trim();
        return stored !== computeCommandsHash(client);
    } catch {
        return true; // no stored hash → first deploy
    }
}

export function saveCommandsHash(client: BotClient): void {
    try {
        writeFileSync(HASH_FILE, computeCommandsHash(client), 'utf-8');
    } catch (error) {
        logger.warn({ error }, 'Failed to save deploy hash');
    }
}

/** Implemented commands first, then stubs - then category priority. */
function sortCommandsForDeploy(client: BotClient) {
    const allCommands = Array.from(client.commands.values());

    // Priority categories (most important first)
    const priorityOrder = [
        'moderation', 'automod', 'security', 'tickets', 'setup', 'utility',
        'admin', 'logs', 'economy', 'leveling', 'community', 'fun',
        'games', 'music', 'ai', 'giveaway', 'suggestions', 'voice',
        'events', 'search', 'social', 'emoji', 'image', 'starboard',
        'afk', 'birthday', 'analytics', 'applications', 'autoresponder',
        'confessions', 'counting', 'customcommands', 'invites', 'marriage',
        'notifications', 'pets', 'qotd', 'reports', 'stats',
        'stickymessages', 'tags', 'tempvoice', 'translation', 'dev'
    ];

    return allCommands.sort((a, b) => {
        const aStub = isStubCommand(a);
        const bStub = isStubCommand(b);
        if (aStub !== bStub) return aStub ? 1 : -1;

        const aPriority = priorityOrder.indexOf(getCategoryFromCommand(a));
        const bPriority = priorityOrder.indexOf(getCategoryFromCommand(b));

        if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
        if (aPriority !== -1) return -1;
        if (bPriority !== -1) return 1;
        return 0;
    });
}

export async function deployCommands(client: BotClient): Promise<void> {
    const rest = new REST({ version: '10' }).setToken(env.DISCORD_BOT_TOKEN);

    const commands = Array.from(client.commands.values()).map((cmd) =>
        cmd.data.toJSON()
    );

    try {
        logger.info(`🔄 Deploying ${commands.length} slash commands...`);

        // Deploy commands globally
        await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), {
            body: commands,
        });

        logger.info(`✅ Successfully deployed ${commands.length} slash commands globally`);
    } catch (error) {
        logger.error({ error }, 'Failed to deploy commands');
        throw error;
    }
}

/**
 * Deploy commands to a specific guild (for testing)
 * Limited to 100 commands due to Discord's limit
 */
export async function deployGuildCommands(
    client: BotClient,
    guildId: string
): Promise<void> {
    const rest = new REST({ version: '10' }).setToken(env.DISCORD_BOT_TOKEN);

    // Implemented commands always deploy before stubs - see
    // sortCommandsForDeploy for the shared ordering.
    const allCommands = Array.from(client.commands.values());
    const sortedCommands = sortCommandsForDeploy(client);

    // Take only first 100 commands
    const commandsToDeploy = sortedCommands.slice(0, 100);
    const commands = commandsToDeploy.map((cmd) => cmd.data.toJSON());

    try {
        logger.info(`🔄 Deploying ${commands.length} commands to guild ${guildId}...`);
        logger.warn(`⚠️  Limited to 100 commands (${allCommands.length - 100} commands not deployed due to Discord limit)`);

        await rest.put(
            Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, guildId),
            { body: commands }
        );

        logger.info(`✅ Successfully deployed ${commands.length} commands to guild ${guildId}`);

        // Log which commands were deployed
        const deployedCategories = new Map<string, number>();
        commandsToDeploy.forEach(cmd => {
            const cat = getCategoryFromCommand(cmd);
            deployedCategories.set(cat, (deployedCategories.get(cat) || 0) + 1);
        });

        logger.info('📊 Deployed commands by category:');
        deployedCategories.forEach((count, category) => {
            logger.info(`   ${category}: ${count} commands`);
        });
    } catch (error) {
        logger.error({ error, guildId }, 'Failed to deploy guild commands');
        throw error;
    }
}

/**
 * Detects placeholder commands whose execute body is the standard
 * "Command In Development" stub template.
 */
function isStubCommand(cmd: any): boolean {
    try {
        return cmd.execute?.toString().includes('Command In Development') ?? false;
    } catch {
        return false;
    }
}

/**
 * Helper function to determine command category
 */
function getCategoryFromCommand(cmd: any): string {
    // Try to get category from command metadata or name
    if (cmd.category) return cmd.category;

    // Common command name patterns
    const name = cmd.data.name.toLowerCase();

    if (['ban', 'kick', 'mute', 'warn', 'timeout', 'antispam', 'antiraid', 'antinuke', 'filter', 'clear', 'lock', 'unlock', 'slowmode', 'nuke', 'softban', 'unban', 'unmute', 'untimeout', 'warnings', 'clearwarnings', 'case', 'clone'].includes(name)) return 'moderation';
    if (['setup', 'autorole', 'reactionrole', 'buttonrole', 'verification', 'verify', 'backup', 'import', 'export', 'role'].includes(name)) return 'setup';
    if (['help', 'ping', 'avatar', 'userinfo', 'serverinfo', 'channelinfo', 'roleinfo', 'botinfo', 'calc', 'remind', 'reminders', 'poll', 'pollend', 'pollresults', 'note', 'todo', 'snipe', 'editsnipe', 'convert', 'timezone', 'schedule', 'vote'].includes(name)) return 'utility';
    if (['announce', 'embed', 'say', 'dm', 'purge', 'nickname'].includes(name)) return 'admin';
    if (['logs'].includes(name)) return 'logs';
    if (['balance', 'daily', 'weekly', 'work', 'beg', 'rob', 'pay', 'shop', 'buy', 'sell', 'inventory', 'use', 'trade', 'deposit', 'withdraw', 'flip'].includes(name)) return 'economy';
    if (['rank', 'leaderboard', 'addxp', 'removexp', 'setxp', 'levelroles', 'prestige'].includes(name)) return 'leveling';
    if (['welcome', 'goodbye', 'introduce', 'introductions', 'profile', 'rep', 'streak', 'milestone', 'engage', 'prompt', 'question', 'icebreaker'].includes(name)) return 'community';
    if (['trivia', 'chess', 'tictactoe', 'akinator', 'wordle', 'hangman', 'blackjack', 'poker', 'slots', 'dice', 'connect4', 'uno', 'mathgame', 'memorygame', 'reactiongame', 'typingtest', 'gamestats', 'gameleaderboard'].includes(name)) return 'games';
    if (['8ball', 'meme', 'joke', 'fact', 'quote', 'roll', 'choose', 'coinflip'].includes(name)) return 'fun';
    if (['play', 'pause', 'resume', 'skip', 'stop', 'queue', 'queueclear', 'queueremove', 'queueshuffle', 'nowplaying', 'volume', 'loop', 'seek', 'previous', 'lyrics', 'playlist', 'filters'].includes(name)) return 'music';
    if (['ai', 'aiimage', 'context', 'grammar', 'memory', 'aimoderate', 'personality', 'toxicity', 'voice'].includes(name)) return 'ai';
    if (['gstart', 'gend', 'greroll', 'glist'].includes(name)) return 'giveaway';
    if (['ticket'].includes(name)) return 'tickets';
    if (['suggest', 'suggestsetup', 'approve', 'deny'].includes(name)) return 'suggestions';
    if (['join', 'leave', 'move', 'vcmute', 'vcunmute', 'deafen', 'undeafen'].includes(name)) return 'voice';
    if (['event', 'eventremind', 'attendance'].includes(name)) return 'events';
    if (['google', 'youtube', 'wikipedia', 'weather'].includes(name)) return 'search';
    if (['hug', 'kiss', 'slap', 'pat', 'highfive'].includes(name)) return 'social';
    if (['addemoji', 'removeemoji', 'emojilist', 'steal'].includes(name)) return 'emoji';
    if (['memegen', 'blur', 'triggered'].includes(name)) return 'image';
    if (['starboard'].includes(name)) return 'starboard';
    if (['afk'].includes(name)) return 'afk';
    if (['birthday'].includes(name)) return 'birthday';
    if (['analytics', 'heatmap'].includes(name)) return 'analytics';
    if (['automod'].includes(name)) return 'automod';

    return 'other';
}
