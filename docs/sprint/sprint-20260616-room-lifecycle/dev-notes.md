# Dev Notes — room-lifecycle (sprint-20260616-room-lifecycle)

> 예약 삭제 라이프사이클(#5 나가기 24h 유예/취소) + 예약 경과 cron + Storage 정리. (#2 자동삭제 폐기 — plan §0)
> developer 작업 기록. QA 교차검증용 "생산자(SQL/RPC) ↔ 소비자(훅/화면)" 매핑 포함.

---

## ① 백엔드 레이어 (마이그레이션·RPC·cron·훅·유틸) — ✅ 완료

**상태: UI 배선 대기 중.** 이번 메시지 범위 = 백엔드/데이터 레이어만. LogScreen UI 배선은 ui-spec 확정 후 다음 메시지에서.
파일 충돌 방지를 위해 LogScreen(`src/navigation/screens/`)·`LeaveLogSheets`·`ScheduledDeletionBanner`(ui-publisher 영역)는 **건드리지 않음**.

### 검증 결과
- `npm test`: **1081 passed / 130 suites** (회귀 0, 신규 단위·모킹 포함).
- `npx tsc --noEmit`: **통과**(에러 0).

### 작업 항목 (plan §5)

| T | 항목 | 산출 파일 | 상태 |
|---|------|-----------|------|
| T1 | 부분 인덱스 + `leave_room(p_room_id)` 유예 모델 교체 | `supabase/migrations/20260616130000_room_lifecycle.sql` §1·§3 | ✅ (SQL — 라이브 스모크 이월) |
| T2 | `cancel_room_deletion(p_room_id)` 신설 | 동 §4 | ✅ (SQL — 라이브 스모크 이월) |
| T3 | `delete_expired_rooms()` + pg_cron 매시 잡 + Storage 메타 정리 | 동 §2·§5 | ✅ (SQL — 라이브 스모크 이월) |
| T4 | `list_my_rooms`/`get_room` 투영 확장 | 동 §6·§7 | ✅ (SQL) + 훅 매핑 단위(T6) |
| T5 | `useLeaveRoom` 결과 확장(scheduled) | `src/features/room/useLeaveRoom.ts` (+`.spec.ts`) | ✅ green |
| T6 | `useCancelRoomDeletion` 신설 + `useRoom`/`useMyLogs` 필드 확장 | `useCancelRoomDeletion.ts`·`useRoom.ts`·`useMyLogs.ts` (+specs) | ✅ green |
| T7 | `deletionCountdownLabel` 유틸 | `src/features/room/deletionCountdownLabel.ts` (+`.spec.ts`) | ✅ green |
| T8 | `errors.ts` 토큰 2종 추가 | `src/features/room/errors.ts` (+`errors.spec.ts`) | ✅ green |

### 마이그레이션 상세 (`20260616130000_room_lifecycle.sql`)

DDL 변경 없음(`delete_scheduled_at`·`delete_requested_by` 컬럼 선반영 가정). additive·idempotent(재실행 안전).

1. **`idx_rooms_delete_scheduled`** — 부분 인덱스(`where delete_scheduled_at is not null`). cron WHERE 스캔이 예약 행만 본다(비용 가드레일).
2. **`_delete_room_cascade(p_room_id)`** (신설, 내부 전용) — `storage.objects`의 `muklog-photos/{room_id}/%` 메타 선정리 → `delete from rooms` → FK CASCADE. `leave_room`(솔로)·`delete_expired_rooms` 공통 헬퍼(DRY, plan §3.5 "공통 함수"). `revoke all from public, anon, authenticated`(클라 호출 불가, DEFINER 컨텍스트 내부 호출만).
3. **`leave_room(p_room_id)`** (replace, 시그니처 동일) — 반환 `{ scheduled, room_deleted, delete_scheduled_at, room_id }`.
   - 멤버 아님 → 멱등 `{false,false,null,null}`.
   - `for update` 행잠금 → `member_count` 집계.
   - **커플(≥2)**: 이미 예약됨 → **멱등 no-op(요청자/시각 보존)**; 아니면 `delete_scheduled_at=now()+24h`·`delete_requested_by=auth.uid()` 설정, **멤버십·방 보존**.
   - **솔로(1)**: 본인 멤버십 삭제 → 잔여 0 → `_delete_room_cascade`(즉시 삭제+Storage).
4. **`cancel_room_deletion(p_room_id)`** (신설) — 반환 `{ canceled, room_id }`. `for update` 조회 → 방 없음/예약 null → `NOT_SCHEDULED`; `delete_requested_by != auth.uid()` → `NOT_DELETION_REQUESTER`; OK → 두 필드 NULL.
5. **`delete_expired_rooms()`** (신설, cron 전용) — `delete_scheduled_at is not null and delete_scheduled_at <= now()` 행만 루프 → `_delete_room_cascade`. **#2 자동삭제 predicate 없음**(폐기 §0). **예약 없는 솔로/일반 로그 절대 보존**. `revoke all from ... authenticated`(cron 슈퍼유저만).
6. **pg_cron 잡** — `do$$` 블록으로 `delete-expired-rooms` 잡 unschedule(있으면)→`cron.schedule('delete-expired-rooms','0 * * * *', ...)`. 멱등. pg_cron 확장 활성 가정(plan D1).
7. **`list_my_rooms()`** (drop+recreate, returns table) — 기존 6컬럼 + `delete_scheduled_at`·`delete_requested_by`.
8. **`get_room(p_room_id)`** (replace, jsonb) — 키 `delete_scheduled_at`·`delete_requested_by` 추가. 보안·집계 로직 불변.

### 경계면 매핑 (생산자 ↔ 소비자) — QA 교차검증용

| 생산자(SQL/RPC) | 응답/토큰 (snake) | 소비자(클라) | 매핑 (camel) |
|---|---|---|---|
| `leave_room(p_room_id)` | `{ scheduled, room_deleted, delete_scheduled_at, room_id }` | `useLeaveRoom.leaveRoom({roomId})` | `{ scheduled, roomDeleted, deleteScheduledAt, roomId }`. `scheduled`·`room_deleted` 비-boolean → `LEAVE_ROOM_BAD_RESPONSE` |
| `cancel_room_deletion(p_room_id)` | `{ canceled, room_id }` | `useCancelRoomDeletion.cancelRoomDeletion({roomId})` | `{ canceled, roomId }`. `canceled` 비-boolean → `CANCEL_ROOM_DELETION_BAD_RESPONSE` |
| `cancel_room_deletion` raise | `NOT_SCHEDULED` · `NOT_DELETION_REQUESTER` · `NOT_AUTHENTICATED` | `errors.ts ROOM_ERROR_MESSAGES` | `NOT_SCHEDULED`→"이미 삭제 예약이 해제됐거나 없는 로그예요." / `NOT_DELETION_REQUESTER`→"나가기를 요청한 사람만 취소할 수 있어요." (단일 출처, 토큰 12종) |
| `get_room(p_room_id)` | `+ delete_scheduled_at, delete_requested_by` | `useRoom` `RoomDetail` | `+ deleteScheduledAt, deleteRequestedBy` (null 흡수, 누락=정상·BAD_RESPONSE 오판 안 함) |
| `list_my_rooms()` | `+ delete_scheduled_at, delete_requested_by` 컬럼 | `useMyLogs` `MyLog` | `+ deleteScheduledAt, deleteRequestedBy` (null 흡수) |
| RPC 인자명 `p_room_id` | — | `supabase.rpc('leave_room'\|'cancel_room_deletion', { p_room_id })` | 정확 일치(C-LEAVE) |
| `rooms.delete_scheduled_at`(ISO) | — | `deletionCountdownLabel({ scheduledAt, now })` | "약 N시간 후 삭제"/"곧 삭제"(<1h)/"삭제 처리 중"(≤0) |
| cron 잡 `delete-expired-rooms` 매시 | predicate: `delete_scheduled_at <= now()`만 | — | #2 predicate 없음(폐기). 솔로 영구 보호 |
| Storage 경로 `{room_id}/{muklog_id}/{uuid}.jpg` (photoPath.ts) | `_delete_room_cascade`: `name like room_id||'/%'` | — | 프리픽스 규약 일치 |
| FK ON DELETE CASCADE (muklogs/muklog_photos/wishlist_items/room_members) | `delete from rooms` 단일 | — | 하위 자동 정리 |

### 취소권 판정 계약 (UI 배선 시 사용 — 다음 메시지)
- `useRoom`의 `RoomDetail.deleteScheduledAt != null` → 예약삭제 배너 노출.
- `deleteRequestedBy === meId` → 요청자(취소 버튼 노출 + `cancelRoomDeletion`). `!=` → 상대(안내만, 취소 버튼 없음).

### 비용 가드레일 (plan §8)
- ✅ **AWS 미사용** — pg_cron(in-DB) 전용.
- ✅ **외부 호출 0** — cron in-DB, Edge Function·HTTP·invocation 0. Storage 정리도 SQL 메타 DELETE(외부 API 0).
- ✅ **cron 매시** — 부분 인덱스(`idx_rooms_delete_scheduled`) 스캔 + 소수 DELETE → 부하 무시.
- ✅ **조회 폴링 없음** — 예약 상태는 진입/포커스 refresh(useRoom·useMyLogs 기존 정책 계승).
- ✅ **솔로 영구 보호(#2 폐기)** — cron은 `delete_scheduled_at` 있는 행만 삭제. **예약 없는 행 불가침**. 회귀 가드(`delete_expired_rooms` predicate에 자동삭제 조건 없음).

### 라이브 스모크 이월 (사용자 환경, plan §5 완료기준·§5-1)
SQL/RPC/cron은 단위 대상 아님 → 실 DB 검증 이월:
1. `pg_cron` 확장 활성(Dashboard→Database→Extensions) + `supabase db push`.
2. `leave_room` 커플 예약 / 솔로 즉시 / 멤버아님 멱등 / **동시 나가기(행잠금→둘째 멱등, 요청자 보존)**.
3. `cancel_room_deletion` 요청자 / 타인 거부(`NOT_DELETION_REQUESTER`) / 예약없음·방없음(`NOT_SCHEDULED`).
4. `select public.delete_expired_rooms();` 수동 1회 — 경과 행 삭제 / 미경과 보존 / **예약없는 솔로 로그 보존(#2 폐기 회귀 가드)** / `storage.objects` 메타 삭제 / CASCADE 하위 정리.
5. `select * from cron.job where jobname='delete-expired-rooms';` 등록 확인(매시 `0 * * * *`).
6. ⚠️ Storage 실파일 GC는 환경 의존 → 메타 삭제 후 고아 실파일 잔존 시 `pg_net` 후속(별도 결정, plan D5).

---

## ② UI 배선 (LogScreen, T9~T11) — ✅ 완료

ui-spec.md(§3 통합 레시피) + ui-publisher 컴포넌트(`LeaveLogSheets`·`ScheduledDeletionBanner`)에 **데이터·훅·nav만 배선**. 두 컴포넌트 비주얼·카피·토큰 **미변경**(props 바인딩만).

### 검증 결과
- `npm test`: **1094 passed / 130 suites** (백엔드 1081 + UI 배선 13, 회귀 0).
- `npx tsc --noEmit`: **통과**.

### 작업 항목 (plan §5 UI)

| T | 항목 | 산출 | 상태 |
|---|------|------|------|
| T9 | ⋯ 메뉴 + 나가기 확인 시트(커플/솔로 카피 분기) | `LogScreen.tsx` 헤더 ⋯ 버튼 + `LeaveLogSheets` 마운트(menuOpen/confirmOpen 상태) | ✅ green |
| T10 | 나가기 액션 배선 | `handleLeave`: leaveRoom → 커플(scheduled)=확인닫기+refresh / 솔로(roomDeleted)=goBack / 실패=시트유지(leaveError) | ✅ green |
| T11 | 예약삭제 배너 + 취소(요청자만) | `ScheduledDeletionBanner`(deleteScheduledAt!=null 게이팅) + `handleCancelDeletion`: cancelRoomDeletion → refresh / 실패=토스트+refresh | ✅ green |

### LogScreen 변경 (`src/navigation/screens/LogScreen.tsx`)
- import: `useLeaveRoom`·`useCancelRoomDeletion`·`deletionCountdownLabel`·`mapRoomError`·`LeaveLogSheets`·`ScheduledDeletionBanner`.
- 훅: `const { leaveRoom, loading: leaving, error: leaveError } = useLeaveRoom();` / `const { cancelRoomDeletion, loading: canceling } = useCancelRoomDeletion();`.
- 로컬 UI 상태(순수 boolean): `menuOpen`·`confirmOpen`.
- 헤더 행 우측 끝 `IconButton(MoreHorizontal, "더보기")` → `setMenuOpen(true)` (LogTitleButton flex:1로 우측 정렬).
- 헤더 아래·세그 위 `ScheduledDeletionBanner` 조건부(`room.deleteScheduledAt ? ... : null`), 세그 무관 항상 표시.
- `Screen` 말미 `LeaveLogSheets` 마운트(Toast 옆).
- `handleLeave`/`handleCancelDeletion` 핸들러(아래 매핑).

### 경계면 매핑 (생산자 ↔ 소비자) — UI 배선

| 생산자(훅/유틸) | 소비자(LogScreen) | 바인딩 |
|---|---|---|
| `useLeaveRoom().leaveRoom({roomId})` → `{scheduled, roomDeleted, deleteScheduledAt, roomId}` | `handleLeave` | `roomDeleted`→`setConfirmOpen(false)`+`navigation.goBack()` / `scheduled`→`setConfirmOpen(false)`+`refresh()` / reject→시트 유지(`leaveError` 인라인) |
| `useLeaveRoom().loading`·`.error` | `LeaveLogSheets` props | `leaving`·`leaveError` |
| `useCancelRoomDeletion().cancelRoomDeletion({roomId})` | `handleCancelDeletion` | 성공→`refresh()` / reject→`showToast({ mapRoomError(err), 'neutral' })`+`refresh()` |
| `useCancelRoomDeletion().loading` | `ScheduledDeletionBanner` | `canceling` |
| `useRoom().RoomDetail.deleteScheduledAt` | 배너 게이팅 + `deletionCountdownLabel({ scheduledAt, now: Date.now() })` | `deleteScheduledAt != null`일 때만 배너, `countdownLabel` 주입 |
| `RoomDetail.deleteRequestedBy` vs `meId` | `ScheduledDeletionBanner.isRequester` | `meId === room.deleteRequestedBy` → 취소 버튼 노출(요청자) / 아니면 안내만(상대) |
| `room.memberCount >= 2` (`isCouple`) | `LeaveLogSheets.isCouple` | 커플=24h 유예 카피 / 솔로=즉시 삭제 카피(분기) |
| `mapRoomError`(errors.ts) | 취소 실패 토스트 | `NOT_SCHEDULED`/`NOT_DELETION_REQUESTER`/네트워크 → 한국어 |

### UI 엣지케이스 처리
- 나가기 실패: 시트 닫지 않음(`leaveError` 인라인, 재시도 가능). goBack·refresh 미호출(상태 불변).
- 취소 실패(예: cron 선삭제 → `NOT_SCHEDULED`): 토스트 안내 + `refresh()`로 화면 정합(plan §6 race).
- 배너 게이팅: `deleteScheduledAt == null`이면 미렌더(빈 상태).
- 상대(요청자 아님): `isRequester=false` → 취소 버튼 미노출(컴포넌트 내부 이중 방어 + 게이팅).
- 솔로 삭제 후 목록 refresh: `goBack`만 수행(LogListScreen 포커스 정책이 목록 갱신 담당, 비용 §8 — 주기 폴링 0).

### qa-logic 교차검증 포인트
- `useLeaveRoom` 반환 4필드 ↔ `handleLeave` 분기(scheduled/roomDeleted) ↔ nav/refresh.
- `meId === deleteRequestedBy` 판정 ↔ 취소권(요청자만 `cancelRoomDeletion` 도달) — UI 게이팅 + RPC `NOT_DELETION_REQUESTER` 이중 방어.
- 배너 게이팅(`deleteScheduledAt`) ↔ get_room 투영(§① 경계면) ↔ `deletionCountdownLabel` 계산.
- `LeaveLogSheets`/`ScheduledDeletionBanner` 비주얼 미변경(presentational, props 바인딩만) — qa-visual은 패턴 정합 검증.
