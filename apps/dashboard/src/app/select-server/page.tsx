/**
 * Server Selection Screen
 *
 * Standalone page shown right after Discord OAuth - pick which server
 * to manage before entering the dashboard. Only shows servers where
 * the user is owner/admin (scoped server-side via their OAuth token).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Server {
    id: string;
    name: string;
    icon: string | null;
    ownerId: string;
    memberCount: number;
    enabledModules: number;
    totalModules: number;
}

export default function SelectServerPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [servers, setServers] = useState<Server[]>([]);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (status === 'unauthenticated') router.replace('/login');
    }, [status, router]);

    const load = useCallback(() => {
        if (status !== 'authenticated') return;
        setLoading(true); setError(false);
        Promise.all([
            fetch('/api/dashboard/guilds'),
            fetch('/api/dashboard/me'),
        ])
            .then(async ([guildsRes, meRes]) => {
                if (guildsRes.ok) {
                    const data = await guildsRes.json();
                    setServers(Array.isArray(data) ? data : []);
                } else {
                    setError(true);
                }
                if (meRes.ok) {
                    const me = await meRes.json();
                    setIsSuperAdmin(me?.isSuperAdmin === true);
                }
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [status]);

    useEffect(() => { load(); }, [load]);

    if (status === 'loading' || status === 'unauthenticated') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    const filtered = servers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="min-h-screen bg-background flex flex-col items-center px-6 py-16">
            {/* Header */}
            <div className="text-center mb-10">
                <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4">
                    <svg className="w-9 h-9 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176-1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                </div>
                <h1 className="text-3xl font-bold text-foreground">
                    Welcome{session?.user?.name ? `, ${session.user.name}` : ''} 👋
                </h1>
                <p className="text-muted-foreground mt-2">Select a server to manage</p>
            </div>

            {/* Search */}
            {servers.length > 6 && (
                <input
                    type="text"
                    placeholder="Search servers…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full max-w-md bg-secondary/50 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground mb-8 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
            )}

            {/* Admin Panel entry - bot owner only */}
            {isSuperAdmin && (
                <Link
                    href="/admin"
                    className="glass rounded-xl p-4 border border-yellow-500/40 hover:border-yellow-500/70 transition-colors w-full max-w-4xl mb-6 flex items-center gap-4 group"
                >
                    <span className="text-2xl">👑</span>
                    <div className="flex-1">
                        <p className="font-bold text-foreground group-hover:text-yellow-500 transition-colors">Admin Panel</p>
                        <p className="text-xs text-muted-foreground">Global view across every server the bot is in</p>
                    </div>
                    <span className="text-muted-foreground group-hover:text-yellow-500 group-hover:translate-x-1 transition-all">→</span>
                </Link>
            )}

            {/* Server grid */}
            {loading ? (
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            ) : filtered.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl">
                    {filtered.map(server => (
                        <Link
                            key={server.id}
                            href={`/dashboard/servers/${server.id}`}
                            className="glass rounded-xl p-5 border border-border/50 hover:border-primary/50 hover:bg-secondary/30 transition-all group"
                        >
                            <div className="flex items-center gap-4">
                                {server.icon ? (
                                    <img src={server.icon} alt="" className="w-14 h-14 rounded-full" />
                                ) : (
                                    <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-xl font-bold text-foreground">
                                        {server.name.charAt(0)}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-foreground truncate group-hover:text-primary transition-colors">
                                        {server.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {server.memberCount} members • {server.enabledModules}/{server.totalModules} modules
                                    </p>
                                </div>
                                <span className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all">→</span>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="glass rounded-xl p-10 border border-border/50 text-center max-w-md">
                    <p className="text-4xl mb-3">🤖</p>
                    <h2 className="text-lg font-bold text-foreground">No manageable servers</h2>
                    <p className="text-sm text-muted-foreground mt-2">
                        {error
                            ? 'Couldn\'t reach Discord to verify your servers - your session may be stale.'
                            : search
                                ? 'No servers match your search.'
                                : 'The bot isn\'t in any server you manage yet - invite it first.'}
                    </p>
                    <div className="flex gap-3 justify-center mt-5">
                        <button
                            onClick={load}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            ↻ Retry
                        </button>
                        <button
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            className="bg-secondary hover:bg-secondary/80 text-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            Re-login
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
