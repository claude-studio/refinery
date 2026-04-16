# Refinery

Claude Code 세션을 분석해서 비효율 패턴을 찾아주는 개인 대시보드.

홈서버에서 돌아가는 백엔드가 세션 데이터를 수집·분석하고, 웹 대시보드로 결과를 보여준다.

---

## 왜 만들었나

Claude Code를 하루 4시간 이상 쓰다 보면 나쁜 습관이 반복된다.

- 같은 파일을 세션 내에서 5번 Read
- `Bash: cat file.ts` — Read 쓰면 될 걸
- 실패한 도구 호출을 똑같이 3번 재시도
- 이미 로드한 정보를 다시 불러오는 낭비

이 패턴들을 인식하지 못한 채 반복한다. Refinery는 세션이 끝나면 자동으로 분석해서 대시보드에 보여준다.

---

## 동작 방식

데이터는 두 경로로 수집된다.

```
[개발 PC]
  Claude Code
    ├─ OTel (토큰 수, 레이턴시) ──────────────▶ Backend :4318
    └─ ~/.claude/projects/**/*.jsonl
         └─ Agent Daemon (5분마다)
              └─ 마스킹 후 HTTP POST ──────────▶ Backend :3001

[홈서버 — Docker Compose]
  backend   :3001 / :4318  — 수신 · 분석 · REST API · SSE
  frontend  :3000          — Next.js 대시보드
  db        :5432          — PostgreSQL
  cloudflared              — Cloudflare Tunnel (HTTPS 자동)
```

**OTel 경로**: 토큰 수, 레이턴시 같은 숫자 메트릭. Claude Code가 직접 내보낸다.

**트랜스크립트 경로**: 실제 대화 내용. 개발 PC의 에이전트 데몬이 JSONL 파일을 읽어서 서버로 보낸다. 서버는 파싱 → 분류 → 비효율 검출 → 요약 파이프라인을 돌린다.

---

## 검출하는 비효율 패턴

| 패턴 | 설명 |
|------|------|
| **반복 Read** | 세션 내 동일 파일을 3회 이상 Read |
| **실패 반복** | 동일 도구+인자 조합 오류 후 3회 이상 재시도 |
| **Bash 안티패턴** | `cat`, `grep`, `find` → Read/Grep/Glob으로 대체 가능한 경우 |
| **컨텍스트 낭비** | 이미 로드한 파일/정보를 다시 불러오는 패턴 |

---

## 기술 스택

| 영역 | 선택 |
|------|------|
| 모노레포 | Turborepo + pnpm workspace |
| 백엔드 | Fastify, Prisma, PostgreSQL, Zod |
| 프론트엔드 | Next.js (App Router), Tailwind CSS, shadcn/ui, Recharts |
| 에이전트 | Node.js, chokidar, tsx |
| LLM (선택) | @anthropic-ai/sdk (주간 인사이트 BYOK) |
| 인프라 | Docker Compose, Cloudflare Tunnel |

---

## 프로젝트 구조

```
refinery/
├── apps/
│   ├── backend/        # Fastify — OTLP 수신, 트랜스크립트 분석, REST API
│   ├── frontend/       # Next.js — 대시보드 UI
│   └── agent/          # 개발 PC 에이전트 — 파일 감시 + 서버 전송
├── packages/
│   ├── shared/         # 공통 타입 (ParsedSession, Inefficiency 등)
│   └── ui/             # shadcn/ui 컴포넌트 (@refinery/ui)
├── docker-compose.yml
├── turbo.json
└── .env.example
```

---

## 시작하기

### 1. 홈서버 — Docker Compose 실행

```bash
# 저장소 클론
git clone https://github.com/yourname/refinery.git
cd refinery

# 환경변수 설정
cp .env.example .env
# .env 편집: API_KEY, DATABASE_URL, CLOUDFLARE_TUNNEL_TOKEN 필수

# 실행
docker compose up -d
```

대시보드: `https://your-tunnel.domain` (또는 `http://homeserver:3000`)

### 2. 개발 PC — 에이전트 설치

```bash
npx cc-insights-agent init --server https://your-tunnel.domain
```

설치하면 launchd(Mac) 또는 systemd(Linux) 데몬으로 등록된다. 이후 자동 실행.

### 3. 개발 PC — OTel 활성화

`~/.bashrc` 또는 `~/.zshrc` 에 추가:

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_ENDPOINT=https://your-tunnel.domain/otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_HEADERS=X-API-Key=<API_KEY>
```

이후 Claude Code 세션을 사용하면 5분 내로 대시보드에 자동 반영된다.

---

## 환경변수

### 백엔드 (`.env`)

| 변수 | 설명 | 필수 |
|------|------|:----:|
| `DATABASE_URL` | PostgreSQL 연결 문자열 | ✅ |
| `API_KEY` | 프론트엔드/에이전트 인증 키 | ✅ |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare Tunnel 토큰 | ✅ |
| `OTLP_HTTP_PORT` | OTLP 수신 포트 (기본 `4318`) | |
| `ANTHROPIC_API_KEY` | 주간 인사이트 LLM 생성 (선택) | |
| `RETENTION_DAYS` | 데이터 보존 기간 (기본 `90`) | |

### 프론트엔드

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_API_URL` | 백엔드 URL (`http://backend:3001`) |
| `API_KEY` | 백엔드 인증 키 (백엔드와 동일) |

### 에이전트 (개발 PC)

| 변수 | 설명 |
|------|------|
| `CC_INSIGHTS_SERVER` | 홈서버 백엔드 URL |
| `CC_INSIGHTS_API_KEY` | 인증 키 |
| `CC_TRANSCRIPT_DIR` | 트랜스크립트 경로 (기본 `~/.claude/projects`) |

---

## 개발

```bash
# 의존성 설치
pnpm install

# 전체 개발 서버 실행
pnpm dev

# 백엔드만
pnpm --filter backend dev

# 프론트엔드만
pnpm --filter frontend dev

# 빌드
pnpm build

# 테스트
pnpm test

# 타입 체크
pnpm type-check
```

### DB 마이그레이션

```bash
cd apps/backend
pnpm prisma migrate dev
pnpm prisma generate
```

---

## 보안

- 에이전트가 트랜스크립트를 전송하기 전 **로컬에서 1차 마스킹** (AWS Key, GitHub Token, JWT 등)
- 서버 수신 즉시 **2차 마스킹** 후 DB 저장. 마스킹 전 데이터는 절대 저장되지 않는다
- Cloudflare Access로 앞단 OAuth 보호 (선택적)
- 단일 사용자 가정 — 팀 멀티유저/SaaS는 v1 범위 밖

---

## 문서

- [Plan 문서](docs/01-plan/features/cc-otel-session-insights.plan.md)
- [Design 문서](docs/02-design/features/cc-otel-session-insights.design.md)
- [Design System](DESIGN.md)
