# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
# postinstall (prisma generate) needs the schema, which is copied in the next stage
RUN npm ci --ignore-scripts

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npx next build

# One-shot image that applies the database schema (see the migrate service in docker-compose.yml)
FROM base AS tools
COPY --from=builder /app ./
CMD ["npx", "prisma", "migrate", "deploy"]

FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 helio && adduser --system --uid 1001 --ingroup helio helio
COPY --from=builder --chown=helio:helio /app/.next/standalone ./
COPY --from=builder --chown=helio:helio /app/.next/static ./.next/static
USER helio
EXPOSE 3000
CMD ["node", "server.js"]
