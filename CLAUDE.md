# Refinery — Claude Code Project Guide

## Project Overview

Claude Code 세션 트랜스크립트 분석 + OTel 수집 백엔드 + Next.js 대시보드.
Turborepo 모노레포, Docker Compose 홈서버 배포.

```
apps/backend/   — Fastify (OTLP 수신 + 트랜스크립트 분석 + REST API)
apps/frontend/  — Next.js (대시보드 UI)
apps/agent/     — 개발PC 실행 에이전트 (파일 감시 + 전송)
packages/shared/ — 공통 타입
packages/ui/    — shadcn/ui 컴포넌트 (apps/frontend에서 @refinery/ui로 import)
```

## 필수 규칙

- 파일명/폴더명은 **반드시 kebab-case** (`session-card.tsx`, `repeat-read.ts`)
- UI는 `DESIGN.md` 토큰만 사용. 명시되지 않은 색상/폰트/간격 금지
- 컴포넌트는 **직접 작성 금지** — `packages/ui/`에 shadcn/ui 설치 후 `@refinery/ui/components/<name>`으로 import
- DB 접근은 `apps/backend/src/db/client.ts` 경유만 허용. 라우트에서 Prisma 직접 호출 금지

## UI 작업 — impeccable 스킬 필수

모든 UI 구현/개선/리뷰는 `/impeccable:impeccable` 스킬을 사용한다.

| 작업 | 사용 커맨드 |
|------|------------|
| 새 UI 기능 구현 | `/impeccable:impeccable` |
| 레이아웃 개선 | `/impeccable:layout` |
| 디자인 비평/검토 | `/impeccable:critique` |
| 인터랙션 추가 | `/impeccable:animate` |
| 색상 추가 | `/impeccable:colorize` |
| 최종 품질 점검 | `/impeccable:polish` |

> impeccable 없이 UI 코드를 직접 작성하지 않는다. 항상 스킬을 먼저 실행한다.

## Tech Stack

- **Backend**: Fastify, Prisma, PostgreSQL, Zod, @anthropic-ai/sdk
- **Frontend**: Next.js (App Router), Tailwind CSS v4, shadcn/ui, Recharts
- **Agent**: Node.js, chokidar, tsx
- **Infra**: Turborepo, pnpm workspace, Docker Compose, Cloudflare Tunnel
- **Quality**: TypeScript strict, ESLint (import-order + tailwindcss rules), Prettier (prettier-plugin-tailwindcss)

## API 응답 표준

```ts
// 성공
{ data: T, meta?: PaginationMeta }
// 에러
{ error: { code: string, message: string, details?: object } }
```

## 에러 해결 원칙

에러가 발생하면 반드시 공식 문서를 확인하여 근본 원인을 해결한다.

**금지 행동**
- 에러 메시지를 유추해서 임시 수정
- 공식 문서 확인 없이 설정·코드 변경
- 에러를 우회(suppress·disable·ignore)하는 방식으로 해결
- 경고를 에러가 아니라는 이유로 그냥 통과 처리

**필수 절차**
1. 에러 메시지에서 라이브러리·도구 이름과 버전을 식별
2. `mcp__plugin_context7_context7__resolve-library-id` → `mcp__plugin_context7_context7__query-docs` 로 해당 버전 공식 문서 확인
3. 문서에서 확인한 정확한 설정·API로만 수정
4. 수정 후 같은 에러가 재현되지 않는지 직접 실행으로 검증

**적용 범위**: 빌드 오류, 타입 오류, 린트 오류, 런타임 오류, Docker 빌드 오류 모두 포함

## 설계 문서

- Plan: `docs/01-plan/features/cc-otel-session-insights.plan.md`
- Design: `docs/02-design/features/cc-otel-session-insights.design.md`
- Design System: `DESIGN.md`
