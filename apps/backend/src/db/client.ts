// Design Ref: §9.1 — DB는 최하단 레이어. Prisma 클라이언트는 이 모듈에서만 직접 사용
// Plan SC: 라우트에서 Prisma 직접 호출 금지 규칙 적용점
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
