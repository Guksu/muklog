# muklog

커플이 데이트 중 다닌 맛집을 사진·메모·위치로 기록하는 React Native 앱.

**스택:** React Native(Expo Dev Client) · Supabase(Postgres·Auth·Storage·Realtime·Edge Functions) · Kakao(Map SDK·Local API) · 원티드 디자인 토큰.
**설계 단일 출처:** `docs/design/architecture.md` (데이터 모델·화면·스프린트 백로그·비용 가드레일).

## 절대 규칙
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
