// Design Ref: §2.2 — OTLP 경로: POST /v1/metrics|logs → db.otel_spans 저장
// Plan SC: FR-01 — OTLP HTTP/protobuf 수신기 (포트 4318 → 단일서버 경로로 처리)
// 현재: http/json 형식 완전 지원. http/protobuf: 수신 확인만 (Phase 8에서 디코더 구현)
import { Prisma } from '@prisma/client'
import type { FastifyInstance } from 'fastify'

import { prisma } from '../db/client'

// OTLP JSON 포맷 타입 (https://opentelemetry.io/docs/specs/otlp/#json-protobuf-encoding)
interface OtlpAttribute {
  key: string
  value: { stringValue?: string; intValue?: string; doubleValue?: number; boolValue?: boolean }
}

interface OtlpDataPoint {
  asDouble?: number
  asInt?: number
  timeUnixNano?: string
  attributes?: OtlpAttribute[]
}

interface OtlpMetric {
  name: string
  gauge?: { dataPoints?: OtlpDataPoint[] }
  sum?: { dataPoints?: OtlpDataPoint[] }
  histogram?: { dataPoints?: OtlpDataPoint[] }
}

interface OtlpMetricsBody {
  resourceMetrics?: Array<{
    resource?: { attributes?: OtlpAttribute[] }
    scopeMetrics?: Array<{ metrics?: OtlpMetric[] }>
  }>
}

interface OtlpLogRecord {
  timeUnixNano?: string
  body?: { stringValue?: string }
  attributes?: OtlpAttribute[]
  severityText?: string
}

interface OtlpLogsBody {
  resourceLogs?: Array<{
    resource?: { attributes?: OtlpAttribute[] }
    scopeLogs?: Array<{ logRecords?: OtlpLogRecord[] }>
  }>
}

export async function otlpRoute(fastify: FastifyInstance) {
  // OTLP HTTP 메트릭 수신
  fastify.post<{ Body: unknown }>('/v1/metrics', async (request, reply) => {
    const contentType = request.headers['content-type'] ?? ''

    if (contentType.includes('application/json')) {
      try {
        await storeMetrics(fastify, request.body as OtlpMetricsBody)
      } catch (err) {
        fastify.log.error({ err }, 'OTLP metrics 저장 실패')
        // OTLP 스펙: 파싱 실패 시에도 2xx 반환 (드롭 처리)
      }
    } else if (contentType.includes('application/x-protobuf')) {
      // protobuf 디코딩은 Phase 8에서 구현
      fastify.log.debug(
        { bytes: (request.body as Buffer | undefined)?.length ?? 0 },
        'OTLP protobuf metrics received — decoding deferred to Phase 8',
      )
    } else {
      fastify.log.warn({ contentType }, 'OTLP metrics: 지원하지 않는 Content-Type')
    }

    // OTLP 스펙 준수: 빈 응답 객체로 200 반환
    return reply.status(200).send({})
  })

  // OTLP HTTP 로그 수신
  fastify.post<{ Body: unknown }>('/v1/logs', async (request, reply) => {
    const contentType = request.headers['content-type'] ?? ''

    if (contentType.includes('application/json')) {
      try {
        await storeLogs(fastify, request.body as OtlpLogsBody)
      } catch (err) {
        fastify.log.error({ err }, 'OTLP logs 저장 실패')
      }
    } else if (contentType.includes('application/x-protobuf')) {
      fastify.log.debug(
        { bytes: (request.body as Buffer | undefined)?.length ?? 0 },
        'OTLP protobuf logs received — decoding deferred to Phase 8',
      )
    } else {
      fastify.log.warn({ contentType }, 'OTLP logs: 지원하지 않는 Content-Type')
    }

    return reply.status(200).send({})
  })
}

async function storeMetrics(fastify: FastifyInstance, body: OtlpMetricsBody): Promise<void> {
  if (!body?.resourceMetrics?.length) return

  const spans = body.resourceMetrics.flatMap((rm) => {
    const resourceAttrs = attributesToObject(rm.resource?.attributes)
    return (rm.scopeMetrics ?? []).flatMap((sm) =>
      (sm.metrics ?? []).flatMap((metric) => {
        const dataPoints = [
          ...(metric.gauge?.dataPoints ?? []),
          ...(metric.sum?.dataPoints ?? []),
          ...(metric.histogram?.dataPoints ?? []),
        ]
        return dataPoints.map((dp) => ({
          spanType: 'metric' as const,
          name: metric.name,
          value: dp.asDouble ?? (dp.asInt !== undefined ? Number(dp.asInt) : null),
          attributes: {
            ...resourceAttrs,
            ...attributesToObject(dp.attributes),
          } as Prisma.InputJsonValue,
          timestamp: nanoToDate(dp.timeUnixNano),
        }))
      }),
    )
  })

  if (spans.length === 0) return

  await prisma.otelSpan.createMany({
    data: spans,
    skipDuplicates: false,
  })

  fastify.log.info({ count: spans.length }, 'OTLP metrics stored')
}

async function storeLogs(fastify: FastifyInstance, body: OtlpLogsBody): Promise<void> {
  if (!body?.resourceLogs?.length) return

  const spans = body.resourceLogs.flatMap((rl) => {
    const resourceAttrs = attributesToObject(rl.resource?.attributes)
    return (rl.scopeLogs ?? []).flatMap((sl) =>
      (sl.logRecords ?? []).map((lr) => ({
        spanType: 'log' as const,
        name: lr.body?.stringValue?.slice(0, 255) ?? 'log',
        value: null,
        attributes: {
          ...resourceAttrs,
          ...attributesToObject(lr.attributes),
          severityText: lr.severityText,
        } as Prisma.InputJsonValue,
        timestamp: nanoToDate(lr.timeUnixNano),
      })),
    )
  })

  if (spans.length === 0) return

  await prisma.otelSpan.createMany({
    data: spans,
    skipDuplicates: false,
  })

  fastify.log.info({ count: spans.length }, 'OTLP logs stored')
}

function nanoToDate(timeUnixNano?: string): Date {
  if (!timeUnixNano) return new Date()
  // BigInt으로 나노초 → 밀리초 변환 (정밀도 손실 없이)
  try {
    return new Date(Number(BigInt(timeUnixNano) / BigInt(1_000_000)))
  } catch {
    return new Date()
  }
}

function attributesToObject(attrs?: OtlpAttribute[]): Record<string, unknown> {
  if (!attrs) return {}
  const result: Record<string, unknown> = {}
  for (const attr of attrs) {
    const v = attr.value
    result[attr.key] = v.stringValue ?? v.intValue ?? v.doubleValue ?? v.boolValue ?? null
  }
  return result
}
