// Design Ref: §7 — API Key 인증. 모든 보호 엔드포인트에 X-API-Key 헤더 검증
// Plan SC: NFR — 홈서버 API 접근: API Key 헤더 인증
import type { FastifyReply, FastifyRequest } from 'fastify'

export async function authHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const apiKey = request.headers['x-api-key']
  const expectedKey = process.env.API_KEY

  if (!expectedKey) {
    request.log.error('API_KEY 환경변수가 설정되지 않았습니다')
    await reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: '서버 설정 오류가 발생했습니다' },
    })
    return
  }

  if (!apiKey || apiKey !== expectedKey) {
    await reply.status(401).send({
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
    })
  }
}
