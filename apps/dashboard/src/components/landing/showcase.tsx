import Link from 'next/link';
import {
    ArrowRight,
    Bot,
    Check,
    ChevronDown,
    Database,
    Gift,
    Heart,
    Lock,
    Search,
    Shield,
    Sparkles,
    Ticket,
    Trophy,
    Users,
} from 'lucide-react';
import { SIDEBAR, STEPS, TICKS } from './data';

const PANEL_MODULES: [string, string, typeof Shield, boolean][] = [
    ['Moderation', 'Cases & automod', Shield, true],
    ['Leveling', 'XP & ranks', Trophy, true],
    ['Economy', 'Currency & shop', Database, true],
    ['Tickets', 'Support panels', Ticket, true],
    ['Welcome', 'Greet new members', Users, false],
    ['Reaction Roles', 'Self-assign roles', Heart, false],
    ['Giveaways', 'Community events', Gift, true],
    ['AI Commands', 'Chat, image & TTS', Sparkles, false],
];

export function Showcase() {
    return (
        <section className="section" id="dashboard">
            <div className="wrap split">
                <div>
                    <div className="kicker">Web dashboard</div>
                    <h2>Manage everything without typing a command.</h2>
                    <p className="secSub">
                        A clean admin surface for moderators and owners - built on
                        Next.js, authenticated with Discord OAuth, scoped per guild.
                    </p>

                    <ul className="tickList">
                        {TICKS.map((t) => (
                            <li key={t}><span className="tick"><Check size={11} /></span>{t}</li>
                        ))}
                    </ul>

                    <Link className="btn btnPrimary" href="/dashboard">
                        Open Dashboard <ArrowRight size={14} />
                    </Link>
                </div>

                <ModulesPanel />
            </div>
        </section>
    );
}

function ModulesPanel() {
    return (
        <div className="miniFrame">
            <div className="frameBar">
                <span className="fdot r" /><span className="fdot y" /><span className="fdot g" />
                <span className="frameUrl"><Lock size={9} /> dashboard / modules</span>
            </div>

            <div className="frameBody">
                <aside className="fside">
                    <div className="fsideLogo"><i><Bot size={12} /></i> MasterBot</div>
                    {SIDEBAR.map(([name, Icon], i) => (
                        <div className={`fItem ${i === 1 ? 'on' : ''}`} key={name}>
                            <Icon size={12} /> {name}
                        </div>
                    ))}
                    <div className="fsideFoot"><i>PC</i> Phoenix <ChevronDown size={10} /></div>
                </aside>

                <div className="fmain">
                    <div className="fhead">
                        <div>
                            <b>Modules</b>
                            <div className="sub">Toggle features for this server</div>
                        </div>
                        <span className="fchip">28 enabled</span>
                    </div>

                    <div className="searchRow"><Search size={11} /> Search modules…</div>

                    {PANEL_MODULES.map(([n, d, Icon, on]) => (
                        <div className="fmod" key={n}>
                            <span className="fmodIcon"><Icon size={13} /></span>
                            <div><b>{n}</b><small>{d}</small></div>
                            <span className={`sw ${on ? '' : 'off'}`} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function Steps() {
    return (
        <section className="section" id="get-started">
            <div className="wrap">
                <div className="secHead center">
                    <div className="kicker">Setup</div>
                    <h2>Running in minutes, not days.</h2>
                    <p className="secSub">
                        Clone, configure, deploy - the whole stack comes up with one
                        compose command.
                    </p>
                </div>

                <div className="stepGrid">
                    {STEPS.map((s, i) => (
                        <div className="step" key={s.title}>
                            <div className="stepNum">{i + 1}</div>
                            <h3>{s.title}</h3>
                            <p>{s.desc}</p>
                            {s.code && <code className="stepCode">{s.code}</code>}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
