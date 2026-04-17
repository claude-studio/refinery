// Design Ref: §4.1 GET /insights/weekly, POST /insights/weekly/generate
// Plan FR-11: 주간 인사이트 엔드포인트 (LLM은 Phase 8, 현재는 규칙 기반)
import type { FastifyInstance } from 'fastify'

import { prisma } from '../db/client.js'
import { generateWeeklyReport, getMondayOf } from '../insight/weekly-report.js'

export async function insightsRoute(fastify: FastifyInstance) {
  fastify.get('/weekly', async (request, reply) => {
    const report = await prisma.weeklyReport.findFirst({
      orderBy: { weekStart: 'desc' },
    })

    if (!report) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: '주간 리포트가 없습니다' },
      })
    }

    return reply.send({
      data: {
        id: report.id,
        weekStart: report.weekStart.toISOString(),
        insights: report.insights,
        stats: report.stats,
        generatedAt: report.generatedAt.toISOString(),
      },
    })
  })

  fastify.get<{ Params: { weekStart: string } }>('/weekly/:weekStart', async (request, reply) => {
    const weekStart = new Date(request.params.weekStart)
    if (isNaN(weekStart.getTime())) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: '올바른 날짜 형식이 아닙니다 (ISO 8601)' },
      })
    }

    const report = await prisma.weeklyReport.findUnique({ where: { weekStart } })

    if (!report) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: '해당 주 리포트가 없습니다' },
      })
    }

    return reply.send({
      data: {
        id: report.id,
        weekStart: report.weekStart.toISOString(),
        insights: report.insights,
        stats: report.stats,
        generatedAt: report.generatedAt.toISOString(),
      },
    })
  })

  fastify.post('/weekly/generate', async (request, reply) => {
    const weekStart = getMondayOf(new Date())

    try {
      const data = await generateWeeklyReport(weekStart)
      return reply.status(201).send({ data })
    } catch (err) {
      fastify.log.error({ err }, 'Weekly report generation failed')
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' },
      })
    }
  })
}
