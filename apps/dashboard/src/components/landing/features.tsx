import { ArrowRight, Layers3, Puzzle, Server, Settings2, Shield, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MODULES, STATS } from './data';

export function Stats() {
    return (
        <div className="strip">
            <div className="wrap">
                <div className="stripRow">
                    {STATS.map(({ value, label, icon: Icon }) => (
                        <div className="stripCell" key={label}>
                            <Icon size={18} />
                            <b>{value}</b>
                            <span>{label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

const BENTO: { title: string; desc: string; icon: LucideIcon; wide?: boolean; meta?: string[] }[] = [
    {
        title: 'Fully modular architecture',
        desc: 'Every feature is an independent module. Enable only what your community needs and configure each one per server — nothing runs unless you turn it on.',
        icon: Puzzle,
        wide: true,
        meta: ['Per-guild toggles', 'Zero redeploys', 'Isolated config'],
    },
    {
        title: 'Real infrastructure',
        desc: 'PostgreSQL for persistence, Redis for cache and rate limits — the same stack production services run on.',
        icon: Server,
        meta: ['PostgreSQL', 'Redis', 'Prisma'],
    },
    {
        title: 'REST API',
        desc: 'A Fastify API with 70+ endpoints backs the dashboard and can power your own tooling.',
        icon: Zap,
        wide: true,
        meta: ['Fastify 5', 'API-key auth', 'OpenAPI-ready'],
    },
    {
        title: 'Moderation first',
        desc: 'Cases, warnings, automod rules and audit logs with a searchable record per member.',
        icon: Shield,
    },
    {
        title: 'Web dashboard',
        desc: 'Configure every module visually. Discord OAuth sign-in with per-guild access control built in.',
        icon: Settings2,
        wide: true,
        meta: ['Next.js 15', 'Discord OAuth', 'Guild-scoped'],
    },
    {
        title: 'Deploy anywhere',
        desc: 'Three Docker images, one compose file, two isolated networks. Production-ready out of the box.',
        icon: Layers3,
        meta: ['Docker Compose', 'Network isolation', 'One-command deploy'],
    },
];

export function Features() {
    return (
        <section className="section" id="features">
            <div className="wrap">
                <div className="secHead">
                    <div className="kicker">Platform</div>
                    <h2>Everything your community needs.<br />Nothing it doesn&rsquo;t.</h2>
                    <p className="secSub">
                        MasterBot is built like a platform, not a script — modular
                        features, a real persistence layer and a dashboard designed
                        for people who run servers, not just chat in them.
                    </p>
                </div>

                <div className="bento">
                    {BENTO.map(({ title, desc, icon: Icon, wide, meta }) => (
                        <div className={`tile ${wide ? 'wide' : ''}`} key={title}>
                            <span className="tileGlow" />
                            <div className="tileIcon"><Icon size={18} /></div>
                            <h3>{title}</h3>
                            <p>{desc}</p>
                            {meta && (
                                <div className="tileMeta">
                                    {meta.map((m) => <i key={m}>{m}</i>)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function Modules() {
    return (
        <section className="band section" id="modules">
            <div className="wrap">
                <div className="secHead" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 32, maxWidth: 'none' }}>
                    <div style={{ maxWidth: 620 }}>
                        <div className="kicker">Feature modules</div>
                        <h2>A module for every job.</h2>
                        <p className="secSub">
                            Moderation, leveling, economy, tickets, AI, games and more.
                            Toggle each one per server from the dashboard.
                        </p>
                    </div>
                    <a className="btn btnGhost" href="/dashboard" style={{ flexShrink: 0 }}>
                        Browse in dashboard <ArrowRight size={14} />
                    </a>
                </div>

                <div className="modGrid">
                    {MODULES.map(({ name, desc, icon: Icon }) => (
                        <div className="mod" key={name}>
                            <span className="modIcon"><Icon size={15} /></span>
                            <div>
                                <b>{name}</b>
                                <small>{desc}</small>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
