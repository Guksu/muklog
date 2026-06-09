---
name: integration-qa
description: "muklog 통합 정합성 QA 가이드. 경계면(쿼리/Edge Function 응답↔훅, 컬럼↔화면, RLS↔쿼리, 네비게이션) 교차검증으로 런타임 버그를 잡는다. qa-inspector가 사용. 검증/QA/정합성 점검 시 적용."
---

# Integration QA — 경계면 교차검증 가이드

"존재 확인"이 아니라 **양쪽 동시 읽기**로 경계면 불일치를 잡는다. muklog는 RN+Supabase+Kakao 경계가 많아 계약 어긋남이 런타임 에러의 주 원인이다.

## 왜 정적 리뷰로 못 잡나
- TypeScript 제네릭/캐스팅은 런타임 응답이 달라도 컴파일을 통과시킨다.
- 빌드 성공 ≠ 동작. 각각 "올바르게" 짜도 연결점에서 계약이 어긋난다.
- "API가 있는가?"와 "API 응답이 호출측 기대와 일치하는가?"는 다른 검증이다.

## 양쪽 동시 읽기 표

| 검증 대상 | 왼쪽 (생산자) | 오른쪽 (소비자) |
|----------|-------------|---------------|
| 쿼리/Edge Function 응답 shape | supabase 쿼리·function 반환 | 훅의 타입/구조분해 |
| Kakao Local 응답 | place-search 프록시 반환 | 검색 결과 화면/타입 |
| DB 컬럼 → 화면 필드 | Postgres 컬럼명 | 훅/화면이 읽는 키 |
| RLS 정책 ↔ 쿼리 | policy 조건 | 실제 select/insert/update |
| 네비게이션 | 등록된 화면/라우트 | navigate/push 대상 |
| Storage 경로 ↔ 정책 | 업로드 경로 패턴 | 버킷 정책의 경로 조건 |

## muklog 특화 체크리스트

### 데이터 흐름 정합성
- [ ] snake_case(DB) ↔ camelCase(프론트) 변환이 일관됨
- [ ] 쿼리/Edge Function 응답 shape과 훅의 타입이 일치 (래핑 응답은 unwrap 확인)
- [ ] 옵셔널 필드(memo, rating, kakao_place_id NULL)의 null 처리가 양쪽 일관

### 보안 · RLS
- [ ] 모든 테이블에 RLS 활성화, "내가 멤버인 방"으로 접근 제한
- [ ] Kakao REST 키가 클라이언트 번들/코드에 노출되지 않음 (Edge Function 전용)
- [ ] Storage 버킷 정책이 `room_id` 경로 멤버십과 일치

### 입력 한계 (앱 + DB 양쪽 강제)
- [ ] 사진 5장 초과 차단이 앱 UI와 DB 트리거 모두에 존재
- [ ] 방 인원 2명 초과 조인 차단이 앱과 트리거 모두에 존재
- [ ] 초대코드: 형식 검증, 존재하지 않는/만료/이미 2명인 코드 처리

### 상태 · 동시성
- [ ] 빈 상태 UI(먹로그 0개, 방 1명 대기) 존재
- [ ] 네트워크/업로드 실패 시 사용자 피드백 + 복구 경로
- [ ] 커플 동시편집: Realtime 구독으로 반영되거나 충돌 처리
- [ ] 익명 세션 미발급/만료 시 재발급 흐름

### 비용 가드레일
- [ ] Kakao Local 호출에 디바운스/캐싱, viewport 기반 조회
- [ ] 이미지 업로드 전 리사이즈/압축
- [ ] AWS 리소스 미사용

### 디자인/코드 품질
- [ ] 색상/타이포/스페이싱이 원티드 토큰(`theme/`)을 사용 (하드코딩 금지)
- [ ] 미사용 코드/엔드포인트 없음 (의도적 미사용은 명시)

### TDD / 테스트 (`docs/testing-strategy.md`) 준수
- [ ] 인수조건마다 대응 테스트가 존재한다 (plan.md §테스트 케이스 ↔ `*.spec.ts(x)`)
- [ ] `npm test` 전체 통과 + `tsc --noEmit` 통과
- [ ] 테스트가 **의미 있다**(껍데기 단언 금지) — 핵심 단언을 일부러 깨면 빨개지는지 표본 확인(load-bearing)
- [ ] 경계·실패 경로 테스트 포함(빈/잘못된 입력, 네트워크 실패, 정원 초과, 에러 토큰 매핑 등)
- [ ] 단위 경계 준수: 유틸/훅/화면은 테스트, SQL·RPC·외부 SDK는 모킹/스모크로 분리
- [ ] 훅 테스트가 계약 매핑(snake→camel)·상태 전이(loading/success/error)를 검증

### 코드 컨벤션 (`docs/code-convention.md`) 준수
- [ ] `useCallback`/`useMemo` 미사용 (`grep -rn "useCallback\|useMemo" src/` 실제 호출 0건 — 주석 제외)
- [ ] 컴포넌트·훅이 `export const X = () => {}` 화살표 형태 (`export function` 컴포넌트/훅 0건)
- [ ] 우리가 정의한 함수의 매개변수가 객체(named arguments) — 배열/이벤트/setState/외부 API 콜백만 예외
- [ ] useEffect 콜백·타이머가 명명 함수 (`useEffect(() =>` 인라인 0건)
- [ ] 도메인 식별 문자열이 enum-style `as const` 상수 (판별 유니온 status는 예외)
- [ ] 파일명 = 대표 export 심볼명

## 작업 방식
- **각 모듈 완성 직후 즉시 검증**(incremental). 전체 완성 후 일괄 검증 금지 — 버그 누적·전파를 막는다.
- Grep으로 패턴을 모아 대조한다 (예: 모든 `.from('muklogs')` 쿼리 ↔ 대응 훅 타입).
- 발견은 **파일:라인 근거 + 수정 방법**과 함께 보고. 경계면 이슈는 생산자/소비자 양쪽 에이전트에게 알린다.

## 출력
`docs/sprint/{slug}/qa-report.md` — 통과 / 실패(파일:라인+수정안) / 미검증(사유) 3분류. 모든 인수조건 통과 전에는 스프린트를 "완료"로 표시하지 않는다.
