# Helio

💡 Helio is a team room where you work with 3 AI agents: **Lyra** (assistant), **Carina** (product and design) and **Hydra** (engineer). Each workspace is isolated from every other workspace.

🚧 **Status: Phase 2 of 7 is done** (foundation and chat core). Agent tools, the board and the rest come in the next phases. See "What is done and what is next" below.

## 🚀 1. Quick start

💡 Putting Helio on a server next to your 9Router? Follow **VPS.md** instead. It has a compose file made for that (`docker-compose.vps.yml`) and a step-by-step guide.

1. Copy the env file: `cp .env.example .env`
2. Set **POSTGRES_PASSWORD** and **MASTER_KEY** in `.env`. Make a key with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. Set the **shared model provider** in `.env` (see "Model providers" below): `PLATFORM_LLM_BASE_URL` and a model for each tier (`PLATFORM_MODEL_LIGHT`, `PLATFORM_MODEL_MEDIUM`, `PLATFORM_MODEL_HEAVY`)
4. Start everything: `docker compose up --build`
5. Open **http://localhost:3000** and create an account
6. Read the confirmation email in Mailpit: **http://localhost:8025**

⚠️ Docker runs the app in production mode, so session cookies are `Secure`. Chrome and Firefox accept this on `localhost`. Safari does not. In Safari, use HTTPS or run `npm run dev` instead.

❓ **Want to edit the code with hot reload?** Run only the databases in Docker and the app on your machine (needs Node 20 or newer):

1. Start Postgres and Redis:
   `docker run -d --name helio-pg -e POSTGRES_USER=helio -e POSTGRES_PASSWORD=helio -e POSTGRES_DB=helio -p 5432:5432 postgres:16-alpine`
   `docker run -d --name helio-redis -p 6379:6379 redis:7-alpine`
2. `npm install`
3. `cp .env.example .env`, then set **MASTER_KEY**, and uncomment **DATABASE_URL** (`postgresql://helio:helio@localhost:5432/helio`) and **REDIS_URL**
4. `npx prisma db push`
5. `npm run dev`, then open **http://localhost:3000**

Without `SMTP_HOST`, emails are printed in the server log in development.

## 🔌 2. Model providers: shared first, your own key optional

💡 Every workspace works out of the box on the **shared provider** that you, the operator, run (for example your 9Router). People do not need an API key. An own key is an **optional extra** that takes load off the shared provider.

1. **Shared provider (default).** Set it once in `.env`: `PLATFORM_LLM_BASE_URL`, `PLATFORM_LLM_API_KEY` (optional), and `PLATFORM_MODEL_LIGHT` / `_MEDIUM` / `_HEAVY` (each with an optional `_FALLBACK`). Light is Lyra, Medium is Carina, Heavy is Hydra. People cannot change these models, so they cannot point your provider at expensive ones.
2. **Daily limits protect it.** `PLATFORM_DAILY_TOKENS_WORKSPACE` and `PLATFORM_DAILY_TOKENS_USER` limit what one workspace and one person can use on the shared provider per day. `0` means unlimited. When a limit is reached, the run stops with a plain message.
3. **Own key (optional).** An owner or admin can open **Settings** and add an API key for any OpenAI-compatible endpoint, then choose the models for their key. Usage on that key **does not count** toward the shared daily limit.
4. **Mixing both.** With an own key, a tier that has a model on the key uses the key first. A tier that has no model there uses the shared provider. If "If my key fails, use the shared provider" is on, a broken or rate-limited own key moves on to the shared provider by itself, and nothing is lost.
5. **Remove the key** at any time. The workspace goes back to the shared provider.

Where the answer came from is saved on every usage record (`PLATFORM` or `OWN`), so the Usage screen in Phase 5 can show it.

## 💬 3. Try the chat

1. Sign in and finish onboarding (workspace, your team, first project). There is no provider step: the shared provider is already there
2. Open your project's **Team room**. Write a message:
   1. With no mention, the project's default agent answers (Lyra, you can change it on the **Projects** page)
   2. `@Carina plan an invoice export` calls Carina. You can mention up to 3 agents in one message
   3. `@Ada can you check this?` mentions a teammate. No agent answers
3. Open **Private chats** in the sidebar to talk to one agent alone. Nobody else can see that chat
4. Press **Stop** to cancel an answer that is still streaming. The part already written is kept
5. Optional: open **Settings** to add your own API key

💡 If your agents say "No model provider is set up", the install has no shared provider yet. Set the `PLATFORM_*` values in `.env`, or add an own key in Settings.

💡 Agents can also pass work to each other by writing `@Name`. They stop after 6 hand-offs in a row, and after 12 agent runs per message, so they cannot loop.

## 🗄️ 4. Database and migrations

💡 The schema is in `prisma/schema.prisma`. It holds all 25 tables (the 21 from the data model, plus sessions, email tokens, OAuth accounts and the workspace file table), so later phases do not need big changes.

1. **First time:** `docker compose` uses `prisma db push` when there is no `prisma/migrations` folder. This is fine for development.
2. **Before production:** run `npm run db:migrate -- --name init` once against a dev database, then **commit `prisma/migrations/`**. From then on, compose runs `prisma migrate deploy`.

⚠️ I could not generate the first migration file where this was built (the Prisma schema engine could not be downloaded there). Step 2 creates it in one command.

## 🗺️ 5. Folder map

1. **`src/app`**: pages and API routes (Next.js App Router)
2. **`src/lib`**: shared code with no UI: crypto, passwords, sessions, roles (RBAC), workspace scoping, rate limits, mail, SSRF guard, mention parser, chat state
3. **`src/lib/gateway`**: the **Model Gateway**: OpenAI-compatible streaming client with retries and fallback, tier models
4. **`src/server`**: services used by the routes: auth tokens, workspace access, invites, chat service, **agent runner**, usage and limits
5. **`src/components`**: UI pieces (logo, constellation icons, forms, onboarding wizard, chat room and composer)
6. **`prisma`**: database schema
7. **`tests`**: unit tests (`npm test`)

## 🏗️ 6. Architecture

```mermaid
flowchart LR
  Browser["Browser / PWA"] -->|"REST"| Web["Next.js web + API"]
  Browser <-->|"SSE live events"| Web
  Web --> PG[("PostgreSQL<br/>Prisma")]
  Web <-->|"pub/sub + rate limits"| Redis[("Redis")]
  Web --> Mail["SMTP / Mailpit"]
  Web --> Runner["Agent runner<br/>(inside web, Phase 2)"]
  Runner --> Gateway["Model Gateway<br/>retries, fallback, usage"]
  Gateway --> Providers["9Router / LiteLLM / OpenRouter / provider keys"]
  Runner -->|"events"| Redis
  Redis -. "Phase 3" .-> Worker["Worker<br/>agent runtime + tools"]
  Worker -. "Phase 3" .-> Sandbox["Sandbox per workspace<br/>code, docs, specs"]
```

Solid lines exist today. Dotted lines are planned. In Phase 3 the agent runner moves out of the web process into a worker. `runAgentTurn` stays the same.

### How one message flows

1. The browser sends `POST /threads/:id/messages`
2. The server saves it, reads the @mentions, and starts a run for each agent that should answer
3. The runner checks the limits, builds the prompt (the agent's SOUL, the team, the last 40 messages), and streams the answer from the Model Gateway
4. Every piece goes to Redis, and from there to **everyone** watching the thread over SSE. The answer is saved about once a second while it streams
5. When it ends, usage and cost are saved. If the answer @mentions another agent, that agent is started (loop guard applies)

## 🔒 7. Security decisions

1. **Workspace isolation.** All workspace data is read and written through `scoped(workspaceId)` (`src/lib/db.ts`). It adds the workspace filter to every query and refuses writes into another workspace. Tests: `tests/scope.test.ts`.
2. **Roles.** Owner, Admin, Member, Viewer. One gate for every workspace route: `requireWorkspaceAccess`. Non-members get a 404, so ids cannot be probed. Viewers can read and watch, but not post.
3. **Own API keys.** Encrypted with AES-256-GCM. The ciphertext is bound to its workspace, so it cannot be copied into another one. The key is never returned to the browser and never logged.
4. **Passwords.** scrypt (N=2^15, r=8, p=3). Login takes the same time for unknown emails.
5. **Sessions.** Random token in an `HttpOnly`, `SameSite=Lax` cookie. Only a hash is stored. A password reset signs out every device.
6. **No account enumeration.** Register, forgot password and resend always give the same answer.
7. **CSRF.** `SameSite=Lax` plus an Origin check on every write request.
8. **Rate limits.** Redis counters on login, register, reset, invites, provider tests and chat messages. They fail closed if Redis is down.
9. **SSRF guard.** The address of an **own** key must be https and must not point to a private network (unless `ALLOW_PRIVATE_PROVIDER_URLS=true`). It is checked again every time an agent runs. The **shared provider** address comes from `.env`, so only the operator can set it, and it may be private.
10. **Google sign-in.** Authorization code flow with PKCE, no extra library. An unverified local account is wiped of its password before Google is linked to it.
11. **Live events.** The SSE route checks access first, and builds the Redis channel from the verified workspace and thread ids. Nobody can listen to a private chat that is not theirs.
12. **Safe markdown.** Messages are rendered as markdown with no raw HTML. Links open in a new tab and remote images are not loaded.
13. **Provider errors.** Users see short plain messages. Raw provider answers are never shown or stored.

## ➕ 8. How to add a new agent

💡 Custom agents are out of scope for now, but the code is ready.

1. Add an entry to `DEFAULT_AGENTS` in `src/lib/agents.ts` (key, name, role, color, tier, tools, SOUL)
2. Add the key to `AGENT_KEYS` and a constellation shape in `src/components/constellation.tsx`
3. New workspaces get the agent automatically. For existing workspaces, insert an `Agent` row for each (a small script, or the seed in Phase 7)

## ✅ 9. What is done and what is next

**Done (Phase 1):**

1. Repo, Docker, env file, full database schema
2. Register, email confirmation, login, logout, forgot and reset password, Google sign-in
3. Workspaces, roles, invites (create, email, accept)
4. Onboarding in 3 steps: workspace, your team (rename the agents), first project

**Done (Phase 2):**

1. **Model Gateway** for any OpenAI-compatible endpoint: streaming, retries with backoff, a fallback model per tier, token and cost tracking, daily token limits per user and per workspace, and a limit on runs working at the same time
2. **Shared provider first, own key optional** (see "Model providers"): per-tier models and fallbacks set by the operator, daily token limits on the shared provider only, failover from an own key to the shared provider, and usage tagged by source
3. **Settings** page: add, test, replace or remove an own key, switch it on or off, and choose models for it
4. **Projects**: list, create, archive, restore, and choose the default agent
5. **Team room** and **private agent chats**: live streaming for everyone watching, markdown and code blocks, replies, an @mention menu, agent status rings, and a **Stop** button
6. **Mentions**: agents and teammates, names with spaces, mentions inside code are ignored
7. Agents can **hand work to each other** with @mentions, with a loop guard

**Next:**

1. **Phase 3.** Orchestrator and queue, tools, sandbox, SOULs, handoff cards, a proper loop guard
2. **Phase 4.** Kanban board, Needs you flow, Inbox, pause and resume
3. **Phase 5.** Files, Activity, Usage screens and limit settings
4. **Phase 6.** PWA, push, mobile layouts, accessibility, landing page
5. **Phase 7.** Hardening, seed data, end-to-end tests, final README

## ⚠️ 10. Known limits

1. **Runs live inside the web server for now.** If it restarts in the middle of an answer, that run is closed as failed after 15 minutes. **Stop** only reaches runs on the same server. Phase 3 moves runs to a queue and a worker.
2. **Not in Phase 2:** file attachments (need the Files screen, Phase 5) and message reactions. Handoff cards and Needs you requests come in Phases 3 and 4. When the loop guard stops a chain, it posts a note for now.
3. The usage and limit **screens** are Phase 5. The limits already work: the install defaults are in `.env`, and one workspace can be changed on its `Workspace` row (`dailyTokenLimitUser`, `dailyTokenLimitWorkspace`, `maxConcurrentRuns`; 0 means unlimited for the two token limits).
4. There is no cap yet on the **total** number of runs across all workspaces. Each workspace is limited to 3 at once (`maxConcurrentRuns`). A global cap to protect the shared provider is a small addition if you need it.
5. Prices are per tier. The fallback model uses the same prices as the main model.
5. Behind a reverse proxy, turn response buffering off for `/events` (the header `X-Accel-Buffering: no` is already sent for nginx).
6. Each person watching a thread holds one Redis connection. This is fine for small teams.
7. The Carina kickoff message is fixed text until Phase 3.
8. Only a partial Content Security Policy is set. Full script rules need nonces (Phase 7).
9. Scoping blocks forgotten filters in the app. Database-level row security (Postgres RLS) is a Phase 7 hardening item.
10. DNS can change between the provider URL check and the request (DNS rebinding). The sandbox network allow-list in Phase 3 closes this for agent traffic.
11. There is no password breach check or two-factor login yet.

## 🧪 11. Tests

1. `npm test` runs the unit tests: encryption, passwords, roles, workspace scoping, SSRF guard, rate limiter, validation, **the Model Gateway (streaming, retries, fallback, stop)**, mentions, prompt building, limits and the live chat state
2. `npm run typecheck` runs the TypeScript check
