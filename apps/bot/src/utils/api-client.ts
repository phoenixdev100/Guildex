/**
 * API Client
 * 
 * HTTP client for communicating with the API backend.
 */

import { env } from '../config/env';
import logger from '../config/logger';

/**
 * Error thrown when the API responds with a non-2xx status.
 * Exposes `status` and `data` (parsed body), plus a `response`
 * getter for axios-style `error.response?.status` compatibility.
 */
export class ApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly data: any,
        message?: string
    ) {
        super(message ?? `API request failed: ${status}`);
        this.name = 'ApiError';
    }

    /** Axios-style compatibility shim used by existing commands. */
    get response(): { status: number; data: any } {
        return { status: this.status, data: this.data };
    }
}

export class APIClient {
    private baseUrl: string;

    constructor() {
        this.baseUrl = env.API_URL;
    }

    /**
     * Make a request to the API
     */
    private async request<T>(
        endpoint: string,
        options?: RequestInit
    ): Promise<T> {
        // Normalize: all API routes live under the /api prefix
        const path = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
        const url = `${this.baseUrl}${path}`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options?.headers as Record<string, string> | undefined),
        };

        // Internal service authentication
        if (env.INTERNAL_API_KEY) {
            headers['x-api-key'] = env.INTERNAL_API_KEY;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers,
            });

            if (!response.ok) {
                const body = await response.text();
                let data: any = body;
                try {
                    data = JSON.parse(body);
                } catch {
                    // Not JSON - keep raw text
                }
                throw new ApiError(response.status, data);
            }

            return response.json() as Promise<T>;
        } catch (error) {
            if (!(error instanceof ApiError)) {
                // Network-level failure (e.g. ECONNREFUSED when API is down).
                // fetch throws TypeError with the real reason in `cause`.
                const cause = (error as any)?.cause;
                const reason = cause?.code ?? cause?.message
                    ?? (error instanceof Error ? error.message : String(error));
                logger.warn({ endpoint: path, reason }, 'API unreachable');
            }
            throw error;
        }
    }

    /**
     * GET request
     */
    async get<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: 'GET' });
    }

    /**
     * POST request
     */
    async post<T>(endpoint: string, data?: unknown): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'POST',
            body: data ? JSON.stringify(data) : undefined,
        });
    }

    /**
     * PUT request
     */
    async put<T>(endpoint: string, data?: unknown): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'PUT',
            body: data ? JSON.stringify(data) : undefined,
        });
    }

    /**
     * PATCH request
     */
    async patch<T>(endpoint: string, data?: unknown): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'PATCH',
            body: data ? JSON.stringify(data) : undefined,
        });
    }

    /**
     * DELETE request
     */
    async delete<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: 'DELETE' });
    }

    /**
     * Register a guild with the API
     */
    async registerGuild(guildId: string, guildData: {
        name: string;
        icon: string | null;
        ownerId: string;
    }): Promise<void> {
        await this.post(`/api/guilds/${guildId}/register`, guildData);
    }

    /**
     * Unregister a guild from the API
     */
    async unregisterGuild(guildId: string): Promise<void> {
        await this.delete(`/api/guilds/${guildId}/unregister`);
    }

    /**
     * Reconcile guild membership on startup - sends the bot's current
     * guild ids; the API marks any active guild missing from the list
     * as inactive (covers kicks/deletions while the bot was offline).
     */
    async reconcileGuilds(ids: string[]): Promise<void> {
        await this.post(`/api/guilds/reconcile`, { ids });
    }

    /**
     * Check if a module is enabled for a guild
     */
    async isModuleEnabled(guildId: string, moduleName: string): Promise<boolean> {
        try {
            const response = await this.get<{ enabled: boolean }>(
                `/api/guilds/${guildId}/modules/${moduleName}`
            );
            return response.enabled;
        } catch (error) {
            logger.warn({ error, guildId, moduleName }, 'Failed to check module status');
            return true; // Fail open so commands aren't blocked by API issues
        }
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<boolean> {
        try {
            await this.get('/api/health');
            return true;
        } catch (error) {
            return false;
        }
    }
}

export const apiClient = new APIClient();
