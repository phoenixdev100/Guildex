/**
 * Event Loader
 * 
 * Registers all event handlers with the Discord client.
 */

import type { BotClient } from '../client';
import logger from '../config/logger';

// Import event handlers
import { handleReady } from '../events/ready';
import { handleGuildCreate } from '../events/guildCreate';
import { handleGuildDelete } from '../events/guildDelete';
import { handleGuildMemberAdd } from '../events/guildMemberAdd';
import { handleGuildMemberRemove } from '../events/guildMemberRemove';
import { handleInteractionCreate } from '../events/interactionCreate';
import { handleMessageCreate } from '../events/messageCreate';
import { handleMessageReactionAdd, handleMessageReactionRemove } from '../events/messageReactionAdd';
import { handleError } from '../events/error';
import { handleWarn } from '../events/warn';

export function loadEvents(client: BotClient): void {
    // Ready event
    client.once('clientReady', () => handleReady(client));

    // Guild events
    client.on('guildCreate', (guild) => handleGuildCreate(client, guild));
    client.on('guildDelete', (guild) => handleGuildDelete(client, guild));
    client.on('guildMemberAdd', (member) => handleGuildMemberAdd(client, member));
    client.on('guildMemberRemove', (member) => handleGuildMemberRemove(client, member));

    // Reaction role events
    client.on('messageReactionAdd', (reaction, user) =>
        handleMessageReactionAdd(client, reaction, user)
    );
    client.on('messageReactionRemove', (reaction, user) =>
        handleMessageReactionRemove(client, reaction, user)
    );

    // Interaction events
    client.on('interactionCreate', (interaction) =>
        handleInteractionCreate(client, interaction)
    );

    // Message events
    client.on('messageCreate', (message) =>
        handleMessageCreate(client, message)
    );

    // Error events
    client.on('error', (error) => handleError(client, error));
    client.on('warn', (warning) => handleWarn(client, warning));

    logger.info('✅ Loaded event handlers');
}
