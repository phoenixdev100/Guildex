/**
 * Guild Access Middleware
 *
 * Determines which guilds the calling user is allowed to manage.
 * The dashboard's Next.js middleware forwards the user's Discord OAuth
 * token (`x-discord-token`) — we ask Discord which guilds that user
 * owns or has ADMINISTRATOR / MANAGE_GUILD in, then scope data to
 * those guilds.
 *
 * Requests carrying only the internal API key (bot-to-API traffic)
 * get unrestricted access.
 */

import type { FastifyRequest } from 'fastify';
import { env } from '../config/env';

const DISCORD_API = 'https://discord.com/api/v10';
const CACHE_TTL_MS = 5 * 60 * 1000;

const ADMINISTRATOR = 0x8n;
const MANAGE_GUILD = 0x20n;

interface DiscordGuildEntry {
    id: string;
    owner?: boolean;
    permissions?: string;
}

interface CacheEntry {
    guildIds: Set<string>;
    fetchedAt: number;
}

const guildCache = new Map<string, CacheEntry>();

async function fetchManageableGuilds(token: string): Promise<Set<string>> {
    const cached = guildCache.get(token);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return cached.guildIds;
    }

    let res: Response;
    try {
        res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
            headers: { Authorization: `Bearer ${token}` },
        });
    } catch (err) {
        // Network failure — don't cache, let the next request retry
        console.error('[guild-access] Discord /users/@me/guilds request failed:', err);
        return new Set();
    }

    if (!res.ok) {
        // Invalid/expired token or transient Discord error — don't cache
        // failures; a cached empty set would lock the user out for 5 min.
        const body = await res.text().catch(() => '');
        console.error(`[guild-access] Discord /users/@me/guilds → ${res.status}: ${body.slice(0, 200)}`);
        return new Set();
    }

    const guilds = (await res.json()) as DiscordGuildEntry[];
    const manageable = new Set<string>();

    for (const g of guilds) {
        const perms = g.permissions ? BigInt(g.permissions) : 0n;
        if (g.owner || (perms & ADMINISTRATOR) !== 0n || (perms & MANAGE_GUILD) !== 0n) {
            manageable.add(g.id);
        }
    }

    // Only cache successful fetches
    guildCache.set(token, { guildIds: manageable, fetchedAt: Date.now() });
    return manageable;
}

/**
 * Returns:
 *  - null        → unrestricted (internal API-key caller, no user context)
 *  - Set<string> → the guild IDs this user may manage (empty = none)
 */
export async function getAllowedGuildIds(request: FastifyRequest): Promise<Set<string> | null> {
    const discordToken = request.headers['x-discord-token'] as string | undefined;

    // Bot owner / super admin sees every guild
    if (env.SUPER_ADMIN_ID && discordUserId(request) === env.SUPER_ADMIN_ID) {
        return null;
    }

    if (!discordToken) {
        // Bot / service traffic — trusted via internal API key
        return request.isInternal ? null : new Set();
    }

    return fetchManageableGuilds(discordToken);
}

/** true when the caller may manage the given guild */
export function canAccessGuild(allowed: Set<string> | null, guildId: string): boolean {
    return allowed === null || allowed.has(guildId);
}

export function discordUserId(request: FastifyRequest): string | null {
    return (request.headers['x-discord-id'] as string | undefined) ?? null;
}
