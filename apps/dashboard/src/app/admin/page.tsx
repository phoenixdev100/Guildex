/**
 * Admin Panel - bot owner only, standalone UI
 *
 * Completely separate from the normal dashboard: own top bar, own nav,
 * only owner-level controls (global stats, all guilds, module defaults,
 * global audit feed). Gated server-side by SUPER_ADMIN_ID on every
 * endpoint - this page additionally checks /api/dashboard/me.
 */

'use client';

import { useState, useEffect, useCallback, type MouseEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface AdminGuild {
    id: string;
    name: string;
    icon: string | null;
    ownerId: string;
    isActive: boolean;
    joinedAt: string;
    memberCount: number;
    enabledModules: number;
}

interface Overview {
    totalGuilds: number;
    activeGuilds: number;
    totalUsers: number;
    totalSubmissions: number;
    pendingSubmissions: number;
    blacklistedUsers: number;
    commandsUsed: number;
    guilds: AdminGuild[];
}

interface ModuleRow {
    id: string;
    name: string;
    description: string | null;
    category: string;
    isDefault: boolean;
    enabledInGuilds: number;
    totalGuilds: number;
}

interface ActivityItem {
    id: string;
    action: string;
    server: string;
    user?: string;
    time: string;
    icon: string;
}

type Tab = 'overview' | 'servers' | 'modules' | 'activity';

export default function AdminPanel() {
    const { status } = useSession();
    const router = useRouter();

    const [authorized, setAuthorized] = useState<boolean | null>(null);
    const [tab, setTab] = useState<Tab>('overview');
    const [overview, setOverview] = useState<Overview | null>(null);
    const [modules, setModules] = useState<ModuleRow[]>([]);
    const [activity, setActivity] = useState<ActivityItem[]>([]);
    const [toggling, setToggling] = useState<string | null>(null);
    const [leaving, setLeaving] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (status === 'unauthenticated') router.replace('/login');
    }, [status, router]);

    const load = useCallback(async () => {
        try {
            const meRes = await fetch('/api/dashboard/me');
            const me = meRes.ok ? await meRes.json() : null;
            if (me?.isSuperAdmin !== true) { setAuthorized(false); return; }
            setAuthorized(true);

            const [ovRes, modRes, actRes] = await Promise.all([
                fetch('/api/dashboard/admin/overview'),
                fetch('/api/dashboard/modules'),
                fetch('/api/dashboard/activity'),
            ]);
            if (ovRes.ok) setOverview(await ovRes.json());
            if (modRes.ok) setModules(await modRes.json());
            if (actRes.ok) setActivity(await actRes.json());
        } catch {
            setAuthorized(false);
        }
    }, []);

    useEffect(() => {
        if (status === 'authenticated') load();
    }, [status, load]);

    /** Queue a LEAVE_GUILD action - bot leaves within ~30s (action poller). */
    const removeBot = async (e: MouseEvent, g: AdminGuild) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm(`Remove the bot from "${g.name}"?\n\nIt will leave the server within ~30 seconds. This only affects the bot - the server's data is kept.`)) return;
        setLeaving(prev => new Set(prev).add(g.id));
        try {
            const res = await fetch(`/api/dashboard/admin/guilds/${g.id}/leave`, { method: 'POST' });
            if (!res.ok) throw new Error();
        } catch {
            setLeaving(prev => {
                const next = new Set(prev);
                next.delete(g.id);
                return next;
            });
        }
    };

    const toggleDefault = async (m: ModuleRow) => {
        setToggling(m.id);
        try {
            const res = await fetch(`/api/dashboard/modules/${m.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isDefault: !m.isDefault }),
            });
            if (res.ok) {
                setModules(prev => prev.map(x => x.id === m.id ? { ...x, isDefault: !m.isDefault } : x));
            }
        } finally {
            setToggling(null);
        }
    };

    if (status === 'loading' || authorized === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
            </div>
        );
    }

    if (!authorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="glass rounded-xl p-12 border border-border/50 text-center max-w-md">
                    <p className="text-4xl mb-3">🔒</p>
                    <h1 className="text-xl font-bold text-foreground">Bot owner only</h1>
                    <p className="text-sm text-muted-foreground mt-2">This panel is restricted to the bot owner account.</p>
                    <Link href="/select-server" className="inline-block mt-5 text-sm text-primary hover:underline">← Back to servers</Link>
                </div>
            </div>
        );
    }

    const stats = overview ? [
        { label: 'Servers', value: overview.totalGuilds, sub: `${overview.activeGuilds} active`, icon: '🏰' },
        { label: 'Tracked Users', value: overview.totalUsers, icon: '👥' },
        { label: 'Commands Used', value: overview.commandsUsed, icon: '⚡' },
        { label: 'Applications', value: overview.totalSubmissions, sub: `${overview.pendingSubmissions} pending`, icon: '📝' },
        { label: 'Blacklisted', value: overview.blacklistedUsers, icon: '🚫' },
    ] : [];

    const filteredGuilds = (overview?.guilds ?? []).filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

    const tabs: { key: Tab; label: string }[] = [
        { key: 'overview', label: '📊 Overview' },
        { key: 'servers', label: `🏰 Servers (${overview?.totalGuilds ?? 0})` },
        { key: 'modules', label: `🧩 Modules (${modules.length})` },
        { key: 'activity', label: '📜 Activity' },
    ];

    return (
        <div className="min-h-screen bg-background">
            {/* Admin top bar */}
            <div className="border-b border-yellow-500/30 bg-card">
                <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">👑</span>
                        <span className="font-bold text-foreground">Admin Panel</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500">owner</span>
                    </div>
                    <Link href="/select-server" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        ← Servers
                    </Link>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
                {/* Tabs */}
                <div className="flex gap-2 border-b border-border/50">
                    {tabs.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${tab === t.key ? 'bg-secondary/50 text-foreground border-b-2 border-yellow-500' : 'text-muted-foreground hover:text-foreground'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === 'overview' && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {stats.map(s => (
                            <div key={s.label} className="glass rounded-xl p-5 border border-border/50">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs text-muted-foreground">{s.label}</p>
                                    <span className="text-lg">{s.icon}</span>
                                </div>
                                <p className="text-2xl font-bold text-foreground">{s.value.toLocaleString()}</p>
                                {s.sub && <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>}
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'servers' && (
                    <div className="space-y-4">
                        <input
                            type="text" placeholder="Search servers…" value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full max-w-md bg-secondary/50 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                        />
                        <div className="glass rounded-xl border border-border/50 overflow-hidden">
                            <div className="divide-y divide-border/30">
                                {filteredGuilds.map(g => (
                                    <Link key={g.id} href={`/dashboard/servers/${g.id}`}
                                        className="flex items-center gap-4 px-6 py-4 hover:bg-secondary/30 transition-colors">
                                        {g.icon ? (
                                            <img src={g.icon} alt="" className="w-10 h-10 rounded-full" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-foreground font-bold">
                                                {g.name.charAt(0)}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-foreground truncate">{g.name}</p>
                                                {!g.isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-500">left</span>}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {g.memberCount} users • {g.enabledModules} modules • joined {new Date(g.joinedAt).toLocaleDateString()} • owner {g.ownerId}
                                            </p>
                                        </div>
                                        {leaving.has(g.id) ? (
                                            <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/15 text-yellow-500 border border-yellow-500/30 shrink-0">removal queued</span>
                                        ) : g.isActive ? (
                                            <button
                                                onClick={(e) => removeBot(e, g)}
                                                className="text-xs px-2.5 py-1 rounded-lg border border-red-500/40 text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                                                title="Bot will leave this server"
                                            >
                                                Remove bot
                                            </button>
                                        ) : null}
                                        <span className="text-muted-foreground">→</span>
                                    </Link>
                                ))}
                                {filteredGuilds.length === 0 && (
                                    <p className="px-6 py-8 text-sm text-muted-foreground text-center">No servers found.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'modules' && (
                    <div className="glass rounded-xl border border-border/50 overflow-hidden">
                        <div className="px-6 py-4 border-b border-border/50">
                            <h2 className="font-bold text-foreground">Module defaults</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">Default = enabled automatically when the bot joins a new server.</p>
                        </div>
                        <div className="divide-y divide-border/30">
                            {modules.map(m => (
                                <div key={m.id} className="flex items-center gap-4 px-6 py-3.5">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground">{m.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{m.category} • on in {m.enabledInGuilds}/{m.totalGuilds} servers</p>
                                    </div>
                                    <button
                                        onClick={() => toggleDefault(m)}
                                        disabled={toggling === m.id}
                                        className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${m.isDefault ? 'bg-green-500' : 'bg-secondary'}`}
                                    >
                                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${m.isDefault ? 'left-[22px]' : 'left-0.5'}`} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {tab === 'activity' && (
                    <div className="glass rounded-xl border border-border/50 overflow-hidden">
                        <div className="divide-y divide-border/30">
                            {activity.map(a => (
                                <div key={a.id} className="flex items-center gap-4 px-6 py-3.5">
                                    <span className="text-lg">{a.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-foreground">{a.action}</p>
                                        <p className="text-xs text-muted-foreground">{a.server}{a.user ? ` • ${a.user}` : ''}</p>
                                    </div>
                                    <span className="text-xs text-muted-foreground shrink-0">{new Date(a.time).toLocaleString()}</span>
                                </div>
                            ))}
                            {activity.length === 0 && (
                                <p className="px-6 py-8 text-sm text-muted-foreground text-center">No recent activity.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
