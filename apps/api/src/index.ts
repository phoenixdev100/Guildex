/**
 * API Entry Point
 * 
 * Initializes and starts the API server.
 */

import 'dotenv/config';
import { createServer } from './server';
import { initializeDatabase, prisma } from './config/database';
import redis from './config/redis';
import logger from './config/logger';
import { env } from './config/env';

// Import routes
import { authRoutes } from './routes/auth';
import { healthRoutes } from './routes/health';
import { moderationRoutes } from './routes/moderation';
import { moderationExtendedRoutes } from './routes/moderation-extended';
import { autoModRoutes } from './routes/automod';
import { guildRoutes } from './routes/guilds';
import { economyRoutes } from './routes/economy';
import { levelingRoutes } from './routes/leveling';
import { remindersRoutes } from './routes/reminders';
import { dashboardRoutes } from './routes/dashboard';
import { featureRoutes } from './routes/features';
import { analyticsRoutes } from './routes/analytics';
import { applicationRoutes } from './routes/applications';

async function main() {
    try {
        logger.info('🚀 Starting Discord Bot Platform API...');

        // Initialize database
        try {
            if (env.DATABASE_URL) {
                await initializeDatabase();
                logger.info('✅ Database connected');
            } else {
                logger.warn('⚠️ No DATABASE_URL found, skipping database connection');
            }
        } catch (error) {
            logger.warn({ error }, '⚠️ Database connection failed, continuing without database...');
        }

        // Test Redis connection
        try {
            await redis.ping();
            logger.info('✅ Redis connected');
        } catch (error) {
            logger.warn({ error }, '⚠️ Redis connection failed, continuing without Redis...');
        }

        // Create server
        const app = await createServer();

        // Register routes
        await app.register(healthRoutes, { prefix: '/api/health' });
        await app.register(authRoutes, { prefix: '/api/auth' });
        await app.register(guildRoutes, { prefix: '/api/guilds' });
        await app.register(moderationRoutes, { prefix: '/api' });
        await app.register(moderationExtendedRoutes, { prefix: '/api' });
        await app.register(autoModRoutes, { prefix: '/api' });
        await app.register(economyRoutes, { prefix: '/api' });
        await app.register(levelingRoutes, { prefix: '/api' });
        await app.register(remindersRoutes, { prefix: '/api' });
        await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
        await app.register(featureRoutes, { prefix: '/api' });
        await app.register(analyticsRoutes, { prefix: '/api' });
        await app.register(applicationRoutes, { prefix: '/api' });

        // Start server
        await app.listen({
            port: env.API_PORT,
            host: env.API_HOST,
        });

        logger.info(`✅ API server running on ${env.API_URL}`);
        if (env.NODE_ENV === 'development') {
            logger.info(`📚 API documentation available at ${env.API_URL}/docs`);
        }
    } catch (error) {
        logger.error({ error }, '❌ Failed to start API server');
        process.exit(1);
    }
}

// Graceful shutdown — bounded: force-exits after 3s even if a
// connection close hangs (ioredis quit can stall mid-reconnect).
async function shutdown(signal: string) {
    logger.info(`${signal} received, shutting down...`);

    const forceExit = setTimeout(() => process.exit(0), 3000);
    forceExit.unref();

    try {
        // Forceful disconnects — never block the exit
        redis.disconnect();
        await prisma.$disconnect().catch(() => {});

        logger.info('👋 Shutdown complete');
    } finally {
        process.exit(0);
    }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    logger.error({ error }, '❌ Uncaught exception');
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, '❌ Unhandled rejection');
    process.exit(1);
});

// Start the server
main();
