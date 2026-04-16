# cc-otel-session-insights Planning Document

> **Summary**: Claude Code 세션 트랜스크립트 분석 + OTel 수집 백엔드와 Next.js 대시보드 프론트엔드
>
> **Project**: refinery
> **Version**: 0.1.0
> **Author**: jeonbg@kakao.com
> **Date**: 2026-04-16
> **Status**: Draft (v0.2 — Backend+Frontend 구조 반영)

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | Claude Code 사용자는 세션에서 어떤 작업을 했는지, 어떤 비효율(반복 Read, 실패 도구 호출 반복, Bash 안티패턴, 컨텍스트 낭비)이 있었는지 객관적으로 파악할 수 없다. |
| **Solution** | Fastify 백엔드가 OTLP 수신 + 트랜스크립트 분석을 담당하고, Next.js 프론트엔드가 대시보드를 제공한다. Docker Compose로 홈서버에서 함께 실행. |
| **Function/UX Effect** | 웹 대시보드로 세션 요약, 비효율 리포트, 주간 인사이트 시각화. 개발 PC → 홈서버로 OTel 스트리밍 + 트랜스크립트 동기화. |
| **Core Value** | "내가 Claude Code 세션에서 무엇을 했고, 어디서 비효율이 생겼는지 대시보드에서 바로 확인한다" |

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

### 1.1 Purpose

Claude Code 세션 데이터를 두 경로로 수집하여 대시보드에서 시각화한다:

1. **OTel 경로**: 개발 PC의 Claude Code → OTLP → 홈서버 백엔드 (토큰 수, 레이턴시, 도구 호출 횟수)
2. **트랜스크립트 경로**: 개발 PC의 `~/.claude/projects/**/*.jsonl` → 동기화 에이전트 → 홈서버 백엔드 (메시지 흐름, 의미적 작업 분류, 비효율 패턴)

백엔드는 수집·분석·API를 담당하고, 프론트엔드는 대시보드 UI를 담당한다.

### 1.2 시스템 구성도

```
[개발 PC]
  Claude Code
    ├─ OTEL_EXPORTER_OTLP_ENDPOINT=https://your-tunnel.domain/otlp
    │    └─→ [홈서버] Backend (Fastify) :4318 OTLP HTTP/protobuf
    └─ ~/.claude/projects/**/*.jsonl
         └─→ [에이전트 데몬] 파일 변경 감지 + 마스킹 + HTTP POST
                └─→ [홈서버] Backend API :3001/ingest/transcript

[홈서버] Docker Compose
  ├── backend (Fastify) :3001/:4318
  │     ├── OTLP HTTP/protobuf 수신기 (:4318, /v1/metrics + /v1/logs)
  │     ├── 트랜스크립트 분석 엔진
  │     ├── 비효율 패턴 검출기
  │     ├── REST API → Frontend
  │     └── PostgreSQL 연결
  ├── frontend (Next.js) :3000
  │     └── 대시보드 UI
  ├── db (PostgreSQL) :5432
  └── cloudflared (Cloudflare Tunnel)
```

### 1.3 Related Documents

- PRD: `docs/00-pm/cc-otel-session-insights.prd.md`
- OTel 스키마: Claude Code 공식 문서 참조

---

## 2. Scope

### 2.1 In Scope (v1)

**Backend (Fastify)**
- [ ] OTLP gRPC/HTTP 수신기 (포트 4317/4318)
- [ ] 트랜스크립트 수신 API (`POST /ingest/transcript`)
- [ ] 트랜스크립트 파서 (JSONL → 구조화 데이터, 메시지-도구호출 매핑)
- [ ] 의미적 작업 분류 엔진
- [ ] 비효율 패턴 검출기 4종 (반복 Read / 실패 반복 / Bash 안티패턴 / 컨텍스트 낭비)
- [ ] 세션 요약 생성
- [ ] 주간 인사이트 생성 (LLM BYOK)
- [ ] REST API (Frontend 제공)
- [ ] PII/시크릿 마스킹 (수신 즉시)
- [ ] PostgreSQL 저장

**Frontend (Next.js)**
- [ ] 세션 목록 + 세션 상세 대시보드
- [ ] 비효율 패턴 시각화 (차트/리스트)
- [ ] 주간 인사이트 리포트 뷰
- [ ] OTel 메트릭 보조 차트 (토큰 수, 레이턴시)
- [ ] 실시간 업데이트 (SSE 또는 폴링)

**에이전트 (개발 PC 실행)**
- [ ] 트랜스크립트 파일 변경 감지 (chokidar)
- [ ] 마스킹 전처리 후 백엔드로 HTTP POST
- [ ] 설치: `npx cc-insights-agent init --server http://homeserver:3001`

**인프라**
- [ ] Docker Compose (backend + frontend + db)
- [ ] 환경 변수 설정 가이드
- [ ] 홈서버 방화벽 포트 설정 가이드

### 2.2 Out of Scope (v1)

- 팀 멀티유저 / 인증 (단일 사용자 가정)
- SaaS 클라우드 배포
- 실시간 세션 인터셉트
- 자동 코드 수정
- Cursor / Copilot 등 타 도구 통합

---

## 3. Requirements

### 3.1 Functional Requirements

**Backend**

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | OTLP HTTP/protobuf 수신기 (포트 4318) — `POST /v1/metrics`, `POST /v1/logs` 수신 및 PostgreSQL 저장 | High | Pending |
| FR-02 | ~~OTLP gRPC 수신기 (포트 4317)~~ — §7.2 아키텍처 결정으로 HTTP/protobuf로 대체 | ~~Medium~~ | Superseded |
| FR-03 | `POST /ingest/transcript` — JSONL 수신, 마스킹 적용 후 파싱 파이프라인 실행 | High | Pending |
| FR-04 | 트랜스크립트 파서: 메시지 ↔ 도구 호출 정확 매핑 (tool_use/tool_result 블록 연결) | High | Pending |
| FR-05 | 의미적 작업 분류: 버그 수정 / 기능 개발 / 리팩토링 / 탐색 / 설정 | High | Pending |
| FR-06 | 비효율 검출 - 반복 Read: 세션 내 동일 파일 경로 3회+ Read 탐지 | High | Pending |
| FR-07 | 비효율 검출 - 실패 반복: 동일 도구+인자 조합 오류 후 3회+ 재시도 탐지 | High | Pending |
| FR-08 | 비효율 검출 - Bash 안티패턴: cat/grep/find → Read/Grep/Glob 대체 가능 판단 | High | Pending |
| FR-09 | 비효율 검출 - 컨텍스트 낭비: 이미 로드된 파일/정보 재로드 패턴 탐지 | Medium | Pending |
| FR-10 | 세션 요약 생성: 작업 목록 + 비효율 건수 + 주요 파일 목록 | High | Pending |
| FR-11 | 주간 인사이트 생성: Claude API (BYOK) 또는 로컬 모델, 인사이트 ≥ 3개 | Medium | Pending |
| FR-12 | PII/시크릿 마스킹: regex + high-entropy 탐지 → [REDACTED] 치환 (수신 즉시) | High | Pending |
| FR-13 | REST API: 세션 목록/상세, 비효율 목록, 주간 리포트, OTel 메트릭 엔드포인트 | High | Pending |
| FR-14 | SSE 엔드포인트 (`GET /events`) — 신규 세션 분석 완료 이벤트 실시간 푸시 | Medium | Pending |

**Frontend**

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-20 | 세션 목록 페이지: 날짜/작업유형/비효율건수 표시, 정렬/필터 | High | Pending |
| FR-21 | 세션 상세 페이지: 작업 분류, 비효율 패턴 목록, 도구 호출 타임라인 | High | Pending |
| FR-22 | 주간 리포트 뷰: 인사이트 카드, 트렌드 차트 | High | Pending |
| FR-23 | OTel 메트릭 차트: 세션별 토큰 수, 레이턴시 히스토그램 (보조) | Low | Pending |
| FR-24 | SSE 또는 폴링으로 신규 세션 자동 갱신 | Medium | Pending |

**에이전트 (개발 PC)**

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-30 | `~/.claude/projects/**/*.jsonl` 파일 변경 감지 (chokidar) | High | Pending |
| FR-31 | 신규/변경 트랜스크립트 → 마스킹 → `POST /ingest/transcript` 전송 | High | Pending |
| FR-32 | `npx cc-insights-agent init --server <URL>` 설치 + 데몬 등록 (launchd/systemd) | High | Pending |
| FR-33 | 전송 실패 시 로컬 큐 + 재시도 (지수 백오프) | Medium | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | 세션 분석 파이프라인 < 5초/세션 | 벤치마크 |
| Performance | API 응답 < 200ms (p95, DB 캐시 히트) | 측정 |
| Security | 시크릿 마스킹 recall ≥ 99% | 단위 테스트 |
| Security | 홈서버 API 접근: API Key 헤더 인증 (단일 사용자) | 수동 검증 |
| Reliability | 에이전트 재시작 후 미전송 큐 복구 | 오류 주입 테스트 |
| Reliability | 트랜스크립트 파싱 실패 시 해당 파일 스킵, 나머지 계속 처리 | 오류 주입 |
| Compatibility | Docker Compose, linux/amd64 + linux/arm64 (홈서버 호환) | CI 빌드 |
| Compatibility | Claude Code 2.1+ 트랜스크립트 포맷 | 포맷 회귀 테스트 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] Docker Compose `docker compose up` 한 번으로 백엔드+프론트엔드+DB 기동
- [ ] 에이전트 설치 후 새 Claude Code 세션 종료 시 대시보드에 자동 반영
- [ ] 비효율 패턴 4종 검출 + 세션 상세 페이지에 표시
- [ ] 주간 리포트 페이지 표시
- [ ] 시크릿 마스킹 테스트 통과 (recall ≥ 99%)

### 4.2 Quality Criteria

- [ ] 테스트 커버리지 ≥ 75% (파서/검출기 모듈)
- [ ] TypeScript strict mode 오류 0
- [ ] 린트 오류 0

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 트랜스크립트 전송 중 시크릿 노출 | Critical | Low | 에이전트에서 마스킹 먼저, 전송 후 서버에서 2차 마스킹 |
| 홈서버-개발PC 네트워크 단절 시 데이터 유실 | High | Medium | 에이전트 로컬 큐 + 재시도, 오프라인 내성 |
| 트랜스크립트 JSONL 스키마 변경 | High | Medium | 스키마 버전 감지 + 유연한 파서, 회귀 테스트 |
| 인사이트 품질 낮음 → 피로감 이탈 | High | Medium | Top 3만 노출, 피드백(좋아요/싫어요) 수집 |
| PostgreSQL 볼륨 과다 (장기 누적) | Medium | Medium | 데이터 보존 정책 (기본 90일), 자동 정리 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `~/.claude/projects/**/*.jsonl` | 외부 파일 (읽기 전용) | 에이전트가 읽어 서버로 전송 — 원본 수정 없음 |
| Claude Code `settings.json` | 읽기 전용 참조 | OTEL 환경변수 설정 가이드만, 직접 수정 안 함 |
| 홈서버 포트 3000, 3001, 4317, 4318, 5432 | 네트워크 | Docker Compose로 노출 |

### 6.2 Verification

- [ ] 에이전트가 트랜스크립트 읽기만 하는지 확인 (쓰기 경로 없음)
- [ ] 포트 충돌 없음 확인 (홈서버 기존 서비스)
- [ ] 마스킹 전 데이터 외부 전송 없음 검증

---

## 7. Architecture Considerations

### 7.1 Project Level

**Dynamic** — feature-based 모듈 구조. 백엔드/프론트엔드/에이전트 3개 패키지.

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| 백엔드 프레임워크 | Fastify / Hono / Express | **Fastify** | 고성능, TypeScript 친화, 플러그인 시스템 |
| 프론트엔드 | Next.js / React+Vite | **Next.js** | App Router, SSR, API Routes 활용 |
| DB | PostgreSQL / SQLite | **PostgreSQL** | Docker 환경, 장기 누적 데이터, 쿼리 성능 |
| ORM | Prisma / Drizzle / 직접 쿼리 | **Prisma** | 타입 안전, 마이그레이션 관리 |
| OTLP 수신 | gRPC 서버 내장 / HTTP 엔드포인트 | **HTTP/protobuf 엔드포인트** (`POST /v1/metrics`, `POST /v1/logs`) | gRPC 서버 직접 구현 대비 복잡도 대폭 감소. `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf` 설정으로 연동. |
| 실시간 업데이트 | WebSocket / SSE / 폴링 | **SSE** | 단방향 스트림, 구현 단순 |
| 에이전트 파일 감시 | chokidar / fs.watch | **chokidar** | 크로스플랫폼, 안정적 |
| LLM 연동 | @anthropic-ai/sdk | **@anthropic-ai/sdk** | BYOK, prompt caching |
| 컨테이너 | Docker Compose | **Docker Compose** | 홈서버 단일 머신 배포 |
| 모노레포 | Turborepo / pnpm workspace | **Turborepo** | 빌드 캐시, 파이프라인 최적화, pnpm workspace 포함 |
| 외부 접근 | 포트 직접 개방 / Cloudflare Tunnel | **Cloudflare Tunnel (cloudflared)** | 홈서버 포트 개방 불필요, HTTPS 자동, 외부 접근 가능 |
| 인증 | API Key만 / Cloudflare Access + API Key | **Cloudflare Access + API Key** | Cloudflare 앞단 OAuth(Google 등) + 백엔드 API Key 이중 보호 |
| 에이전트 전송 시점 | idle 감지 / 주기적 배치 | **주기적 배치 (5분마다)** | 구현 단순, 안정적 |

### 7.3 프로젝트 구조

```
refinery/
├── apps/
│   ├── backend/               # Fastify 백엔드
│   │   ├── src/
│   │   │   ├── ingest/        # 수신 레이어
│   │   │   │   ├── otlp.ts    # OTLP gRPC/HTTP 수신기
│   │   │   │   └── transcript.ts  # 트랜스크립트 수신 API
│   │   │   ├── parser/        # 트랜스크립트 파서
│   │   │   │   ├── transcript.ts
│   │   │   │   ├── classifier.ts
│   │   │   │   └── masker.ts
│   │   │   ├── analyzer/      # 비효율 패턴 검출기
│   │   │   │   ├── repeat-read.ts
│   │   │   │   ├── failed-retry.ts
│   │   │   │   ├── bash-antipattern.ts
│   │   │   │   └── context-waste.ts
│   │   │   ├── insight/       # 인사이트 생성
│   │   │   │   ├── session-summary.ts
│   │   │   │   ├── weekly-report.ts
│   │   │   │   └── llm.ts
│   │   │   ├── api/           # REST API 라우트
│   │   │   │   ├── sessions.ts
│   │   │   │   ├── insights.ts
│   │   │   │   └── events.ts  # SSE
│   │   │   └── db/            # Prisma 클라이언트
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── Dockerfile
│   │
│   ├── frontend/              # Next.js 프론트엔드
│   │   ├── app/
│   │   │   ├── page.tsx       # 대시보드 홈 (주간 리포트)
│   │   │   ├── sessions/
│   │   │   │   ├── page.tsx   # 세션 목록
│   │   │   │   └── [id]/page.tsx  # 세션 상세
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   └── Dockerfile
│   │
│   └── agent/                 # 개발 PC 실행 에이전트
│       ├── src/
│       │   ├── watcher.ts     # 파일 변경 감지
│       │   ├── masker.ts      # 로컬 마스킹
│       │   ├── sender.ts      # HTTP 전송 + 큐
│       │   └── cli.ts         # init 명령
│       └── package.json
│
├── docker-compose.yml       # backend + frontend + db + cloudflared
├── .env.example
└── pnpm-workspace.yaml
```

---

## 8. Convention Prerequisites

### 8.1 Conventions to Define

| Category | To Define | Priority |
|----------|-----------|:--------:|
| **Naming** | camelCase 변수/함수, PascalCase 컴포넌트, kebab-case 파일 | High |
| **API 응답 형식** | `{ data, error, meta }` 표준 래퍼 | High |
| **에러 처리** | Fastify error handler + Result 타입 내부 | Medium |
| **환경변수** | 백엔드/프론트 각각 `.env.local`, Docker는 `.env` | High |

### 8.2 Environment Variables

**Backend**

| Variable | Purpose | Default |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 | `postgresql://...` |
| `OTLP_HTTP_PORT` | OTLP HTTP/protobuf 수신 포트 | `4318` |
| `API_KEY` | 프론트엔드/에이전트 인증 키 | 랜덤 생성 |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare Tunnel 인증 토큰 | Cloudflare 대시보드에서 발급 |
| `ANTHROPIC_API_KEY` | LLM 인사이트 생성 (선택) | — |
| `RETENTION_DAYS` | 데이터 보존 기간 | `90` |

**Frontend**

| Variable | Purpose | Default |
|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | 백엔드 API URL | `http://backend:3001` |
| `API_KEY` | 백엔드 인증 키 | (백엔드와 동일) |

**Agent (개발 PC)**

| Variable | Purpose | Default |
|----------|---------|---------|
| `CC_INSIGHTS_SERVER` | 홈서버 백엔드 URL | `http://homeserver:3001` |
| `CC_INSIGHTS_API_KEY` | 인증 키 | — |
| `CC_TRANSCRIPT_DIR` | 트랜스크립트 경로 | `~/.claude/projects` |

**개발 PC Claude Code 설정**

```bash
# OTel 활성화 (필수)
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
# Cloudflare Tunnel 사용 시: 터널 도메인으로 변경
export OTEL_EXPORTER_OTLP_ENDPOINT=https://your-tunnel.domain/otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_HEADERS=X-API-Key=<API_KEY>

# 사용자 프롬프트 내용 포함 (선택, 기본은 redact)
# export OTEL_LOG_USER_PROMPTS=1
```

> 주의: `CLAUDE_CODE_ENABLE_TELEMETRY=1` 없으면 OTel export 안 됨 (공식 문서 확인)

---

## 9. Implementation Order (v1 Build Sequence)

1. **Phase 1 (인프라)**: Docker Compose (backend + frontend + db + cloudflared) + PostgreSQL + Prisma 스키마 + 기본 Fastify/Next.js 프레임
2. **Phase 2 (수신 레이어)**: OTLP 수신기 + 트랜스크립트 수신 API + 마스킹
3. **Phase 3 (파서/분류기)**: 트랜스크립트 파서 + 의미적 분류
4. **Phase 4 (검출기)**: 비효율 패턴 4종 + 세션 요약
5. **Phase 5 (API)**: REST API 엔드포인트 + SSE
6. **Phase 6 (프론트엔드)**: 세션 목록/상세 + 주간 리포트 UI
7. **Phase 7 (에이전트)**: 파일 감시 데몬 + 큐
8. **Phase 8 (LLM 인사이트, 선택)**: BYOK Claude API 연동

---

## 10. 확정된 결정 사항

| 항목 | 결정 | 이유 |
|------|------|------|
| **홈서버 인증** | Cloudflare Access + API Key 이중 보호 | Cloudflare 앞단 OAuth, 백엔드는 API Key |
| **트랜스크립트 전송 시점** | 주기적 배치 (5분마다) | 구현 단순, 안정적 |
| **ORM** | Prisma | 백엔드 입문자 친화, 타입 안전, 마이그레이션 자동 |
| **Next.js → Backend 통신** | 프론트에서 백엔드 직접 호출 | 불필요한 레이어 제거 |
| **외부 접근** | Cloudflare Tunnel (cloudflared) | 홈서버 포트 개방 불필요, HTTPS 자동 |
| **트랜스크립트 스키마** | 확인 완료 (아래 §10.1 참조) | 실제 파일 분석 완료 |

---

### 10.1 트랜스크립트 JSONL 실제 스키마 (확인 완료)

**파일 경로**: `~/.claude/projects/<경로-슬래시를-하이픈으로>/<세션UUID>.jsonl`

**각 라인 공통 필드**:
```
uuid, parentUuid, isSidechain, sessionId, type, timestamp, cwd, version, gitBranch
```

**라인 타입별 구조**:

| type | 설명 | 주요 필드 |
|------|------|---------|
| `permission-mode` | 세션 시작 시 권한 모드 | `permissionMode` |
| `user` | 사용자 메시지 | `message.role="user"`, `message.content=string` |
| `assistant` | AI 응답 | `message.content=array` (thinking/text/tool_use 항목 포함) |
| `attachment` | hook 이벤트 결과 | `attachment.type` (hook_success 등) |
| `summary` | 대화 요약 | — |

**tool_use 구조** (assistant content 배열 내):
```json
{
  "type": "tool_use",
  "id": "toolu_01...",
  "name": "Read",
  "input": { "file_path": "/path/to/file" }
}
```

**tool_result 구조** (user content 배열 내):
```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_01...",
  "content": [{ "type": "text", "text": "..." }]
}
```

**isSidechain: true** 라인은 서브에이전트 대화 → 분석 시 필터링

---

## 11. Next Steps

1. [ ] Design 문서 작성 (`cc-otel-session-insights.design.md`)
2. [x] 트랜스크립트 JSONL 실제 스키마 분석 완료 (§10.1)
3. [ ] Prisma 스키마 설계 (sessions, messages, tool_calls, inefficiencies, otel_spans)
4. [ ] Docker Compose 기본 골격 작성 (backend + frontend + db + cloudflared)
5. [ ] Cloudflare Tunnel 토큰 발급 (Cloudflare 대시보드)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-16 | Initial draft (CLI 중심) | jeonbg@kakao.com |
| 0.2 | 2026-04-16 | Backend(Fastify)+Frontend(Next.js)+Agent 구조로 전면 개정 | jeonbg@kakao.com |
| 0.3 | 2026-04-16 | Cloudflare Tunnel 추가, 미결정 사항 전부 확정, 트랜스크립트 스키마 문서화 | jeonbg@kakao.com |
