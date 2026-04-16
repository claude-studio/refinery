---
description: 백엔드(Fastify) 코딩 규칙 및 보안 금지 행동 목록
paths:
  - "apps/backend/**"
---

# Backend Rules

## 레이어 규칙

- `api/` 라우트: 요청/응답 직렬화만. Prisma 직접 호출 금지
- `db/client.ts` 경유만 허용: `import { db } from '../db/client'`
- 비즈니스 로직은 `parser/`, `analyzer/`, `insight/` 모듈에 위치

## 파이프라인 순서 (트랜스크립트)

```
수신 → mask() → parse() → classify() → analyze() → summarize() → db.save()
```
순서 변경 금지. 특히 `mask()` 는 반드시 최우선.

---

## 보안 — 절대 하지 말아야 할 행동

### 1. 입력 검증 없이 데이터 사용 금지

모든 외부 입력(body, query, params, headers)은 **Zod 스키마 검증 필수**.
검증 전 데이터를 DB에 저장하거나 로직에 사용하는 것 금지.

```ts
// 금지
fastify.post('/ingest/transcript', async (req) => {
  await db.session.create({ data: req.body }) // 검증 없음
})

// 올바른 방법
const schema = z.object({ sessionId: z.string().uuid(), lines: z.array(...) })
fastify.post('/ingest/transcript', async (req) => {
  const data = schema.parse(req.body) // 검증 후 사용
  await db.session.create({ data })
})
```

### 2. SQL Injection 방지 — Raw 쿼리 금지

Prisma parameterized 쿼리만 사용. `$queryRawUnsafe` 절대 금지.

```ts
// 금지
await db.$queryRawUnsafe(`SELECT * FROM sessions WHERE id = '${id}'`)

// 올바른 방법
await db.session.findUnique({ where: { id } })
// Raw가 꼭 필요하면
await db.$queryRaw`SELECT * FROM sessions WHERE id = ${id}`
```

### 3. Prototype Poisoning 방어 설정 필수

서버 초기화 시 반드시 명시:

```ts
const fastify = Fastify({
  onProtoPoisoning: 'error',      // __proto__ 포함 JSON 거부
  onConstructorPoisoning: 'error' // constructor 포함 JSON 거부
})
```

`'ignore'` 설정 금지.

### 4. `hasOwnProperty` 사용 금지 (Fastify v5)

```ts
// 금지
req.params.hasOwnProperty('name')

// 올바른 방법 (Fastify v5 — params에 prototype 없음)
Object.hasOwn(req.params, 'name')
```

### 5. 보안 헤더 — @fastify/helmet 필수

```ts
// 반드시 등록
await fastify.register(import('@fastify/helmet'))
```

임의로 Content-Security-Policy 비활성화 금지:
```ts
// 금지
fastify.register(helmet, { contentSecurityPolicy: false })
```

### 6. Rate Limiting — @fastify/rate-limit 필수

수신 엔드포인트에 반드시 적용:

```ts
await fastify.register(import('@fastify/rate-limit'), {
  max: 60,
  timeWindow: '1 minute'
})
```

`/ingest/transcript`, `/v1/metrics`, `/v1/logs` 에 반드시 적용. 제거 금지.

### 7. API Key 노출 금지

- API Key를 응답 body에 포함 금지
- API Key를 로그에 출력 금지 (`req.headers['x-api-key']` 로깅 금지)
- 에러 메시지에 유효/무효 키 힌트 제공 금지 ("Invalid key" → "Unauthorized"만)

### 8. 마스킹 전 데이터 로그/저장 금지

```ts
// 금지
console.log('Received transcript:', req.body.lines) // 마스킹 전 로그
await db.save(req.body) // 마스킹 전 저장

// 올바른 방법
const masked = masker.mask(req.body.lines)
await db.save(masked)
```

### 9. 에러 메시지에 내부 정보 노출 금지

```ts
// 금지
reply.status(500).send({ error: err.stack })
reply.status(500).send({ error: err.message }) // DB 쿼리 오류 등 노출 위험

// 올바른 방법
reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' } })
// 상세 오류는 서버 로그에만 기록
fastify.log.error(err)
```

### 10. CORS 설정 — 와일드카드 금지

```ts
// 금지
fastify.register(cors, { origin: '*' })

// 올바른 방법 (허용 도메인 명시)
fastify.register(cors, {
  origin: process.env.ALLOWED_ORIGIN, // 예: https://your-tunnel.domain
  credentials: true
})
```

### 11. 환경변수 하드코딩 금지

```ts
// 금지
const apiKey = 'sk-hardcoded-key-12345'
const dbUrl = 'postgresql://user:pass@localhost/db'

// 올바른 방법
const apiKey = process.env.API_KEY
if (!apiKey) throw new Error('API_KEY env var required')
```

---

## Zod 에러 응답 형식

```ts
if (error instanceof z.ZodError) {
  reply.status(400).send({
    error: {
      code: 'VALIDATION_ERROR',
      message: '요청 데이터가 올바르지 않습니다',
      details: { fieldErrors: error.flatten().fieldErrors }
    }
  })
}
```

## 에러 코드 표준

| Code | HTTP | 상황 |
|------|------|------|
| `UNAUTHORIZED` | 401 | API Key 없음/불일치 |
| `VALIDATION_ERROR` | 400 | Zod 검증 실패 |
| `NOT_FOUND` | 404 | 리소스 없음 |
| `PARSE_ERROR` | 422 | JSONL 파싱 실패 |
| `INTERNAL_ERROR` | 500 | 서버 내부 오류 |
