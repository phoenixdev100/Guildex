/**
 * Guild Detail Page
 *
 * Per-server configuration: admin role assignment + quick info.
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Role {
    id: string;
    name: string;
    color: number;
    position: number;
    managed: boolean;
}

interface Server {
    id: string;
    name: string;
    icon: string | null;
    ownerId: string;
    memberCount: number;
}

interface GuildModule {
    name: string;
    category: string;
    description: string | null;
    enabled: boolean;
}

export default function GuildDetailPage() {
    const params = useParams();
    const guildId = params.guildId as string;

    const [server, setServer] = useState<Server | null>(null);
    const [roles, setRoles] = useState<Role[]>([]);
    const [adminRoleId, setAdminRoleId] = useState<string>('');
    const [modules, setModules] = useState<GuildModule[]>([]);
    const [toggling, setToggling] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [guildId]);

    const load = async () => {
        try {
            const [guildsRes, rolesRes, adminRes, modulesRes] = await Promise.all([
                fetch('/api/dashboard/guilds'),
                fetch(`/api/guilds/${guildId}/discord-roles`),
                fetch(`/api/guilds/${guildId}/admin-role`),
                fetch(`/api/guilds/${guildId}/modules`),
            ]);

            if (guildsRes.ok) {
                const guilds = await guildsRes.json();
                setServer(guilds.find((g: Server) => g.id === guildId) ?? null);
            }
            if (rolesRes.ok) {
                const data = await rolesRes.json();
                setRoles(data.data ?? []);
            }
            if (adminRes.ok) {
                const data = await adminRes.json();
                setAdminRoleId(data.data?.adminRoleId ?? '');
            }
            if (modulesRes.ok) {
                const data = await modulesRes.json();
                setModules(data.modules ?? []);
            }
        } catch (error) {
            console.error('Failed to load guild:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveAdminRole = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/guilds/${guildId}/admin-role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roleId: adminRoleId || null }),
            });
            if (res.ok) {
                setMessage({ type: 'ok', text: '✅ Admin role saved - takes effect within ~60 seconds.' });
            } else {
                const err = await res.json().catch(() => ({}));
                setMessage({ type: 'err', text: `❌ ${err.error ?? 'Failed to save'}` });
            }
        } catch {
            setMessage({ type: 'err', text: '❌ Failed to save admin role' });
        } finally {
            setSaving(false);
        }
    };

    const toggleModule = async (name: string, enabled: boolean) => {
        setToggling(name);
        try {
            const res = await fetch(`/api/guilds/${guildId}/modules/${name}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled }),
            });
            if (res.ok) {
                setModules(prev => prev.map(m => m.name === name ? { ...m, enabled } : m));
            } else {
                const err = await res.json().catch(() => ({}));
                setMessage({ type: 'err', text: `❌ ${err.error ?? 'Toggle failed'}` });
            }
        } catch {
            setMessage({ type: 'err', text: '❌ Failed to toggle module' });
        } finally {
            setToggling(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <Link href="/dashboard/servers" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                ← Back to servers
            </Link>

            {/* Header */}
            <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center overflow-hidden border border-border/50">
                    {server?.icon ? (
                        <img src={`https://cdn.discordapp.com/icons/${guildId}/${server.icon}.png`} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-2xl font-bold text-muted-foreground">{server?.name?.slice(0, 2).toUpperCase() ?? '??'}</span>
                    )}
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-foreground">{server?.name ?? 'Server'}</h1>
                    <p className="text-muted-foreground text-sm mt-1">{server?.memberCount ?? 0} members • {guildId}</p>
                </div>
            </div>

            {/* Admin Role Card */}
            <div className="glass rounded-xl p-6 border border-border/50 max-w-2xl">
                <h2 className="text-xl font-bold text-foreground mb-1">🛡️ Bot Admin Role</h2>
                <p className="text-sm text-muted-foreground mb-6">
                    Members with this role can use <strong>admin commands</strong> (/announce, /purge, /roleall, /audit, …)
                    even without raw Discord permissions. Enforced by the bot - takes effect within ~60 seconds.
                </p>

                <label className="block text-sm font-medium text-foreground mb-2">Admin role</label>
                <div className="flex gap-3">
                    <select
                        value={adminRoleId}
                        onChange={(e) => setAdminRoleId(e.target.value)}
                        className="flex-1 bg-secondary/50 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                        <option value="">- No admin role (Discord permissions only) -</option>
                        {roles.map((r) => (
                            <option key={r.id} value={r.id} disabled={r.managed}>
                                {r.name}{r.managed ? ' (managed)' : ''}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={saveAdminRole}
                        disabled={saving}
                        className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>

                {message && (
                    <p className={`mt-4 text-sm ${message.type === 'ok' ? 'text-green-500' : 'text-red-500'}`}>
                        {message.text}
                    </p>
                )}
            </div>

            {/* Applications Manager */}
            <Link
                href={`/dashboard/servers/${guildId}/applications`}
                className="glass rounded-xl p-6 border border-border/50 max-w-2xl flex items-center justify-between hover:border-primary/50 transition-colors group"
            >
                <div>
                    <h2 className="text-xl font-bold text-foreground mb-1">📝 Applications</h2>
                    <p className="text-sm text-muted-foreground">
                        Build application forms, manage questions, review submissions - powers <code className="bg-secondary px-1 rounded">/apply</code>.
                    </p>
                </div>
                <span className="text-2xl text-muted-foreground group-hover:text-primary transition-colors">→</span>
            </Link>

            {/* Modules */}
            <div className="glass rounded-xl p-6 border border-border/50">
                <h2 className="text-xl font-bold text-foreground mb-1">🧩 Modules</h2>
                <p className="text-sm text-muted-foreground mb-6">
                    Toggle feature categories for this server - disabled modules block their commands instantly.
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {modules.map(m => (
                        <div key={m.name} className="flex items-center justify-between bg-secondary/30 rounded-lg px-4 py-3 border border-border/30">
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{m.category}</p>
                            </div>
                            <button
                                onClick={() => toggleModule(m.name, !m.enabled)}
                                disabled={toggling === m.name}
                                className={`ml-3 shrink-0 w-11 h-6 rounded-full transition-colors relative ${m.enabled ? 'bg-green-500' : 'bg-secondary'}`}
                            >
                                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${m.enabled ? 'left-[22px]' : 'left-0.5'}`} />
                            </button>
                        </div>
                    ))}
                    {modules.length === 0 && (
                        <p className="text-sm text-muted-foreground col-span-full">No modules registered - invite the bot to this server first.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
