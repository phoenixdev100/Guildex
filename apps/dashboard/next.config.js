const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Standalone output for Docker: emits .next/standalone with a minimal
    // server.js and traced node_modules (no full install needed at runtime).
    // Conditional: on Windows this fails with EPERM - standalone tracing
    // recreates pnpm's symlink tree and Windows blocks symlinks without
    // Developer Mode. The Dockerfile sets DOCKER_BUILD=1 (Linux, works fine).
    output: process.env.DOCKER_BUILD === '1' ? 'standalone' : undefined,
    // Monorepo: trace dependencies from the repo root, not just this app dir.
    outputFileTracingRoot: path.join(__dirname, '../../'),
    images: {
        remotePatterns: [{ protocol: 'https', hostname: 'cdn.discordapp.com' }],
    },
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    },
    async rewrites() {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        return [
            {
                source: '/api/dashboard/:path*',
                destination: `${apiUrl}/api/dashboard/:path*`,
            },
            {
                source: '/api/guilds/:path*',
                destination: `${apiUrl}/api/guilds/:path*`,
            },
            // Add other backend proxy routes here as needed, but DO NOT include /api/auth
        ];
    },
};

module.exports = nextConfig;
