FROM node:22-alpine AS base
RUN corepack enable

# ─── 의존성 설치 ───────────────────────────────────────────────────────────────
FROM base AS installer
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/
RUN pnpm install --frozen-lockfile

# ─── 빌드 ─────────────────────────────────────────────────────────────────────
FROM installer AS builder
WORKDIR /app
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend
RUN pnpm --filter @refinery/backend exec prisma generate
RUN pnpm --filter @refinery/backend run build

# ─── 실행 ─────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder /app/apps/backend/package.json ./apps/backend/

WORKDIR /app/apps/backend
EXPOSE 3001 4318
CMD ["node", "dist/server.js"]
