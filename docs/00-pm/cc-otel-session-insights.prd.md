# PRD: cc-otel-session-insights

> Claude Code OpenTelemetry 로그 + 세션 대화 분석 기반 사용자 코딩 행동 개선 인사이트 서비스

| 항목 | 내용 |
|------|------|
| **Feature ID** | `cc-otel-session-insights` |
| **작성일** | 2026-04-16 |
| **PM Lead** | bkit-pm-lead (PM Agent Team) |
| **상태** | Draft (Pre-Plan) |
| **분석 프레임워크** | OST · JTBD 6-Part · Lean Canvas · 3 Personas · TAM/SAM/SOM · GTM · Pre-mortem |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | Claude Code 사용자는 자신의 프롬프트 패턴, 컨텍스트 낭비, 비효율 워크플로를 객관적으로 인지할 수단이 없어, 같은 실수와 비효율을 반복한다. OTel 로그는 운영 메트릭 위주로 설계되어 "더 잘 쓰는 법"으로 환원되지 않는다. |
| **Solution** | Claude Code OTel 메트릭 + 로컬 세션 트랜스크립트(`~/.claude/projects/**`)를 합쳐 "사용자 코딩 행동"을 분석하고, **반복 패턴/비효율/안티 프롬프트**를 개인화 인사이트와 액션 가능한 권고로 환원한다. |
| **Function/UX/Effect** | 로컬 우선(privacy-by-default) CLI + 대시보드. 주간 리포트, 실시간 "지금 이 프롬프트가 비효율적입니다" 너지, 팀 단위 익명 벤치마크. → 토큰 비용 20-40% 절감, 작업 완료 시간 15% 단축, 팀 베스트 프랙티스 자동 전파. |
| **Core Value** | "Claude Code를 쓰는 모든 사용자가 자기 자신의 시니어 코치를 갖는다" — AI가 AI 사용 행동을 코칭하는 메타-루프. |

---

## Context Anchor

| 키 | 값 |
|----|----|
| **WHY** | AI 코딩 도구 사용량은 폭발적이지만, 사용 품질은 측정·개선되지 않는 사각지대다. 같은 사람이 같은 패턴으로 비싼 토큰을 계속 소모한다. |
| **WHO** | Primary: Claude Code 파워 유저 개발자 (월 $100+ 토큰 소비). Secondary: 엔지니어링 팀 리드. Tertiary: 팀 단위로 Claude Code 도입한 회사의 DevEx/Platform 팀. |
| **RISK** | 1) 세션 트랜스크립트의 프라이버시·보안 (코드/시크릿 포함), 2) Anthropic 공식 도구와의 경쟁, 3) "잔소리 피로감"으로 인한 이탈, 4) OTel 스키마 변경 깨짐 |
| **SUCCESS** | 90일 내 NSM = "주간 활성 인사이트 채택률 (WAIA) ≥ 30%". 보조 지표: 사용자당 토큰 -25%, 7일 리텐션 ≥ 50% |
| **SCOPE** | IN: OTel 메트릭 수집·해석, 세션 트랜스크립트 분석, 인사이트 생성, 로컬 CLI 대시보드. OUT(v1): 다른 AI 도구(Cursor 등) 통합, SaaS 호스팅, 팀 RBAC |

---

## 1. Discovery 분석 (Opportunity Solution Tree)

### 1.1 5-Step Discovery Chain

#### Step 1 — Brainstorm (가능성 폭발)

20+ 가설을 발산:
- (H1) 사용자는 자기 프롬프트가 비효율인지 모른다
- (H2) 같은 실수를 같은 사용자가 반복한다 (예: 매번 `Read` 후 `Edit` 대신 `Edit`만 쓰면 되는 경우)
- (H3) 컨텍스트 윈도우 낭비가 비용의 30%+를 먹는다
- (H4) 사용자는 OTel 메트릭(토큰, latency)을 봐도 "그래서 뭐?"가 된다
- (H5) 세션을 회고할 시간이 없다 → 누군가 자동 회고해주면 가치
- (H6) 팀 내 한 명의 베스트 프랙티스가 전파되지 않는다
- (H7) 주니어가 시니어처럼 Claude Code를 쓰지 못한다 (스킬 갭)
- (H8) 반복 작업을 Skill/Agent로 만들 기회를 놓친다
- (H9) 멀티 세션 컨텍스트 단절 (같은 task를 여러 번 재설명)
- (H10) Anti-pattern: `cat`/`grep`을 Bash로 직접 호출 (Read/Grep 도구 미사용)
- (H11) Anti-pattern: TodoWrite 없이 긴 작업 진행 → 중도 이탈
- (H12) Anti-pattern: 병렬화 가능한 tool calls를 직렬로 실행
- (H13) 비용 폭주 알림이 사후약방문
- (H14) "내가 어떤 모델을 가장 효율적으로 쓰는지" 모름
- (H15) Slash command/Skill 학습 곡선이 높음
- (H16) 세션 종료 후 무엇을 배웠는지 정리 안 됨
- (H17) 코드 리뷰처럼 "프롬프트 리뷰"가 필요
- (H18) 팀 단위로 Claude Code ROI 측정 어려움
- (H19) 신입 온보딩 시 Claude Code 사용법 표준 없음
- (H20) 대시보드는 많지만 **개인화된 권고**가 없다

#### Step 2 — Assumption Mapping (Impact × Risk)

| 가설 | Impact (사용자 가치) | Risk (검증 필요도) | 우선순위 |
|------|---------------------|-------------------|----------|
| H2 (반복 실수 패턴) | 높음 | 낮음 — OTel + 트랜스크립트로 즉시 검증 가능 | **P0** |
| H3 (컨텍스트 낭비) | 매우 높음 | 중간 — 토큰 비용 직접 환산 | **P0** |
| H10/H12 (Anti-pattern) | 높음 | 낮음 — 패턴 정의 가능 | **P0** |
| H6 (베스트 프랙티스 전파) | 매우 높음 | 높음 — 팀 사용·익명화 필요 | P1 |
| H5 (자동 회고) | 중간 | 중간 — 사용자 회고 의향 검증 필요 | P1 |
| H7 (주니어 스킬 갭) | 높음 | 높음 — 학습 효과 측정 어려움 | P2 |
| H13 (비용 알림) | 중간 | 낮음 — 이미 일부 구현됨 | P2 |
| H17 (프롬프트 리뷰) | 중간 | 매우 높음 — 사회적 수용성 미검증 | P3 |

→ **상위 3개 가설로 v1 집중**: 반복 패턴 검출, 컨텍스트 낭비 분석, Anti-pattern 코칭.

#### Step 3 — Prioritize Assumptions

**Leap-of-Faith Assumption (LoFA)**: "사용자는 자기 사용 패턴 분석 결과를 받으면, 행동을 바꿀 만큼 가치를 느낀다."
→ 이 가설이 깨지면 모든 게 무너짐 → 가장 먼저 검증.

#### Step 4 — Experiments (검증 실험 설계)

| 실험 | 가설 | 방법 | 성공 기준 | 기간 |
|------|------|------|-----------|------|
| **EXP-1: 컨시어지 MVP** | LoFA | 5명 사용자에게 1주일 OTel + 세션 받아 수동 분석 후 PDF 리포트 발송 | 4/5명이 "행동 바꾸겠다" 응답 | 2주 |
| **EXP-2: Pattern Library** | H2, H10 | 기존 사용자 50개 세션을 분류해 반복 패턴 카탈로그 작성 | 패턴 20개 이상 식별, 빈도 검증 | 1주 |
| **EXP-3: Token Waste 측정** | H3 | OTel 토큰 메트릭으로 "재실행/중복 read/실패한 도구 호출" 비율 측정 | 평균 25%+ 낭비 입증 | 3일 |
| **EXP-4: Smoke Test 랜딩** | 시장성 | "Claude Code 사용 코치" 랜딩 → 이메일 가입 | CTR ≥ 5%, 가입 100명 | 2주 |
| **EXP-5: Privacy Friction** | 채택 장벽 | 프로토타입 설치 흐름에서 트랜스크립트 접근 동의율 측정 | 동의율 ≥ 70% | 1주 |

#### Step 5 — Opportunity Solution Tree (OST)

```
OUTCOME (NSM): 주간 활성 인사이트 채택률 (WAIA) ≥ 30%
│
├── OPP-A: "내가 토큰을 어디서 낭비하는지 모른다" [P0]
│   ├── SOL-A1: 토큰 낭비 히트맵 (세션별, 도구별, 모델별)
│   ├── SOL-A2: "이 작업은 Haiku로 충분했어요" 모델 다운그레이드 권고
│   └── SOL-A3: 컨텍스트 누적 경고 (다음 메시지 비용 예측)
│
├── OPP-B: "같은 안티 패턴을 반복한다" [P0]
│   ├── SOL-B1: 룰 기반 Anti-pattern 검출기 (cat→Read, 직렬→병렬, mkdir 사전체크 누락 등)
│   ├── SOL-B2: 인라인 너지 ("이 패턴, 이번 주 7번째에요")
│   └── SOL-B3: 사용자 맞춤 Skill/Agent 추천
│
├── OPP-C: "팀 내 베스트 프랙티스가 전파 안 된다" [P1]
│   ├── SOL-C1: 익명화 팀 대시보드 (P50/P90 토큰, 패턴 채택률)
│   ├── SOL-C2: "팀 시니어가 만든 Skill" 자동 큐레이션
│   └── SOL-C3: 신입 온보딩 패스 (선배의 좋은 세션 익명화 학습 자료)
│
├── OPP-D: "세션 회고를 할 시간이 없다" [P1]
│   ├── SOL-D1: 자동 주간 회고 리포트 (이번 주 학습 3가지)
│   ├── SOL-D2: "이 작업은 다음에 X로 시도해보세요" 액셔너블 카드
│   └── SOL-D3: 세션 종료 시 60초 마이크로-회고 트리거
│
└── OPP-E: "어떤 모델을 언제 써야 할지 모른다" [P2]
    ├── SOL-E1: 작업 유형별 모델 추천 휴리스틱
    └── SOL-E2: 모델 전환 A/B (사용자 자동 실험)
```

**v1 출시 범위**: SOL-A1, A3, B1, B2, D1 (총 5개) — Discovery에서 가장 신뢰도 높고 구현 가능.

### 1.2 핵심 Pain Points (사용자 인터뷰 가설)

1. **"비용이 무섭다"** — 청구서 보고 놀라지만 무엇을 줄여야 할지 모름
2. **"내가 잘 쓰고 있는지 모르겠다"** — 비교 대상이 없음, 피드백 루프 없음
3. **"다른 사람은 어떻게 쓰는지 궁금하다"** — 학습 자료 부족
4. **"세션마다 처음부터 설명한다"** — 컨텍스트 단절
5. **"좋은 패턴을 발견해도 잊어버린다"** — 명시적 학습 루프 없음

---

## 2. Strategy 분석 (Value Proposition + Lean Canvas)

### 2.1 Value Proposition — JTBD 6-Part Framework

| Part | 내용 |
|------|------|
| **Job Statement** | When I'm using Claude Code daily for non-trivial coding tasks, I want to understand my own usage patterns and inefficiencies, so I can spend less and ship faster without changing tools. |
| **Functional Job** | Claude Code 사용 데이터를 수집·분석해 비효율을 식별하고 개선책을 제시한다 |
| **Emotional Job** | "내가 잘 쓰고 있다"는 통제감, "AI 시대에 뒤처지지 않는다"는 안심감 |
| **Social Job** | 팀 내에서 "Claude Code 잘 쓰는 사람"으로 인정받음, 신입 멘토링 가능 |
| **Pains** | 비용 폭주 / 학습 곡선 / 시간 낭비 / 비교 대상 없음 / 좋은 패턴 망각 |
| **Gains** | 토큰 절감 / 작업 속도 / 프로페셔널 자기 효능감 / 팀 평판 / 학습 가속 |

### 2.2 Lean Canvas

| 블록 | 내용 |
|------|------|
| **1. Problem** | (1) Claude Code 비용이 가시성 없이 증가 (2) 사용자가 자기 비효율을 인지 못 함 (3) 팀 내 베스트 프랙티스 전파 안 됨. **기존 대안**: 스프레드시트로 토큰 추적, Slack 채널 공유, 무시 |
| **2. Customer Segments** | **Early Adopters**: Claude Code 월 $200+ 토큰 쓰는 인디 개발자, 50인 이하 스타트업의 Tech Lead. 얼리 채택 신호: dotfiles 공유, Skill 직접 작성, MCP 서버 설치 경험 |
| **3. Unique Value Proposition** | "Claude Code의 시니어 코치 — 당신이 토큰을 어디서 낭비하는지, 어떻게 더 잘 쓸지 매주 알려드립니다. 모든 분석은 로컬에서, 코드는 떠나지 않습니다." |
| **4. Solution** | (1) OTel 메트릭 로컬 수집기 (2) 세션 트랜스크립트 패턴 분석 엔진 (3) 주간 인사이트 리포트 + 실시간 너지 (4) 팀 익명 벤치마크 (Phase 2) |
| **5. Channels** | (1) Anthropic 디스코드/포럼 (2) Hacker News Show HN (3) DevEx 뉴스레터 (4) bkit/pdca 같은 Claude Code 생태계 플러그인 마켓플레이스 (5) GitHub README/awesome-claude-code 리스트 |
| **6. Revenue Streams** | (1) Free 로컬 CLI (2) Pro $9/mo: 고급 패턴, 히스토리, 커스텀 룰 (3) Team $29/user/mo: 익명 벤치마크, 팀 대시보드 (4) Enterprise: SSO, 감사 로그, 온프레미스 |
| **7. Cost Structure** | 개발 (FTE 2명, 6개월) / LLM 추론 비용 (인사이트 생성, 사용자당 $1-3/월) / 마케팅·DevRel / 인프라 (Pro/Team 백엔드) |
| **8. Key Metrics** | NSM: WAIA(주간 활성 인사이트 채택률). 선행: 설치→첫 인사이트 시간 < 10분, 인사이트당 명확도 ≥ 4/5. AARRR: A(설치/주) R(D7 ≥ 50%) R(주간 인사이트 열람률) R(NPS ≥ 40) R(Pro 전환율 ≥ 5%) |
| **9. Unfair Advantage** | (1) Claude Code 생태계 깊이 이해 (bkit/PDCA 경험) (2) 로컬 우선 = 신뢰 = 타사 SaaS는 따라할 수 없는 포지션 (3) Claude Code의 OTel 스키마 빠른 추적 (4) 메타-루프: AI로 AI 사용을 코칭하는 도그푸드 |

### 2.3 SWOT 분석

| | Helpful | Harmful |
|---|---------|---------|
| **Internal** | **S**: Claude Code 생태계 도메인 지식 / 로컬 우선 신뢰 / Claude API 활용 가능 | **W**: 신규 진입자 신뢰 부족 / 분석 품질이 트랜스크립트 다양성에 의존 / 1인/소규모 팀 리소스 |
| **External** | **O**: Claude Code 사용자 폭증 / "AI ROI" 측정 수요 폭발 / 엔터프라이즈 거버넌스 요구 / 경쟁 부재(현재) | **T**: Anthropic 공식 기능 통합 / 사용자 프라이버시 우려 / OTel 스키마 변경 / Claude Code 자체 변동성 |

**전략 매트릭스**:
- **SO (강점-기회)**: 도메인 지식 × 사용자 폭증 → 디스코드/HN 강한 콘텐츠 마케팅으로 얼리 어답터 흡수
- **WT (약점-위협)**: 신뢰 부족 × Anthropic 통합 위협 → 오픈소스 코어 + Pro 부가가치 모델로 신뢰 확보
- **ST (강점-위협)**: 로컬 우선 × 프라이버시 우려 → "Zero data egress" 마케팅 메시지 강조
- **WO (약점-기회)**: 리소스 한계 × 시장 폭증 → bkit 같은 인접 도구와 번들 파트너십

### 2.4 추가 프레임워크: RICE 우선순위 (v1 솔루션)

| 솔루션 | Reach | Impact | Confidence | Effort | RICE |
|--------|-------|--------|------------|--------|------|
| SOL-A1 (토큰 히트맵) | 100% | 3 | 90% | 3주 | **90** |
| SOL-A3 (컨텍스트 경고) | 100% | 2 | 70% | 2주 | 70 |
| SOL-B1 (Anti-pattern 검출) | 100% | 3 | 85% | 4주 | **64** |
| SOL-B2 (인라인 너지) | 100% | 3 | 60% | 3주 | 60 |
| SOL-D1 (주간 리포트) | 100% | 2 | 95% | 2주 | **95** |

→ **v1 빌드 순서**: D1 → A1 → B1 → A3 → B2

---

## 3. Research 분석 (Personas + Competitors + Market Sizing)

### 3.1 Personas (3개)

#### Persona 1: "Solo Sam" — 인디 개발자 / 시니어

| 항목 | 내용 |
|------|------|
| **인구통계** | 32세, 풀스택 개발자, SaaS 부업, 미국/유럽 |
| **상황** | Claude Code 매일 4-8시간 사용. 월 토큰 $150-300 |
| **JTBD** | "내 한 달 토큰 비용을 30% 줄이고 싶다 — 작업 품질은 유지하면서" |
| **Pains** | 청구서 충격 / 자기 패턴 무지 / 비교 대상 없음 |
| **Gains** | 비용 절감 / 자기 효능감 / 새 도구/Skill 발견 |
| **현재 행동** | OTel 안 씀. 가끔 토큰 사용량 수동 체크. Twitter에서 팁 수집 |
| **기술 수준** | High — CLI/터미널 능숙 |
| **결정 권한** | Full — 본인 결정 |
| **WTP** | $9-19/월 |
| **채널 선호** | Hacker News, Twitter, GitHub, Discord |

#### Persona 2: "Team Lead Tina" — 10인 스타트업 엔지니어링 리드

| 항목 | 내용 |
|------|------|
| **인구통계** | 38세, Eng Manager, 시리즈 A 스타트업 |
| **상황** | 팀원 8명이 Claude Code 사용. 회사 카드로 Anthropic API. 월 $2,000+ |
| **JTBD** | "팀 토큰 비용을 정당화하고, 팀원 모두 시니어처럼 쓰게 하고 싶다" |
| **Pains** | ROI 입증 압박 / 신입은 비효율적으로 사용 / 누가 잘 쓰는지 모름 |
| **Gains** | 팀 생산성 가시화 / 베스트 프랙티스 전파 / 온보딩 가속 |
| **현재 행동** | Anthropic 콘솔에서 사용량 다운로드 → 스프레드시트. Slack 채널에 팁 공유 (휘발됨) |
| **기술 수준** | Medium-High |
| **결정 권한** | 팀 도구 결정 |
| **WTP** | $29/user/월 (8인 = $232/월) |
| **채널 선호** | LinkedIn, Lenny's Newsletter, DevEx 컨퍼런스 |

#### Persona 3: "DevEx Diana" — 200인 회사 Platform/DevEx 리드

| 항목 | 내용 |
|------|------|
| **인구통계** | 41세, Staff Engineer, Platform Team 리드 |
| **상황** | 회사 전체 50명이 Claude Code 사용 도입 검토 중. 보안팀 통과 필요 |
| **JTBD** | "Claude Code 도입 후 회사 전체 효과를 측정하고, 거버넌스를 확립하고 싶다" |
| **Pains** | 보안/컴플라이언스 우려 / 도구 ROI 측정 / 사용 표준화 부재 |
| **Gains** | 통합 대시보드 / 감사 로그 / 정책 시행 / 비용 통제 |
| **현재 행동** | OTel 백엔드(Datadog/Honeycomb) 운영 중 → Claude Code OTel 흘려보내고 있으나 의미 추출 못 함 |
| **기술 수준** | Very High |
| **결정 권한** | 도구 평가/도입 |
| **WTP** | Enterprise: $50-100/user/월 (SSO, 감사, 온프레) |
| **채널 선호** | Gartner, KubeCon, 분석가 리포트, Anthropic 영업 |

### 3.2 Customer Journey Map (Primary: Solo Sam)

| 단계 | 행동 | 생각/감정 | Touch Points | Pain | Opportunity |
|------|------|----------|--------------|------|-------------|
| **Awareness** | "Claude Code 비용 어떻게 줄이지?" 검색 | 짜증, 막막함 | Twitter 스레드, HN 글 | 정보 분산 | SEO 글 + 무료 진단 도구 |
| **Consideration** | 도구 후보 비교 | 의심: "내 데이터 안전?" | 랜딩, 디스코드 후기 | 신뢰 검증 어려움 | 로컬 우선 메시지, 오픈소스 |
| **Onboarding** | `npm install`, OTel 설정 | "복잡하면 포기할 거야" | CLI, 문서 | OTel 설정 마찰 | 1-command 자동 설치 |
| **First Value** | 첫 인사이트 수신 | "헐 진짜 이걸 7번 했네" | CLI 출력, 첫 리포트 | Time-to-value | 설치 후 24시간 내 첫 리포트 |
| **Habit** | 주간 리포트 열람, 너지 반응 | "도움 된다, 토큰 줄었다" | 이메일/CLI | 너지 피로감 | 너지 빈도 사용자 제어 |
| **Advocacy** | 디스코드/팀에 공유 | "이거 진짜 좋다" | Twitter, Discord | 공유 동기 부재 | 공유 시 Pro 1개월 무료 |

### 3.3 Competitor Analysis (5개)

| # | 경쟁자 | 카테고리 | 강점 | 약점 | 차별 전략 |
|---|--------|---------|------|------|----------|
| **1** | **Anthropic Console (네이티브)** | 직접 | 공식, 무료, 이미 통합 | 메트릭만, 인사이트 없음, 팀 단위 약함 | 의미적 인사이트 + 트랜스크립트 분석 |
| **2** | **OpenTelemetry + Grafana/Datadog** | 인접 (DIY) | 강력, 유연, 기존 인프라 활용 | 학습 곡선 / 의미 추출 불가 / 사용자 향 X | "OTel 위에 얹는 의미층" 포지션 |
| **3** | **Helicone / LangSmith / Langfuse** | 인접 (LLM Obs) | 트레이싱, 토큰 추적 | API 호출자(개발자) 향, Claude Code 사용자 향 X, 트랜스크립트 분석 약함 | Claude Code 워크플로 특화 |
| **4** | **GitHub Copilot Metrics + 자체 도구** | 대체 (다른 도구) | 깃헙 통합, 엔터프라이즈 | Claude Code 미지원, 일반 메트릭 | Claude Code 특화 깊이 |
| **5** | **Cursor Analytics** | 대체 (다른 도구) | UI 우수, 사용자 친화 | Cursor 한정, Claude Code 미지원 | Claude Code 전용 + 멀티 도구(Phase 2) |

**경쟁 포지셔닝 맵 (Quality of Insights × Workflow Specificity)**:
- 우상단(우리의 자리): 깊은 인사이트 × Claude Code 특화 — **빈 자리**
- 좌상단: Helicone, Langfuse (깊은 분석 × 일반)
- 우하단: Cursor Analytics (얕은 메트릭 × 특화)
- 좌하단: 자체 스프레드시트 (얕음 × 일반)

### 3.4 시장 규모 (TAM/SAM/SOM) — Dual Method

#### Top-Down

- **글로벌 개발자 수 (2026)**: ~30M (IDC/SlashData 추산)
- **AI 코딩 도구 활성 사용자**: ~30% = 9M (생산성 도구 채택률)
- **Claude Code (모든 변형) 사용자**: 추정 5-10% of AI dev tool users = **450K-900K**
- **TAM** (전체 잠재): 700K 사용자 × $120/년 평균 = **$84M/년**

#### Bottom-Up

- Anthropic 발표 (가정): Claude Code 활성 사용자 ~500K
- 분석 도구 채택률 (DevTools 평균): 5-15% = 25K-75K 유료 가능 사용자
- ARPU: Pro $108/년 + Team $348/년 (혼합 가정 ARPU $150)
- **TAM**: 500K × 30% × $150 = **$22.5M/년** (보수적)
- **TAM**: 1M × 30% × $200 = **$60M/년** (낙관적)

→ **TAM 추정**: $25M-85M/년 (2026 시점, Claude Code 한정)

#### SAM (Serviceable Available Market)

영어권 + 자기 결정 가능한 인디/소팀 + Pro+ 기꺼이 지불:
- **150K 사용자 × $150 ARPU = $22.5M/년**

#### SOM (Serviceable Obtainable Market — 3년)

- Year 1: 0.5% of SAM = 750 유료 사용자 → **$110K ARR**
- Year 2: 2% of SAM = 3,000 유료 → **$450K ARR**
- Year 3: 5% of SAM = 7,500 유료 → **$1.1M ARR**

**시장 성장 가속 요인**: Claude Code 채택률 YoY +200% 가정 시 SAM은 매년 2-3배 확대.

---

## 4. Execution 분석 (ICP + Beachhead + GTM)

### 4.1 Ideal Customer Profile (ICP)

**Primary ICP**: "Solo Sam"
- 31-40세 시니어 풀스택 개발자
- Claude Code 일 4시간+ 사용, 월 $150+ 토큰
- 영어 능통, 미국/유럽/한국
- Twitter/HN/Discord 활동
- dotfiles 공유, OSS 기여 경험
- WTP $9-19/월

### 4.2 Beachhead Segment (Geoffrey Moore)

**선택**: **"Solo Sam (인디·프리랜서 파워 유저)"**

| 4-Criteria 평가 | Score (1-5) | 근거 |
|----------------|------------|------|
| **Identifiable** | 5 | Discord/HN/Twitter에서 명확히 식별 가능 |
| **Reachable** | 5 | 채널 비용 낮음 (콘텐츠 마케팅 + 커뮤니티) |
| **Compelling Reason to Buy** | 4 | 비용 직접 환산 가능, 즉시 ROI |
| **Complete Solution Possible** | 4 | 단일 사용자 → 복잡한 통합 불필요 |
| **Allies in Adjacent Segments** | 4 | 이들이 회사로 가져가면 Team segment 자연 확장 |
| **Total** | **22/25** | **강력한 Beachhead** |

**선택 이유**: 의사결정 단순, 빠른 피드백 루프, 입소문 강력, Team/Enterprise 확장 다리.

### 4.3 GTM 전략

#### Pre-Launch (Week -8 ~ 0)

- "Build in Public" Twitter/HN 시리즈 (주 1회)
- 베타 50명 모집 (Discord, Anthropic 포럼)
- 컨시어지 MVP (수동 분석 PDF) → 5명 케이스 스터디

#### Launch (Week 0)

- **Show HN: cc-otel-session-insights** — 오픈소스 코어 공개
- Anthropic Discord 발표
- Twitter 스레드 + Loom 데모

#### Growth (Month 1-6)

| 채널 | 액션 | KPI |
|------|------|-----|
| **Content** | "Claude Code 토큰 절감 리포트" 월간 (익명 데이터 기반) | 월 5K 방문 |
| **Community** | Discord 적극 참여, "오늘의 패턴" 공유 | 가입 200/월 |
| **Partnerships** | bkit/PDCA, awesome-claude-code 번들 | 5개 통합 |
| **Product-led Growth** | 무료 사용자가 팀에 자연 도입 | Team 전환율 5% |
| **DevEx 뉴스레터** | 게스트 기고 (Console.dev, Pragmatic Engineer) | 도달 50K |

#### Funnel Metrics

| 단계 | 전환율 목표 |
|------|------------|
| 방문 → 설치 | 8% |
| 설치 → 활성 (1주 사용) | 50% |
| 활성 → 유료 (Pro) | 7% |
| Pro → Team | 10% |
| 월간 churn | < 5% |

### 4.4 Competitor Battlecards

#### vs. Anthropic Console (Native)

| 영역 | 우리 | Anthropic |
|------|------|-----------|
| **메트릭** | OTel 모두 | OTel + 청구 |
| **트랜스크립트 분석** | ✓ (로컬) | ✗ |
| **개인화 인사이트** | ✓ | ✗ |
| **팀 벤치마크** | ✓ (익명) | ✗ |
| **가격** | Free + Pro $9 | 무료 |
| **승부수** | "공식이 못 하는 의미적 분석. 우리는 공식과 보완재." |

#### vs. Helicone/Langfuse

| 영역 | 우리 | Helicone |
|------|------|---------|
| **타겟** | Claude Code 사용자 | LLM API 호출 개발자 |
| **분석 단위** | 코딩 세션/워크플로 | API 호출/트레이스 |
| **너지/코칭** | ✓ | ✗ |
| **승부수** | "당신은 호출자가 아니라 사용자입니다. 사용 행동을 코칭합니다." |

### 4.5 Growth Loops

1. **Content Loop**: 익명 사용 데이터 → 월간 트렌드 리포트 → SEO/공유 → 신규 사용자 → 더 많은 데이터
2. **Team Loop**: Solo 사용자 → 회사에 도입 → Team plan → 팀원 8명 가입 → 그중 일부 Solo 사용자
3. **Skill Loop**: 사용자가 좋은 패턴 → 우리가 Skill로 패키징 추천 → 공유 → 신규 사용자 학습 자료

---

## 5. PRD 본문 (8 섹션)

### 5.1 Problem & Opportunity

Claude Code는 **사용량은 폭증**하지만 **사용 품질은 측정·개선 사각지대**다. OTel 메트릭은 운영 관점이라 사용자에게 "무엇을 어떻게 바꿀지" 알려주지 못한다. 사용자는 자기 비효율을 인지 못 하고 동일 안티 패턴을 반복하며, 팀 단위로는 베스트 프랙티스가 전파되지 않는다.

**Opportunity**: 시장에 "Claude Code 사용 행동 코칭" 카테고리는 비어 있다. 로컬 우선 + 의미적 분석 = 신뢰와 차별화.

### 5.2 Goals & Non-Goals

**Goals (v1)**
- G1: 사용자가 자기 토큰 낭비 패턴을 5분 안에 시각적으로 이해
- G2: 매주 액셔너블 인사이트 3개 이상 자동 생성
- G3: 설치 후 24시간 내 첫 가치 경험 (TTFV)
- G4: Anti-pattern 10종 이상 검출 (rule-based)
- G5: 100% 로컬 처리 — 코드/시크릿 외부 송출 0건

**Non-Goals (v1)**
- ✗ Cursor/Copilot 등 타 도구 통합
- ✗ SaaS 호스팅 백엔드 (v1은 로컬 CLI only)
- ✗ 팀 SSO/RBAC (Phase 2)
- ✗ 실시간 인터셉트 (히스토리 분석만)
- ✗ 자동 코드 수정/실행 권고

### 5.3 Target Users

상세는 §3.1. 우선순위:
1. **P0**: Solo Sam (인디 파워 유저)
2. **P1**: Team Lead Tina (10인 팀 리드, Phase 2)
3. **P2**: DevEx Diana (엔터프라이즈, Phase 3)

### 5.4 Use Cases / User Stories

**US-1**: Solo Sam은 일주일에 한 번 주간 리포트를 받아 자신의 토큰 낭비 Top 3 패턴을 확인하고, 다음 주 행동을 결정한다.

**US-2**: 작업 중 사용자가 동일 안티 패턴을 3회 반복하면 CLI가 인라인으로 너지를 보낸다 ("`Read` 후 `Edit` 대신 `Edit`만 써도 됩니다 — 이번 주 5번째").

**US-3**: 팀 리드 Tina는 매월 익명화된 팀 대시보드에서 P50/P90 토큰 사용량을 보고, 베스트 패턴을 큐레이션해 #engineering Slack에 공유한다.

**US-4**: DevEx Diana는 회사 OTel 백엔드(Datadog)에 인사이트 메트릭을 export 받아 "AI 도구 ROI" KPI 보드에 통합한다.

**US-5**: 신규 사용자가 `npx cc-insights init`을 실행하면 OTel 자동 설정 + 즉시 과거 1주일 트랜스크립트 분석 → 첫 리포트 제공.

(전체 User Stories는 §6.6)

### 5.5 Functional Requirements

**FR-1: Data Collection**
- FR-1.1: Claude Code OTel 메트릭 자동 수신 (OTLP gRPC/HTTP)
- FR-1.2: `~/.claude/projects/**/*.jsonl` 세션 트랜스크립트 로컬 읽기
- FR-1.3: PII/시크릿 자동 마스킹 (regex + entropy 기반)
- FR-1.4: 사용자 옵트인 명시적 동의 (설치 시)

**FR-2: Analysis Engine**
- FR-2.1: 토큰 사용 분해 (도구별, 모델별, 작업 유형별)
- FR-2.2: Anti-pattern 룰 엔진 (10+ 규칙, plugin 가능)
- FR-2.3: 반복 패턴 검출 (frequency mining)
- FR-2.4: 컨텍스트 낭비 추정 (중복 read, 재시도, 실패 도구 호출)
- FR-2.5: LLM 기반 인사이트 생성 (Claude API, 사용자 키 또는 우리 키)

**FR-3: Insight Delivery**
- FR-3.1: CLI: `cc-insights report` (주간/월간)
- FR-3.2: CLI: `cc-insights nudge` (실시간 너지, hook 통합)
- FR-3.3: 마크다운 리포트 export
- FR-3.4: 사용자 정의 알림 임계값

**FR-4: Privacy & Security**
- FR-4.1: 100% 로컬 처리 옵션 (LLM도 로컬)
- FR-4.2: 명시적 옵트인 흐름
- FR-4.3: 데이터 30일 자동 폐기 (사용자 설정)
- FR-4.4: Audit log

**FR-5: Pro Features (Phase 1.5)**
- FR-5.1: 6개월+ 히스토리
- FR-5.2: 커스텀 룰 정의
- FR-5.3: 멀티 머신 동기화

### 5.6 Non-Functional Requirements

| 영역 | 요구사항 |
|------|---------|
| **성능** | 1주일 트랜스크립트 분석 < 30초, CLI 응답 < 1초 |
| **신뢰성** | 분석 실패 시 graceful degradation (메트릭 only) |
| **보안** | 코드/시크릿 외부 송출 0건 (감사 가능), 시크릿 마스킹 ≥ 99% recall |
| **호환성** | macOS/Linux/Windows, Node 20+, Claude Code 2.1+ |
| **국제화** | v1 영어, v1.1 한국어/일본어 |
| **접근성** | CLI: scriptable; Pro 대시보드: WCAG 2.1 AA |
| **OTel 호환** | OpenTelemetry spec 1.0+ |

### 5.7 Success Metrics & KPIs

**North Star Metric**: 주간 활성 인사이트 채택률 (WAIA)
> WAIA = (인사이트를 보고 행동을 변경한 사용자 수) / (주간 활성 사용자)

**Input Metrics (선행 지표)**
- 설치 → 첫 인사이트 시간 (TTFV) < 24h
- 인사이트 정확도 (사용자 평가) ≥ 4.0/5.0
- 너지 수용률 ≥ 30%

**Output Metrics (결과 지표)**
- 사용자당 주간 토큰 사용 -25% (90일)
- 작업 완료 시간 -15%
- D7 리텐션 ≥ 50%
- D30 리텐션 ≥ 30%
- NPS ≥ 40
- Pro 전환율 ≥ 5%

**Business Metrics**
- 90일: 1,000 활성 / 50 Pro / $5K MRR
- 1년: 10,000 활성 / 750 Pro / $7K MRR + Team launch

### 5.8 Risks & Mitigations (Pre-mortem)

#### Pre-mortem: "1년 후 이 프로덕트가 실패했다면 왜?"

| Top 3 Risk | 가능성 | 임팩트 | Mitigation |
|-----------|-------|--------|------------|
| **R1: 사용자가 트랜스크립트 분석 권한 거부 (프라이버시)** | High | Critical | 100% 로컬 옵션, 오픈소스 코어, 감사 로그, 명확한 옵트인 UX, Privacy Policy DPIA 공개 |
| **R2: Anthropic이 동일 기능을 Claude Code에 내장** | Medium | High | (a) 의미적 깊이로 차별화 (b) 멀티 도구 확장(Cursor 등 Phase 2) (c) 팀/엔터프라이즈로 빠른 이동 (d) Anthropic과 협력적 포지셔닝 |
| **R3: 인사이트 품질이 평범 → "잔소리 피로"로 이탈** | Medium | High | (a) LLM 인사이트 품질 평가 자동 (b) 사용자 피드백 루프 (좋아요/싫어요) (c) 너지 빈도 사용자 제어 (d) Top 3만 보여주는 디자인 원칙 |

추가 위험:
- R4: Claude Code OTel 스키마 변경 → 자동 회귀 테스트 + Anthropic 변경 추적
- R5: 시크릿 마스킹 실패 → 다층 방어 (regex + entropy + LLM redaction)
- R6: 신뢰 부족으로 도입 마찰 → Build in Public, 오픈소스, 외부 보안 감사

### 5.9 Stakeholder Map

| 이해관계자 | 관심 | 영향력 | 관리 전략 |
|----------|------|-------|----------|
| **End User (Solo Sam)** | 사용성, 가치, 가격 | High | 베타 그룹, 주간 피드백 |
| **Anthropic** | 생태계 건강, 브랜드 | Very High | 협력적 포지셔닝, 공식 파트너십 시도 |
| **보안/컴플라이언스 (엔터프라이즈)** | DPIA, 감사 | High | 로컬 우선, SOC2(Phase 3), 보안 문서 |
| **OSS 커뮤니티** | 투명성, 기여 | Medium | 오픈소스 코어, 명확한 거버넌스 |
| **투자자 (Phase 2+)** | TAM, 성장 | Medium | 분기 업데이트, 메트릭 대시보드 |

---

## 6. 추가 산출물

### 6.1 INVEST User Stories (전체)

| ID | Story | INVEST 체크 |
|----|-------|------------|
| US-01 | 사용자로서, `npx cc-insights init`으로 1분 안에 설치하고 싶다 | I✓ N✓ V✓ E✓ S✓ T✓ |
| US-02 | 사용자로서, 매주 월요일 9시에 주간 인사이트 리포트를 받고 싶다 | ✓ |
| US-03 | 사용자로서, 내 토큰 사용을 도구별/모델별로 시각화해서 보고 싶다 | ✓ |
| US-04 | 사용자로서, 동일 패턴 반복 시 인라인 너지를 받고 싶다 | ✓ |
| US-05 | 사용자로서, 너지 빈도를 사용자 설정으로 조절하고 싶다 | ✓ |
| US-06 | 사용자로서, 모든 분석이 로컬에서만 일어난다는 것을 검증하고 싶다 | ✓ |
| US-07 | 사용자로서, 시크릿이 마스킹되었는지 미리보기로 확인하고 싶다 | ✓ |
| US-08 | Pro 사용자로서, 6개월 트렌드를 비교해 개선을 추적하고 싶다 | ✓ |
| US-09 | Pro 사용자로서, 우리 회사 코드 컨벤션 기반 커스텀 룰을 정의하고 싶다 | ✓ |
| US-10 | 팀 리드로서, 익명화된 팀 P50/P90 대시보드를 보고 싶다 (Phase 2) | ✓ |
| US-11 | 팀 리드로서, 베스트 패턴을 자동 큐레이션해 공유받고 싶다 (Phase 2) | ✓ |
| US-12 | DevEx 리드로서, OTel 백엔드에 인사이트 메트릭을 export 받고 싶다 (Phase 3) | ✓ |

### 6.2 Test Scenarios (User Story 기반)

| TS ID | 대응 US | 시나리오 | 기대 결과 |
|-------|--------|---------|----------|
| TS-01 | US-01 | 깨끗한 환경에서 `npx cc-insights init` 실행 | 60초 내 OTel 설정 + 첫 리포트 |
| TS-02 | US-02 | 1주일 사용 후 자동 스케줄 트리거 | 마크다운 리포트 생성, 인사이트 ≥ 3 |
| TS-03 | US-03 | 토큰 분해 리포트 호출 | 도구/모델/작업 분류 정확도 ≥ 95% |
| TS-04 | US-04 | 동일 안티 패턴 3회 반복 시뮬레이션 | 너지 정확히 3회째에 발화 |
| TS-05 | US-06 | 네트워크 차단 환경에서 분석 실행 | 정상 동작, egress 0 |
| TS-06 | US-07 | 시크릿 포함 트랜스크립트 분석 | 시크릿 마스킹 99%+ recall |
| TS-07 | US-08 | Pro 6개월 트렌드 조회 | 시계열 차트 정확 |
| TS-08 | (FR-2.5) | LLM 인사이트 생성 (사용자 키) | 30초 내 인사이트 3개 생성 |
| TS-09 | (NFR) | 1주일치 1MB 트랜스크립트 분석 | 30초 이내 |
| TS-10 | (R1) | 옵트인 거부 시 동작 | 메트릭 분석만, 트랜스크립트 미접근 |

### 6.3 Roadmap (Quarter View)

| Quarter | Focus | Deliverables |
|---------|-------|--------------|
| **Q1 (Now-+3mo)** | Discovery + MVP | 컨시어지 MVP, 베타 50명, 오픈소스 alpha |
| **Q2** | v1.0 Launch | Solo Sam 풀 기능, Show HN, Pro 출시 |
| **Q3** | Growth + Pro | 컨텐츠 마케팅, Pro 100명, Team alpha |
| **Q4** | Team Edition | 익명 벤치마크, 팀 대시보드, Tina 세그먼트 진입 |
| **Year 2** | Enterprise + 멀티 도구 | SSO/감사, Cursor 통합, 엔터프라이즈 영업 |

### 6.4 의존성 및 가정

**의존성**
- Claude Code OTel spec 안정성
- `~/.claude/projects/` 트랜스크립트 포맷 안정성 (현재 jsonl)
- Claude API (인사이트 생성, 사용자 BYOK 옵션)

**가정**
- Claude Code 사용자 베이스 YoY +200% 지속
- 사용자가 트랜스크립트 분석에 동의 (베타 검증 필수)
- 로컬 우선 메시지가 신뢰 형성에 효과적

### 6.5 Open Questions

1. LLM 인사이트 생성 비용을 누가 부담? (BYOK vs 우리 호스팅)
2. Anthropic과 협력 vs 경쟁 포지셔닝?
3. 오픈소스 라이선스 (MIT vs AGPL)?
4. 트랜스크립트 시크릿 마스킹 책임 한계?
5. v1에 너지(real-time) 포함 vs 리포트만으로 시작?

### 6.6 Decision Log Seeds (Plan 단계 입력)

| 결정 필요 | 옵션 | 권장 |
|---------|------|------|
| MVP 형태 | (a) CLI only (b) CLI + 웹 (c) IDE 익스텐션 | **(a) CLI only** — Claude Code 사용자 = CLI 친숙 |
| LLM 추론 | (a) BYOK (b) 우리 호스팅 (c) 로컬 모델 | **(a) BYOK 기본 + (c) 로컬 옵션** |
| 라이선스 | (a) MIT (b) AGPL (c) Source-available | **(b) AGPL** — SaaS 카피캣 방어 |
| 스택 | TS/Node, Rust, Go | **TS/Node** — Claude Code 생태계 정합 |

---

## 7. Attribution

본 PRD는 다음 프레임워크를 통합 적용했습니다:

| 영역 | 프레임워크 | 출처 |
|------|----------|------|
| Discovery | Opportunity Solution Tree | Teresa Torres, *Continuous Discovery Habits* |
| Discovery | Assumption Mapping (Impact × Risk) | David Bland, *Testing Business Ideas* |
| Strategy | JTBD 6-Part Framework | Tony Ulwick / Bob Moesta |
| Strategy | Lean Canvas | Ash Maurya |
| Strategy | SWOT, RICE | 표준 PM 프레임워크 |
| Research | Persona / Customer Journey | Alan Cooper / Service Design |
| Research | TAM/SAM/SOM Dual-Method | Christoph Janz |
| Execution | Beachhead Segment (4-Criteria) | Geoffrey Moore, *Crossing the Chasm* |
| Execution | Pre-mortem | Gary Klein |
| Execution | INVEST User Stories | Bill Wake |

PM Agent Team 프롬프트 구조는 [pm-skills](https://github.com/phuryn/pm-skills) (Pawel Huryn, MIT) 영감 기반.

---

## 8. 다음 단계

```
/pdca plan cc-otel-session-insights
```

> 본 PRD가 Plan 문서에 자동 참조됩니다.

**권장 후속 액션**:
1. **EXP-1 (컨시어지 MVP)** 즉시 시작 — 5명 베타 모집, 수동 분석 PDF
2. **EXP-3 (Token Waste 측정)** 본인 계정으로 검증 (1주일)
3. **R1 (프라이버시) Mitigation 설계** Plan 단계에서 우선
4. Decision Log Seeds (§6.6) 4건 결정 → Plan 문서에 반영
