# muklog

커플이 데이트 중 다닌 맛집을 사진·메모·위치로 기록하는 React Native 앱.

**스택:** React Native(Expo Dev Client) · Supabase(Postgres·Auth·Storage·Realtime·Edge Functions) · Kakao(Map SDK·Local API) · 원티드 디자인 토큰.
**설계 단일 출처:** `docs/design/architecture.md` (데이터 모델·화면·스프린트 백로그·비용 가드레일).
**코드 컨벤션 단일 출처:** `docs/code-convention.md` — 모든 코드가 100% 준수(useCallback/useMemo 지양, 화살표 함수, named-object 인자, useEffect 명명 함수, enum-style 상수, 원티드 토큰 스타일링). 위반은 즉시 수정 대상.
**테스트 전략 단일 출처:** `docs/testing-strategy.md` — TDD(Red→Green→Refactor), **jest-expo + @testing-library/react-native**, 단위 테스트 경계(유틸·훅·화면 ✅ / SQL·RPC·외부 SDK는 모킹·스모크, 네이티브 동작은 디바이스 스모크).
**UI 디자인 단일 출처:** `.claude/skills/ui-design` 스킬(원티드 디자인 시스템 + `templates/muklog` 킷이 muklog 화면 레퍼런스, 토큰 원천 `tokens/`). **모든 UI 구현·수정은 이 스킬을 최우선 기준으로 따른다.** 브랜드 규칙: 파랑 `#3366FF`, 그림자 대신 헤어라인 보더, 10px(컨트롤)/16px(카드) radius, 4px 스페이싱 그리드, Pretendard(UI) + Wanted Sans(브랜드 헤드라인), 해요체·구체 숫자. 스킬은 웹(CSS/JSX)이므로 RN에서는 토큰·패턴을 `src/theme/`로 **번역**해 적용(직접 CSS 사용 아님). **muklog는 `templates/muklog` 변형을 정확히 따른다 — 일반 원티드의 "이모지 금지"와 달리 muklog 킷의 음식 이모지/음식커버·플레이풀 요소는 허용(킷이 곧 디자인 기준).** 화면 레이아웃(헤더 워드마크, 카드, 하단 CTA 등)은 `templates/muklog/mk-*.jsx`를 충실히 재현한다.

## 절대 규칙
- **TDD가 기본.** 모든 기능은 테스트 우선(Red→Green→Refactor)으로 개발한다. 상세·스택·테스트 경계는 `docs/testing-strategy.md`. 스프린트 완료 기준에 `npm test` 통과가 포함된다.
- **git 작업 금지.** 커밋·푸시·브랜치 등 모든 git 명령은 **사용자가 직접** 한다. 에이전트/스킬은 수행하지 않는다.
- **AWS 비용폭탄 회피 최우선.** 백엔드는 Supabase 무료 티어 내에서만 운영, AWS 리소스 미사용.
- **1 스프린트 = 1 기능.** 여러 기능을 한 스프린트로 묶지 않는다.

## 하네스: muklog 개발

**목표:** planner→ui-publisher→developer→qa 에이전트 팀으로 한 스프린트에 한 기능을 기획·퍼블리싱·구현·검증한다. **역할 경계:** planner=무엇을(기획·계약) / **ui-publisher=어떻게 보이는가(킷 `templates/muklog`→RN 토큰·프리미티브·화면 골격)** / developer=어떻게 동작하는가(데이터·훅·배선) / qa=통합 정합성+비주얼 충실도. **디자인 단일 출처는 킷 `templates/muklog`**(`.claude/skills/ui-design/templates/muklog/`) — ui-publisher가 RN으로 번역하고, developer는 비주얼을 임의 변경하지 않는다.

**트리거:** 기능 개발/스프린트 관련 요청(예: "초대코드 방 기능 스프린트 시작", "먹로그 리스트 구현", "지도 탭 개발", "다음 스프린트", "○○만 다시 구현") 시 `sprint-orchestrator` 스킬을 사용하라. 단순 질문은 직접 응답 가능.

**산출물:** 각 스프린트는 `docs/sprint/sprint-{YYYYMMDD}-{name}/`에 plan.md / dev-notes.md / qa-report.md를 남긴다.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-06-09 | 초기 구성 (에이전트 3 + 스킬 4 + 설계 문서) | 전체 | - |
| 2026-06-09 | 원티드 토큰 실값 반영 (builbook→RN tokens.ts 변환) | rn-supabase-dev/references/wanted-tokens.md | 실제 토큰 소스 확보 |
| 2026-06-09 | 코드 컨벤션 도입 + 전체 코드 정합화 (useCallback/useMemo 제거, 화살표 함수, named-args, useEffect 명명) + 하네스 연결 | docs/code-convention.md, src 전체, dev/qa 스킬·에이전트 | 사용자 컨벤션 적용 |
| 2026-06-09 | fmt consteval 빌드 오류 우회 — base.h 직접 패치(FMT_USE_CONSTEVAL 강제 0). -D 정의는 fmt 11.0.2가 헤더에서 재정의해 무효였음 | plugins/withFmtConstevalFix.js, app.json | 신규 Xcode clang ↔ RN 0.76 fmt 비호환. SDK 업그레이드 시 제거 |
| 2026-06-09 | TDD 기본 채택 + 하네스 전반 반영(전략 문서·테스트 레퍼런스·오케스트레이터·dev/qa/planner 스킬·에이전트) | docs/testing-strategy.md, rn-supabase-dev/references/testing.md, 스킬·에이전트 전반 | 사용자 지시(TDD 기본) |
| 2026-06-11 | **UI 퍼블리셔 역할 추가** — 4역할 파이프라인(기획→퍼블리싱→구현→QA). ui-publisher 에이전트 + ui-publishing 스킬 신설, 오케스트레이터·developer·qa-inspector 역할 경계 갱신(퍼블리셔=비주얼/토큰/프리미티브, 개발자=데이터/로직). 디자인 단일 출처를 킷 `ui_kits/muklog`로 명문화 | .claude/agents/ui-publisher.md, .claude/skills/ui-publishing/, sprint-orchestrator·developer·qa-inspector | 기획 UI와 구현 UI 불일치 누적 → 비주얼 충실도 전담 역할 분리 |
| 2026-06-12 | **ui-design 킷 경로 마이그레이션** — 킷 `ui_kits/muklog` → `templates/muklog`, 토큰 원천 루트 → `tokens/`로 이동(ui-design 스킬 신규 배포판). 디자인 실값(`--mk-*` #3366FF·radius 22/14·Stars #FFB23E)·프리미티브 10종·플레이풀 예외 모두 불변 → 살아있는 하네스의 경로 참조만 동기화 | CLAUDE.md, ui-publisher·qa-inspector 에이전트, ui-publishing·rn-supabase-dev·sprint-orchestrator 스킬, src/theme/tokens.ts | 외부 ui-design 스킬 구조 변경에 따른 단일 출처 경로 동기화 |
