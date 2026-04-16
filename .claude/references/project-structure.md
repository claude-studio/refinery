# 프로젝트 구조

Claude Code 세션 트랜스크립트 분석 + OTel 수집 백엔드 + Next.js 대시보드.
Turborepo 모노레포, Docker Compose 홈서버 배포.

```
apps/backend/   — Fastify (OTLP 수신 + 트랜스크립트 분석 + REST API)
apps/frontend/  — Next.js (대시보드 UI)
apps/agent/     — 개발PC 실행 에이전트 (파일 감시 + 전송)
packages/shared/ — 공통 타입
packages/ui/    — shadcn/ui 컴포넌트 (apps/frontend에서 @refinery/ui로 import)
```
