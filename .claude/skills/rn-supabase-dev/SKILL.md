---
name: rn-supabase-dev
description: "muklog 구현 가이드. React Native(Expo Dev Client) + Supabase(Postgres·Auth·Storage·Realtime·Edge Functions) + Kakao(Map·Local API) 스택의 코드 컨벤션과 패턴. 원티드 디자인 토큰 사용. developer 에이전트가 사용. 구현/개발/코딩 작업 시 적용."
---

# RN + Supabase + Kakao 구현 가이드

muklog의 스택 컨벤션. plan.md를 구현할 때 따른다. 스택별 상세는 `references/`를 필요 시 로드한다.

## 스택 요약
- **앱**: React Native + **Expo Dev Client**(Kakao Map 네이티브 모듈 때문에 Expo Go 불가). TypeScript.
- **백엔드**: Supabase — Postgres(RLS), Auth(익명), Storage, Realtime, Edge Functions.
- **지도/장소**: Kakao Map SDK(렌더링·핀) + Kakao Local REST API(장소검색, **Edge Function 프록시 경유**).
- **디자인**: 원티드 디자인 시스템 토큰을 `theme/`로 매핑해 사용.

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
구현 코드 + `docs/sprint/{slug}/dev-notes.md`(구현 파일, 생성 테이블/함수, 계약 shape, 생산자↔소비자 매핑, 미완 항목). 모듈 완성마다 qa-inspector에게 교차검증 요청.
