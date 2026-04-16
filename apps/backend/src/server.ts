// Design Ref: §2.3 — Fastify 앱 초기화 + 플러그인 등록
// Plan SC: 백엔드 수신 신뢰성 — 실패-안전 처리 기반 마련
import cors from '@fastify/cors'
import Fastify from 'fastify'

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
})

server.register(cors, {
  origin: process.env.FRONTEND_URL ?? true,
})

// 헬스체크 — 인증 없이 접근 가능
server.get('/health', async () => {
  return { status: 'ok' }
})

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
