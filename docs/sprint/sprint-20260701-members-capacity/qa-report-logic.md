# QA Report — Logic / 통합 정합성 (sprint-20260701-members-capacity, S5a)

판정: **PASS** (blocking 0, non-blocking 관찰 2) — qa-logic 에이전트

## 1. C6 정원 정합 (최우선) — PASS
세 출처 모두 5 일치: 트리거 `enforce_room_capacity() >= 5`(`20260701120000_members_up_to_5.sql:29`), `join_room` `v_count >= 5`(:80), 클라 `ROOM_CAPACITY={solo:5,couple:5}`(`modes.ts:19`). 불일치 없음 → 동시성 정원초과 위험 없음(트리거 최종 방어 + `for update`).

## 2. 마이그레이션 정확성 — PASS
`20260610150000_multi_log_home.sql`(최신 정의) 베이스로 두 함수 diff = **숫자(2→5)·주석만 변경**, 로직 100% 보존(모드 무관 count·SOLO 가드 부재·PK 멱등·for update·반환 shape). room_modes 폐기 SOLO 거부 부활 없음. `create or replace` override(적용본 미편집).

## 3. ROOM_FULL 계약 — PASS
토큰/errcode(P0001) 보존. `errors.ts:11` `'로그 정원(5명)이 가득 찼어요.'`("2명" 제거). 소비자 `useJoinRoom`(mapRoomError 경유)·`JoinLogScreen` 회귀 없음(매핑 단일 출처).

## 4. 회귀 — PASS (정원 상한 ≠ 커플 경계)
`>=2` "2명 이상=커플 파생" 지점 보존: `logName.ts:12 COUPLE_MIN_MEMBERS=2`, `useLeaveRoom`·`LeaveLogSheets` 커플 유예, `useMyLogs/useRoom` memberCount 주석 — 전부 불변(정원 상한과 혼동 없음).

## 가드레일·TDD — PASS
- Supabase 무료 티어(행 상한만 변경, 신규 테이블/인덱스 없음). 시크릿 없음.
- `tsc --noEmit` 0, 전체 `npm test` **1404 passed / 150 suites, 0 fail**.
- Load-bearing 확인: `modes.ts` solo를 2로 파괴 → `modes.spec` RED 확인 후 복원(껍데기 단언 아님).

## Non-blocking 관찰 (S5a 결함 아님)
1. `errors.spec.ts:63` describe 산술 문구가 오래된 카피(단언 12키는 정확·통과).
2. `useMyLogs.ts:21`·`useRoom.ts:21` 주석 `1=혼자/2=둘이`는 정원 5 확장 후 상한 오해 여지 — 의미는 유효, S5b에서 멤버 표시 갱신 시 함께 다듬으면 충분.

## 미검증 (사유 명시)
- **라이브 DB 정원 5 반영**: 마이그레이션 실제 적용은 사용자 몫(에이전트 라이브 DB 미접근). SQL은 리뷰로 검증 완료 — 적용 전까지 라이브 정원 2 유지.

> qa-logic 에이전트 회신을 리더가 본 파일로 보존(하네스 규칙 3).
