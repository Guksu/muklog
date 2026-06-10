# Dev Notes — room-modes

> 입력: `plan.md`(§3 계약, §5 T1~T9, §7 C1~C8). 방식: TDD(Red→Green→Refactor).
> 완료기준 충족: `npm test` 전체 그린(17 suites / 126 tests), `npx tsc --noEmit` exit 0.

---

## 1. 변경/생성 파일

| 파일 | 유형 | 내용 |
|------|------|------|
| `supabase/migrations/20260610130000_room_modes.sql` | 신규 | rooms.mode(+backfill)·삭제 컬럼 선반영·정원 트리거 모드화·create_room(p_mode)·join_room 솔로가드 |
| `src/features/room/modes.ts` | 신규 | `RoomMode` 타입 · `ROOM_MODES` enum-style 상수 · `ROOM_CAPACITY`(solo1/couple2) |
| `src/features/room/modes.spec.ts` | 신규 | 상수·정원 명세(T6, C4) |
| `src/features/room/errors.ts` | 수정 | 토큰 2종 추가: `INVALID_MODE`, `SOLO_ROOM_NOT_JOINABLE`(기존 5토큰 불변) |
| `src/features/room/errors.spec.ts` | 수정 | 신규 2토큰 + 7토큰 단일출처 검증(T5, C2) |
| `src/features/room/useCreateRoom.ts` | 수정 | `createRoom({ mode })` 시그니처 + 반환 `mode` 포함 + `mode` 누락 BAD_RESPONSE(T7, C1·C3) |
| `src/features/room/useCreateRoom.spec.ts` | 수정 | solo/couple 호출 인자·매핑·실패경로 갱신 |
| `src/features/room/index.ts` | 수정 | `ROOM_MODES`/`ROOM_CAPACITY`/`RoomMode` 재노출 |
| `src/navigation/screens/OnboardingScreen.tsx` | 수정 | `select-mode` step 추가(솔로=코드화면 생략 즉시 RoomTabs / 커플=기존 코드 흐름)(T8, C7) |
| `src/navigation/screens/OnboardingScreen.spec.tsx` | 수정 | select-mode 분기·솔로/커플 전이·회귀 갱신 |

> 기존 `invite_room.sql`은 **미수정**(증분 ALTER). `useJoinRoom.ts`는 **시그니처 불변** — 신규 토큰은 공통 `mapRoomError`가 흡수하므로 코드 변경 없음(plan §3.6).

---

## 2. 생산자 ↔ 소비자 매핑 (QA 교차검증용, plan §7)

| # | 생산자(경로) | 소비자(경로) | 계약 |
|---|--------------|--------------|------|
| **C1** | `create_room` 반환 `jsonb {room_id, invite_code, mode}` (migration §3) | `useCreateRoom.ts:36-40` 파싱 → `{roomId, inviteCode, mode}` | snake→camel + `mode` 필수. 셋 중 하나라도 누락 → `CREATE_ROOM_BAD_RESPONSE` |
| **C2** | RPC `raise '<TOKEN>'` (migration: INVALID_MODE/SOLO_ROOM_NOT_JOINABLE/기존5) | `errors.ts:9-16` `ROOM_ERROR_MESSAGES` → 화면 인라인 | 7토큰 1:1, 누락 0. 미일치는 `DEFAULT_ROOM_ERROR_MESSAGE` |
| **C3** | RPC 파라미터명 `p_mode` (migration §3 시그니처) | `useCreateRoom.ts:30` `rpc('create_room', { p_mode: mode })` | 인자명 정확 일치(불일치 시 default 'couple'로 조용히 생성되는 함정 — spec이 `toHaveBeenCalledWith('create_room', { p_mode })`로 고정) |
| **C4** | `rooms.mode` CHECK + 트리거 정원식 `case solo→1 else 2` (migration §1·§2) | `modes.ts:15` `ROOM_CAPACITY {solo:1, couple:2}` | DB 정원 ↔ 클라 상수 단일출처 |
| **C5a** | 트리거 `enforce_room_capacity`(모드별, before insert room_members) | solo 2번째 / couple 3번째 insert | 각각 `ROOM_FULL`. room 없으면 `ROOM_NOT_FOUND` |
| **C5b** | `join_room` 분기 순서: 멤버십 분기 → 솔로 가드 (migration §4) | 솔로 생성자 자기코드 재입력 / 타인 입력 | 본인=멱등 성공(가드 전), 타인=`SOLO_ROOM_NOT_JOINABLE` |
| **C6** | `create_room()` 무인자 **DROP** + `create_room(text)` grant (migration §0·§3) | 익명 세션 `rpc('create_room', {p_mode})` | 오버로드 단일·authenticated 권한 |
| **C7** | Onboarding `select-mode` 분기: `handleCreate` 가 `createdMode==='solo'`면 코드화면 생략 즉시 `goToRoom()` (OnboardingScreen.tsx:55-63) | 성공 전이 `refresh()` + `reset(RoomTabs)` | 솔로=코드화면 없이 reset / 커플=create-result 후 전이 |
| **C8** | `mode` backfill `'couple'`(add column default) + invite_room 흐름 불변 | 기존 스펙 전체 / tsc | 회귀 0 |

---

## 3. 마이그레이션 적용법 (사용자 전담)

```bash
# 방법 A — Supabase CLI(로컬 링크된 프로젝트)
supabase db push

# 방법 B — Supabase 대시보드 SQL 에디터
#   supabase/migrations/20260610130000_room_modes.sql 전문을 붙여넣고 실행
```

- **적용 순서가 파일 내에 고정**되어 있음(§0 drop → §1 alter → §2 trigger → §3 create_room → §4 join_room). 통째로 실행하면 됨.
- **재실행 안전(idempotent)**: `drop function if exists` / `add column if not exists` / `create or replace`.
- ⚠️ **함정1(필수)**: 무인자 `create_room()`을 먼저 DROP하지 않으면 `create_room(text)`와 오버로드가 공존해 `rpc('create_room')` 호출이 모호해진다 → 파일 §0이 선처리.
- ⚠️ **함정2**: 클라가 `p_mode` 인자명을 틀리면 서버가 default 'couple'로 조용히 생성 → `useCreateRoom.spec.ts`가 인자명을 고정 검증.

---

## 4. 회귀 확인 결과 (T9)

- `npm test`: **17 suites / 126 tests 전부 PASS**(기존 invite-room·profile 스펙 포함).
- `npx tsc --noEmit`: **exit 0**.
- 기존 커플 생성 흐름 보존: choose → "방 만들기" → **select-mode(신규)** → "둘이 함께 기록할래요" → create-result(코드 표시·복사·"방으로 가기"·reset+refresh). 코드 표시/복사/전이 행위 불변(`create-result step (커플, 회귀 보존)` describe).
- 기존 커플 입장(join)·정원2·멱등 재입장: `useJoinRoom.spec.ts` 불변 통과.
- `mode` 미수신 기존 소비자 영향 없음(additive 반환).

---

## 5. 범위 준수 / 미완 항목

- **선반영만(동작 미구현)**: `delete_scheduled_at`/`delete_requested_by`는 컬럼만 추가. 나가기 UI·취소·자동삭제 cron은 **room-lifecycle 스프린트**(plan §2 OUT-OF-SCOPE 준수).
- **솔로→커플 전환**: 미구현. plan §9에 `room-promote` 스프린트용 설계만 존재. 본 스프린트가 (a)솔로방 invite_code 발급, (b)정원 트리거 모드화, (c)mode 컬럼/CHECK로 선결 완비.
- **솔로방 invite_code**: 발급은 하되 UI 미노출 + `join_room`이 `SOLO_ROOM_NOT_JOINABLE`로 거부(plan §3.1 결정).

---

## 6. SQL 스모크(사용자 디바이스/실DB) 권장 체크리스트

> SQL/RPC/트리거는 단위 대상 아님(testing-strategy). 실DB 적용 후 다음을 스모크:

1. 기존 커플방 행 → `select mode from rooms` 가 전부 `couple`(backfill).
2. `create_room('solo')` → mode='solo', 멤버 1, 코드 발급. 같은 유저 재호출 → `ALREADY_IN_ROOM`.
3. `create_room('couples')`(오타) → `INVALID_MODE`. 인자 없이 `create_room()` → couple 생성.
4. 솔로방 코드를 **타인** 세션이 `join_room` → `SOLO_ROOM_NOT_JOINABLE`. 솔로 생성자 본인 재입력 → 멱등 `{room_id}`.
5. 커플방 3번째 입장 → `ROOM_FULL`(회귀). 솔로방 2번째 멤버 강제 insert → 트리거 `ROOM_FULL`.
6. `select proname, pronargs from pg_proc where proname='create_room'` → **단일 행**(무인자 잔존 없음).
