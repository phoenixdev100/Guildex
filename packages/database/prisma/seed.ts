/**
 * Database Seed Script
 * 
 * Seeds the database with initial data including:
 * - Core modules registry
 * - System configuration
 */

import { PrismaClient } from '@prisma/client';
import { MODULE_DEFINITIONS } from '../src/modules';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seed...');

    // Seed core modules
    console.log('📦 Seeding modules...');

    const modules = MODULE_DEFINITIONS.map((m) => ({
        name: m.name,
        description: m.description,
        category: m.category,
        isDefault: m.isDefault,
    }));

    /* Legacy module list removed - see MODULE_DEFINITIONS in src/modules.ts
    const modules = [
        {
            name: 'moderation',
            displayName: 'Moderation & Safety',
            description: 'Comprehensive moderation tools including bans, kicks, mutes, warnings, and auto-moderation',
            category: 'moderation',
            version: '1.0.0',
            isCore: true,
        },
        {
            name: 'server-setup',
            displayName: 'Server Setup & Configuration',
            description: 'Server configuration, welcome messages, auto-roles, and initial setup',
            category: 'utility',
            version: '1.0.0',
            isCore: true,
        },
        {
            name: 'utility',
            displayName: 'Utility & Productivity',
            description: 'Useful utility commands for server management and productivity',
            category: 'utility',
            version: '1.0.0',
            isCore: false,
        },
        {
            name: 'community',
            displayName: 'Community & Engagement',
            description: 'Tools to build and engage your community',
            category: 'engagement',
            version: '1.0.0',
            isCore: false,
        },
        {
            name: 'leveling',
            displayName: 'Leveling & XP',
            description: 'XP and leveling system with role rewards',
            category: 'engagement',
            version: '1.0.0',
            isCore: false,
        },
        {
            name: 'economy',
            displayName: 'Economy System',
            description: 'Virtual currency, daily rewards, work commands, and economy management',
            category: 'engagement',
            version: '1.0.0',
            isCore: false,
        },
        {
            name: 'fun',
            displayName: 'Fun & Games',
            description: 'Fun commands and mini-games for entertainment',
            category: 'fun',
            version: '1.0.0',
            isCore: false,
        },
        {
            name: 'music',
            displayName: 'Music & Media',
            description: 'Music playback and media controls',
            category: 'media',
            version: '1.0.0',
            isCore: false,
        },
        {
            name: 'ai',
            displayName: 'AI & Smart Features',
            description: 'AI-powered features and smart automation',
            category: 'ai',
            version: '1.0.0',
            isCore: false,
        },
        {
            name: 'events',
            displayName: 'Events & Scheduling',
            description: 'Event creation, scheduling, and reminders',
            category: 'utility',
            version: '1.0.0',
            isCore: false,
        },
        {
            name: 'custom-commands',
            displayName: 'Custom Commands',
            description: 'Create and manage custom commands',
            category: 'utility',
            version: '1.0.0',
            isCore: false,
        },
        {
            name: 'integrations',
            displayName: 'Integrations & Automation',
            description: 'Third-party integrations and automation workflows',
            category: 'automation',
            version: '1.0.0',
            isCore: false,
        },
        {
            name: 'security',
            displayName: 'Security & Anti-Abuse',
            description: 'Advanced security features and anti-abuse measures',
            category: 'security',
            version: '1.0.0',
            isCore: false,
        },
        {
            name: 'logging',
            displayName: 'Logging & Analytics',
            description: 'Comprehensive logging and analytics dashboard',
            category: 'analytics',
            version: '1.0.0',
            isCore: true,
        },
        {
            name: 'permissions',
            displayName: 'Roles & Permissions',
            description: 'Advanced role and permission management',
            category: 'moderation',
            version: '1.0.0',
            isCore: true,
        },
        {
            name: 'tickets',
            displayName: 'Support & Ticketing',
            description: 'Support ticket system for user assistance',
            category: 'support',
            version: '1.0.0',
            isCore: false,
        },
        {
            name: 'social',
            displayName: 'Social & Interaction',
            description: 'Social features and user interaction tools',
            category: 'engagement',
            version: '1.0.0',
            isCore: false,
        },
        {
            name: 'accessibility',
            displayName: 'Accessibility & UX',
            description: 'Accessibility features and user experience improvements',
            category: 'utility',
            version: '1.0.0',
            isCore: false,
        },
        {
            name: 'backup',
            displayName: 'Data & Backup',
            description: 'Data backup and restore functionality',
            category: 'utility',
            version: '1.0.0',
            isCore: false,
        },
        {
            name: 'monetization',
            displayName: 'Monetization',
            description: 'Premium features and monetization options (feature-flagged)',
            category: 'premium',
            version: '1.0.0',
            isCore: false,
        },
    ];
    */

    for (const module of modules) {
        await prisma.module.upsert({
            where: { name: module.name },
            update: module,
            create: module,
        });
    }

    console.log(`✅ Seeded ${modules.length} modules`);

    // Seed system configuration
    console.log('⚙️  Seeding system configuration...');

    const systemConfigs = [
        {
            key: 'platform.version',
            value: '1.0.0',
        },
        {
            key: 'platform.maintenance_mode',
            value: false,
        },
        {
            key: 'platform.max_guilds_per_instance',
            value: 1000,
        },
        {
            key: 'rate_limit.global.window_ms',
            value: 60000,
        },
        {
            key: 'rate_limit.global.max_requests',
            value: 100,
        },
        {
            key: 'features.premium_enabled',
            value: true,
        },
        {
            key: 'features.monetization_enabled',
            value: false,
        },
    ];

    for (const config of systemConfigs) {
        await prisma.systemConfig.upsert({
            where: { key: config.key },
            update: { value: config.value },
            create: config,
        });
    }

    console.log(`✅ Seeded ${systemConfigs.length} system configurations`);

    console.log('🎉 Database seed completed successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
