# Project Notes

Discord bot monorepo (pnpm + Turborepo). Workspaces: `apps/bot` (discord.js), `apps/api` (Fastify - NOT Express, README is wrong), `apps/dashboard` (Next.js 14 + NextAuth), `packages/{database,shared,modules,permissions}`.

## Commands

- `pnpm dev` - turbo dev for all apps (bot/api load root `.env` via dotenv-cli; dashboard now does too)
- `pnpm build` / `pnpm lint` - both currently green across all 7 workspaces
- `pnpm --filter @discord-platform/database db:generate|db:migrate:deploy|db:seed`
- Typecheck single app: `cd apps/<name> && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json`

## Non-obvious architecture facts

- **API routes all live under `/api`** - the bot's `apiClient` auto-prepends `/api` to any path not already starting with it.
- **Internal auth**: bot↔API and dashboard-proxy↔API authenticate via `x-api-key: $INTERNAL_API_KEY` (see `authenticateOrInternal` in `apps/api/src/middleware/auth.ts`). Dashboard injects the key server-side in `src/middleware.ts` - never expose it client-side.
- **Module gating**: every command has a `category`; `interactionCreate` checks `GET /api/guilds/:id/modules/:category`. Missing modules default to **enabled**; guild registration creates rows for all modules in `MODULE_DEFINITIONS` (`packages/database/src/modules.ts`). Toggle via `PUT /api/guilds/:id/modules/:name {enabled}`.
- **Deploy limit**: Discord allows 100 commands/guild. `deployGuildCommands` sorts implemented commands before stub placeholders (detected via `'Command In Development'` in the execute source), so real commands always deploy first.
- **Response conventions**: command-facing endpoints return `{success, data}` or `{success, case}` - the bot's `ApiError` exposes `.response` for axios-style `error.response?.status` checks used by commands.
- **Discord work happens bot-side**: the API only persists state. Ticket channels, role assignments, reaction roles (via `guildMemberAdd`/`messageReaction*` events) and reminder delivery (via `services/reminder-poller.ts`, 30s poll of `/api/reminders/pending`) are all done by the bot.
- Most of the 192 commands are intentional "in development" stubs; the implemented set is moderation/economy/leveling/utility/setup/automod/tickets.

## Environment

- Root `.env` holds all secrets (gitignored): Discord creds, `DATABASE_URL` (Neon), `JWT_SECRET`, `NEXTAUTH_SECRET`, `INTERNAL_API_KEY`.
- Docker Compose env comes from `env_file: .env` so new vars propagate automatically.

## Docker

- Per-app Dockerfiles (`apps/{bot,api,dashboard}/Dockerfile`), each with `deps → build → runtime` stages plus a `dev` target (tsx watch / next dev).
- `docker-compose.yml` = production. `docker-compose.override.yml` = dev (auto-merged by `docker compose up`; adds `.:/app` bind mounts + `dev` targets + polling envs for Windows file-watch). Pure prod: `docker compose -f docker-compose.yml up -d --build`.
- Dashboard uses `output: 'standalone'` gated behind `DOCKER_BUILD=1` (set only in its Dockerfile) - standalone tracing creates symlinks, which fails with EPERM on Windows without Developer Mode.
- Dashboard rewrites bake `NEXT_PUBLIC_API_URL` at **build** time → passed as a build `arg` (`http://api:4000`, the in-network name - localhost inside the container is wrong).
- `prisma generate` runs in the deps stage so the generated client lands in the node_modules that runtime copies.
- `.dockerignore` excludes `.env*` and `**/node_modules` - without it, secrets get baked into images and host (Windows) node_modules overwrite Linux ones.
- Two compose networks isolate the DB tier: `backend` holds only api+postgres+redis; `frontend` holds bot+dashboard+api. Bot/dashboard have no route or DNS to the DB. In `docker-compose.yml` postgres/redis ports bind to `127.0.0.1` only; in `docker-compose.prod.yml` they publish no ports at all.
- Docker Hub: images are tagged `phoenixdev100/discord-bot{,-api,-dashboard}:latest`. To publish manually: `docker compose -f docker-compose.yml build && docker compose -f docker-compose.yml push` (explicit `-f` skips the dev override - a bare `docker compose build`+`push` after dev mode would push `dev`-target images as `latest`). `docker-compose.prod.yml` is pull-only (`pull_policy: always`, no `build:`) and **fully self-contained** - no `.env` needed on the server; secrets live in the top `x-secrets` YAML anchor that merges into api/bot/dashboard via `<<: *secrets`. `docker compose -f docker-compose.prod.yml up -d` pulls and starts everything. Docker commands are run manually - no docker scripts in package.json.

## Gotchas discovered

- Live Neon DB can cold-start → first connect may fail P1001, retry works.
- `prisma migrate diff --from-schema-datasource <schema> --to-schema-datamodel <schema> --script` is how the last DB-drift migration was generated.
- `packages/permissions` compiles but is not wired into bot/api yet.
