import Link from 'next/link';
import { ArrowRight, Bot, Github } from 'lucide-react';
import { REPO_URL } from './data';

export function Nav() {
    return (
        <nav className="nav">
            <Link href="/" className="logo">
                <span className="logoMark"><Bot size={17} /></span>
                MasterBot
                <span className="logoTag">Self-Hosted</span>
            </Link>

            <div className="navLinks">
                <a href="#features">Features</a>
                <a href="#modules">Modules</a>
                <a href="#dashboard">Dashboard</a>
                <a href="#faq">FAQ</a>
                <a href={REPO_URL}>Docs</a>
            </div>

            <div className="navRight">
                <a className="iconBtn" href={REPO_URL} aria-label="GitHub repository">
                    <Github size={16} />
                </a>
                <Link className="btn btnPrimary" href="/dashboard">
                    Open Dashboard <ArrowRight size={14} />
                </Link>
            </div>
        </nav>
    );
}
