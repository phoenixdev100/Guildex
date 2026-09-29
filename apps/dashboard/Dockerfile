# syntax=docker/dockerfile:1
# Dashboard image - Next.js standalone output.
# Stages: deps → build (next build) → runtime | dev
#
# Rewrites are baked at build time, so NEXT_PUBLIC_API_URL must be a build
# ARG pointing at the in-network API hostname (http://api:4000), not localhost.

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
WORKDIR /app

# ---------------------------------------------------------------------------
# deps - every workspace manifest must be present or --frozen-lockfile fails.
# The prisma schema is copied so @prisma/client's postinstall doesn't fail.
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/bot/package.json ./apps/bot/
COPY apps/api/package.json ./apps/api/
COPY apps/dashboard/package.json ./apps/dashboard/
COPY packages/database/package.json ./packages/database/
COPY packages/modules/package.json ./packages/modules/
COPY packages/permissions/package.json ./packages/permissions/
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/prisma ./packages/database/prisma/
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# build - next build (produces .next/standalone + .next/static)
# ---------------------------------------------------------------------------
FROM base AS build
ARG NEXT_PUBLIC_API_URL=http://api:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
# Enables `output: 'standalone'` in next.config.js - kept off by default
# because standalone tracing can't create symlinks on Windows dev machines.
ENV DOCKER_BUILD=1
COPY --from=deps /app ./
COPY . .
RUN pnpm --filter @discord-platform/dashboard build

# ---------------------------------------------------------------------------
# dev - hot reload target used by docker-compose.override.yml (next dev)
# ---------------------------------------------------------------------------
FROM deps AS dev
ENV NODE_ENV=development
CMD ["pnpm", "--filter", "@discord-platform/dashboard", "dev"]

# ---------------------------------------------------------------------------
# runtime - standalone server only (no full node_modules needed)
# ---------------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# With outputFileTracingRoot at the repo root, standalone mirrors the
# monorepo layout: server.js lands at apps/dashboard/server.js.
COPY --from=build /app/apps/dashboard/.next/standalone ./
COPY --from=build /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=build /app/apps/dashboard/public ./apps/dashboard/public
EXPOSE 3000
CMD ["node", "apps/dashboard/server.js"]
