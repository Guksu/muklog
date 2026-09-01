---
name: rn-supabase-dev
description: "muklog 구현 가이드. React Native(Expo Dev Client) + Supabase(Postgres·Auth·Storage·Realtime·Edge Functions) + Kakao(Map·Local API) 스택의 코드 컨벤션과 패턴. 원티드 디자인 토큰 사용. developer 에이전트가 사용. 구현/개발/코딩 작업 시 적용. 후속 작업: 구현 수정·보완·리팩토링·버그 재수정 시에도 적용."
---

# RN + Supabase + Kakao 구현 가이드

muklog의 스택 컨벤션. plan.md를 구현할 때 따른다. 스택별 상세는 `references/`를 필요 시 로드한다.

## 스택 요약
- **앱**: React Native + **Expo Dev Client**(Kakao Map 네이티브 모듈 때문에 Expo Go 불가). TypeScript.
- **백엔드**: Supabase — Postgres(RLS), Auth(익명), Storage, Realtime, Edge Functions.
- **지도/장소**: Kakao Map SDK(렌더링·핀) + Kakao Local REST API(장소검색, **Edge Function 프록시 경유**).
- **디자인**: **`ui-design` 스킬(`.claude/skills/ui-design`)이 UI 단일 출처·최우선.** 원티드 디자인 시스템 + `templates/muklog` 킷(화면 레퍼런스)을 따른다. 브랜드 규칙(파랑 #3366FF, 헤어라인 보더, 10/16px radius, 4px 그리드, Pretendard, 해요체, 이모지 금지)을 `theme/`로 **번역**해 적용(스킬은 웹 CSS/JSX → RN StyleSheet+토큰으로 변환). 어떤 UI 작업이든 ui-design을 먼저 읽는다.

## 폴더 컨벤션 (제안)
```
src/
  lib/         supabase 클라이언트, kakao map 래퍼
  theme/       tokens.ts (원티드 토큰), components 기본 스타일
  features/    invite/ profile/ muklog/ map/  (기능별 화면·훅·타입)
  components/  공용 UI (Button, Card, EmptyState ...)
  navigation/  AuthGate, RoomTabs
supabase/
  migrations/  SQL (테이블, RLS, 트리거)
  functions/   place-search (Kakao 프록시)
```

## 핵심 규칙 (왜)
- **TDD가 기본**: 테스트를 먼저 쓰고(Red) → 통과시키고(Green) → 정리(Refactor)한다. 인수조건 1개 = 사이클 1회. 스택·패턴·테스트 경계는 `references/testing.md`와 `docs/testing-strategy.md`. 구현 완료 기준은 `npm test` 전체 통과 + `tsc --noEmit`. (SQL/RPC·외부 SDK는 단위 대상 아님 → 모킹/스모크.)
- **코드 컨벤션 100% 준수**: 구현 전 `docs/code-convention.md`를 읽고 따른다. 핵심 — **useCallback/useMemo 지양**(일반 함수/직접 계산), **컴포넌트·훅은 화살표 const**, **우리 함수 매개변수는 항상 객체(named arguments)**(배열/이벤트/setState/외부 API 콜백은 예외), **useEffect 콜백·타이머는 명명 함수**, **도메인 식별 문자열은 enum-style `as const`**, **스타일은 원티드 토큰(useTheme)만**(raw hex 금지).
- **계약 일치**: 쿼리/Edge Function 응답 shape과 프론트 훅 타입을 동일하게. 경계면 버그의 주원인이므로 dev-notes.md에 "생산자↔소비자" 매핑을 남긴다.
- **보안 키 비노출**: Kakao REST 키는 Edge Function 환경변수로만. 앱 번들에 넣으면 추출·쿼터 남용 위험.
- **RLS 필수**: 모든 테이블에 활성화. 사용자는 자신이 멤버인 방만 접근.
- **이중 강제**: 사진 5장·방 인원 2명 한계는 앱 UI(1차) + DB 트리거(2차) 양쪽에서 막는다. 앱만 막으면 우회 가능.
- **비용 가드레일**: Kakao 호출 디바운스·캐싱·viewport 조회, 업로드 전 이미지 압축, AWS 미사용.
- **엣지케이스 우선**: 빈 상태·네트워크 실패·커플 동시편집(Realtime)·익명 세션/초대코드 예외를 코드로 처리.
- **git 절대 금지**: 커밋·푸시·브랜치 등 어떤 git 명령도 실행하지 않는다.

## 스택별 상세 (필요 시 로드)
- **테스트/TDD(jest-expo·RTL·모킹·Red-Green-Refactor): `references/testing.md`**
- Supabase(클라이언트·익명인증·RLS·트리거·Storage·Realtime): `references/supabase.md`
- Kakao(Map SDK 셋업·Local API·프록시 Edge Function): `references/kakao.md`
- 원티드 토큰 매핑(theme/tokens.ts): `references/wanted-tokens.md`

## 출력
구현 코드 + `_workspace/{slug}/dev-notes.md`(구현 파일, 생성 테이블/함수, 계약 shape, 생산자↔소비자 매핑, fe-skills 조회 결과, 미완 항목 — 커밋되지 않는 인계물, 보존 기록은 리더가 `docs/history/`에 종합). 모듈 완성마다 qa-logic에게 교차검증 요청(비주얼 충실도는 qa-visual 담당).

## fe-skills 라이브러리 (UI 패턴 정본)

이름 있는 UI 패턴(바텀시트·풀투리프레시·프레스 피드백·핀치줌 등)을 구현하기 전에 **요청 여부와 무관하게** `node .claude/scripts/feSkills.mjs find "<사용자 요청 문장>"`을 먼저 실행한다. 후보가 나오면 `get <slug> --into <대상>`으로 SKILL.md를 받아 읽는다. **웹(CSS/DOM) 정본이므로 코드 복사가 아니라 판단값(타이밍·이징·scale·reduce-motion·엣지케이스)과 순수 TS 층을 RN으로 번역**해 적용한다(비주얼은 킷 우선). 후보 0건·조회 실패(exit 3)면 직접 구현하고 dev-notes에 그 사실을 남긴다. 완료 기준: 패턴 구현 시작 전 `find` 실행, 후보가 있었다면 SKILL.md 읽음. 모션 품질 기준은 `fe-craft` 스킬 `references/animation.md`(RN 번역 단서는 그 SKILL.md 상단). 버그 진단은 규율대로: 재현 명령(실패 테스트) 1개 → 가설 랭킹(반증 가능한 예측) → 가설당 변수 1개 계측 → 최소 수정+회귀 테스트.
