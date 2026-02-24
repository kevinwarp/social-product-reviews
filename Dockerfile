# ── Stage 1: Install dependencies ──────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: Build the application ────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js (standalone output)
RUN npm run build

# Bundle the refresh-featured-searches script into a single JS file.
# --packages=external keeps npm deps as require() calls (resolved from
# the standalone node_modules at runtime), while --tsconfig resolves the
# @/* path aliases used throughout src/.
RUN npx esbuild scripts/refresh-featured-searches.ts \
      --bundle \
      --platform=node \
      --target=node22 \
      --format=cjs \
      --tsconfig=tsconfig.json \
      --packages=external \
      --outfile=scripts/refresh-featured-searches.js

# ── Stage 3: Production runner ─────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Copy standalone server and static files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma generated client + schema (needed at runtime)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

# Copy pg and its transitive deps (not traced by Next.js standalone bundler)
COPY --from=builder /app/node_modules/pg ./node_modules/pg
COPY --from=builder /app/node_modules/pg-types ./node_modules/pg-types
COPY --from=builder /app/node_modules/pg-pool ./node_modules/pg-pool
COPY --from=builder /app/node_modules/pg-protocol ./node_modules/pg-protocol
COPY --from=builder /app/node_modules/pg-connection-string ./node_modules/pg-connection-string
COPY --from=builder /app/node_modules/pg-cloudflare ./node_modules/pg-cloudflare
COPY --from=builder /app/node_modules/pg-int8 ./node_modules/pg-int8
COPY --from=builder /app/node_modules/pgpass ./node_modules/pgpass
COPY --from=builder /app/node_modules/postgres-array ./node_modules/postgres-array
COPY --from=builder /app/node_modules/postgres-bytea ./node_modules/postgres-bytea
COPY --from=builder /app/node_modules/postgres-date ./node_modules/postgres-date
COPY --from=builder /app/node_modules/postgres-interval ./node_modules/postgres-interval

# Copy additional runtime deps needed by the refresh script / pipeline
COPY --from=builder /app/node_modules/@google ./node_modules/@google

# Copy deploy-time refresh script and entrypoint
COPY --from=builder --chown=nextjs:nodejs /app/scripts/refresh-featured-searches.js ./scripts/
COPY --from=builder --chown=nextjs:nodejs /app/scripts/docker-entrypoint.sh ./scripts/
RUN chmod +x scripts/docker-entrypoint.sh

USER nextjs

EXPOSE 8080

CMD ["sh", "scripts/docker-entrypoint.sh"]
