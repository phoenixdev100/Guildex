/**
 * Dashboard Middleware
 *
 * 1. Requires a valid NextAuth session for all backend-proxy routes -
 *    unauthenticated requests get 401 instead of silently passing
 *    the internal API key through.
 * 2. Injects the internal API key plus the user's Discord identity
 *    (id + OAuth access token) server-side. The API uses the OAuth
 *    token to scope responses to guilds the user actually manages.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const headers = new Headers(request.headers);

    const apiKey = process.env.INTERNAL_API_KEY;
    if (apiKey) {
        headers.set('x-api-key', apiKey);
    }
    if (token.discordId) {
        headers.set('x-discord-id', String(token.discordId));
    }
    if (token.accessToken) {
        headers.set('x-discord-token', String(token.accessToken));
    }

    return NextResponse.next({
        request: { headers },
    });
}

export const config = {
    matcher: ['/api/dashboard/:path*', '/api/guilds/:path*'],
};
