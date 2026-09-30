import { ArrowRight, Check, Database, Layers3, Puzzle, Server, Settings2, Shield, Ticket, Trophy, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { STATS } from './data';
import { ModulesBrowser } from './modules-browser';

type Vis = 'modules' | 'api' | 'term' | 'dash' | 'infra';

interface BentoTile {
    title: string;
    desc: string;
    icon: LucideIcon;
    wide?: boolean;
    meta?: string[];
    vis?: Vis;
    points?: string[];
}

export function Stats() {
    return (
        <div className="strip">
            <div className="wrap">
                <div className="stripRow">
                    {STATS.map(({ value, label, icon: Icon }) => (
                        <div className="stripCell" key={label}>
                            <div className="stripIcon"><Icon size={18} /></div>
                            <div>
                                <b>{value}</b>
                                <span>{label}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Bento layout: wide tiles span 3 cols, regular span 2 of a 6-col grid.
// Order matters - each row must fill exactly 6 columns or a gap appears.
// Row 1: wide + wide (3+3). Row 2: regular x3 (2+2+2).
const BENTO: BentoTile[] = [
    {
        title: 'Fully modular architecture',
        desc: 'Every feature is an independent module. Enable only what your community needs and configure each one per server - nothing runs unless you turn it on.',
        icon: Puzzle,
        wide: true,
        vis: 'modules',
        meta: ['Per-guild toggles', 'Zero redeploys'],
    },
    {
        title: 'Web dashboard',
        desc: 'Configure every module visually. Discord OAuth sign-in with per-guild access control built in.',
        icon: Settings2,
        wide: true,
        vis: 'dash',
        meta: ['Next.js 15', 'Discord OAuth'],
        points: [
            'Role-based access for owners, admins and moderators',
            'Changes apply to the bot instantly via the API',
        ],
    },
    {
        title: 'Real infrastructure',
        desc: 'PostgreSQL for persistence, Redis for cache and rate limits - the same stack production services run on.',
        icon: Server,
        vis: 'infra',
    },
    {
        title: 'REST API',
        desc: 'A Fastify API with 70+ endpoints backs the dashboard and can power your own tooling.',
        icon: Zap,
        vis: 'api',
        meta: ['Fastify 5', 'API-key auth'],
    },
    {
        title: 'Deploy anywhere',
        desc: 'Three Docker images, one compose file, two isolated networks. Production-ready out of the box.',
        icon: Layers3,
        vis: 'term',
        meta: ['Compose', 'Isolated nets'],
    },
];

export function Features() {
    return (
        <section className="section" id="features" style={{ paddingBottom: 'clamp(40px, 5vw, 64px)' }}>
            <div className="wrap">
                <div className="secHead">
                    <div className="kicker">Platform</div>
                    <h2>Everything your community needs.<br />Nothing it doesn&rsquo;t.</h2>
                    <p className="secSub">
                        Guildex is built like a platform, not a script - modular
                        features, a real persistence layer and a dashboard designed
                        for people who run servers, not just chat in them.
                    </p>
                </div>

                <div className="bento">
                    {BENTO.map(({ title, desc, icon: Icon, wide, meta, vis, points }) => (
                        <div className={`tile ${wide ? 'wide' : ''}`} key={title}>
                            <span className="tileGlow" />
                            <div className="tileBody">
                                <div className="tileIcon"><Icon size={18} /></div>
                                <h3>{title}</h3>
                                <p>{desc}</p>
                                {points && (
                                    <ul className="tilePoints">
                                        {points.map((pt) => (
                                            <li key={pt}><Check size={11} />{pt}</li>
                                        ))}
                                    </ul>
                                )}
                                {meta && (
                                    <div className="tileMeta">
                                        {meta.map((m) => <i key={m}>{m}</i>)}
                                    </div>
                                )}
                            </div>
                            {vis === 'modules' && <ModulesVis />}
                            {vis === 'api' && <ApiVis />}
                            {vis === 'dash' && <DashVis />}
                            {vis === 'term' && <TermVis />}
                            {vis === 'infra' && <InfraVis />}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

const VIS_MODS: [string, LucideIcon, boolean][] = [
    ['Moderation', Shield, true],
    ['Leveling', Trophy, true],
    ['Tickets', Ticket, false],
];

function ModulesVis() {
    return (
        <div className="tileVis">
            {VIS_MODS.map(([n, Icon, on]) => (
                <div className="fmod" key={n}>
                    <span className="fmodIcon"><Icon size={12} /></span>
                    <div><b>{n}</b></div>
                    <span className={`sw ${on ? '' : 'off'}`} />
                </div>
            ))}
        </div>
    );
}

function ApiVis() {
    return (
        <div className="visDark">
            <div className="ln"><b><span className="purple">GET</span> /api/guilds/:id/modules</b><span className="ok">200</span></div>
            <div className="ln"><b><span className="purple">PUT</span> /api/guilds/:id/modules/:m</b><span className="ok">200</span></div>
            <div className="ln"><b><span className="purple">GET</span> /api/moderation/cases</b><span className="ok">200</span></div>
            <div className="ln dim"><span>x-api-key · authenticated</span><span>avg 14ms</span></div>
        </div>
    );
}

const DASH_BARS = [38, 55, 42, 68, 50, 80, 62, 92];

function DashVis() {
    return (
        <div className="tileVis">
            <div className="dashMini">
                <div className="dashMiniHead">
                    <span>
                        <b>Overview</b>
                        <small>Phoenix Community</small>
                    </span>
                    <span className="fchip">● Online</span>
                </div>
                <div className="dashStats">
                    {[
                        ['Members', '12.4K'],
                        ['Modules', '28'],
                        ['Cases', '342'],
                    ].map(([k, v]) => (
                        <div key={k}><span>{k}</span><b>{v}</b></div>
                    ))}
                </div>
                <div className="chart mini">
                    {DASH_BARS.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}
                </div>
            </div>
        </div>
    );
}

const INFRA_SERVICES: [string, LucideIcon, string, string][] = [
    ['PostgreSQL', Database, 'primary', '9ms'],
    ['Redis', Zap, 'cache', '2ms'],
];

function InfraVis() {
    return (
        <div className="tileVis">
            {INFRA_SERVICES.map(([n, Icon, role, lat]) => (
                <div className="fmod" key={n}>
                    <span className="fmodIcon"><Icon size={12} /></span>
                    <div><b>{n}</b><small>{role}</small></div>
                    <span className="lat">● {lat}</span>
                </div>
            ))}
        </div>
    );
}

function TermVis() {
    return (
        <div className="visDark">
            <div className="dim">$ docker compose up -d</div>
            <div><span className="ok">✓</span> api <span className="ok">✓</span> bot <span className="ok">✓</span> dashboard</div>
            <div><span className="ok">✓</span> postgres <span className="ok">✓</span> redis <span className="dim">- 5 services</span></div>
        </div>
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

                <ModulesBrowser />
            </div>
        </section>
    );
}
