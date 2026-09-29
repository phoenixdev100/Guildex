import Link from 'next/link';
import { ArrowRight, Bot, Github, Rocket } from 'lucide-react';
import { REPO_URL } from './data';

export function Cta() {
    return (
        <section className="section" style={{ paddingTop: 0, paddingBottom: 'clamp(36px, 4vw, 56px)' }}>
            <div className="wrap">
                <div className="ctaCard">
                    <span className="logoMark ctaMark"><Bot size={18} /></span>
                    <h2>Put your community back in your hands.</h2>
                    <p>
                        Open source, self-hosted and fully customizable.
                        No monthly fees - your data stays on your infrastructure.
                    </p>
                    <div className="ctaBtns">
                        <Link className="btn btnInvert btnLg" href="/dashboard">
                            <Rocket size={15} /> Get Started <ArrowRight size={14} />
                        </Link>
                        <a className="btn btnOutline btnLg" href={REPO_URL}>
                            <Github size={15} /> GitHub
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
}

export function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer className="foot" id="docs">
            <div className="wrap">
                <div className="footTop">
                    <div className="footBrand">
                        <Link href="/" className="logo">
                            <span className="logoMark"><Bot size={17} /></span>
                            MasterBot
                        </Link>
                        <p>The self-hosted Discord platform. Open source under MIT.</p>
                    </div>

                    <div className="footCol">
                        <h5>Product</h5>
                        <a href="#features">Features</a>
                        <a href="#modules">Modules</a>
                        <a href="#dashboard">Dashboard</a>
                        <a href="#faq">FAQ</a>
                    </div>

                    <div className="footCol">
                        <h5>Resources</h5>
                        <a href={REPO_URL}>Documentation</a>
                        <a href={`${REPO_URL}#readme`}>API reference</a>
                        <a href={`${REPO_URL}/commits`}>Changelog</a>
                        <a href={`${REPO_URL}/releases`}>Releases</a>
                    </div>

                    <div className="footCol">
                        <h5>Community</h5>
                        <a href={REPO_URL}>GitHub</a>
                        <a href={`${REPO_URL}/issues`}>Issues</a>
                        <a href={`${REPO_URL}/discussions`}>Discussions</a>
                        <a href={`${REPO_URL}/blob/dev/AGENTS.md`}>Contributing</a>
                    </div>
                </div>

                <div className="footBar">
                    <span>© {year} <a className="footLink" href="https://github.com/phoenixdev100">Deepak</a></span>
                    <div className="icons">
                        <a className="iconBtn" href={REPO_URL} aria-label="GitHub">
                            <Github size={14} />
                        </a>
                    </div>
                    <span>Built for Discord communities</span>
                </div>
            </div>
        </footer>
    );
}
