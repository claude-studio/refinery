// Design Ref: §2.3 — Fastify 앱 초기화 + 보안 플러그인 + 라우트 등록
// Plan SC: 백엔드 수신 신뢰성 — 실패-안전 처리, API Key 인증, Proto-Poisoning 방어
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'

import { eventsRoute } from './api/events'
import { insightsRoute } from './api/insights'
import { sessionsRoute } from './api/sessions'
import { otlpRoute } from './ingest/otlp'
import { transcriptRoute } from './ingest/transcript'
import { authHook } from './plugins/auth'

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
  // Prototype Poisoning 방어 — backend.md 보안 규칙 §3
  onProtoPoisoning: 'error',
  onConstructorPoisoning: 'error',
})

// ─── 보안 플러그인 ─────────────────────────────────────────────────────────────
server.register(helmet)

// CORS — 와일드카드 금지 (backend.md 보안 규칙 §10)
server.register(cors, {
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  credentials: true,
})

// Rate Limiting — 전역 기본값. 수신 엔드포인트는 별도 설정 가능
server.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
})

// ─── 공개 엔드포인트 (인증 불필요) ────────────────────────────────────────────
server.get('/health', async () => {
  return { status: 'ok' }
})

// ─── 보호 영역 (X-API-Key 필수) ───────────────────────────────────────────────
server.register(async (protectedApp) => {
  protectedApp.addHook('preHandler', authHook)

  // OTLP HTTP 수신기 — Claude Code OTel 데이터 수신
  protectedApp.register(otlpRoute)

  // 트랜스크립트 수신 — 에이전트에서 전송하는 JSONL 데이터
  protectedApp.register(transcriptRoute, { prefix: '/ingest' })

  // REST API — 세션 목록/상세
  protectedApp.register(sessionsRoute, { prefix: '/sessions' })

  // REST API — 주간 인사이트 리포트
  protectedApp.register(insightsRoute, { prefix: '/insights' })

  // SSE — 신규 세션 분석 완료 이벤트 스트림
  protectedApp.register(eventsRoute)
})

// ─── 서버 시작 ────────────────────────────────────────────────────────────────
const start = async () => {
  try {
    const port = Number(process.env.PORT ?? 3001)
    await server.listen({ port, host: '0.0.0.0' })
    server.log.info(`Backend listening on :${port}`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
