/**
 * Module Definitions
 *
 * Canonical list of feature modules. Each module name maps to a bot
 * command category - the interaction handler checks whether a command's
 * category module is enabled for the guild before executing it.
 */

export interface ModuleDefinition {
    name: string;
    description: string;
    category: string;
    isDefault: boolean;
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
    { name: 'moderation', description: 'Moderation tools: ban, kick, mute, warn, cases', category: 'moderation', isDefault: true },
    { name: 'automod', description: 'Automatic moderation: spam, caps, mentions, links', category: 'moderation', isDefault: true },
    { name: 'utility', description: 'Utility and productivity commands', category: 'utility', isDefault: true },
    { name: 'setup', description: 'Server setup, autoroles and reaction roles', category: 'utility', isDefault: true },
    { name: 'admin', description: 'Administration commands: announce, say, purge', category: 'moderation', isDefault: true },
    { name: 'logs', description: 'Server logging configuration', category: 'moderation', isDefault: true },
    { name: 'leveling', description: 'XP, levels and leaderboards', category: 'engagement', isDefault: false },
    { name: 'economy', description: 'Currency, daily rewards, shop', category: 'engagement', isDefault: false },
    { name: 'tickets', description: 'Support ticket system', category: 'support', isDefault: false },
    { name: 'community', description: 'Community engagement: welcome, profiles, rep', category: 'engagement', isDefault: false },
    { name: 'fun', description: 'Fun commands: 8ball, memes, jokes', category: 'fun', isDefault: false },
    { name: 'games', description: 'Mini-games: trivia, chess, wordle', category: 'fun', isDefault: false },
    { name: 'music', description: 'Music playback and queue management', category: 'media', isDefault: false },
    { name: 'ai', description: 'AI-powered features', category: 'ai', isDefault: false },
    { name: 'giveaway', description: 'Giveaway management', category: 'engagement', isDefault: false },
    { name: 'suggestions', description: 'Server suggestions system', category: 'engagement', isDefault: false },
    { name: 'voice', description: 'Voice channel management', category: 'media', isDefault: false },
    { name: 'events', description: 'Event scheduling and attendance', category: 'utility', isDefault: false },
    { name: 'search', description: 'Search commands: google, youtube, wikipedia', category: 'utility', isDefault: false },
    { name: 'social', description: 'Social interactions: hug, pat, highfive', category: 'fun', isDefault: false },
    { name: 'emoji', description: 'Emoji management', category: 'utility', isDefault: false },
    { name: 'image', description: 'Image generation and manipulation', category: 'media', isDefault: false },
    { name: 'starboard', description: 'Starboard for highlighted messages', category: 'engagement', isDefault: false },
    { name: 'afk', description: 'AFK status system', category: 'utility', isDefault: false },
    { name: 'birthday', description: 'Birthday tracking and announcements', category: 'engagement', isDefault: false },
    { name: 'analytics', description: 'Server analytics and statistics', category: 'analytics', isDefault: false },
    { name: 'applications', description: 'Staff application forms', category: 'engagement', isDefault: false },
    { name: 'autoresponder', description: 'Auto-responses to message triggers', category: 'utility', isDefault: false },
    { name: 'confessions', description: 'Anonymous confessions channel', category: 'engagement', isDefault: false },
    { name: 'counting', description: 'Counting channel game', category: 'fun', isDefault: false },
    { name: 'customcommands', description: 'Guild-defined custom commands', category: 'utility', isDefault: false },
    { name: 'dev', description: 'Bot owner/developer tools', category: 'system', isDefault: false },
    { name: 'invites', description: 'Invite tracking and rewards', category: 'engagement', isDefault: false },
    { name: 'marriage', description: 'Marriage and family roleplay system', category: 'fun', isDefault: false },
    { name: 'notifications', description: 'YouTube/Twitch/Reddit alert notifications', category: 'media', isDefault: false },
    { name: 'pets', description: 'Virtual pet system', category: 'fun', isDefault: false },
    { name: 'qotd', description: 'Question of the day', category: 'engagement', isDefault: false },
    { name: 'reports', description: 'User report system for staff', category: 'moderation', isDefault: false },
    { name: 'security', description: 'Lockdown, raid mode and quarantine', category: 'moderation', isDefault: false },
    { name: 'stats', description: 'Server statistics and counter channels', category: 'analytics', isDefault: false },
    { name: 'stickymessages', description: 'Sticky messages that repost in channels', category: 'utility', isDefault: false },
    { name: 'tags', description: 'Saved text tag snippets', category: 'utility', isDefault: false },
    { name: 'tempvoice', description: 'Join-to-create temporary voice channels', category: 'media', isDefault: false },
    { name: 'translation', description: 'Text translation commands', category: 'utility', isDefault: false },
];

export const MODULE_NAMES = MODULE_DEFINITIONS.map((m) => m.name);
