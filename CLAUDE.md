# muklog

커플이 데이트 중 다닌 맛집을 사진·메모·위치로 기록하는 React Native 앱.

**스택:** React Native(Expo Dev Client) · Supabase(Postgres·Auth·Storage·Realtime·Edge Functions) · Kakao(Map SDK·Local API) · 원티드 디자인 토큰.
**설계 단일 출처:** `docs/design/architecture.md` (데이터 모델·화면·스프린트 백로그·비용 가드레일).
**코드 컨벤션 단일 출처:** `docs/code-convention.md` — 모든 코드가 100% 준수(useCallback/useMemo 지양, 화살표 함수, named-object 인자, useEffect 명명 함수, enum-style 상수, 원티드 토큰 스타일링). 위반은 즉시 수정 대상.
**테스트 전략 단일 출처:** `docs/testing-strategy.md` — TDD(Red→Green→Refactor), **jest-expo + @testing-library/react-native**, 단위 테스트 경계(유틸·훅·화면 ✅ / SQL·RPC·외부 SDK는 모킹·스모크, 네이티브 동작은 디바이스 스모크).

## 절대 규칙
- **TDD가 기본.** 모든 기능은 테스트 우선(Red→Green→Refactor)으로 개발한다. 상세·스택·테스트 경계는 `docs/testing-strategy.md`. 스프린트 완료 기준에 `npm test` 통과가 포함된다.
- **git 작업 금지.** 커밋·푸시·브랜치 등 모든 git 명령은 **사용자가 직접** 한다. 에이전트/스킬은 수행하지 않는다.
- **AWS 비용폭탄 회피 최우선.** 백엔드는 Supabase 무료 티어 내에서만 운영, AWS 리소스 미사용.
- **1 스프린트 = 1 기능.** 여러 기능을 한 스프린트로 묶지 않는다.

## 하네스: muklog 개발

**목표:** planner→developer→qa 에이전트 팀으로 한 스프린트에 한 기능을 설계·구현·검증한다.

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
