# QA Report — room-modes (솔로/커플 방 모드)

> 검증자: qa-inspector · 방식: 경계면 교차검증(생산자↔소비자 양쪽 동시 읽기) + TDD 정합성 + 회귀
> 입력: `plan.md`(§3 계약, §5 T1~T9, §7 C1~C8), `dev-notes.md`, 소스 전체.
> 결과: **전 인수조건 PASS · 회귀 0 · 차단 이슈 없음.** 정보성 관찰 1건(비차단).

---

## 0. 종합 판정

| 항목 | 결과 |
|------|------|
| 인수조건(T1~T9) | ✅ 전부 통과 |
| 경계면(C1~C8) | ✅ 전부 정합 |
| `npx jest` | ✅ 17 suites / **126 tests PASS** (baseline 112 → +14 신규) |
| `npx tsc --noEmit` | ✅ exit 0 |
| 회귀(invite-room/profile 스펙·행위) | ✅ 불변, 그린 유지 |
| 코드 컨벤션 | ✅ 위반 0 |
| 범위 준수(삭제 컬럼 선반영만) | ✅ 오버구현 없음 |
| TDD load-bearing 표본 | ✅ 변형 시 정확히 빨강(C3) |

---

## 1. 경계면 교차검증 (생산자 ↔ 소비자)

| # | 경계면 | 생산자 | 소비자 | 판정 |
|---|--------|--------|--------|------|
| **C1** | create_room 반환 shape | `migration §3` jsonb `{room_id, invite_code, mode}` (snake) | `useCreateRoom.ts:31-38` → `{roomId, inviteCode, mode}` 매핑, 셋 중 하나 누락 시 `CREATE_ROOM_BAD_RESPONSE` | ✅ snake→camel 일관, `mode` 필수화 + 누락 방어 테스트 존재 |
| **C2** | 에러 토큰 1:1 | RPC `raise` 7토큰 | `errors.ts:9-18` `ROOM_ERROR_MESSAGES` 정확히 7키 | ✅ 신규 2토큰(INVALID_MODE/SOLO_ROOM_NOT_JOINABLE) 양쪽 동기화, 기존 5 불변 |
| **C3** ⚠️함정 | rpc 인자명 `p_mode` | `migration §3` `create_room(p_mode text)` | `useCreateRoom.ts:31` `rpc('create_room',{ p_mode: mode })` | ✅ 정확 일치. **load-bearing 입증**: `p_mode→p_modeX` 변형 시 spec 2건 즉시 RED(L29·L45) |
| **C4** | 정원 단일출처 | `migration §2` 트리거 `case mode='solo' then 1 else 2` | `modes.ts:15` `ROOM_CAPACITY {solo:1, couple:2}` | ✅ DB 정원식 ↔ 클라 상수 일치. CHECK가 mode를 solo\|couple로 한정 → `else`=couple 안전 |
| **C5a** | 모드별 정원 강제 | 트리거 `enforce_room_capacity`(before insert room_members) | solo 2번째 / couple 3번째 insert | ✅ solo: count1≥cap1→ROOM_FULL / couple: count2≥cap2→ROOM_FULL(회귀 보존) |
| **C5b** | join 분기 순서 | `migration §4` 멤버십 분기(L180-188) **→** 솔로 가드(L191) | 솔로 생성자 자기코드 재입력 / 타인 입력 | ✅ 본인=멱등 성공(가드 전 `return`), 타인=`SOLO_ROOM_NOT_JOINABLE`. 순서 정확 |
| **C6** ⚠️함정 | 오버로드 단일화 | `migration §0` `drop function create_room()` **선행** + `create_room(text)` grant(L140-141) | 익명 세션 `rpc('create_room',{p_mode})` | ✅ 무인자 DROP 선처리로 오버로드 충돌 차단, authenticated 권한 재선언 |
| **C7** | 모드별 전이 | `OnboardingScreen.tsx:54-66` `createdMode==='solo'` → 코드화면 생략 즉시 `goToRoom()` | `refresh()` + `reset(RoomTabs)` | ✅ 솔로=코드화면 없이 reset(테스트 L131-135 queryByText null) / 커플=create-result 경유(L120 reset 미호출) |
| **C8** | 회귀 | `migration §1` `mode` backfill `'couple'`(add column default) + `useJoinRoom.ts` 미수정 | 기존 스펙 전체 / tsc | ✅ 126/126 그린, 커플 생성·복사·전이 행위 불변 |

---

## 2. 인수조건별 판정 (plan §5 T1~T9)

| Task | 인수조건 | 판정 | 근거 |
|------|----------|------|------|
| T1 | `mode`(NOT NULL/CHECK/default backfill) + 삭제 컬럼 2종, idempotent, invite_room.sql 미변경 | ✅ | `room_modes.sql:31-39`. `add column if not exists`. 기존 마이그레이션 미변경(별도 신규 파일) |
| T2 | 트리거 모드별 정원(solo1/couple2), room 없으면 ROOM_NOT_FOUND | ✅ | `room_modes.sql:46-72`. couple=2 유지(회귀) |
| T3 | 무인자 DROP 선행, p_mode 분기·반환 mode, INVALID_MODE/ALREADY_IN_ROOM, 권한 재grant | ✅ | `room_modes.sql:23, 80-141` |
| T4 | 솔로 타인 거부(SOLO_ROOM_NOT_JOINABLE), 생성자 본인 멱등, 커플 회귀 | ✅ | `room_modes.sql:179-207` 분기 순서 정확 |
| T5 | 토큰 2종 추가, 기존 5 불변, 1:1 | ✅ | `errors.ts:16-17` + `errors.spec.ts` 7키 단일출처 검증 |
| T6 | `ROOM_CAPACITY.solo===1/.couple===2`, enum-style, 재노출 | ✅ | `modes.ts` + `index.ts:7` + `modes.spec.ts` |
| T7 | `createRoom({mode})` 호출 인자·매핑·실패경로, loading 전이 | ✅ | `useCreateRoom.ts` + spec 8케이스(solo/couple/loading/INVALID_MODE/CODE_GENERATION_FAILED/mode누락/invite누락/null) |
| T8 | select-mode step, 솔로 코드생략 reset, 커플 create-result, 실패 인라인+step유지 | ✅ | `OnboardingScreen.tsx` + spec C7 describe 4케이스 |
| T9 | npm test 전체 그린, tsc 통과, 커플 행위 불변 | ✅ | 126/126, tsc exit 0 |

---

## 3. TDD 정합성

- **인수조건 ↔ 테스트 1:1**: T5(errors.spec), T6(modes.spec), T7(useCreateRoom.spec 8케이스), T8(OnboardingScreen.spec C7) 전부 대응. 경계·실패 경로 커버(BAD_RESPONSE 3종, INVALID_MODE, 생성 실패 시 step 유지).
- **의미 있는 단언(load-bearing) 표본 검증**: 최고위험 C3(인자명 함정)에서 `useCreateRoom.ts`의 `p_mode`를 일시 `p_modeX`로 변형 → `useCreateRoom.spec.ts` L29·L45 2건이 정확히 RED(`toHaveBeenCalledWith` 불일치) 확인 후 **즉시 원복**(git diff로 잔여 없음 확인). 껍데기 테스트 아님 입증.
- **단위 경계 준수**: SQL/RPC/트리거는 단위 대상 제외 → 모킹된 rpc 응답으로 클라 계약 검증 + 실DB는 dev-notes §6 스모크 체크리스트(사용자 전담). testing-strategy 부합.
- **강한 단언 구조**: `toHaveBeenCalledWith` 정확 인자, `toEqual` 전체 객체, `queryByText(...).toBeNull()` 부재 검증 — 행위 변경 시 깨지는 구조.

---

## 4. 코드 컨벤션 (전수 grep)

| 항목 | 결과 |
|------|------|
| `useCallback`/`useMemo` 실호출 | ✅ 0건 |
| `export function` 컴포넌트/훅 | ✅ 0건(전부 화살표 const) |
| `useEffect(() =>` 인라인 | ✅ 0건 |
| raw hex 색상(피처/화면) | ✅ 0건(토큰 소스 `theme/tokens.ts`에만 존재 — 정상) |
| named-object 인자 | ✅ `createRoom({mode})`, `handleCreate({mode})` 등 준수 |
| enum-style 상수 | ✅ `ROOM_MODES … as const` |
| 파일명=심볼명 | ✅ `modes.ts`/`RoomMode` 등 |

---

## 5. 범위 준수 / 오버구현 점검

- ✅ **삭제 라이프사이클**: `delete_scheduled_at`/`delete_requested_by`는 **컬럼 정의만**(`room_modes.sql:37,39`). 나가기 UI·취소·cron·이를 읽는 함수/쿼리 **0건**(grep 확인). plan §2 OUT-OF-SCOPE 준수, 오버구현 없음.
- ✅ **솔로→커플 전환**: 미구현(plan §9 설계만). `promote_room` 참조 0건.
- ✅ **솔로방 invite_code**: 발급하되 UI 미노출 + join 거부 — plan §3.1 결정대로.

---

## 6. 발견 이슈 / 관찰

### 🟡 관찰 1 (정보성, 비차단) — `ROOM_NOT_FOUND` 토큰 미매핑
- **생산자**: `room_modes.sql:60` 트리거가 `raise 'ROOM_NOT_FOUND'`.
- **소비자**: `ROOM_ERROR_MESSAGES`에 `ROOM_NOT_FOUND` 키 없음 → `mapRoomError`가 `DEFAULT_ROOM_ERROR_MESSAGE`("연결에 실패했어요…")로 graceful fallback.
- **판정**: **비차단**. ① plan §3.7이 요구한 신규 토큰은 INVALID_MODE/SOLO_ROOM_NOT_JOINABLE 2종뿐이며 ROOM_NOT_FOUND는 매핑 요구 대상 아님. ② 사실상 도달 불가 경로(create_room은 동일 트랜잭션에서 방 insert 후 멤버 insert, join_room은 직전 select로 INVALID_CODE 분기 — 트랜잭션 중 방 삭제 레이스에서만 발생). ③ 크래시 없이 안전 폴백.
- **선택적 권장(차기)**: 일관성을 위해 `ROOM_ERROR_MESSAGES`에 `ROOM_NOT_FOUND: '방을 찾을 수 없어요.'` 추가 고려 가능. 본 스프린트 차단 아님.

**차단 이슈: 없음. 수정 요청 발신 건수: 0.**

---

## 7. 미검증 항목 (실DB 의존 — 사용자 스모크 전담)

> SQL/RPC/트리거 실행 결과는 단위 테스트 경계 밖. dev-notes §6 체크리스트로 사용자 디바이스/실 Supabase 스모크 필요(코드 정합성은 위에서 정적 교차검증 완료).

1. 기존 rooms 행 `mode` 전부 `couple` backfill 실측.
2. `create_room('solo')` mode/멤버/코드, 재호출 `ALREADY_IN_ROOM`.
3. `create_room('couples')`→`INVALID_MODE`, 무인자→couple.
4. 솔로 코드 타인 join→`SOLO_ROOM_NOT_JOINABLE`, 생성자 본인→멱등.
5. 커플 3번째→`ROOM_FULL`, 솔로 2번째 강제 insert→트리거 `ROOM_FULL`.
6. `pg_proc` create_room 단일 행(무인자 잔존 없음).

---

## 8. 검증 메타

- 회귀 기준점(구현 전): tsc 0 / jest 16 suites·112 tests.
- 구현 후: tsc 0 / jest 17 suites·126 tests. 회귀 0.
- load-bearing 변형 실험은 즉시 원복, `git diff` 잔여 없음 확인.
- git 작업·deliverable 수정 없음(QA 원칙 준수).
</content>
</invoke>
