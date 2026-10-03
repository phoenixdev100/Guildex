/**
 * Server Selection Screen
 *
 * Standalone page shown right after Discord OAuth - pick which server
 * to manage before entering the dashboard. Only shows servers where
 * the user is owner/admin (scoped server-side via their OAuth token).
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowRight,
    ChevronDown,
    Crown,
    LogOut,
    Pin,
    Plus,
    Puzzle,
    RotateCw,
    ServerCrash,
    Users,
} from 'lucide-react';
import './select.css';

interface Server {
    id: string;
    name: string;
    icon: string | null;
    ownerId: string;
    memberCount: number;
    enabledModules: number;
    totalModules: number;
    isActive?: boolean;
}

type SortMode = 'default' | 'name' | 'members';

const PIN_KEY = 'guildex:pinned-servers';

export default function SelectServerPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [servers, setServers] = useState<Server[]>([]);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [search, setSearch] = useState('');
    const [applied, setApplied] = useState('');
    const [searching, setSearching] = useState(false);
    const [sort, setSort] = useState<SortMode>('default');
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const onSearch = (v: string) => {
        setSearch(v);
        setSearching(true);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            setApplied(v);
            setSearching(false);
        }, 400);
    };

    const clearSearch = () => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        setSearch(''); setApplied(''); setSearching(false);
    };

    const [pinned, setPinned] = useState<Set<string>>(() => {
        if (typeof window === 'undefined') return new Set();
        try {
            return new Set<string>(JSON.parse(localStorage.getItem(PIN_KEY) || '[]'));
        } catch {
            return new Set();
        }
    });

    const togglePin = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        setPinned(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            try { localStorage.setItem(PIN_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
            return next;
        });
    };

    useEffect(() => {
        if (status === 'unauthenticated') router.replace('/login');
    }, [status, router]);

    /* close profile menu on outside click */
    useEffect(() => {
        const close = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

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
            <div className="sel">
                <div className="selLoader"><div className="spin" /></div>
            </div>
        );
    }

    const myId = (session?.user as { id?: string } | undefined)?.id;

    const filtered = servers
        .filter(s => s.name.toLowerCase().includes(applied.toLowerCase()))
        .sort((a, b) => {
            const pinDiff = Number(pinned.has(b.id)) - Number(pinned.has(a.id));
            if (pinDiff !== 0) return pinDiff;
            if (sort === 'name') return a.name.localeCompare(b.name);
            if (sort === 'members') return b.memberCount - a.memberCount;
            return 0;
        });

    const inviteBot = () => window.open(
        'https://discord.com/oauth2/authorize?client_id=' + process.env.DISCORD_CLIENT_ID + '&scope=bot&permissions=8',
        '_blank',
    );

    return (
        <div className="sel">
            {/* top bar */}
            <header className="selTop">
                <Link href="/" className="selBrand">
                    <img src="/logo.png" alt="Guildex" />
                    Guildex
                </Link>
                <div className="selUser">
                    {isSuperAdmin && (
                        <Link href="/admin" className="adminBtn">
                            <Crown size={13} /> Admin
                        </Link>
                    )}
                    <div className="selProfile" ref={menuRef}>
                        <button
                            className="selAvatar"
                            onClick={() => setMenuOpen(v => !v)}
                            aria-label="Account menu"
                        >
                            {session?.user?.image ? (
                                <img src={session.user.image} alt="" />
                            ) : (
                                <span className="selAvatarInit">
                                    {(session?.user?.name || '?').charAt(0).toUpperCase()}
                                </span>
                            )}
                            <ChevronDown size={13} className={menuOpen ? 'flip' : ''} />
                        </button>
                        {menuOpen && (
                            <div className="selMenu">
                                <div className="selMenuHead">
                                    <b>{session?.user?.name}</b>
                                    <small>Signed in with Discord</small>
                                </div>
                                <button
                                    className="selMenuItem danger"
                                    onClick={() => signOut({ callbackUrl: '/login' })}
                                >
                                    <LogOut size={13} /> Sign out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="selMain">
                <div className="selHead">
                    <div className="selKicker">Servers</div>
                    <h1>Select the server you want to manage</h1>
                    <p>
                        {session?.user?.name
                            ? `Welcome, ${session.user.name} - pick a community to manage.`
                            : 'Pick a community to manage - you will land on its dashboard.'}
                    </p>
                </div>

                {/* search */}
                {!loading && servers.length > 0 && (
                    <div className="selFilter">
                        <span>Filter:</span>
                        <label className="selSearch">
                            <input
                                type="text"
                                placeholder="Type name or ID"
                                value={search}
                                onChange={e => onSearch(e.target.value)}
                            />
                        </label>
                        {search && (
                            <button className="selClear" onClick={clearSearch} aria-label="Clear">
                                <RotateCw size={12} />
                            </button>
                        )}
                        <span className="selSortLbl">Sort:</span>
                        <div className="selSort">
                            {([['default', 'Pinned'], ['name', 'A–Z'], ['members', 'Members']] as [SortMode, string][]).map(([mode, label]) => (
                                <button
                                    key={mode}
                                    className={`sortChip ${sort === mode ? 'on' : ''}`}
                                    onClick={() => setSort(mode)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* server grid */}
                {loading || searching ? (
                    <div className="selGrid">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="skel">
                                <div className="skelBanner" />
                                <div className="skelLine w70" />
                                <div className="skelLine w50" />
                            </div>
                        ))}
                    </div>
                ) : filtered.length > 0 ? (
                    <div className="selGrid">
                        {filtered.map(server => (
                            <Link
                                key={server.id}
                                href={`/dashboard/servers/${server.id}`}
                                className="srv"
                            >
                                <div className="srvBanner">
                                    <span className={`roleChip ${server.ownerId === myId ? 'own' : 'adm'}`}>
                                        {server.ownerId === myId ? 'Owner' : 'Admin'}
                                    </span>
                                    <button
                                        className={`pin ${pinned.has(server.id) ? 'on' : ''}`}
                                        onClick={(e) => togglePin(e, server.id)}
                                        aria-label={pinned.has(server.id) ? 'Unpin server' : 'Pin server'}
                                    >
                                        <Pin size={12} />
                                    </button>
                                    <span className="srvIcon">
                                        {server.icon ? (
                                            <img src={server.icon} alt="" />
                                        ) : (
                                            server.name.charAt(0).toUpperCase()
                                        )}
                                    </span>
                                </div>
                                <b className="srvName">{server.name}</b>
                                <span className="srvMeta">
                                    <i className={`dot ${server.isActive !== false ? 'on' : ''}`} />
                                    {server.isActive !== false ? 'Bot active' : 'Bot not added'}
                                </span>
                                <span className="srvMeta">
                                    <Users size={11} /> {server.memberCount.toLocaleString()} members
                                    <i>·</i>
                                    <Puzzle size={11} /> {server.enabledModules}/{server.totalModules} modules
                                </span>
                                <span className="srvGo">
                                    <span className="srvGoBtn">Manage <ArrowRight size={12} /></span>
                                </span>
                            </Link>
                        ))}
                        <button type="button" className="addCard" onClick={inviteBot}>
                            <span className="addMark"><Plus size={18} /></span>
                            <b>Add to a server</b>
                            <small>Invite Guildex to another community</small>
                        </button>
                    </div>
                ) : (
                    <div className="selEmpty">
                        <span className="eMark"><ServerCrash size={22} /></span>
                        <h2>No manageable servers</h2>
                        <p>
                            {error
                                ? "Couldn't reach Discord to verify your servers - your session may be stale."
                                : search
                                    ? 'No servers match your search.'
                                    : "The bot isn't in any server you manage yet - invite it first."}
                        </p>
                        <div className="selEmptyBtns">
                            <button onClick={load} className="btn btnPrimary">
                                <RotateCw size={13} /> Retry
                            </button>
                            <button
                                onClick={() => signOut({ callbackUrl: '/login' })}
                                className="btn btnGhost"
                            >
                                Re-login
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
