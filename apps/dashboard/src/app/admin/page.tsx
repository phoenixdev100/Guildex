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
    LayoutList,
    LayoutGrid,
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

type Tab = 'overview' | 'servers' | 'modules';

export default function AdminPanel() {
    const { status } = useSession();
    const router = useRouter();

    const [authorized, setAuthorized] = useState<boolean | null>(null);
    const [dataLoading, setDataLoading] = useState(true);
    const [tab, setTabState] = useState<Tab>(() =>
        (typeof window !== 'undefined' && (localStorage.getItem('guildex:admin-tab') as Tab)) || 'overview');
    const setTab = (t: Tab) => {
        setTabState(t);
        try { localStorage.setItem('guildex:admin-tab', t); } catch { /* ignore */ }
    };
    const [overview, setOverview] = useState<Overview | null>(null);
    const [modules, setModules] = useState<ModuleRow[]>([]);
    const [activity, setActivity] = useState<ActivityItem[]>([]);
    const [toggling, setToggling] = useState<string | null>(null);
    const [leaving, setLeaving] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'active' | 'left' | 'all'>('active');
    const [serverView, setServerView] = useState<'list' | 'grid'>(() =>
        typeof window !== 'undefined' && localStorage.getItem('guildex:admin-server-view') === 'grid' ? 'grid' : 'list');
    const [moduleView, setModuleView] = useState<'list' | 'grid'>(() =>
        typeof window !== 'undefined' && localStorage.getItem('guildex:admin-module-view') === 'list' ? 'list' : 'grid');
    const [historyFor, setHistoryFor] = useState<string | null>(null);
    const [historyData, setHistoryData] = useState<Record<string, { events: { id: string; icon: string; action: string; detail: string; time: string }[]; loading?: boolean }>>({});

    const toggleHistory = async (guildId: string) => {
        if (historyFor === guildId) { setHistoryFor(null); return; }
        setHistoryFor(guildId);
        if (historyData[guildId]?.events) return;
        setHistoryData(prev => ({ ...prev, [guildId]: { events: [], loading: true } }));
        try {
            const res = await fetch(`/api/dashboard/admin/guilds/${guildId}/history`);
            const data = res.ok ? await res.json() : { events: [] };
            setHistoryData(prev => ({ ...prev, [guildId]: { events: data.events ?? [] } }));
        } catch {
            setHistoryData(prev => ({ ...prev, [guildId]: { events: [] } }));
        }
    };

    const setServerViewPersist = (v: 'list' | 'grid') => {
        setServerView(v);
        try { localStorage.setItem('guildex:admin-server-view', v); } catch { /* ignore */ }
    };
    const setModuleViewPersist = (v: 'list' | 'grid') => {
        setModuleView(v);
        try { localStorage.setItem('guildex:admin-module-view', v); } catch { /* ignore */ }
    };

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
        } finally {
            setDataLoading(false);
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

    if (status === 'loading' || authorized === null || (authorized && dataLoading)) {
        return (
            <div className="adm admLoader">
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
                    <>
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
                    <div className="admCard wide" style={{ marginTop: 18 }}>
                        <div className="admCardHead">
                            <div>
                                <h2>Recent activity</h2>
                                <p>Latest actions across all servers.</p>
                            </div>
                            <FileText size={16} style={{ color: 'var(--purple)' }} />
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
                    </>
                )}

                {/* servers */}
                {tab === 'servers' && (
                    <>
                        <div className="admToolbar">
                            <div className="admToolbarMid">
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
                            <div className="viewToggle">
                                <button onClick={() => setServerViewPersist('list')} className={serverView === 'list' ? 'on' : ''} title="List view"><LayoutList size={14} /></button>
                                <button onClick={() => setServerViewPersist('grid')} className={serverView === 'grid' ? 'on' : ''} title="Grid view"><LayoutGrid size={14} /></button>
                            </div>
                        </div>
                        <div className={`admCard${serverView === 'grid' ? ' flush' : ''}`}>
                            {serverView === 'list' ? (
                            <div className="admRows">
                                {filteredGuilds.map(g => (
                                    <div key={g.id}>
                                    <Link href={`/dashboard/servers/${g.id}`} className="admRow" style={{ display: 'flex' }}>
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
                                            </div>
                                        </div>
                                        <div className="admRowAct">
                                            <button
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleHistory(g.id); }}
                                                className={`admBtn admBtnGhost${historyFor === g.id ? ' on' : ''}`}
                                                title="View guild history"
                                            >
                                                <FileText size={12} /> History
                                            </button>
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
                                    {historyFor === g.id && (
                                        <div className="histPanel">
                                            {historyData[g.id]?.loading ? (
                                                <div className="histLoading"><div className="spin" /></div>
                                            ) : (historyData[g.id]?.events.length ?? 0) === 0 ? (
                                                <p className="histEmpty">No history recorded yet.</p>
                                            ) : (
                                                historyData[g.id]!.events.map(ev => (
                                                    <div key={ev.id} className="histRow">
                                                        <span className="histIcon">{ev.icon}</span>
                                                        <div className="histMain">
                                                            <b>{ev.action}</b>
                                                            {ev.detail && <small>{ev.detail}</small>}
                                                        </div>
                                                        <span className="histTime">{new Date(ev.time).toLocaleString()}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                    </div>
                                ))}
                                {filteredGuilds.length === 0 && (
                                    <div className="admEmpty">
                                        <div className="admEmptyMark"><Server size={20} /></div>
                                        <p>No servers found</p>
                                    </div>
                                )}
                            </div>
                            ) : (
                            <div className="srvGrid">
                                {filteredGuilds.map(g => (
                                    <Link key={g.id} href={`/dashboard/servers/${g.id}`} className="srvCard">
                                        <div className="srvCardBanner">
                                            <span className={`statusChip ${g.isActive ? 'on' : 'off'}`}>
                                                {g.isActive ? 'Active' : 'Left'}
                                            </span>
                                            <span className="srvCardIcon">
                                                {g.icon ? <img src={g.icon} alt="" /> : g.name.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <b className="srvCardName">{g.name}</b>
                                        <span className="srvCardMeta">
                                            <Users size={11} /> {g.memberCount.toLocaleString()} members
                                        </span>
                                        <span className="srvCardMeta">
                                            <Puzzle size={11} /> {g.enabledModules} modules
                                        </span>
                                        <span className="srvGo">
                                            {leaving.has(g.id) ? (
                                                <span className="admQueued">Removal queued</span>
                                            ) : g.isActive ? (
                                                <button
                                                    onClick={(e) => { e.preventDefault(); removeBot(e, g); }}
                                                    className="srvGoBtn danger"
                                                    title="Remove bot from server"
                                                >
                                                    <Ban size={11} /> Remove
                                                </button>
                                            ) : (
                                                <span className="srvGoBtn">Manage <ArrowRight size={11} /></span>
                                            )}
                                        </span>
                                    </Link>
                                ))}
                                {filteredGuilds.length === 0 && (
                                    <div className="admEmpty" style={{ gridColumn: '1 / -1' }}>
                                        <div className="admEmptyMark"><Server size={20} /></div>
                                        <p>No servers found</p>
                                    </div>
                                )}
                            </div>
                            )}
                        </div>
                    </>
                )}

                {/* modules */}
                {tab === 'modules' && (
                    <>
                    <div className="admToolbar">
                        <div className="admToolbarMid" />
                        <div className="viewToggle">
                            <button onClick={() => setModuleViewPersist('list')} className={moduleView === 'list' ? 'on' : ''} title="List view"><LayoutList size={14} /></button>
                            <button onClick={() => setModuleViewPersist('grid')} className={moduleView === 'grid' ? 'on' : ''} title="Grid view"><LayoutGrid size={14} /></button>
                        </div>
                    </div>
                    <div className={`admCard${moduleView === 'grid' ? ' flush' : ' wide'}`}>
                        <div className="admCardHead">
                            <div>
                                <h2>Module defaults</h2>
                                <p>Default = enabled automatically when the bot joins a new server.</p>
                            </div>
                            <Puzzle size={16} style={{ color: 'var(--purple)' }} />
                        </div>
                        {moduleView === 'list' ? (
                        <div className="admRows">
                            {modules.map(m => {
                                const pct = m.totalGuilds > 0 ? Math.round((m.enabledInGuilds / m.totalGuilds) * 100) : 0;
                                return (
                                    <div key={m.id} className="admRow">
                                        <span className="modIcon"><Puzzle size={15} /></span>
                                        <div className="admRowMain">
                                            <div className="admRowTitle">
                                                <b>{m.name}</b>
                                            </div>
                                            <div className="admRowMeta">
                                                {m.description}
                                                <i>·</i> on in {m.enabledInGuilds}/{m.totalGuilds} servers
                                            </div>
                                        </div>
                                        <span className={`rowCenterChip ${m.isDefault ? 'on' : 'off'}`}>
                                            {m.isDefault ? 'Default' : 'Off'}
                                        </span>
                                        <div className="admRowAct">
                                            <span className="catChip">{m.category}</span>
                                            <button
                                                onClick={() => toggleDefault(m)}
                                                disabled={toggling === m.id}
                                                className={`sw ${m.isDefault ? 'on' : ''}`}
                                                aria-label={`Toggle ${m.name} default`}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        ) : (
                        <div className="modGrid">
                            {modules.map(m => {
                                const pct = m.totalGuilds > 0 ? Math.round((m.enabledInGuilds / m.totalGuilds) * 100) : 0;
                                return (
                                    <div key={m.id} className="modCard">
                                        <div className="modCardTop">
                                            <span className="modIcon"><Puzzle size={15} /></span>
                                            <button
                                                onClick={() => toggleDefault(m)}
                                                disabled={toggling === m.id}
                                                className={`sw ${m.isDefault ? 'on' : ''}`}
                                                aria-label={`Toggle ${m.name} default`}
                                            />
                                        </div>
                                        <b className="modCardName">{m.name}</b>
                                        <span className="catChip">{m.category}</span>
                                        <p className="modCardDesc">{m.description}</p>
                                        <span className={`modCardState ${m.isDefault ? '' : 'off'}`}>
                                            {m.isDefault ? 'Default: On' : 'Default: Off'}
                                        </span>
                                        <div className="modCoverage">
                                            <div className="modBar"><i style={{ width: `${pct}%` }} /></div>
                                            <small>{m.enabledInGuilds}/{m.totalGuilds}</small>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        )}
                    </div>
                    </>
                )}

            </main>

            {/* footer */}
            <footer className="admFoot">
                <div className="admFootInner">
                    <span className="admFootBrand">
                        <img src="/logo.png" alt="Guildex" />
                        Guildex
                    </span>
                    <span className="admFootText">Admin Panel • Bot owner controls</span>
                    <span className="admFootCopy">© {new Date().getFullYear()} Guildex. All rights reserved.</span>
                </div>
            </footer>
        </div>
    );
}
