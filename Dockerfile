# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests and install ALL deps (including devDeps for tsc)
COPY package*.json ./
RUN npm ci

# Copy source and compile
COPY tsconfig.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma/
COPY src ./src/

RUN npx prisma generate
RUN npm run build

# ─── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy manifests and install production deps only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output and prisma client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy prisma schema (needed by the adapter at runtime for type metadata)
COPY prisma ./prisma/

# FIX: Do NOT copy prisma.config.ts into the runner stage.
# prisma.config.ts is a CLI tool used only during `prisma migrate` / `prisma generate`.
# It imports dotenv and pg which are devDependencies and are NOT installed in the
# production image (npm ci --omit=dev). Copying it serves no purpose and would
# cause a confusing "Cannot find module 'dotenv'" error if ever imported.
# Migrations are run as a separate release step, not inside the API container.

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 express
USER express

EXPOSE 5000

CMD ["node", "dist/server.js"]