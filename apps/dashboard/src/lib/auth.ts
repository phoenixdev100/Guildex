/**
 * NextAuth Options
 *
 * Discord OAuth2 authentication config for the dashboard.
 * Kept outside the route file because App Router routes may only
 * export HTTP method handlers and config fields.
 */

import type { NextAuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';

export const authOptions: NextAuthOptions = {
    providers: [
        DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID!,
            clientSecret: process.env.DISCORD_CLIENT_SECRET!,
            // Discord now sends `iss` in OAuth callbacks - must be declared
            // or NextAuth v4 rejects the callback (issuer validation).
            issuer: 'https://discord.com',
            authorization: {
                params: {
                    scope: 'identify email guilds',
                },
            },
        }),
    ],
    callbacks: {
        async jwt({ token, account, profile }) {
            // Add Discord access token and user info to JWT
            if (account && profile) {
                token.accessToken = account.access_token;
                token.discordId = (profile as { id: string }).id;
            }
            return token;
        },
        async session({ session, token }) {
            // Add Discord info to session
            if (session.user) {
                (session.user as any).id = token.discordId;
                (session.user as any).accessToken = token.accessToken;
            }
            return session;
        },
    },
    pages: {
        signIn: '/login',
        error: '/login',
    },
    session: {
        strategy: 'jwt',
        maxAge: 7 * 24 * 60 * 60, // 7 days
    },
    secret: process.env.NEXTAUTH_SECRET,
};
