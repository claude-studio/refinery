---
description: DESIGN.md 기반 디자인 시스템 규칙 — 프론트엔드 전용
paths:
  - "apps/frontend/**"
---

# Design System Rules

## DESIGN.md 토큰 외 스타일 금지

UI 작업 시 `DESIGN.md`에 명시된 색상/타이포그래피/간격 토큰만 사용한다.
임의의 색상값(`#abc`, `blue-500` 등) 직접 사용 금지.

## 허용 색상 토큰

```
text-warm-parchment   (#faf9f6) — 주요 텍스트, 헤드라인
text-ash-gray         (#afaeac) — 본문 텍스트
text-stone-gray       (#868584) — 보조 텍스트, 레이블
bg-earth-gray         (#353534) — 버튼 배경, 인터랙티브 서피스
text-muted-purple     (#666469) — 링크 텍스트
border-mist           (rgba(226,226,226,0.35)) — 카드 테두리
bg-frosted-veil       (rgba(255,255,255,0.04)) — 서피스 구분
```

## 컴포넌트 규칙

- **shadcn/ui 컴포넌트만 사용** — 직접 컴포넌트 작성 금지
- 새 컴포넌트 필요 시: `npx shadcn add <component-name>` 먼저 실행
- shadcn 컴포넌트에 DESIGN.md 토큰 적용해서 커스터마이징

## 타이포그래피

```
font-family: Matter Regular (400) — 거의 모든 텍스트
font-family: Matter Medium (500) — 카드 타이틀, 버튼만
bold(700+) 사용 금지
uppercase label: letter-spacing 1.4px–2.4px 필수
```

## 금지 사항

- pure white (`#ffffff`, `white`) 텍스트 — warm-parchment 사용
- 밝은 accent 색상 (blue, red, green 계열)
- box-shadow (drop shadow) — 테두리/투명도로 depth 표현
- glassmorphism (backdrop-blur 등)
- gradients — 배경은 단색 dark만

## UI 작업 절차

1. `/impeccable:impeccable` 실행
2. shadcn/ui 컴포넌트 먼저 설치
3. DESIGN.md 토큰으로 Tailwind 클래스 적용
4. `/impeccable:polish` 로 최종 점검
