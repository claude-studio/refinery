FROM node:22-alpine AS base
RUN corepack enable

# ─── 의존성 설치 ───────────────────────────────────────────────────────────────
FROM base AS installer
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
COPY apps/frontend/package.json ./apps/frontend/
RUN pnpm install --frozen-lockfile

# ─── 빌드 ─────────────────────────────────────────────────────────────────────
FROM installer AS builder
WORKDIR /app
COPY packages/shared ./packages/shared
COPY packages/ui ./packages/ui
COPY apps/frontend ./apps/frontend
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @refinery/frontend run build

# ─── 실행 ─────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public

EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
