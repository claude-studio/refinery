// Design Ref: §2.2 — 트랜스크립트 파이프라인: 수신 → mask() → parse() → classify() → 로그
// Plan SC: FR-03 — POST /ingest/transcript. 수신 즉시 마스킹 후 202 반환
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { classify } from '../parser/classifier'
import { maskObject } from '../parser/masker'
import { computeTopFiles, parseTranscript } from '../parser/transcript'

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

    // 비동기 파이프라인 — Phase 3에서 parse/classify/analyze/summarize 구현
    setImmediate(() => {
      enqueueProcessing(fastify, maskedPayload)
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

function enqueueProcessing(fastify: FastifyInstance, payload: IngestPayload): void {
  try {
    // parse() — JSONL → ParsedSession
    const session = parseTranscript(payload.sessionId, payload.projectPath, payload.lines)

    // classify() — 의미적 작업 분류
    const { taskType, taskDescription } = classify(session)

    // topFiles 추출
    const topFiles = computeTopFiles(session, 10)

    fastify.log.info(
      {
        sessionId: payload.sessionId,
        taskType,
        taskDescription,
        messageCount: session.messages.length,
        toolCallCount: session.toolCalls.length,
        topFiles: topFiles.slice(0, 3),
      },
      'Transcript parsed and classified (Phase 4에서 DB 저장 + 검출기 추가 예정)',
    )
  } catch (err) {
    fastify.log.error(
      { sessionId: payload.sessionId, err },
      'Transcript processing failed — session skipped',
    )
  }
}
