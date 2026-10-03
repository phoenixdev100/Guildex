/**
 * Environment Configuration
 * 
 * Validates and exports environment variables with type safety.
 */

import { z } from 'zod';

const envSchema = z.object({
    // Node Environment
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // Server Configuration
    API_PORT: z.string().transform(Number).default('4000'),
    API_HOST: z.string().default('localhost'),
    API_URL: z.string().default('http://localhost:4000'),

    // Database
    DATABASE_URL: z.string().default(''),

    // Redis
    REDIS_URL: z.string().default('redis://localhost:6379'),

    // Discord OAuth2
    DISCORD_CLIENT_ID: z.string().default(''),
    DISCORD_CLIENT_SECRET: z.string().default(''),
    DISCORD_BOT_TOKEN: z.string().default(''),
    DISCORD_REDIRECT_URI: z.string().default('http://localhost:3000/api/auth/callback'),

    // Super Admin
    SUPER_ADMIN_ID: z.string().default(''),

    // JWT
    JWT_SECRET: z.string().default('development-secret-key-change-in-production'),
    JWT_EXPIRES_IN: z.string().default('7d'),

    // Internal API authentication (bot <-> API)
    INTERNAL_API_KEY: z.string().default(''),

    // Direct API→bot calls (instant actions; bot's internal listener)
    BOT_INTERNAL_URL: z.string().default('http://localhost:4001'),

    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),
    RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

    // Logging
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
    try {
        const parsed = envSchema.parse(process.env);

        // Warn about missing critical values in production
        if (process.env.NODE_ENV === 'production') {
            const critical = ['DATABASE_URL', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'JWT_SECRET', 'SUPER_ADMIN_ID'];
            const missing = critical.filter(key => !process.env[key]);
            if (missing.length > 0) {
                throw new Error(`Critical environment variables missing in production: ${missing.join(', ')}`);
            }
        }

        return parsed;
    } catch (error) {
        if (error instanceof z.ZodError) {
            const missing = error.errors.map((err) => err.path.join('.')).join(', ');
            console.warn(`Warning: Missing or invalid environment variables: ${missing}`);
            // Return defaults in development
            return envSchema.parse({});
        }
        throw error;
    }
}

export const env = validateEnv();

export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

