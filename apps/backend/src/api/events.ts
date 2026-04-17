// Design Ref: §4.2 GET /events — SSE 스트림, 신규 세션 분석 완료 이벤트 실시간 푸시
// Plan FR-14: SSE 엔드포인트 — session.analyzed + heartbeat 30초 간격
import type { SseEvent } from '@refinery/shared'
import type { FastifyInstance } from 'fastify'

import { eventBus } from '../lib/event-bus.js'

const HEARTBEAT_MS = 30_000

export async function eventsRoute(fastify: FastifyInstance) {
  fastify.get('/events', (request, reply) => {
    const raw = reply.raw

    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    raw.write('event: connected\ndata: {}\n\n')

    const onSessionAnalyzed = (event: SseEvent) => {
      if (!raw.closed) {
        raw.write(`event: session.analyzed\ndata: ${JSON.stringify(event)}\n\n`)
      }
    }

    eventBus.on('session.analyzed', onSessionAnalyzed)

    const heartbeat = setInterval(() => {
      if (!raw.closed) {
        raw.write('event: heartbeat\ndata: {}\n\n')
      }
    }, HEARTBEAT_MS)

    request.socket.on('close', () => {
      clearInterval(heartbeat)
      eventBus.off('session.analyzed', onSessionAnalyzed)
    })

    return reply.hijack()
  })
}
