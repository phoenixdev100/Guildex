/**
 * Login Page
 *
 * Discord OAuth2 sign-in — one centered card: form left, product preview right.
 * Same light enterprise design language as the landing page.
 */

'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { Check, Database, Shield, Ticket } from 'lucide-react';
import './login.css';

function DiscordIcon() {
    return (
        <svg width="19" height="19" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
    );
}

const PANEL_MODS: [string, string, typeof Shield, boolean][] = [
    ['Moderation', 'Cases & automod', Shield, true],
    ['Economy', 'Currency & shop', Database, true],
    ['Tickets', 'Support panels', Ticket, false],
];

const DEMO_NAV = ['Overview', 'Modules', 'Moderation', 'Economy', 'Leveling', 'Logs'];
const DEMO_BARS = [38, 55, 42, 68, 50, 80, 62, 92];

function LoginForm() {
    const searchParams = useSearchParams();
    const error = searchParams.get('error');

    return (
        <div className="auth">
            <div className="authCol">
                <div className="authCard">
                    {/* left — sign-in */}
                    <div className="authLeft">
                        <Link href="/" className="authBrand">
                            <span className="authLogo"><img className="logoFill" src="/logo.png" alt="Guildex" /></span>
                            Guildex
                        </Link>

                        <div className="authBox">
                            <h1>Welcome back</h1>
                            <p className="authSub">
                                Sign in with Discord to manage your servers and modules.
                            </p>

                            {error && (
                                <div className="authErr">
                                    {error === 'OAuthCallback'
                                        ? 'Authentication failed — the Discord sign-in was interrupted. Please try again.'
                                        : 'Something went wrong during sign in. Please try again.'}
                                </div>
                            )}

                            <button
                                className="discordBtn"
                                onClick={() => signIn('discord', { callbackUrl: '/select-server' })}
                            >
                                <DiscordIcon />
                                Continue with Discord
                            </button>

                            <p className="authLegal">
                                We only see the servers you administer — nothing else.
                            </p>

                            <ul className="authTicks">
                                <li><Check size={13} /> Per-guild access control built in</li>
                                <li><Check size={13} /> Your data stays on your infrastructure</li>
                                <li><Check size={13} /> Open source — no account, no fees</li>
                            </ul>
                        </div>
                    </div>

                    {/* right — product preview */}
                    <div className="authRight">
                        <div className="demoFrame">
                            <div className="demoBar">
                                <i /><i /><i />
                                <span className="demoUrl">guildex.app/dashboard/modules</span>
                            </div>
                            <div className="demoBody">
                                <div className="demoSide">
                                    <img className="logoFill demoLogo" src="/logo.png" alt="" />
                                    {DEMO_NAV.map((n) => (
                                        <div className={`demoNav ${n === 'Modules' ? 'on' : ''}`} key={n}>{n}</div>
                                    ))}
                                </div>
                                <div className="demoMain">
                                    <div className="demoHead">
                                        <div><b>Modules</b><small>Phoenix Community</small></div>
                                        <span className="demoPill">● 28 enabled</span>
                                    </div>
                                    {PANEL_MODS.map(([n, d, Icon, on]) => (
                                        <div className="authMod" key={n}>
                                            <span className="mIcon"><Icon size={12} /></span>
                                            <div><b>{n}</b><small>{d}</small></div>
                                            <span className={`authSw ${on ? '' : 'off'}`} />
                                        </div>
                                    ))}
                                    <div className="demoChart">
                                        {DEMO_BARS.map((h, i) => (
                                            <i key={i} style={{ height: `${h}%` }} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="authMeta">
                    <span>© {new Date().getFullYear()} <a href="https://github.com/phoenixdev100">Deepak</a></span>
                    <Link href="/">← Back to home</Link>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense>
            <LoginForm />
        </Suspense>
    );
}
