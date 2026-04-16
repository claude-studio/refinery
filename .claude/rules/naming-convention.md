---
description: 파일명/폴더명 kebab-case 강제 규칙 (전체 프로젝트)
---

# Naming Convention

## 파일/폴더명 — kebab-case 필수

모든 파일과 폴더는 kebab-case로 작성한다.

```
# 올바른 예
apps/frontend/components/session-card.tsx
apps/frontend/components/inefficiency-badge.tsx
apps/backend/src/analyzer/repeat-read.ts
apps/backend/src/insight/session-summary.ts
packages/shared/src/types.ts

# 금지
SessionCard.tsx         ← PascalCase 파일명 금지
repeatRead.ts           ← camelCase 파일명 금지
SessionSummary.ts       ← PascalCase 파일명 금지
```

## 예외 없음

- Next.js App Router 파일도 동일: `page.tsx`, `layout.tsx`, `[id]/page.tsx` (Next.js 규약은 유지)
- shadcn/ui 설치 시 생성되는 파일 이름도 kebab-case 확인 후 필요하면 rename

## 코드 내부 (파일명과 무관)

- React 컴포넌트 함수명: PascalCase (`export function SessionCard`)
- 일반 함수/변수: camelCase (`parseTranscript`, `sessionId`)
- 상수: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- TypeScript 타입/인터페이스: PascalCase (`SessionSummary`, `Inefficiency`)
