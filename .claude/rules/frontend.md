---
description: 프론트엔드(Next.js) 코딩 규칙 및 보안 금지 행동 목록
paths:
  - "apps/frontend/**"
  - "packages/ui/**"
---

# Frontend Rules

## shadcn/ui — packages/ui 에서 관리

shadcn/ui 컴포넌트는 `packages/ui/` 패키지에서 중앙 관리한다.
`apps/frontend/`에 직접 shadcn 컴포넌트 설치 금지.

```
packages/ui/
  components/        ← shadcn/ui 컴포넌트 설치 위치 (src 없음)
    button.tsx
    card.tsx
    badge.tsx
    ...
  lib/
    utils.ts
  components.json    ← shadcn 설정
  package.json       ← name: "@refinery/ui"
```

**components.json 설정:**
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "../../apps/frontend/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@refinery/ui/components",
    "utils": "@refinery/ui/lib/utils"
  }
}
```

**설치 방법:**
```bash
# packages/ui 디렉토리에서 실행
cd packages/ui
npx shadcn add button
npx shadcn add card
npx shadcn add badge
```

**사용 방법 (apps/frontend):**
```ts
import { Button } from '@refinery/ui/components/button'
import { Card } from '@refinery/ui/components/card'
```

## 컴포넌트 작성 원칙

- `packages/ui/`에 없는 shadcn 컴포넌트 → `npx shadcn add` 먼저 실행
- shadcn/ui에 없는 경우만 `apps/frontend/components/` 에 직접 작성 허용
- 직접 작성 시에도 `/impeccable:impeccable` 스킬 실행 필수

## UI 작업 절차

1. `packages/ui/`에 필요한 shadcn 컴포넌트 설치
2. `/impeccable:impeccable` 실행
3. DESIGN.md 토큰으로 Tailwind 클래스 적용
4. `/impeccable:polish` 최종 점검

## 보안 — 절대 하지 말아야 할 행동

### 1. dangerouslySetInnerHTML 금지

```tsx
// 금지 — XSS 취약점
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// 올바른 방법
<div>{userContent}</div>
```

### 2. API Key를 클라이언트 코드에 노출 금지

```ts
// 금지 — NEXT_PUBLIC_ 변수는 브라우저에 노출됨
const key = process.env.NEXT_PUBLIC_API_KEY

// 올바른 방법 — Server Component 또는 Route Handler에서만 사용
const apiKey = process.env.API_KEY // NEXT_PUBLIC_ 없는 변수만
```

### 3. 환경변수 하드코딩 금지

```ts
// 금지
fetch('http://localhost:3001/sessions')

// 올바른 방법
fetch(`${process.env.NEXT_PUBLIC_API_URL}/sessions`)
```

### 4. eval / new Function 금지

동적 코드 실행 절대 금지.

### 5. API 응답 타입 unknown 그대로 사용 금지

`packages/shared/types.ts` 기준 타입 검증 후 사용.

## API 호출 규칙

모든 백엔드 호출은 `lib/api.ts` 클라이언트 경유:

```ts
// 금지 — 컴포넌트 직접 fetch
const res = await fetch('http://backend:3001/sessions')

// 올바른 방법
import { api } from '@/lib/api'
const sessions = await api.sessions.list({ page: 1 })
```

SSE는 `lib/sse.ts` 훅만 사용. 컴포넌트에서 `EventSource` 직접 생성 금지.

## apps/frontend 파일 구조

```
app/
  page.tsx              # 홈 (주간 리포트)
  sessions/
    page.tsx            # 세션 목록
    [id]/page.tsx       # 세션 상세
  layout.tsx
components/             # 앱 전용 복합 컴포넌트만
  session-card.tsx
  inefficiency-badge.tsx
  weekly-insight-card.tsx
  tool-call-timeline.tsx
  metric-chart.tsx
  session-filter.tsx
lib/
  api.ts
  sse.ts
```
