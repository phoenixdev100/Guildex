/**
 * Ready Event Handler
 * 
 * Fired when the bot successfully connects to Discord.
 */

import type { BotClient } from '../client';
import logger from '../config/logger';
import { apiClient } from '../utils/api-client';
import { deployGuildCommands, hasCommandsChanged, saveCommandsHash } from '../utils/deploy-commands';
import { env } from '../config/env';

export async function handleReady(client: BotClient): Promise<void> {
    logger.info(`✅ Bot logged in as ${client.user?.tag}`);
    logger.info(`📊 Serving ${client.guilds.cache.size} guilds`);

    // Deploy commands to all guilds - but only when definitions changed
    // (tsx watch restarts on every file save; Discord rate-limits guild
    // command deploys to ~200/day, so blind redeploys are risky)
    const shouldDeploy =
        env.DEPLOY_COMMANDS === 'always' ||
        (env.DEPLOY_COMMANDS === 'changed' && hasCommandsChanged(client));

    if (shouldDeploy) {
        logger.info('🚀 Deploying commands to Discord...');
        const guilds = client.guilds.cache;
        logger.info(`📊 Deploying ${client.commands.size} commands to ${guilds.size} guild(s)...`);

        let allSucceeded = true;
        for (const [guildId, guild] of guilds) {
            try {
                await deployGuildCommands(client, guildId);
                logger.info(`✅ Deployed commands to ${guild.name}`);
            } catch (error) {
                allSucceeded = false;
                logger.error({ error, guildId, guildName: guild.name }, `❌ Failed to deploy to ${guild.name}`);
            }
        }

        if (allSucceeded) {
            saveCommandsHash(client);
            logger.info('✅ Commands deployed successfully');
        }
    } else {
        logger.info('⏭️  Commands unchanged - skipping deploy');
    }

    // Check API connectivity
    const apiHealthy = await apiClient.healthCheck();
    if (apiHealthy) {
        logger.info('✅ API connection healthy');

        // Sync guilds with API
        logger.info('🔄 Syncing guilds with API...');
        for (const [guildId, guild] of client.guilds.cache) {
            try {
                await apiClient.registerGuild(guildId, {
                    name: guild.name,
                    icon: guild.icon,
                    ownerId: guild.ownerId,
                });
                logger.info(`✅ Synced guild: ${guild.name}`);
            } catch (error) {
                logger.error({ error, guildId: guild.id }, `failed to sync guild ${guild.name}`);
            }
        }
    } else {
        logger.warn('⚠️  API connection failed - some features may not work');
    }

    // Set bot presence
    client.user?.setPresence({
        status: 'online',
        activities: [
            {
                name: `/help | ${client.guilds.cache.size} servers | ${client.commands.size} commands`,
                type: 0, // Playing
            },
        ],
    });

    logger.info('🤖 Bot is ready!');
}
