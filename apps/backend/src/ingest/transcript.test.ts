// Design Ref: §8.3 — L2 API 테스트 #1~3: POST /ingest/transcript
import Fastify from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { authHook } from '../plugins/auth'

import { transcriptRoute } from './transcript'

const VALID_PAYLOAD = {
  sessionId: '550e8400-e29b-41d4-a716-446655440000',
  projectPath: '/Users/user/projects/myapp',
  lines: [
    {
      uuid: 'aaa-111',
      parentUuid: null,
      type: 'user',
      message: { role: 'user', content: 'Hello' },
      timestamp: '2026-04-17T09:00:00.000Z',
    },
  ],
  agentVersion: '1.0.0',
}

function buildApp() {
  const app = Fastify({ logger: false })
  app.register(async (scope) => {
    scope.addHook('preHandler', authHook)
    scope.register(transcriptRoute, { prefix: '/ingest' })
  })
  return app
}

describe('POST /ingest/transcript', () => {
  const app = buildApp()

  beforeAll(async () => {
    process.env.API_KEY = 'test-api-key'
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    delete process.env.API_KEY
  })

  // §8.3 #1 — 유효한 페이로드 → 202
  it('유효한 페이로드 → 202 + queued: true', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ingest/transcript',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      payload: VALID_PAYLOAD,
    })
    expect(res.statusCode).toBe(202)
    const body = res.json<{ data: { queued: boolean; sessionId: string } }>()
    expect(body.data.queued).toBe(true)
    expect(body.data.sessionId).toBe(VALID_PAYLOAD.sessionId)
  })

  // §8.3 #2 — API Key 누락 → 401
  it('API Key 누락 → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ingest/transcript',
      headers: { 'content-type': 'application/json' },
      payload: VALID_PAYLOAD,
    })
    expect(res.statusCode).toBe(401)
    const body = res.json<{ error: { code: string } }>()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  // §8.3 #3 — 잘못된 JSON (sessionId 누락) → 400 + fieldErrors
  it('필수 필드 누락 → 400 + fieldErrors', async () => {
    const { sessionId: _, ...withoutSessionId } = VALID_PAYLOAD
    const res = await app.inject({
      method: 'POST',
      url: '/ingest/transcript',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      payload: withoutSessionId,
    })
    expect(res.statusCode).toBe(400)
    const body = res.json<{
      error: { code: string; details: { fieldErrors: Record<string, string[]> } }
    }>()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.details.fieldErrors.sessionId).toBeDefined()
  })

  it('UUID 형식이 아닌 sessionId → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ingest/transcript',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      payload: { ...VALID_PAYLOAD, sessionId: 'not-a-uuid' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('lines 빈 배열 → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ingest/transcript',
      headers: { 'x-api-key': 'test-api-key', 'content-type': 'application/json' },
      payload: { ...VALID_PAYLOAD, lines: [] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('잘못된 API Key → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ingest/transcript',
      headers: { 'x-api-key': 'wrong-key', 'content-type': 'application/json' },
      payload: VALID_PAYLOAD,
    })
    expect(res.statusCode).toBe(401)
  })
})
