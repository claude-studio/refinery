// Design Ref: §2.2 — 트랜스크립트 파이프라인: 수신 → mask() → parse() → classify() → analyze() → summarize() → db.save()
// Plan SC: FR-03 — POST /ingest/transcript. 수신 즉시 마스킹 후 202 반환. 비동기 파이프라인 실행
import type { Prisma } from '@prisma/client'
import type { Inefficiency, ParsedSession, SessionSummary } from '@refinery/shared'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { analyze } from '../analyzer/index.js'
import { prisma } from '../db/client.js'
import { summarize } from '../insight/session-summary.js'
import { eventBus } from '../lib/event-bus.js'
import { classify } from '../parser/classifier.js'
import { maskObject } from '../parser/masker.js'
import { computeTopFiles, parseTranscript } from '../parser/transcript.js'

const transcriptLineSchema = z.object({
  uuid: z.string(),
  parentUuid: z.string().nullable(),
  isSidechain: z.boolean().default(false),
  type: z.string(), // user | assistant | attachment | summary | permission-mode
  message: z.record(z.unknown()),
  timestamp: z.string(),
})

const ingestPayloadSchema = z.object({
  sessionId: z.string().uuid('세션 ID는 UUID 형식이어야 합니다'),
  projectPath: z.string().min(1, '프로젝트 경로가 필요합니다'),
  lines: z.array(transcriptLineSchema).min(1, '최소 1개의 라인이 필요합니다'),
  agentVersion: z.string(),
})

type IngestPayload = z.infer<typeof ingestPayloadSchema>

export async function transcriptRoute(fastify: FastifyInstance) {
  fastify.post<{ Body: unknown }>('/transcript', async (request, reply) => {
    const parsed = ingestPayloadSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: '요청 데이터가 올바르지 않습니다',
          details: { fieldErrors: parsed.error.flatten().fieldErrors },
        },
      })
    }

    const payload = parsed.data

    // 마스킹 필수 — 파이프라인 최우선. DB 저장 전 반드시 먼저 수행
    const maskedPayload = applyMasking(payload)

    // 202 먼저 반환 → 에이전트 블로킹 방지
    reply.status(202).send({ data: { queued: true, sessionId: maskedPayload.sessionId } })

    // 비동기 파이프라인
    setImmediate(() => {
      void runPipeline(fastify, maskedPayload)
    })
  })
}

function applyMasking(payload: IngestPayload): IngestPayload {
  return {
    ...payload,
    lines: payload.lines.map((line) => ({
      ...line,
      message: maskObject(line.message) as Record<string, unknown>,
    })),
  }
}

async function runPipeline(fastify: FastifyInstance, payload: IngestPayload): Promise<void> {
  try {
    const session = parseTranscript(payload.sessionId, payload.projectPath, payload.lines)
    const classification = classify(session)
    const inefficiencies = analyze(session)
    const summary = summarize(session, classification, inefficiencies)

    await saveSession(session, inefficiencies, summary)

    eventBus.emitSessionAnalyzed({
      sessionId: session.sessionId,
      inefficiencyCount: inefficiencies.length,
      taskType: summary.taskType,
    })

    fastify.log.info(
      {
        sessionId: payload.sessionId,
        taskType: classification.taskType,
        inefficiencyCount: inefficiencies.length,
        totalToolCalls: session.toolCalls.length,
      },
      'Transcript processed and saved',
    )
  } catch (err) {
    fastify.log.error(
      { sessionId: payload.sessionId, err },
      'Transcript processing failed — session skipped',
    )
  }
}

async function saveSession(
  session: ParsedSession,
  inefficiencies: Inefficiency[],
  summary: SessionSummary,
): Promise<void> {
  const existing = await prisma.session.findUnique({
    where: { sessionId: session.sessionId },
  })

  if (existing) {
    await prisma.session.update({
      where: { sessionId: session.sessionId },
      data: {
        endedAt: session.endedAt,
        durationMin: summary.durationMin,
        taskType: summary.taskType,
        taskDescription: summary.taskDescription,
        totalToolCalls: session.toolCalls.length,
        inefficiencyCount: inefficiencies.length,
        topFiles: summary.topFiles,
      },
    })
    return
  }

  await prisma.session.create({
    data: {
      sessionId: session.sessionId,
      projectPath: session.projectPath,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationMin: summary.durationMin,
      taskType: summary.taskType,
      taskDescription: summary.taskDescription,
      totalToolCalls: session.toolCalls.length,
      inefficiencyCount: inefficiencies.length,
      topFiles: computeTopFiles(session, 10),
      messages: {
        create: session.messages.map((m) => ({
          uuid: m.uuid,
          parentUuid: m.parentUuid,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          isSidechain: m.isSidechain,
        })),
      },
      toolCalls: {
        create: session.toolCalls.map((tc) => ({
          toolUseId: tc.id,
          name: tc.name,
          input: tc.input as Prisma.InputJsonValue,
          resultText: tc.resultText || null,
          isError: tc.isError,
          timestamp: tc.timestamp,
        })),
      },
      inefficiencies: {
        create: inefficiencies.map((i) => ({
          type: i.type,
          severity: i.severity,
          description: i.description,
          evidence: i.evidence,
          count: i.count,
        })),
      },
      summary: {
        create: {
          raw: summary as unknown as Prisma.InputJsonValue,
        },
      },
    },
  })
}
