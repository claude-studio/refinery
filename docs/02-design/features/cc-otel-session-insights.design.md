# cc-otel-session-insights Design Document

> **Summary**: Fastify 백엔드(OTLP 수신 + 트랜스크립트 분석) + Next.js 대시보드 + 개발PC 에이전트 — Turborepo 모노레포, Docker Compose 홈서버 배포
>
> **Project**: refinery
> **Version**: 0.1.0
> **Author**: jeonbg@kakao.com
> **Date**: 2026-04-16
> **Status**: Draft
> **Planning Doc**: [cc-otel-session-insights.plan.md](../../01-plan/features/cc-otel-session-insights.plan.md)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 세션 비효율(반복 동작, 실패 패턴, 컨텍스트 낭비)은 인식하지 못한 채 반복된다. 비용보다 "행동 정확성"이 먼저다. |
| **WHO** | Primary: Claude Code 파워 유저 (일 4시간+ 사용, 홈서버 운영자). |
| **RISK** | 트랜스크립트 전송 시 시크릿 노출, 홈서버-개발PC 네트워크 연결 의존, 트랜스크립트 포맷 변경 시 파서 깨짐 |
| **SUCCESS** | 설치 후 첫 세션 요약 대시보드 표시 + 비효율 검출 ≥ 1건. 주간 리포트 자동 생성. |
| **SCOPE** | v1 IN: 백엔드(OTLP 수신+트랜스크립트 분석 API), 프론트엔드(대시보드), Docker Compose, 에이전트(개발PC→서버 트랜스크립트 동기화). v1 OUT: 팀 멀티유저, SaaS, 실시간 인터셉트 |

---

## 1. Overview

### 1.1 Design Goals

1. **모노레포 일관성**: Turborepo + pnpm workspace로 backend/frontend/agent 빌드 캐시 공유
2. **수신 신뢰성**: OTLP HTTP/protobuf + 트랜스크립트 인제스트 두 경로 모두 실패-안전 처리
3. **파서 교체 가능성**: 트랜스크립트 JSONL 스키마가 변경되어도 `parser/` 모듈만 수정
4. **마스킹 우선**: 모든 데이터는 수신 즉시 마스킹 → DB 저장 순서 강제
5. **대시보드 반응성**: SSE로 신규 세션 분석 완료 시 자동 갱신 (폴링 폴백)

### 1.2 Design Principles

- **Feature-Module 분리**: `ingest/`, `parser/`, `analyzer/`, `insight/`, `api/` 각 모듈은 독립적으로 테스트 가능
- **Thin API Routes**: Fastify 라우트는 요청/응답 직렬화만. 비즈니스 로직은 해당 모듈 서비스로
- **DB는 최하단**: Prisma 클라이언트는 `db/` 모듈에서만 직접 사용. 라우트에서 직접 호출 금지
- **DESIGN.md 준수**: UI는 `DESIGN.md`에 정의된 토큰(색상, 타이포그래피, 간격)만 사용. 명시되지 않은 스타일 금지
- **kebab-case 강제**: 모든 파일명/폴더명은 kebab-case (`session-card.tsx`, `repeat-read.ts`)

---

## 2. Architecture

### 2.0 Architecture Comparison

| Criteria | Option A: Minimal | Option B: Clean | Option C: Pragmatic ✅ |
|----------|:-:|:-:|:-:|
| **Approach** | Flat files, 로직 혼합 | 완전 레이어 분리, DI | Feature 모듈 + 서비스 레이어 |
| **신규 파일** | ~25개 | ~80개 | ~45개 |
| **복잡도** | Low | High | **Medium** |
| **유지보수성** | Low | High | **High** |
| **노력** | Low | High | **Medium** |
| **Turborepo 적합성** | Poor | Good | **Best** |

**Selected**: Option C — **Rationale**: Plan §7.3 구조와 일치, Turborepo 파이프라인(빌드/테스트/타입체크)이 모듈 경계를 따르면 캐시 효율 극대화. 백엔드 입문자도 `ingest/` → `parser/` → `analyzer/` 흐름이 명확.

### 2.1 컴포넌트 다이어그램

```
[개발 PC]
  Claude Code ──OTLP HTTP/protobuf──▶ Backend :4318/v1/metrics
                                    ▶ Backend :4318/v1/logs
  Agent Daemon ──HTTP POST──────────▶ Backend :3001/ingest/transcript
    (chokidar)

[홈서버 — Docker Compose]
┌──────────────────────────────────────────────────────┐
│  cloudflared (Tunnel)                                │
│    └── HTTPS ──▶ backend:3001 / frontend:3000        │
│                                                      │
│  backend (Fastify :3001/:4318)                       │
│    ├── ingest/     ← OTLP + transcript 수신          │
│    ├── parser/     ← JSONL 파싱 + 분류 + 마스킹      │
│    ├── analyzer/   ← 비효율 4종 검출                 │
│    ├── insight/    ← 세션요약 + 주간리포트 + LLM     │
│    ├── api/        ← REST + SSE                      │
│    └── db/         ← Prisma                          │
│                           │                          │
│  frontend (Next.js :3000) │                          │
│    └── ◀──────────────────┘ REST + SSE               │
│                                                      │
│  db (PostgreSQL :5432)                               │
└──────────────────────────────────────────────────────┘
```

### 2.2 데이터 흐름

```
[OTLP 경로]
Claude Code → POST /v1/metrics|logs (protobuf)
  → ingest/otlp.ts (decode + mask)
  → db: otel_spans 저장

[트랜스크립트 경로]
Agent → POST /ingest/transcript (JSON)
  → ingest/transcript.ts (API Key 검증 → mask → 파이프라인 큐)
  → parser/transcript.ts (JSONL → ParsedSession)
  → parser/classifier.ts (의미적 작업 분류)
  → analyzer/*.ts (비효율 4종 검출)
  → insight/session-summary.ts (SessionSummary 생성)
  → db: sessions, messages, inefficiencies 저장
  → SSE: 'session.analyzed' 이벤트 발행

[주간 리포트]
cron (매주 월 09:00) 또는 수동 요청
  → insight/weekly-report.ts
  → insight/llm.ts (Claude API BYOK)
  → db: weekly_reports 저장
```

### 2.3 모노레포 구조 (Turborepo)

```
refinery/
├── apps/
│   ├── backend/               # Fastify 백엔드
│   │   ├── src/
│   │   │   ├── ingest/
│   │   │   │   ├── otlp.ts          # OTLP HTTP/protobuf 디코더 + 저장
│   │   │   │   └── transcript.ts    # 트랜스크립트 수신 API 핸들러
│   │   │   ├── parser/
│   │   │   │   ├── transcript.ts    # JSONL → ParsedSession
│   │   │   │   ├── classifier.ts    # 의미적 작업 분류
│   │   │   │   └── masker.ts        # PII/시크릿 마스킹
│   │   │   ├── analyzer/
│   │   │   │   ├── repeat-read.ts   # 동일 파일 3회+ Read
│   │   │   │   ├── failed-retry.ts  # 동일 도구 실패 후 3회+ 재시도
│   │   │   │   ├── bash-antipattern.ts  # cat/grep/find 안티패턴
│   │   │   │   ├── context-waste.ts # 이미 로드된 정보 재로드
│   │   │   │   └── index.ts         # 4종 검출기 조합 실행
│   │   │   ├── insight/
│   │   │   │   ├── session-summary.ts   # 세션 요약 생성
│   │   │   │   ├── weekly-report.ts     # 주간 인사이트 생성
│   │   │   │   └── llm.ts               # Claude API 클라이언트 (BYOK)
│   │   │   ├── api/
│   │   │   │   ├── sessions.ts      # GET /sessions, GET /sessions/:id
│   │   │   │   ├── insights.ts      # GET /insights/weekly
│   │   │   │   └── events.ts        # GET /events (SSE)
│   │   │   ├── db/
│   │   │   │   └── client.ts        # Prisma 클라이언트 싱글톤
│   │   │   └── server.ts            # Fastify 앱 초기화 + 플러그인 등록
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   │
│   ├── frontend/              # Next.js 대시보드
│   │   ├── app/
│   │   │   ├── page.tsx             # 홈 (주간 리포트 + 요약 카드)
│   │   │   ├── sessions/
│   │   │   │   ├── page.tsx         # 세션 목록
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx     # 세션 상세
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── session-card.tsx
│   │   │   ├── inefficiency-badge.tsx
│   │   │   ├── weekly-insight-card.tsx
│   │   │   ├── tool-call-timeline.tsx
│   │   │   └── metric-chart.tsx
│   │   ├── lib/
│   │   │   ├── api.ts               # 백엔드 fetch 클라이언트
│   │   │   └── sse.ts               # SSE 훅
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   │
│   └── agent/                 # 개발 PC 실행 에이전트
│       ├── src/
│       │   ├── watcher.ts           # chokidar 파일 감시
│       │   ├── masker.ts            # 로컬 1차 마스킹
│       │   ├── sender.ts            # HTTP POST + 로컬 큐 + 재시도
│       │   └── cli.ts               # npx cc-insights-agent init
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── shared/                # 공통 타입 (백엔드↔프론트↔에이전트 공유)
│   │   ├── src/
│   │   │   └── types.ts             # ParsedSession, Inefficiency, SessionSummary 등
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── ui/                    # shadcn/ui 컴포넌트 (프론트엔드 전용)
│       ├── components/              # shadcn add 설치 위치 (src 없음)
│       │   ├── button.tsx
│       │   ├── card.tsx
│       │   ├── badge.tsx
│       │   └── ...
│       ├── lib/
│       │   └── utils.ts             # cn() 유틸리티
│       ├── components.json          # shadcn 설정 (path: ./components)
│       ├── package.json             # name: "@refinery/ui"
│       └── tsconfig.json
│
├── turbo.json                 # Turborepo 파이프라인 정의
├── docker-compose.yml
├── .env.example
└── pnpm-workspace.yaml
```

### 2.4 Turborepo 파이프라인

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "lint": {},
    "type-check": {
      "dependsOn": ["^build"]
    }
  }
}
```

### 2.5 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| `ingest/otlp.ts` | `@opentelemetry/otlp-exporter-base`, `db/client` | protobuf 디코드 + 저장 |
| `ingest/transcript.ts` | `parser/masker`, `parser/transcript`, `db/client` | 수신 → 마스킹 → 파이프라인 |
| `parser/transcript.ts` | `packages/shared/types` | JSONL → ParsedSession |
| `analyzer/index.ts` | `analyzer/*.ts` | 4종 검출기 순차 실행 |
| `insight/llm.ts` | `@anthropic-ai/sdk` | Claude API BYOK |
| `api/events.ts` | Fastify SSE 플러그인 | 실시간 이벤트 푸시 |
| `frontend/lib/api.ts` | `packages/shared/types` | 타입 안전 API 호출 |
| `agent/sender.ts` | `packages/shared/types` | 전송 페이로드 타입 공유 |

---

## 3. Data Model

### 3.1 Entity 정의

```typescript
// packages/shared/src/types.ts

// 파싱된 세션 (백엔드 내부 처리 단위)
interface ParsedSession {
  sessionId: string
  projectPath: string
  startedAt: Date
  endedAt: Date
  messages: ParsedMessage[]
  toolCalls: ParsedToolCall[]
}

interface ParsedMessage {
  uuid: string
  parentUuid: string | null
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isSidechain: boolean
}

interface ParsedToolCall {
  id: string          // tool_use_id
  name: string        // Read, Bash, Grep, Edit, Write, etc.
  input: Record<string, unknown>
  resultText: string
  isError: boolean
  timestamp: Date
}

// 비효율 패턴 검출 결과
interface Inefficiency {
  type: 'repeat-read' | 'failed-retry' | 'bash-antipattern' | 'context-waste'
  severity: 'high' | 'medium' | 'low'
  description: string
  evidence: string[]  // 근거 (파일경로, 도구호출ID 등)
  count: number
}

// 세션 요약 (DB 저장 + API 응답)
interface SessionSummary {
  sessionId: string
  projectPath: string
  startedAt: Date
  endedAt: Date
  durationMin: number
  taskType: 'bug-fix' | 'feature' | 'refactor' | 'exploration' | 'config'
  taskDescription: string
  inefficiencies: Inefficiency[]
  inefficiencyCount: number
  topFiles: string[]
  totalToolCalls: number
}
```

### 3.2 Entity 관계

```
[sessions] 1 ──── N [messages]
[sessions] 1 ──── N [tool_calls]
[sessions] 1 ──── N [inefficiencies]
[sessions] 1 ──── 1 [session_summaries]
[otel_spans] N (sessions와 sessionId로 연결, 느슨한 참조)
[weekly_reports] 1 ──── N (sessions 집계)
```

### 3.3 Prisma 스키마

```prisma
// apps/backend/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Session {
  id           String   @id @default(cuid())
  sessionId    String   @unique  // Claude Code 세션 UUID
  projectPath  String
  startedAt    DateTime
  endedAt      DateTime?
  durationMin  Float?
  taskType     String?  // bug-fix | feature | refactor | exploration | config
  taskDescription String?
  totalToolCalls Int    @default(0)
  inefficiencyCount Int @default(0)
  topFiles     String[] // 상위 10개 파일
  createdAt    DateTime @default(now())

  messages       Message[]
  toolCalls      ToolCall[]
  inefficiencies Inefficiency[]
  summary        SessionSummary?

  @@index([startedAt])
  @@index([taskType])
}

model Message {
  id         String   @id @default(cuid())
  sessionId  String
  uuid       String
  parentUuid String?
  role       String   // user | assistant
  content    String   // 마스킹 적용 후
  timestamp  DateTime
  isSidechain Boolean @default(false)

  session Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
}

model ToolCall {
  id         String   @id @default(cuid())
  sessionId  String
  toolUseId  String   // tool_use_id (원본)
  name       String   // Read, Bash, Grep, etc.
  input      Json
  resultText String?  // 마스킹 적용 후
  isError    Boolean  @default(false)
  timestamp  DateTime

  session Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
  @@index([name])
}

model Inefficiency {
  id          String   @id @default(cuid())
  sessionId   String
  type        String   // repeat-read | failed-retry | bash-antipattern | context-waste
  severity    String   // high | medium | low
  description String
  evidence    String[]
  count       Int      @default(1)
  createdAt   DateTime @default(now())

  session Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
  @@index([type])
}

model SessionSummary {
  id        String   @id @default(cuid())
  sessionId String   @unique
  raw       Json     // SessionSummary 전체 JSON
  createdAt DateTime @default(now())

  session Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}

model OtelSpan {
  id         String   @id @default(cuid())
  sessionId  String?  // 연결 가능하면 매핑, 아니면 null
  spanType   String   // metric | log
  name       String
  value      Float?
  attributes Json
  timestamp  DateTime
  createdAt  DateTime @default(now())

  @@index([sessionId])
  @@index([spanType, timestamp])
}

model WeeklyReport {
  id          String   @id @default(cuid())
  weekStart   DateTime @unique  // 해당 주 월요일 00:00 UTC
  insights    Json     // LLM 생성 인사이트 배열 (≥3개)
  stats       Json     // 세션 수, 총 비효율 건수, 타입별 분포
  generatedAt DateTime @default(now())

  @@index([weekStart])
}
```

---

## 4. API Specification

### 4.1 엔드포인트 목록

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/v1/metrics` | OTLP HTTP 메트릭 수신 (protobuf) | API Key |
| POST | `/v1/logs` | OTLP HTTP 로그 수신 (protobuf) | API Key |
| POST | `/ingest/transcript` | 트랜스크립트 JSONL 수신 | API Key |
| GET | `/sessions` | 세션 목록 (페이지네이션 + 필터) | API Key |
| GET | `/sessions/:id` | 세션 상세 (비효율 + 도구호출 포함) | API Key |
| GET | `/insights/weekly` | 최신 주간 리포트 | API Key |
| GET | `/insights/weekly/:weekStart` | 특정 주 리포트 | API Key |
| POST | `/insights/weekly/generate` | 주간 리포트 수동 생성 | API Key |
| GET | `/events` | SSE 스트림 (신규 세션 분석 완료 이벤트) | API Key |
| GET | `/health` | 헬스체크 | 없음 |

**인증**: 모든 보호 엔드포인트에 `X-API-Key: <API_KEY>` 헤더 필수

### 4.2 상세 스펙

#### `POST /ingest/transcript`

**Request:**
```json
{
  "sessionId": "uuid",
  "projectPath": "/Users/user/projects/myapp",
  "lines": [
    { "uuid": "...", "parentUuid": null, "type": "user", "message": {...}, "timestamp": "..." },
    { "uuid": "...", "parentUuid": "...", "type": "assistant", "message": {...}, "timestamp": "..." }
  ],
  "agentVersion": "1.0.0"
}
```

**Response (202 Accepted):**
```json
{
  "data": { "queued": true, "sessionId": "uuid" }
}
```

#### `GET /sessions`

**Query Params:**
- `page` (default: 1), `limit` (default: 20, max: 100)
- `taskType`: `bug-fix | feature | refactor | exploration | config`
- `hasInefficiency`: `true | false`
- `from`, `to`: ISO 8601 날짜 범위

**Response (200):**
```json
{
  "data": [
    {
      "id": "cuid",
      "sessionId": "uuid",
      "projectPath": "...",
      "startedAt": "2026-04-16T10:00:00Z",
      "durationMin": 42,
      "taskType": "feature",
      "taskDescription": "JWT 인증 구현",
      "inefficiencyCount": 3,
      "totalToolCalls": 87
    }
  ],
  "meta": { "total": 150, "page": 1, "limit": 20, "totalPages": 8 }
}
```

#### `GET /sessions/:id`

**Response (200):**
```json
{
  "data": {
    "session": { ...SessionSummary },
    "inefficiencies": [
      {
        "type": "repeat-read",
        "severity": "high",
        "description": "src/auth/jwt.ts 파일을 5회 반복 Read",
        "evidence": ["toolu_01abc (Read)", "toolu_02def (Read)", "..."],
        "count": 5
      }
    ],
    "toolCallTimeline": [
      { "name": "Read", "input": { "file_path": "..." }, "isError": false, "timestamp": "..." }
    ],
    "otelMetrics": {
      "totalTokens": 45200,
      "avgLatencyMs": 1840
    }
  }
}
```

#### `GET /events` (SSE)

```
Content-Type: text/event-stream

event: session.analyzed
data: {"sessionId": "uuid", "inefficiencyCount": 3, "taskType": "feature"}

event: heartbeat
data: {}
```

**Error Responses (공통):**
- `400 Bad Request`: `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": { "fieldErrors": {} } } }`
- `401 Unauthorized`: `{ "error": { "code": "UNAUTHORIZED", "message": "Invalid or missing API key" } }`
- `404 Not Found`: `{ "error": { "code": "NOT_FOUND", "message": "..." } }`
- `500 Internal Server Error`: `{ "error": { "code": "INTERNAL_ERROR", "message": "..." } }`

---

## 5. UI/UX Design

### 5.0 UI 프레임워크 결정

| 항목 | 선택 | 이유 |
|------|------|------|
| CSS | **Tailwind CSS v4** | utility-first, shadcn과 통합 용이 |
| UI 컴포넌트 | **shadcn/ui** (`packages/ui/`) | Turborepo 공유 패키지로 중앙 관리, apps/frontend에서 import |
| 차트 | **Recharts** | React 친화적, BarChart/LineChart 충분 |
| 디자인 시스템 | **DESIGN.md** | Warp 영감 — warm dark, Matter 타입, 모노크로매틱 팔레트 |
| 디자인 작업 | **/impeccable:impeccable** | 모든 UI 구현/개선 시 필수 사용 |

**Tailwind 컬러 토큰 (DESIGN.md 기준):**

```js
// tailwind.config.js
colors: {
  "warm-parchment": "#faf9f6",   // 주요 텍스트
  "ash-gray":       "#afaeac",   // 본문 텍스트
  "stone-gray":     "#868584",   // 보조 텍스트
  "earth-gray":     "#353534",   // 버튼 배경
  "muted-purple":   "#666469",   // 링크
}
```

> **중요**: 위 색상 토큰 외 임의 색상 사용 금지. 비효율 타입별 배지 색상도 이 팔레트 내에서만.

### 5.1 화면 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│  🔬 Refinery                              [주간리포트] [세션] │
├──────────────────────────────────────────────────────────────┤
│  홈 (/) — 주간 리포트                                        │
│  ┌─────────────────────────┐  ┌──────────────────────────┐  │
│  │ 이번 주 인사이트 카드    │  │ 세션 트렌드 차트          │  │
│  │ - 비효율 TOP 3           │  │ (일별 세션수 + 비효율건수) │  │
│  │ - 주요 개선 포인트       │  └──────────────────────────┘  │
│  └─────────────────────────┘                                │
│                                                              │
│  세션 (/sessions) — 세션 목록                                │
│  [타입 필터▼] [비효율만▼] [날짜범위]  총 N개                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 2026-04-16  feature  "JWT 인증"  87호출  비효율3건    │   │
│  │ 2026-04-15  bug-fix  "메모리 누수 수정"  45호출  0건  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  세션 상세 (/sessions/:id)                                   │
│  ┌──────────┐  ┌──────────────────────────────────────────┐ │
│  │ 요약 패널 │  │ 도구 호출 타임라인                        │ │
│  │ 작업유형  │  │ [Read] [Bash] [Edit] [Read] [Grep] ...   │ │
│  │ 비효율 ❗ │  └──────────────────────────────────────────┘ │
│  └──────────┘  ┌──────────────────────────────────────────┐ │
│                │ OTel 메트릭 (토큰 수, 레이턴시)            │ │
│                └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 User Flow

```
홈(주간리포트) → 세션 목록 → 세션 상세 → 비효율 상세 보기
                     ↑
              SSE 신규 세션 자동 갱신
```

### 5.3 컴포넌트 목록

| Component | 위치 | 역할 | 기반 |
|-----------|------|------|------|
| `session-card.tsx` | `apps/frontend/components/` | 세션 목록 카드 | `packages/ui` Card |
| `inefficiency-badge.tsx` | `apps/frontend/components/` | 비효율 타입별 색상 배지 | `packages/ui` Badge |
| `weekly-insight-card.tsx` | `apps/frontend/components/` | 주간 인사이트 카드 | `packages/ui` Card |
| `tool-call-timeline.tsx` | `apps/frontend/components/` | 도구 호출 순서 시각화 | 직접 작성 |
| `metric-chart.tsx` | `apps/frontend/components/` | OTel 토큰/레이턴시 차트 | Recharts |
| `session-filter.tsx` | `apps/frontend/components/` | 타입/날짜/비효율 필터 패널 | `packages/ui` Select, Input |

> **원칙**: `apps/frontend/components/`의 모든 컴포넌트는 `packages/ui/` shadcn 컴포넌트를 조합해서 만든다. 직접 HTML 요소로 UI를 처음부터 작성하지 않는다.

### 5.4 Page UI Checklist

#### 홈 페이지 (`/`)

- [ ] 주간 인사이트 카드: 이번 주 인사이트 ≥ 3개 리스트
- [ ] 주간 통계 요약: 총 세션 수, 총 비효율 건수, 가장 많은 비효율 타입
- [ ] 세션 트렌드 차트: 최근 7일 일별 세션 수 + 비효율 건수 (recharts BarChart)
- [ ] "주간 리포트 생성" 버튼 (LLM 인사이트 미존재 시 활성화)
- [ ] 최근 세션 5개 미리보기 카드

#### 세션 목록 페이지 (`/sessions`)

- [ ] 필터: 작업 유형 드롭다운 (5 옵션: bug-fix, feature, refactor, exploration, config + 전체)
- [ ] 필터: 비효율 있음/없음 토글
- [ ] 필터: 날짜 범위 입력 (from, to)
- [ ] 총 세션 수 표시
- [ ] 세션 카드: 날짜/시간, 작업 유형 배지, 작업 설명 (최대 60자), 도구 호출 수, 비효율 건수 배지
- [ ] 비효율 타입별 색상 배지 (repeat-read: 주황, failed-retry: 빨강, bash-antipattern: 노랑, context-waste: 파랑)
- [ ] 페이지네이션 컨트롤 (이전/다음/페이지 번호)
- [ ] SSE 신규 세션 수신 시 상단 알림 배너 ("새 세션 1개 분석 완료 — 새로고침")

#### 세션 상세 페이지 (`/sessions/:id`)

- [ ] 세션 헤더: 세션 ID, 프로젝트 경로, 시작/종료 시간, 소요 시간
- [ ] 작업 유형 배지 + 작업 설명
- [ ] 비효율 목록: 각 항목에 타입, 심각도(high/medium/low), 설명, 근거 토글 (접기/펼치기)
- [ ] 비효율 건수 요약 (타입별 건수 표)
- [ ] 도구 호출 타임라인: 도구명, 입력 파미리보기(50자), 오류 여부, 타임스탬프
- [ ] OTel 보조 섹션: 총 토큰 수, 평균 레이턴시 (OTel 데이터 없으면 숨김)
- [ ] "목록으로 돌아가기" 링크

---

## 6. Error Handling

### 6.1 에러 코드 정의

| Code | HTTP | 원인 | 처리 |
|------|------|------|------|
| `UNAUTHORIZED` | 401 | API Key 없음/불일치 | 클라이언트 키 확인 안내 |
| `VALIDATION_ERROR` | 400 | 요청 형식 오류 | fieldErrors 상세 반환 |
| `NOT_FOUND` | 404 | 세션/리포트 없음 | 빈 상태 UI |
| `PARSE_ERROR` | 422 | JSONL 파싱 실패 | 해당 파일 스킵, 나머지 계속 |
| `INTERNAL_ERROR` | 500 | 서버 오류 | 로그 기록, 사용자에게 재시도 안내 |
| `OTLP_DECODE_ERROR` | 422 | protobuf 디코딩 실패 | 스팬 드롭, 경고 로그 |

### 6.2 에러 응답 형식

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "요청 데이터가 올바르지 않습니다",
    "details": {
      "fieldErrors": {
        "sessionId": "Required",
        "lines": "Must be an array"
      }
    }
  }
}
```

### 6.3 트랜스크립트 파이프라인 에러 처리

```
수신 실패 → 202 반환 안 함 → 에이전트 재시도 큐로 복귀
파싱 실패 → 해당 세션 스킵, error 로그, DB에 failed_sessions 기록
분류 실패 → taskType = 'exploration' 기본값으로 계속
검출기 실패 → 해당 검출기 결과 제외, 나머지 비효율은 저장
LLM 실패  → 주간 리포트 생성 중단, 수동 재시도 가능
```

---

## 7. Security Considerations

- [x] **API Key 인증**: 모든 엔드포인트 `X-API-Key` 헤더 검증 (Fastify preHandler)
- [x] **Cloudflare Access**: 터널 앞단 OAuth 이중 보호 (v1에서는 선택적)
- [x] **마스킹 우선**: 에이전트 로컬 1차 마스킹 → 서버 수신 직후 2차 마스킹 후 저장
- [x] **시크릿 탐지**: regex 패턴 (AWS Key, GitHub Token, JWT, 고엔트로피 문자열) + `REDACTED` 치환
- [x] **OTLP 프롬프트 제외**: `OTEL_LOG_USER_PROMPTS` 미설정 시 사용자 입력 내용 미포함
- [ ] **Rate Limiting**: `/ingest/transcript` 에 IP당 60 req/min 제한 (Fastify rate-limit 플러그인)
- [ ] **Input Validation**: Zod 스키마로 모든 수신 데이터 검증
- [ ] **Data Retention**: 기본 90일 이후 자동 삭제 (PostgreSQL cron + `RETENTION_DAYS` 설정)

---

## 8. Test Plan

### 8.1 테스트 범위

| 유형 | 대상 | 도구 | 단계 |
|------|------|------|------|
| L1: 단위 테스트 | parser, analyzer, masker 모듈 | Vitest | Do |
| L2: API 테스트 | Fastify 엔드포인트 | Fastify inject + Vitest | Do |
| L3: E2E | 에이전트 → 백엔드 → 대시보드 표시 | Playwright | Do |

### 8.2 L1: 핵심 단위 테스트

| # | 모듈 | 테스트 | 기대 결과 |
|---|------|--------|---------|
| 1 | `parser/masker` | AWS Access Key 패턴 마스킹 | `[REDACTED]` 치환 확인 |
| 2 | `parser/masker` | GitHub Token 패턴 마스킹 | `[REDACTED]` 치환 확인 |
| 3 | `parser/masker` | 고엔트로피 문자열 탐지 | `[REDACTED]` 치환 확인 |
| 4 | `parser/transcript` | 정상 JSONL 파싱 | ParsedSession 구조 검증 |
| 5 | `parser/transcript` | isSidechain=true 라인 필터링 | 서브에이전트 메시지 제외 |
| 6 | `parser/transcript` | tool_use ↔ tool_result 매핑 | toolUseId 기준 연결 확인 |
| 7 | `analyzer/repeat-read` | 동일 파일 3회 Read | Inefficiency 반환 |
| 8 | `analyzer/repeat-read` | 동일 파일 2회 Read | Inefficiency 미반환 |
| 9 | `analyzer/failed-retry` | 동일 도구 실패 후 3회 재시도 | Inefficiency 반환 |
| 10 | `analyzer/bash-antipattern` | `Bash: cat /file` | Read 대체 제안 반환 |
| 11 | `analyzer/bash-antipattern` | `Bash: grep pattern /path` | Grep 대체 제안 반환 |
| 12 | `parser/classifier` | tool 호출 패턴으로 분류 | taskType 정확도 검증 |

### 8.3 L2: API 테스트

| # | 엔드포인트 | 메서드 | 테스트 | 기대 상태 |
|---|-----------|--------|--------|---------|
| 1 | `/ingest/transcript` | POST | 유효한 페이로드 | 202 + `queued: true` |
| 2 | `/ingest/transcript` | POST | API Key 누락 | 401 |
| 3 | `/ingest/transcript` | POST | 잘못된 JSON | 400 + fieldErrors |
| 4 | `/sessions` | GET | 인증 후 목록 조회 | 200 + data 배열 + meta |
| 5 | `/sessions` | GET | taskType=feature 필터 | 200 + feature 세션만 |
| 6 | `/sessions/:id` | GET | 존재하는 세션 | 200 + inefficiencies 포함 |
| 7 | `/sessions/:id` | GET | 없는 세션 | 404 |
| 8 | `/events` | GET | SSE 연결 | 200 + text/event-stream |
| 9 | `/v1/metrics` | POST | OTLP protobuf | 200 |
| 10 | `/health` | GET | 인증 없이 | 200 + `{ status: "ok" }` |

### 8.4 L3: E2E 시나리오

| # | 시나리오 | 단계 | 성공 기준 |
|---|---------|------|---------|
| 1 | 첫 세션 수집 | 트랜스크립트 POST → `/sessions` 목록 확인 | 세션 카드 1개 표시 |
| 2 | 비효율 탐지 | 반복 Read 포함 트랜스크립트 → 세션 상세 확인 | repeat-read 배지 표시 |
| 3 | 주간 리포트 | POST `/insights/weekly/generate` → 홈 확인 | 인사이트 ≥ 3개 표시 |
| 4 | SSE 갱신 | 새 세션 수신 → 세션 목록 페이지 | 상단 알림 배너 표시 |

### 8.5 Seed Data

| Entity | 최소 수 | 필수 필드 |
|--------|:------:|---------|
| Session | 5 | sessionId, projectPath, startedAt, taskType |
| Inefficiency | 3 | sessionId, type, severity, description |
| WeeklyReport | 1 | weekStart, insights (≥3개), stats |

---

## 9. Clean Architecture (레이어 할당)

### 9.1 Backend 레이어 구조

| 레이어 | 역할 | 위치 |
|--------|------|------|
| **Presentation** | Fastify 라우트, 요청/응답 직렬화 | `src/api/`, `src/ingest/` |
| **Application** | 비즈니스 로직, 파이프라인 조율 | `src/parser/`, `src/analyzer/`, `src/insight/` |
| **Infrastructure** | Prisma DB, Claude API 클라이언트 | `src/db/`, `src/insight/llm.ts` |
| **Shared Types** | 엔티티 타입 | `packages/shared/src/types.ts` |

### 9.2 의존성 규칙

```
Presentation (api/, ingest/)
  → Application (parser/, analyzer/, insight/)
    → Infrastructure (db/, llm.ts)
    → Shared Types (packages/shared)
```

**규칙**: `api/` 라우트는 Prisma 직접 호출 금지. `db/` 모듈을 통해서만 접근.

---

## 10. Coding Convention

### 10.0 ESLint + Prettier 설정

**패키지:**
```
eslint
@typescript-eslint/eslint-plugin
@typescript-eslint/parser
eslint-plugin-import
eslint-plugin-tailwindcss
prettier
prettier-plugin-tailwindcss
eslint-config-prettier
```

**ESLint 주요 규칙 (`eslint.config.js`):**
```js
// import order
"import/order": ["error", {
  "groups": ["builtin", "external", "internal", "parent", "sibling", "index"],
  "newlines-between": "always",
  "alphabetize": { "order": "asc" }
}]

// Tailwind
"tailwindcss/classnames-order": "error",     // 클래스 순서 강제
"tailwindcss/no-custom-classname": "error",  // 토큰 외 임의 클래스 금지
"tailwindcss/no-contradicting-classname": "error"
```

**Prettier (`prettier.config.js`):**
```js
{
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindConfig: "./apps/frontend/tailwind.config.js",
  semi: false,
  singleQuote: true,
  printWidth: 100
}
```

> Turborepo 루트에 공유 설정 패키지 `packages/config-eslint/`, `packages/config-prettier/` 로 관리.

### 10.1 네이밍 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 변수/함수 | camelCase | `parseTranscript()`, `sessionId` |
| 클래스/컴포넌트 | PascalCase | `SessionCard`, `MaskerService` |
| 상수 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `RETENTION_DAYS` |
| 파일 (모듈) | kebab-case.ts | `repeat-read.ts`, `session-summary.ts` |
| 파일 (컴포넌트) | PascalCase.tsx | `SessionCard.tsx` |
| DB 컬럼 | snake_case | `session_id`, `created_at` |
| API 응답 키 | camelCase | `sessionId`, `inefficiencyCount` |

### 10.2 API 응답 표준

```typescript
// 성공
{ "data": T, "meta"?: PaginationMeta }
// 에러
{ "error": { "code": string, "message": string, "details"?: object } }
```

### 10.3 환경변수 규칙

| Prefix/변수 | 목적 | 예시 |
|------------|------|------|
| `DATABASE_` | DB 연결 | `DATABASE_URL` |
| `OTLP_` | OTLP 설정 | `OTLP_HTTP_PORT` |
| `API_KEY` | 백엔드/프론트/에이전트 공유 인증 키 | `API_KEY` |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare Tunnel 인증 토큰 | `CLOUDFLARE_TUNNEL_TOKEN` |
| `ANTHROPIC_` | LLM | `ANTHROPIC_API_KEY` |
| `RETENTION_DAYS` | 데이터 보존 기간 (기본 90) | `RETENTION_DAYS=90` |
| `NEXT_PUBLIC_` | 프론트 클라이언트 노출 | `NEXT_PUBLIC_API_URL` |
| `CC_INSIGHTS_` | 에이전트 설정 | `CC_INSIGHTS_SERVER` |

---

## 11. Implementation Guide

### 11.1 파일 구조 (핵심 파일)

위 §2.3 모노레포 구조 참조.

### 11.2 구현 순서

1. [ ] **Phase 1 (인프라)**: Turborepo 초기화, pnpm workspace, packages/shared 타입 정의, Docker Compose, PostgreSQL, Prisma 스키마 마이그레이션, Fastify/Next.js 기본 프레임
2. [ ] **Phase 2 (수신 레이어)**: OTLP HTTP/protobuf 수신기, 트랜스크립트 수신 API, API Key 인증 미들웨어, 마스킹 기초
3. [ ] **Phase 3 (파서/분류기)**: JSONL → ParsedSession 파서, isSidechain 필터, tool_use↔tool_result 매핑, 의미적 분류기
4. [ ] **Phase 4 (검출기)**: 비효율 4종 검출기 (repeat-read, failed-retry, bash-antipattern, context-waste), 세션 요약 생성
5. [ ] **Phase 5 (API)**: REST 엔드포인트, SSE 스트림, Zod 검증, 페이지네이션
6. [ ] **Phase 6 (프론트엔드)**: 세션 목록/상세 페이지, 주간 리포트, SSE 훅, recharts 차트
7. [ ] **Phase 7 (에이전트)**: chokidar 감시 데몬, 로컬 큐+재시도, `npx` CLI init, launchd/systemd 등록
8. [ ] **Phase 8 (LLM, 선택)**: Claude API BYOK 주간 인사이트 생성

### 11.3 Session Guide

#### Module Map

| Module | Scope Key | 설명 | 예상 턴 |
|--------|-----------|------|:-------:|
| 인프라 + 타입 | `module-1` | Turborepo 초기화, shared types, Docker Compose, Prisma 스키마 | 20-25 |
| 수신 레이어 + 마스킹 | `module-2` | OTLP 수신기, transcript 수신 API, API Key 인증, masker.ts | 25-30 |
| 파서 + 분류기 | `module-3` | JSONL 파서, tool_use 매핑, 의미적 분류기 | 20-25 |
| 비효율 검출기 + 요약 | `module-4` | 4종 검출기, session-summary, DB 저장 | 25-30 |
| REST API + SSE | `module-5` | 세션/인사이트 엔드포인트, SSE 스트림, Zod 검증 | 20-25 |
| 프론트엔드 대시보드 | `module-6` | Next.js 페이지 3개, 컴포넌트 6개, SSE 훅 | 30-35 |
| 에이전트 데몬 | `module-7` | watcher, sender, 큐, CLI init | 20-25 |
| LLM 인사이트 (선택) | `module-8` | Claude API, weekly-report, 주간 리포트 생성 | 15-20 |

#### Recommended Session Plan

| 세션 | Phase | Scope | 예상 턴 |
|------|-------|-------|:-------:|
| Session 1 | Plan + Design | 전체 | 30-35 |
| Session 2 | Do | `--scope module-1` (인프라) | 20-25 |
| Session 3 | Do | `--scope module-2,module-3` (수신+파서) | 45-55 |
| Session 4 | Do | `--scope module-4,module-5` (검출기+API) | 45-55 |
| Session 5 | Do | `--scope module-6` (프론트엔드) | 30-35 |
| Session 6 | Do | `--scope module-7` (에이전트) | 20-25 |
| Session 7 | Check + Report | 전체 | 30-40 |

> LLM 인사이트(module-8)는 선택 사항이므로 별도 세션 또는 Session 6에 포함

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-16 | Initial draft (Option C Pragmatic + Turborepo) | jeonbg@kakao.com |
