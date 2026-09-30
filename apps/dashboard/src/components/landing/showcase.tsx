import Link from 'next/link';
import {
    ArrowRight,
    Check,
    ChevronDown,
    Database,
    Gift,
    Lock,
    Search,
    Shield,
    Ticket,
    Trophy,
} from 'lucide-react';
import { SIDEBAR, TICKS } from './data';

const PANEL_MODULES: [string, string, typeof Shield, boolean][] = [
    ['Moderation', 'Cases & automod', Shield, true],
    ['Leveling', 'XP & ranks', Trophy, true],
    ['Economy', 'Currency & shop', Database, true],
    ['Tickets', 'Support panels', Ticket, true],
    ['Giveaways', 'Community events', Gift, false],
];

export function Showcase() {
    return (
        <section className="section" id="dashboard" style={{ paddingTop: 'clamp(40px, 5vw, 64px)' }}>
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
                    <div className="fsideLogo"><img className="logoFill" src="/logo.png" alt="" /> Guildex</div>
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

