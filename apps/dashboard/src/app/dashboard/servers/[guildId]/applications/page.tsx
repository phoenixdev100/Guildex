/**
 * Applications Manager
 *
 * Per-server application form builder + submission review.
 * Create forms, manage questions, open/close, review submissions -
 * everything the /appsetup and /applications commands do, in the UI.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Question {
    label: string;
    style: 'short' | 'paragraph';
    required: boolean;
    placeholder?: string;
}

interface AppForm {
    id: string;
    name: string;
    description?: string | null;
    questions: Question[];
    staffRoleId?: string | null;
    acceptedRoleId?: string | null;
    logChannelId?: string | null;
    isOpen: boolean;
    cooldownHours: number;
    _count?: { submissions: number };
}

interface Submission {
    id: string;
    userId: string;
    status: string;
    answers: { question: string; answer: string }[];
    reason?: string | null;
    createdAt: string;
    form?: { name: string };
}

interface Option { id: string; name: string; }

type Tab = 'forms' | 'submissions';

export default function ApplicationsPage() {
    const params = useParams();
    const guildId = params.guildId as string;

    const [tab, setTab] = useState<Tab>('forms');
    const [forms, setForms] = useState<AppForm[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [roles, setRoles] = useState<Option[]>([]);
    const [channels, setChannels] = useState<Option[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    // Create-form editor state
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newStaffRole, setNewStaffRole] = useState('');
    const [newAcceptedRole, setNewAcceptedRole] = useState('');
    const [newLogChannel, setNewLogChannel] = useState('');

    // Expanded form editor
    const [editing, setEditing] = useState<string | null>(null);
    const [newQ, setNewQ] = useState('');
    const [newQStyle, setNewQStyle] = useState<'short' | 'paragraph'>('short');
    const [newQRequired, setNewQRequired] = useState(true);

    // Submissions filter
    const [statusFilter, setStatusFilter] = useState('pending');

    const load = useCallback(async () => {
        try {
            const [formsRes, subsRes, rolesRes, chansRes] = await Promise.all([
                fetch(`/api/guilds/${guildId}/applications/forms`),
                fetch(`/api/guilds/${guildId}/applications/submissions`),
                fetch(`/api/guilds/${guildId}/discord-roles`),
                fetch(`/api/guilds/${guildId}/discord-channels`),
            ]);
            if (formsRes.ok) setForms((await formsRes.json()).data?.forms ?? []);
            if (subsRes.ok) setSubmissions((await subsRes.json()).data?.submissions ?? []);
            if (rolesRes.ok) setRoles(((await rolesRes.json()).data ?? []).filter((r: any) => !r.managed));
            if (chansRes.ok) setChannels((await chansRes.json()).data ?? []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [guildId]);

    useEffect(() => { load(); }, [load]);

    const flash = (type: 'ok' | 'err', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 4000);
    };

    const api = async (method: string, path: string, body?: unknown) => {
        const res = await fetch(path, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error(data.error ?? `HTTP ${res.status}`);
        return data;
    };

    const createForm = async () => {
        if (!newName.trim()) return flash('err', '❌ Name the form first');
        try {
            await api('POST', `/api/guilds/${guildId}/applications/forms`, {
                name: newName.trim(), description: newDesc.trim() || undefined,
                staffRoleId: newStaffRole || undefined, acceptedRoleId: newAcceptedRole || undefined,
                logChannelId: newLogChannel || undefined,
            });
            setShowCreate(false); setNewName(''); setNewDesc(''); setNewStaffRole(''); setNewAcceptedRole(''); setNewLogChannel('');
            flash('ok', '✅ Form created - add questions below');
            load();
        } catch (e: any) { flash('err', `❌ ${e.message}`); }
    };

    const patchForm = async (formId: string, patch: Record<string, unknown>) => {
        try {
            await api('PATCH', `/api/guilds/${guildId}/applications/forms/${formId}`, patch);
            load();
        } catch (e: any) { flash('err', `❌ ${e.message}`); }
    };

    const deleteForm = async (formId: string, name: string) => {
        if (!confirm(`Delete "${name}" and all its submissions?`)) return;
        try {
            await api('DELETE', `/api/guilds/${guildId}/applications/forms/${formId}`);
            flash('ok', '🗑️ Form deleted'); load();
        } catch (e: any) { flash('err', `❌ ${e.message}`); }
    };

    const addQuestion = async (form: AppForm) => {
        if (!newQ.trim()) return;
        if (form.questions.length >= 10) return flash('err', '❌ Max 10 questions (Discord modal limit)');
        try {
            await api('PATCH', `/api/guilds/${guildId}/applications/forms/${form.id}`, {
                questions: [...form.questions, { label: newQ.trim(), style: newQStyle, required: newQRequired }],
            });
            setNewQ(''); setNewQStyle('short'); setNewQRequired(true);
            flash('ok', '✅ Question added'); load();
        } catch (e: any) { flash('err', `❌ ${e.message}`); }
    };

    const removeQuestion = async (form: AppForm, idx: number) => {
        await patchForm(form.id, { questions: form.questions.filter((_, i) => i !== idx) });
    };

    const review = async (subId: string, action: 'accept' | 'deny') => {
        const reason = action === 'deny' ? prompt('Denial reason (optional):') ?? undefined : undefined;
        try {
            await api('POST', `/api/guilds/${guildId}/applications/submissions/${subId}/review`, {
                reviewerId: 'dashboard', action, reason,
            });
            flash('ok', action === 'accept' ? '✅ Accepted (role will be assigned via command/button review)' : '❌ Denied');
            load();
        } catch (e: any) { flash('err', `❌ ${e.message}`); }
    };

    if (loading) {
        return <div className="flex items-center justify-center py-32"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    }

    const filteredSubs = submissions.filter(s => s.status === statusFilter);
    const inputCls = 'w-full bg-secondary/50 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50';
    const btnCls = 'bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors';

    return (
        <div className="space-y-8 animate-fade-in">
            <Link href={`/dashboard/servers/${guildId}`} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                ← Back to server
            </Link>

            <div>
                <h1 className="text-3xl font-bold text-foreground">📝 Applications</h1>
                <p className="text-muted-foreground text-sm mt-1">Build forms, manage questions, review submissions - members apply in Discord with <code className="bg-secondary px-1 rounded">/apply</code>.</p>
            </div>

            {message && <p className={`text-sm ${message.type === 'ok' ? 'text-green-500' : 'text-red-500'}`}>{message.text}</p>}

            {/* Tabs */}
            <div className="flex gap-2 border-b border-border/50">
                {(['forms', 'submissions'] as Tab[]).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${tab === t ? 'bg-secondary/50 text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                        {t === 'forms' ? `📄 Forms (${forms.length})` : `📬 Submissions (${submissions.length})`}
                    </button>
                ))}
            </div>

            {tab === 'forms' && (
                <div className="space-y-4">
                    {/* Create */}
                    {showCreate ? (
                        <div className="glass rounded-xl p-6 border border-border/50 space-y-4">
                            <h3 className="font-bold text-foreground">New form</h3>
                            <input className={inputCls} placeholder="Form name (e.g. Staff Application)" value={newName} onChange={e => setNewName(e.target.value)} maxLength={45} />
                            <input className={inputCls} placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                            <div className="grid md:grid-cols-3 gap-3">
                                <select className={inputCls} value={newStaffRole} onChange={e => setNewStaffRole(e.target.value)}>
                                    <option value="">Staff role (reviewers)</option>
                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                                <select className={inputCls} value={newAcceptedRole} onChange={e => setNewAcceptedRole(e.target.value)}>
                                    <option value="">Accepted role (auto-granted)</option>
                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                                <select className={inputCls} value={newLogChannel} onChange={e => setNewLogChannel(e.target.value)}>
                                    <option value="">Review channel</option>
                                    {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-3">
                                <button className={btnCls} onClick={createForm}>Create form</button>
                                <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setShowCreate(false)}>Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <button className={btnCls} onClick={() => setShowCreate(true)}>+ Create form</button>
                    )}

                    {/* Form list */}
                    {forms.length === 0 && !showCreate && (
                        <div className="glass rounded-xl p-8 border border-border/50 text-center text-muted-foreground">
                            No forms yet - create one and members can apply with <code className="bg-secondary px-1 rounded">/apply</code>.
                        </div>
                    )}

                    {forms.map(form => (
                        <div key={form.id} className="glass rounded-xl p-6 border border-border/50">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-bold text-foreground text-lg">{form.name}</h3>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${form.isOpen ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                                            {form.isOpen ? 'Open' : 'Closed'}
                                        </span>
                                        {(form._count?.submissions ?? 0) > 0 && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500">{form._count!.submissions} pending</span>
                                        )}
                                    </div>
                                    {form.description && <p className="text-sm text-muted-foreground mt-1">{form.description}</p>}
                                    <p className="text-xs text-muted-foreground mt-2">
                                        {form.questions.length} questions
                                        {form.staffRoleId && ` • staff: ${roles.find(r => r.id === form.staffRoleId)?.name ?? form.staffRoleId}`}
                                        {form.acceptedRoleId && ` • accepts → ${roles.find(r => r.id === form.acceptedRoleId)?.name ?? form.acceptedRoleId}`}
                                        {form.logChannelId && ` • logs → #${channels.find(c => c.id === form.logChannelId)?.name ?? form.logChannelId}`}
                                    </p>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <button className="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground"
                                        onClick={() => patchForm(form.id, { isOpen: !form.isOpen })}>
                                        {form.isOpen ? 'Close' : 'Open'}
                                    </button>
                                    <button className="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground"
                                        onClick={() => setEditing(editing === form.id ? null : form.id)}>
                                        {editing === form.id ? 'Done' : 'Edit'}
                                    </button>
                                    <button className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-500"
                                        onClick={() => deleteForm(form.id, form.name)}>Delete</button>
                                </div>
                            </div>

                            {editing === form.id && (
                                <div className="mt-5 pt-5 border-t border-border/50 space-y-4">
                                    {/* Questions */}
                                    <div>
                                        <p className="text-sm font-medium text-foreground mb-2">Questions ({form.questions.length}/10)</p>
                                        {form.questions.map((q, i) => (
                                            <div key={i} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                                                <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                                                <span className="flex-1 text-sm text-foreground">{q.label}</span>
                                                <span className="text-xs text-muted-foreground">{q.style}{q.required === false ? ' • optional' : ''}</span>
                                                <button className="text-xs text-red-500 hover:text-red-400" onClick={() => removeQuestion(form, i)}>✕</button>
                                            </div>
                                        ))}
                                        <div className="flex gap-2 mt-3">
                                            <input className={`${inputCls} flex-1`} placeholder="New question…" value={newQ} maxLength={45}
                                                onChange={e => setNewQ(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && addQuestion(form)} />
                                            <select className="bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm" value={newQStyle} onChange={e => setNewQStyle(e.target.value as any)}>
                                                <option value="short">Short</option>
                                                <option value="paragraph">Paragraph</option>
                                            </select>
                                            <button className={btnCls} onClick={() => addQuestion(form)}>Add</button>
                                        </div>
                                    </div>

                                    {/* Settings */}
                                    <div className="grid md:grid-cols-2 gap-3">
                                        <select className={inputCls} value={form.logChannelId ?? ''}
                                            onChange={e => patchForm(form.id, { logChannelId: e.target.value || null })}>
                                            <option value="">Review channel - not set</option>
                                            {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                                        </select>
                                        <select className={inputCls} value={form.acceptedRoleId ?? ''}
                                            onChange={e => patchForm(form.id, { acceptedRoleId: e.target.value || null })}>
                                            <option value="">Accepted role - not set</option>
                                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                        </select>
                                        <select className={inputCls} value={form.staffRoleId ?? ''}
                                            onChange={e => patchForm(form.id, { staffRoleId: e.target.value || null })}>
                                            <option value="">Staff/reviewer role - not set</option>
                                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                        </select>
                                        <input className={inputCls} type="number" min={0} max={720} placeholder="Cooldown hours (0 = none)"
                                            value={form.cooldownHours}
                                            onChange={e => patchForm(form.id, { cooldownHours: parseInt(e.target.value) || 0 })} />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {tab === 'submissions' && (
                <div className="space-y-4">
                    <div className="flex gap-2">
                        {['pending', 'accepted', 'denied', 'withdrawn'].map(s => (
                            <button key={s} onClick={() => setStatusFilter(s)}
                                className={`text-xs px-4 py-2 rounded-lg transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'}`}>
                                {s} ({submissions.filter(x => x.status === s).length})
                            </button>
                        ))}
                    </div>

                    {filteredSubs.length === 0 && (
                        <div className="glass rounded-xl p-8 border border-border/50 text-center text-muted-foreground">
                            No {statusFilter} submissions.
                        </div>
                    )}

                    {filteredSubs.map(sub => (
                        <div key={sub.id} className="glass rounded-xl p-6 border border-border/50">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <p className="font-bold text-foreground">{sub.form?.name ?? 'Application'} - <span className="text-muted-foreground font-normal">user {sub.userId}</span></p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(sub.createdAt).toLocaleString()}</p>
                                </div>
                                {sub.status === 'pending' && (
                                    <div className="flex gap-2">
                                        <button className="text-xs px-3 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-500" onClick={() => review(sub.id, 'accept')}>Accept</button>
                                        <button className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-500" onClick={() => review(sub.id, 'deny')}>Deny</button>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-3">
                                {(sub.answers ?? []).map((a, i) => (
                                    <div key={i}>
                                        <p className="text-xs font-medium text-muted-foreground">{a.question}</p>
                                        <p className="text-sm text-foreground mt-0.5">{a.answer}</p>
                                    </div>
                                ))}
                            </div>
                            {sub.reason && <p className="text-xs text-red-400 mt-3">Reason: {sub.reason}</p>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
