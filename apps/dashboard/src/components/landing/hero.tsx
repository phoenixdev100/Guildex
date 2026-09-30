import Link from 'next/link';
import {
    ArrowRight,
    Check,
    ChevronDown,
    Database,
    Github,
    Lock,
    Rocket,
    Shield,
    Sparkles,
    Ticket,
    Trophy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { REPO_URL, SIDEBAR } from './data';

const CHART_BARS = [42, 58, 45, 70, 52, 78, 64, 88, 74, 96, 82, 100];

const FRAME_MODULES: [string, string, LucideIcon, boolean][] = [
    ['Moderation', 'Cases & automod', Shield, true],
    ['Leveling', 'XP & ranks', Trophy, true],
    ['Economy', 'Currency & shop', Database, true],
    ['Tickets', 'Support panels', Ticket, false],
];

const FRAME_STATS: [string, string, string][] = [
    ['Members', '12,458', '+4.2%'],
    ['Commands / day', '3,241', '+11%'],
    ['Open tickets', '7', ''],
    ['Active modules', '28/45', ''],
];

export function Hero() {
    return (
        <section className="hero">
            <div className="wrap">
                <a className="pill" href={REPO_URL}>
                    <b><Sparkles size={11} /> v2.0</b>
                    Open source · Self-hosted · Docker ready
                </a>

                <h1>
                    Every feature your Discord server needs.{' '}
                    <em>One platform.</em>
                </h1>

                <p className="lead">
                    A modular Discord bot with a real database, REST API and a
                    modern admin dashboard. Self-hosted, open source, and fully
                    under your control.
                </p>

                <div className="heroCtas">
                    <Link className="btn btnPrimary btnLg" href="/dashboard">
                        <Rocket size={15} /> Get Started
                        <ArrowRight size={14} />
                    </Link>
                    <a className="btn btnGhost btnLg" href={REPO_URL}>
                        <Github size={15} /> View on GitHub
                    </a>
                </div>

                <div className="trustRow">
                    <span><Check size={13} /> Self-hosted</span>
                    <span><Check size={13} /> Fully modular</span>
                    <span><Check size={13} /> No monthly fees</span>
                    <span><Check size={13} /> Your data, your infra</span>
                </div>

                <ProductFrame />
            </div>
        </section>
    );
}

function ProductFrame() {
    return (
        <div className="frame">
            <div className="frameBar">
                <span className="fdot r" /><span className="fdot y" /><span className="fdot g" />
                <span className="frameUrl"><Lock size={9} /> guildex.local/dashboard</span>
            </div>

            <div className="frameBody">
                <aside className="fside">
                    <div className="fsideLogo"><img className="logoFill" src="/logo.png" alt="" /> Guildex</div>
                    {SIDEBAR.map(([name, Icon], i) => (
                        <div className={`fItem ${i === 0 ? 'on' : ''}`} key={name}>
                            <Icon size={12} /> {name}
                        </div>
                    ))}
                    <div className="fsideFoot"><i>PC</i> Phoenix Community <ChevronDown size={10} /></div>
                </aside>

                <div className="fmain">
                    <div className="fhead">
                        <div>
                            <b>Overview</b>
                            <div className="sub">Phoenix Community · Production</div>
                        </div>
                        <span className="fchip">● All systems operational</span>
                    </div>

                    <div className="fstats">
                        {FRAME_STATS.map(([k, v, d]) => (
                            <div className="fstat" key={k}>
                                <span>{k}</span>
                                <b>{v}</b>
                                {d && <small>{d}</small>}
                            </div>
                        ))}
                    </div>

                    <div className="frow">
                        <div className="fcard">
                            <div className="fcardHead">Command usage <span>Last 12 weeks</span></div>
                            <div className="chart">
                                {CHART_BARS.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}
                            </div>
                        </div>

                        <div className="fcard">
                            <div className="fcardHead">Modules <span>Manage</span></div>
                            {FRAME_MODULES.map(([n, d, Icon, on]) => (
                                <div className="fmod" key={n}>
                                    <span className="fmodIcon"><Icon size={13} /></span>
                                    <div><b>{n}</b><small>{d}</small></div>
                                    <span className={`sw ${on ? '' : 'off'}`} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
