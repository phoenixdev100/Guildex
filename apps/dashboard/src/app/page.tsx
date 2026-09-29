/**
 * Landing Page
 *
 * Public marketing site for the bot platform - a static server component.
 * App routes live under /dashboard (auth-gated via NextAuth).
 */

import type { Metadata } from 'next';
import './landing.css';
import { Nav } from '@/components/landing/nav';
import { Hero } from '@/components/landing/hero';
import { Features, Modules, Stats } from '@/components/landing/features';
import { Showcase } from '@/components/landing/showcase';
import { Faq, Testimonials } from '@/components/landing/social';
import { Cta, Footer } from '@/components/landing/closing';

export const metadata: Metadata = {
    title: 'MasterBot - Self-Hosted Discord Bot Platform',
    description:
        'A modular Discord bot with a powerful web dashboard, REST API and real database. ' +
        'Everything your community needs, fully customizable and under your control.',
};

export default function LandingPage() {
    return (
        <main className="site">
            <Nav />
            <Hero />
            <Stats />
            <Features />
            <Modules />
            <Showcase />
            <Testimonials />
            <Faq />
            <Cta />
            <Footer />
        </main>
    );
}
