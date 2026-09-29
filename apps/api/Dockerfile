# syntax=docker/dockerfile:1
# API image - multi-stage pnpm monorepo build.
# Stages: deps (install + prisma generate) → build (tsc) → runtime | dev

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
WORKDIR /app

# ---------------------------------------------------------------------------
# deps - install all workspace deps ONCE and generate the Prisma client here,
# because the runtime stage copies node_modules from this stage.
# Every workspace manifest must be present or --frozen-lockfile fails.
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
# Prisma schema must exist before install - @prisma/client's postinstall
# runs `prisma generate` and needs the schema file.
COPY packages/database/prisma ./packages/database/prisma/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @discord-platform/database exec prisma generate

# ---------------------------------------------------------------------------
# build - compile the API and its workspace dependencies
# ---------------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app ./
COPY . .
RUN pnpm -r --filter @discord-platform/api... build

# ---------------------------------------------------------------------------
# dev - hot reload target used by docker-compose.override.yml (tsx watch).
# Source is bind-mounted on top of /app at runtime.
# ---------------------------------------------------------------------------
FROM deps AS dev
ENV NODE_ENV=development
CMD ["pnpm", "--filter", "@discord-platform/api", "dev"]

# ---------------------------------------------------------------------------
# runtime - prod image
# ---------------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
# node_modules (incl. generated Prisma client in .pnpm store) + built dists.
# Workspace deps are symlinked inside node_modules → copy real package dirs too.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api ./apps/api
EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
