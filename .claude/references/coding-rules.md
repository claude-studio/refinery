# 필수 코딩 규칙

- 파일명/폴더명은 **반드시 kebab-case** (`session-card.tsx`, `repeat-read.ts`)
  → 상세 규칙: `.claude/rules/naming-convention.md`
- UI는 `DESIGN.md` 토큰만 사용. 명시되지 않은 색상/폰트/간격 금지
- 컴포넌트는 **직접 작성 금지** — `packages/ui/`에 shadcn/ui 설치 후 `@refinery/ui/components/<name>`으로 import
- DB 접근은 `apps/backend/src/db/client.ts` 경유만 허용. 라우트에서 Prisma 직접 호출 금지
