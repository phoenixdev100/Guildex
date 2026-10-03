/**
 * Environment Configuration for Bot
 * 
 * Validates and exports environment variables with type safety.
 */

import { z } from 'zod';

const envSchema = z.object({
    // Node Environment
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // Discord Bot
    DISCORD_BOT_TOKEN: z.string().default(''),
    DISCORD_CLIENT_ID: z.string().default(''),

    // API Configuration
    API_URL: z.string().default('http://localhost:4000'),
    INTERNAL_API_KEY: z.string().default(''),

    // Internal listener for direct API→bot calls (instant actions)
    BOT_INTERNAL_PORT: z.string().transform(Number).default('4001'),

    // Logging
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    // Command deployment strategy on boot:
    // 'changed' - deploy only when command definitions differ (default)
    // 'always'  - deploy on every boot
    // 'never'   - never auto-deploy
    DEPLOY_COMMANDS: z.enum(['always', 'changed', 'never']).default('changed'),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
    try {
        const parsed = envSchema.parse(process.env);

        // Check for critical missing values in production
        if (process.env.NODE_ENV === 'production') {
            if (!parsed.DISCORD_BOT_TOKEN || !parsed.DISCORD_CLIENT_ID) {
                throw new Error('DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID are required in production');
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

