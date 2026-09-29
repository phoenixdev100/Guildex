# syntax=docker/dockerfile:1
# Bot image - multi-stage pnpm monorepo build.
# Stages: deps → build (tsc) → runtime | dev

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
WORKDIR /app

# ---------------------------------------------------------------------------
# deps - install all workspace deps.
# Every workspace manifest must be present or --frozen-lockfile fails.
# The prisma schema is copied so @prisma/client's postinstall (triggered for
# the workspace's database package) doesn't fail.
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
# build - compile the bot and its workspace dependencies
# ---------------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app ./
COPY . .
RUN pnpm -r --filter @discord-platform/bot... build

# ---------------------------------------------------------------------------
# dev - hot reload target used by docker-compose.override.yml (tsx watch)
# ---------------------------------------------------------------------------
FROM deps AS dev
ENV NODE_ENV=development
CMD ["pnpm", "--filter", "@discord-platform/bot", "dev"]

# ---------------------------------------------------------------------------
# runtime - prod image (bot only depends on @discord-platform/shared)
# ---------------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/bot ./apps/bot
CMD ["node", "apps/bot/dist/index.js"]
