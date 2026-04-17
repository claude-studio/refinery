// Design Ref: §4.1 GET /sessions, GET /sessions/:id — Thin routes, DB 직접 호출 금지
// Plan FR-13: REST API 세션 목록/상세 엔드포인트
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { prisma } from '../db/client.js'

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  taskType: z.enum(['bug-fix', 'feature', 'refactor', 'exploration', 'config']).optional(),
  hasInefficiency: z.enum(['true', 'false']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

export async function sessionsRoute(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: '쿼리 파라미터가 올바르지 않습니다',
          details: { fieldErrors: parsed.error.flatten().fieldErrors },
        },
      })
    }

    const { page, limit, taskType, hasInefficiency, from, to } = parsed.data

    const where = buildWhereFilter({ taskType, hasInefficiency, from, to })

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          sessionId: true,
          projectPath: true,
          startedAt: true,
          endedAt: true,
          durationMin: true,
          taskType: true,
          taskDescription: true,
          inefficiencyCount: true,
          totalToolCalls: true,
        },
      }),
      prisma.session.count({ where }),
    ])

    return reply.send({
      data: sessions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  })

  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const session = await prisma.session.findUnique({
      where: { id: request.params.id },
      include: {
        inefficiencies: true,
        toolCalls: { orderBy: { timestamp: 'asc' } },
      },
    })

    if (!session) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다' },
      })
    }

    const otelMetrics = await fetchOtelMetrics(session.sessionId)

    return reply.send({
      data: {
        session: {
          id: session.id,
          sessionId: session.sessionId,
          projectPath: session.projectPath,
          startedAt: session.startedAt.toISOString(),
          endedAt: session.endedAt?.toISOString() ?? null,
          durationMin: session.durationMin,
          taskType: session.taskType,
          taskDescription: session.taskDescription,
          inefficiencyCount: session.inefficiencyCount,
          totalToolCalls: session.totalToolCalls,
        },
        inefficiencies: session.inefficiencies.map((i) => ({
          type: i.type,
          severity: i.severity,
          description: i.description,
          evidence: i.evidence,
          count: i.count,
        })),
        toolCallTimeline: session.toolCalls.map((tc) => ({
          name: tc.name,
          input: tc.input as Record<string, unknown>,
          isError: tc.isError,
          timestamp: tc.timestamp.toISOString(),
        })),
        otelMetrics,
      },
    })
  })
}

function buildWhereFilter(opts: {
  taskType?: string
  hasInefficiency?: string
  from?: string
  to?: string
}) {
  const where: {
    taskType?: string
    inefficiencyCount?: { gt: number } | { equals: number }
    startedAt?: { gte?: Date; lte?: Date }
  } = {}

  if (opts.taskType) where.taskType = opts.taskType

  if (opts.hasInefficiency === 'true') where.inefficiencyCount = { gt: 0 }
  if (opts.hasInefficiency === 'false') where.inefficiencyCount = { equals: 0 }

  if (opts.from || opts.to) {
    where.startedAt = {}
    if (opts.from) where.startedAt.gte = new Date(opts.from)
    if (opts.to) where.startedAt.lte = new Date(opts.to)
  }

  return where
}

async function fetchOtelMetrics(sessionId: string) {
  const spans = await prisma.otelSpan.findMany({ where: { sessionId } })

  const tokenSpans = spans.filter(
    (s) => s.name.toLowerCase().includes('token') || s.name.toLowerCase().includes('usage'),
  )
  const latencySpans = spans.filter(
    (s) => s.name.toLowerCase().includes('latency') || s.name.toLowerCase().includes('duration'),
  )

  const totalTokens =
    tokenSpans.length > 0 ? tokenSpans.reduce((sum, s) => sum + (s.value ?? 0), 0) : null

  const avgLatencyMs =
    latencySpans.length > 0
      ? latencySpans.reduce((sum, s) => sum + (s.value ?? 0), 0) / latencySpans.length
      : null

  return { totalTokens, avgLatencyMs }
}
