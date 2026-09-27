import {
    BarChart3,
    Bell,
    Clock3,
    Code2,
    Crown,
    Database,
    Gift,
    Globe2,
    Heart,
    Layers3,
    Music2,
    Shield,
    Sparkles,
    Star,
    Ticket,
    Trophy,
    Users,
    Wand2,
    Zap,
    LayoutDashboard,
    Terminal,
    Settings2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const REPO_URL = 'https://github.com/phoenixdev100/master-discord-bot';

export interface ModuleItem {
    name: string;
    desc: string;
    icon: LucideIcon;
}

export const MODULES: ModuleItem[] = [
    { name: 'Moderation', desc: 'Warn, mute, ban, cases & audit trail', icon: Shield },
    { name: 'Leveling', desc: 'XP, ranks & leaderboards', icon: Crown },
    { name: 'Economy', desc: 'Currency, shop, jobs & trading', icon: Database },
    { name: 'Tickets', desc: 'Panel-based support system', icon: Ticket },
    { name: 'AI Commands', desc: 'Chat, images & text-to-speech', icon: Sparkles },
    { name: 'Welcome & Autoroles', desc: 'Greet members, auto-assign roles', icon: Users },
    { name: 'Reaction Roles', desc: 'Self-assignable roles via reactions', icon: Heart },
    { name: 'Giveaways', desc: 'Timed community giveaways', icon: Gift },
    { name: 'Suggestions', desc: 'Collect & vote on ideas', icon: Wand2 },
    { name: 'Music', desc: 'High-quality voice playback', icon: Music2 },
    { name: 'Fun & Games', desc: 'Minigames & engagement commands', icon: Trophy },
    { name: 'Custom Commands', desc: 'Build commands without code', icon: Code2 },
    { name: 'AFK & Utilities', desc: 'Status, reminders & tools', icon: Clock3 },
    { name: 'Starboard', desc: 'Pin the community\'s best posts', icon: Star },
    { name: 'Translation', desc: 'Multilingual message support', icon: Globe2 },
];

export const STATS: { value: string; label: string; icon: LucideIcon }[] = [
    { value: '45+', label: 'Feature modules', icon: Layers3 },
    { value: '220+', label: 'Slash commands', icon: Terminal },
    { value: '70+', label: 'REST API endpoints', icon: Zap },
    { value: '100%', label: 'Self-hosted & open source', icon: BarChart3 },
];

export const SIDEBAR: [string, LucideIcon][] = [
    ['Overview', LayoutDashboard],
    ['Modules', Layers3],
    ['Moderation', Shield],
    ['Economy', Database],
    ['Leveling', Trophy],
    ['Tickets', Ticket],
    ['Logs', Bell],
    ['Settings', Settings2],
];

export const TICKS: string[] = [
    'Enable or disable modules per server — no redeploys',
    'Moderation cases, audit logs and guild analytics',
    'Ticket panels, applications and custom commands',
    'Persistent data in PostgreSQL, cached through Redis',
    'Discord OAuth login with per-guild authorization',
];

export const STEPS: { title: string; desc: string; code?: string }[] = [
    {
        title: 'Clone & configure',
        desc: 'Pull the monorepo and set your Discord credentials in one env file.',
        code: 'git clone … && pnpm install',
    },
    {
        title: 'Deploy the stack',
        desc: 'Bot, API, dashboard, PostgreSQL and Redis start together.',
        code: 'docker compose up -d',
    },
    {
        title: 'Sign in with Discord',
        desc: 'OAuth login picks the servers you administer.',
    },
    {
        title: 'Enable modules',
        desc: 'Flip features on per guild and manage everything from the UI.',
    },
];

export const TESTIMONIALS: { quote: string; name: string; role: string; initials: string }[] = [
    {
        quote: 'MasterBot has everything we needed. From moderation to leveling it just works — and the dashboard is genuinely good.',
        name: 'Alex',
        role: 'Community Owner',
        initials: 'AX',
    },
    {
        quote: 'The modular design is perfect. We enable only what we need and configure everything visually. Highly recommended.',
        name: 'Priya',
        role: 'Server Admin',
        initials: 'PR',
    },
    {
        quote: 'Finally a self-hosted bot that feels like a real product. The API gives us full control and the UI stays out of the way.',
        name: 'Rahul',
        role: 'Community Manager',
        initials: 'RH',
    },
];

export const FAQS: { q: string; a: string }[] = [
    {
        q: 'Is MasterBot free to use?',
        a: 'Yes — it is open source and self-hosted. You run it on your own infrastructure, so there are no subscription fees and your data never leaves your servers.',
    },
    {
        q: 'What do I need to run it?',
        a: 'A Discord application token, PostgreSQL and Redis. The whole stack ships as Docker images — `docker compose -f docker-compose.prod.yml up -d` starts everything on a VPS.',
    },
    {
        q: 'Can I enable features per server?',
        a: 'Every feature is a module. Modules can be toggled per guild from the dashboard — moderation, economy, tickets, leveling and dozens more are independent.',
    },
    {
        q: 'How does the dashboard authenticate?',
        a: 'Dashboard uses Discord OAuth via NextAuth. After signing in it lists only the guilds where you have manage-server permissions, and all API calls are guild-scoped.',
    },
    {
        q: 'Can I extend it with my own commands?',
        a: 'The codebase is a pnpm monorepo — commands live in `apps/bot/src/commands`, grouped by category. Drop a file in, register it, and module gating applies automatically.',
    },
];
