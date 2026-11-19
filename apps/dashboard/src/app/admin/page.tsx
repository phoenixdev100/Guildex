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
import {
    ArrowLeft,
    ArrowRight,
    Ban,
    BarChart3,
    Bolt,
    ChevronDown,
    Crown,
    FileText,
    Puzzle,
    Search,
    Server,
    Shield,
    Users,
} from 'lucide-react';
import './admin.css';

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
    const [statusFilter, setStatusFilter] = useState<'active' | 'left' | 'all'>('active');

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
            <div className="admLoader">
                <div className="spin" />
            </div>
        );
    }

    if (!authorized) {
        return (
            <div className="denied">
                <div className="deniedCard">
                    <div className="deniedMark"><Shield size={22} /></div>
                    <h1>Bot owner only</h1>
                    <p>This panel is restricted to the bot owner account.</p>
                    <Link href="/select-server" className="admBtn admBtnPrimary">
                        <ArrowLeft size={13} /> Back to servers
                    </Link>
                </div>
            </div>
        );
    }

    const stats = overview ? [
        { label: 'Servers', value: overview.totalGuilds, sub: `${overview.activeGuilds} active`, icon: <Server size={18} /> },
        { label: 'Tracked Users', value: overview.totalUsers, icon: <Users size={18} /> },
        { label: 'Commands Used', value: overview.commandsUsed, icon: <Bolt size={18} /> },
        { label: 'Applications', value: overview.totalSubmissions, sub: `${overview.pendingSubmissions} pending`, icon: <FileText size={18} /> },
        { label: 'Blacklisted', value: overview.blacklistedUsers, icon: <Ban size={18} /> },
    ] : [];

    const allGuilds = overview?.guilds ?? [];
    const activeCount = allGuilds.filter(g => g.isActive).length;
    const filteredGuilds = allGuilds.filter(g =>
        g.name.toLowerCase().includes(search.toLowerCase())
        && (statusFilter === 'all' || (statusFilter === 'active' ? g.isActive : !g.isActive)),
    );

    const tabs: { key: Tab; label: string; count?: number; icon: React.ReactNode }[] = [
        { key: 'overview', label: 'Overview', icon: <BarChart3 size={13} /> },
        { key: 'servers', label: 'Servers', count: overview?.totalGuilds, icon: <Server size={13} /> },
        { key: 'modules', label: 'Modules', count: modules.length, icon: <Puzzle size={13} /> },
        { key: 'activity', label: 'Activity', icon: <FileText size={13} /> },
    ];

    const filterButtons: { key: typeof statusFilter; label: string; count: number }[] = [
        { key: 'active', label: 'Active', count: activeCount },
        { key: 'left', label: 'Left', count: allGuilds.length - activeCount },
        { key: 'all', label: 'All', count: allGuilds.length },
    ];

    return (
        <div className="adm">
            {/* glass top bar */}
            <header className="admTop">
                <Link href="/" className="admBrand">
                    <img src="/logo.png" alt="Guildex" />
                    Guildex
                    <span className="admBadge"><Crown size={9} /> Owner</span>
                </Link>
                <Link href="/select-server" className="admBack">
                    <ArrowLeft size={13} /> Servers
                </Link>
            </header>

            <main className="admMain">
                {/* head */}
                <div className="admHead">
                    <div className="admKicker">Platform</div>
                    <h1>Admin Panel</h1>
                    <p>Global controls - servers, module defaults, applications and platform activity.</p>
                </div>

                {/* pill tabs */}
                <div className="admTabs">
                    {tabs.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)} className={`admTab ${tab === t.key ? 'on' : ''}`}>
                            {t.icon} {t.label}
                            {t.count !== undefined && <span>{t.count}</span>}
                        </button>
                    ))}
                </div>

                {/* overview */}
                {tab === 'overview' && (
                    <div className="statGrid">
                        {stats.map(s => (
                            <div key={s.label} className="stat">
                                <div className="statGlow" />
                                <div className="statIcon">{s.icon}</div>
                                <b>{s.value.toLocaleString()}</b>
                                <span>{s.label}{s.sub && <small>{s.sub}</small>}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* servers */}
                {tab === 'servers' && (
                    <>
                        <div className="admToolbar">
                            <label className="admSearch">
                                <Search size={14} />
                                <input
                                    type="text" placeholder="Type name or ID"
                                    value={search} onChange={e => setSearch(e.target.value)}
                                />
                            </label>
                            <div className="admChips">
                                {filterButtons.map(f => (
                                    <button key={f.key} onClick={() => setStatusFilter(f.key)} className={`admChip ${statusFilter === f.key ? 'on' : ''}`}>
                                        {f.label} ({f.count})
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="admCard">
                            <div className="admRows">
                                {filteredGuilds.map(g => (
                                    <Link key={g.id} href={`/dashboard/servers/${g.id}`} className="admRow" style={{ display: 'flex' }}>
                                        <span className="admAvatar">
                                            {g.icon ? <img src={g.icon} alt="" /> : g.name.charAt(0).toUpperCase()}
                                        </span>
                                        <div className="admRowMain">
                                            <div className="admRowTitle">
                                                <b>{g.name}</b>
                                                <span className={`statusChip ${g.isActive ? 'on' : 'off'}`}>
                                                    {g.isActive ? 'Active' : 'Left'}
                                                </span>
                                            </div>
                                            <div className="admRowMeta">
                                                <Users size={11} /> {g.memberCount.toLocaleString()} members
                                                <i>·</i> {g.enabledModules} modules
                                                <i>·</i> joined {new Date(g.joinedAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <div className="admRowAct">
                                            {leaving.has(g.id) ? (
                                                <span className="admQueued">Removal queued</span>
                                            ) : g.isActive ? (
                                                <button onClick={(e) => removeBot(e, g)} className="admBtn admBtnDanger">
                                                    <Ban size={12} /> Remove bot
                                                </button>
                                            ) : null}
                                            <ArrowRight size={15} className="admRowArrow" />
                                        </div>
                                    </Link>
                                ))}
                                {filteredGuilds.length === 0 && (
                                    <div className="admEmpty">
                                        <div className="admEmptyMark"><Server size={20} /></div>
                                        <p>No servers found</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* modules */}
                {tab === 'modules' && (
                    <div className="admCard">
                        <div className="admCardHead">
                            <div>
                                <h2>Module defaults</h2>
                                <p>Default = enabled automatically when the bot joins a new server.</p>
                            </div>
                            <Puzzle size={18} style={{ color: 'var(--purple)' }} />
                        </div>
                        <div>
                            {modules.map(m => {
                                const pct = m.totalGuilds > 0 ? Math.round((m.enabledInGuilds / m.totalGuilds) * 100) : 0;
                                return (
                                    <div key={m.id} className="modRow">
                                        <span className="modIcon"><Puzzle size={16} /></span>
                                        <div className="modRowMain">
                                            <div className="modRowTitle">
                                                <b>{m.name}</b>
                                                <span className="catChip">{m.category}</span>
                                            </div>
                                            <p className="modRowDesc">{m.description}</p>
                                            <div className="modCoverage">
                                                <div className="modBar"><i style={{ width: `${pct}%` }} /></div>
                                                <small>on in {m.enabledInGuilds}/{m.totalGuilds} servers</small>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => toggleDefault(m)}
                                            disabled={toggling === m.id}
                                            className={`sw ${m.isDefault ? 'on' : ''}`}
                                            aria-label={`Toggle ${m.name} default`}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* activity */}
                {tab === 'activity' && (
                    <div className="admCard">
                        <div className="admCardHead">
                            <div>
                                <h2>Recent activity</h2>
                                <p>Latest actions across all servers.</p>
                            </div>
                            <FileText size={18} style={{ color: 'var(--purple)' }} />
                        </div>
                        <div>
                            {activity.map(a => (
                                <div key={a.id} className="actRow">
                                    <span className="actIcon">{a.icon}</span>
                                    <div className="actMain">
                                        <b>{a.action}</b>
                                        <small>{a.server}{a.user ? ` • ${a.user}` : ''}</small>
                                    </div>
                                    <span className="actTime">{new Date(a.time).toLocaleString()}</span>
                                </div>
                            ))}
                            {activity.length === 0 && (
                                <div className="admEmpty">
                                    <div className="admEmptyMark"><FileText size={20} /></div>
                                    <p>No recent activity</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
