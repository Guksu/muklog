# Sprint: room-lifecycle (sprint-20260616-room-lifecycle)

> 예약 삭제 라이프사이클 — 커플 로그 나가기 24h 유예/취소(#5) + 예약 경과 삭제 cron + Storage 정리. (#2 커플방 자동삭제는 폐기 — §0)
> 설계 SSOT: `docs/design/architecture.md` §1·§3(라인 62-64·123-126)·§5(room-lifecycle 행)·§7(라인 236-237·243).
> 선행: `room-leave`(즉시판·dormant), `multi-log-home`(`leave_room(p_room_id)` 인자화 선반영).

---

## 0. #2 자동삭제 폐기 결정 (확정)

**사용자 결정: #2(커플방 24h 미입장 자동삭제) = 폐기.** 자동삭제 없음, **솔로 로그 영구 유지.** 이번 스프린트는 **#5(나가기 24h 유예/취소) + Storage 정리**만 구현한다.

- **폐기 사유**: `create_room(p_mode default 'couple')` → **모든 신규 로그가 `mode='couple'`**(멀티로그 전환 후 모드 선택 폐기, architecture 라인 119; `rooms.mode`는 stale·미사용 라인 244). 따라서 #2 기준 "`mode='couple'` & 멤버 1명 & `created_at+24h` → 삭제"를 문자 그대로 구현하면 **콘텐츠 유무와 무관하게 모든 1인(솔로) 로그를 생성 24h 후 삭제**하는 데이터 유실 버그가 된다. 멀티로그 모델에서 1인 로그는 **정당한 영구 솔로 로그**다 → #2 전제(구 room-modes 시절 "커플 의도로 만든 방에 파트너가 안 옴")가 소멸. → **#2 폐기, 솔로 영구 유효.**
- **cron 범위**: `delete_expired_rooms()`는 **#5 예약 경과(`delete_scheduled_at <= now()`) 방 삭제 + Storage 정리**만 수행한다. 자동삭제 predicate 없음.
- architecture.md(SSOT) 라인 124 #2·§5 백로그·§7 미정사항에 본 결정·사유 반영(별도 갱신).

> 그 외 결정(cron 인프라·주기·leave 재설계·취소 RPC·Storage·UI 범위·디자인 출처)은 §1에서 확정한다.

---

## 1. 기능 한줄 정의 + 확정 결정

**이 스프린트가 끝나면**: 커플 로그(2명)에서 한 명이 "로그 나가기"를 누르면 로그가 **24시간 뒤 삭제 예약**되고, 나간 사람은 그 안에 **취소**할 수 있다. 미취소 시 in-DB cron이 예약 경과 로그를 **방+모든 기록+Storage 사진까지** 자동 삭제한다. 솔로 로그 나가기는 기존처럼 **즉시 삭제**된다.

**UI 동반 여부: ✅ UI 동반 스프린트** (백엔드 + LogScreen 나가기 진입점·예약삭제 배너·취소 버튼). 단, **디자인 출처는 킷 비종속**(§ D7).

### 결정 표

| # | 결정 항목 | 결정 | 근거(비용 가드레일 포함) |
|---|----------|------|----------|
| D1 | **cron 인프라** | **pg_cron** (Supabase in-DB 확장) | in-DB → **외부 호출 0·함수 invocation 0** → 호출 비용 0(가드레일 우위). 스케줄 Edge Function은 별도 스케줄러 + invocation 소모 + 운영부품 증가. pg_cron은 무료 티어 포함. 활성화: Supabase Dashboard→Database→Extensions에서 `pg_cron` 활성(또는 마이그레이션 `create extension`). cron 잡은 `postgres` DB에서 실행 |
| D2 | **cron 주기** | **매시** `'0 * * * *'` | 24h 윈도우 → 매시면 데드라인 초과 지연 ≤1h(허용). 매일은 최대 ~24h 추가 지연. in-DB·인덱스 DELETE라 run당 비용 무시 가능 → 매시 채택 |
| D3 | **leave_room(p_room_id) 재설계** | 커플(2명)=유예 예약 / 솔로(1명)=즉시 삭제 | architecture #5·라인 125. 커플은 전체 로그 24h 예약, 솔로/0명은 기존 즉시판 유지(라인 122). 인자명 `p_room_id`(C-LEAVE, 기존 훅 계약 보존) |
| D4 | **취소 RPC** | **`cancel_room_deletion(p_room_id)`** — 나간 사람(`delete_requested_by`)만 | 두 필드 NULL로 복원. DEFINER + 내부 `auth.uid()==delete_requested_by` 검증(타인 거부) |
| D5 | **삭제 시 Storage 정리** | cron 삭제 함수가 **`storage.objects` 내 `muklog-photos/{room_id}/%` 메타행 DELETE** 를 방 행 삭제와 같은 트랜잭션에서 수행 | 외부 호출 0 유지(가드레일). row DELETE의 CASCADE는 DB만 정리 → Storage 고아 방지. ⚠️ 백엔드 S3 실파일 GC는 Supabase 환경 의존 → **라이브 스모크로 확인**, 고아 잔존 시 `pg_net` 후속(별도 결정). 현재 버킷은 `muklog-photos`뿐(영상 `muklog-media`는 muklog-video 스프린트·미생성 → 이번 OUT) |
| D6 | **나가기 진입점** | **포함** — LogScreen 헤더 ⋯ 메뉴 → "로그 나가기" | 현재 진입점 없음(Profile 제거됨·`leave_room` dormant). 기능이 사용자에게 닿으려면 진입점 필수 → 포함 |
| D7 | **UI 디자인 출처** | **킷 비종속** | 킷 `templates/muklog`에 나가기/예약삭제/취소 UI **없음**(grep 확인: mk-log의 `menuOpen`/`SHEET2`/`MenuRow danger`/확인시트는 **MuklogDetail 편집·삭제용**). → 나가기 메뉴·확인시트·예약 배너·취소는 **MuklogDetail의 ⋯메뉴+danger 확인시트 패턴 + 기존 프리미티브 재사용**으로 구성. qa-visual은 킷 대조 대신 **기존 패턴 정합**으로 검증 |

---

## 2. 범위

**In-scope**
- 마이그레이션: `delete_scheduled_at`/`delete_requested_by` 활용(컬럼 선반영됨), `leave_room(p_room_id)` 본문 교체(유예 모델), `cancel_room_deletion(p_room_id)` 신설, `delete_expired_rooms()` cron 함수 + `pg_cron` 잡 등록, Storage 메타 정리.
- `list_my_rooms`/`get_room` 응답에 `delete_scheduled_at`·`delete_requested_by` 투영.
- 클라 훅: `useLeaveRoom` 결과 확장(scheduled), `useCancelRoomDeletion` 신설, `useRoom`/`useMyLogs` 필드 확장, 에러 토큰 추가.
- LogScreen: ⋯ 메뉴 → 나가기 확인시트(커플=유예 카피 / 솔로=즉시 카피), 예약삭제 배너(요청자=취소 버튼 / 상대=안내만), 카운트다운 라벨 유틸.
- cron이 **#5(예약 경과)** 만 확정 삭제.

**Out-of-scope (다음 스프린트)**
- **#2 커플방 24h 미입장 자동삭제 — 폐기**(§0, 사용자 결정). 솔로 로그 영구 유지. cron은 #5 예약 경과만 처리.
- push 알림(상대가 나갔어요/곧 삭제 — 다음 스프린트).
- 솔로방 유예(미적용 — 즉시 삭제 유지).
- 영상 버킷 `muklog-media` 정리(muklog-video 스프린트·버킷 미생성).
- LogList 카드의 예약삭제 배지(주 표면은 LogScreen; 카드 배지는 후속 가능).
- `pg_net` 기반 Storage 실파일 강제 삭제(고아 확인 시 후속).
- Realtime로 상대에게 예약/취소 실시간 반영(폴링/포커스 refresh로 대체).

---

## 3. 데이터 · API 계약

### 3.1 컬럼 (선반영됨 — DDL 변경 없음)
`rooms.delete_scheduled_at timestamptz NULL` · `rooms.delete_requested_by uuid → profiles NULL` (architecture 라인 62-64). 부분 인덱스 신설:
```sql
create index if not exists idx_rooms_delete_scheduled
  on public.rooms (delete_scheduled_at)
  where delete_scheduled_at is not null;  -- cron 스캔 비용 최소화(예약된 행만)
```

### 3.2 `leave_room(p_room_id uuid)` 재설계 (replace, DEFINER)
반환 jsonb: `{ "scheduled": <bool>, "room_deleted": <bool>, "delete_scheduled_at": <timestamptz|null>, "room_id": <uuid|null> }`
로직(기존 room-leave 안전장치 유지: auth → 멤버 멱등 → **행 잠금** → 분기):
- **멤버 아님** → `{ scheduled:false, room_deleted:false, delete_scheduled_at:null, room_id:null }` (멱등).
- `for update`로 `rooms` 행 잠금(동시성 직렬화).
- `member_count` 계산.
- **member_count ≥ 2 (커플)**:
  - 이미 `delete_scheduled_at` 설정됨 → **멱등 no-op**(요청자 덮어쓰지 않음) → 현재 예약값 반환.
  - 아니면 `update rooms set delete_scheduled_at = now()+interval '24 hours', delete_requested_by = v_uid where id=p_room_id`.
  - **멤버십 제거 안 함, 방 삭제 안 함**(전체 로그가 예약 대상).
  - → `{ scheduled:true, room_deleted:false, delete_scheduled_at:<값>, room_id:p_room_id }`.
- **member_count = 1 (솔로)**:
  - 본인 행 `delete from room_members where room_id=p_room_id and user_id=v_uid` → 잔여 0 → `delete from rooms where id=p_room_id`(+ Storage 정리 §3.5 공통 함수 호출).
  - → `{ scheduled:false, room_deleted:true, delete_scheduled_at:null, room_id:p_room_id }`.
- 에러: `NOT_AUTHENTICATED`.
- ⚠️ DEFINER → RLS 우회 → 모든 쓰기 `user_id=auth.uid()`/`id=p_room_id` 스코프 명시(C-RLS).

### 3.3 `cancel_room_deletion(p_room_id uuid)` 신설 (DEFINER)
반환 jsonb: `{ "canceled": <bool>, "room_id": <uuid|null> }`
로직: auth → `for update` 잠금 → 행 조회:
- 방 없음(이미 삭제) → `NOT_SCHEDULED`.
- `delete_scheduled_at is null` → `NOT_SCHEDULED`.
- `delete_requested_by <> v_uid` → `NOT_DELETION_REQUESTER` (타인·상대 거부).
- OK → `update rooms set delete_scheduled_at=null, delete_requested_by=null` → `{ canceled:true, room_id:p_room_id }`.
- 에러: `NOT_AUTHENTICATED` · `NOT_SCHEDULED` · `NOT_DELETION_REQUESTER`.

### 3.4 `delete_expired_rooms()` cron 함수 + pg_cron 잡
```sql
create or replace function public.delete_expired_rooms()
returns void language plpgsql security definer set search_path = public, storage as $$
declare r record;
begin
  -- #5 예약 경과 로그만 삭제. (#2 자동삭제는 폐기 — §0. 솔로/예약없는 로그는 절대 건드리지 않음.)
  for r in
    select id from public.rooms
    where delete_scheduled_at is not null and delete_scheduled_at <= now()
  loop
    -- Storage 메타 정리(D5): 버킷 첫 세그먼트=room_id. CASCADE 전에 선정리.
    delete from storage.objects
      where bucket_id = 'muklog-photos' and name like r.id::text || '/%';
    -- 방 삭제 → muklogs/muklog_photos/wishlist_items/room_members FK CASCADE.
    delete from public.rooms where id = r.id;
  end loop;
end;
$$;
revoke all on function public.delete_expired_rooms() from public, anon, authenticated;
-- pg_cron 등록(매시):
select cron.schedule('delete-expired-rooms', '0 * * * *', $$select public.delete_expired_rooms();$$);
```
- FK CASCADE 확인됨: `muklogs.room_id`→rooms ON DELETE CASCADE / `muklog_photos.muklog_id`→muklogs CASCADE / `wishlist_items.room_id`→rooms CASCADE / `room_members.room_id`→rooms CASCADE.
- ⚠️ `cron.schedule`은 재실행 시 같은 jobname이면 갱신/중복 주의 → 마이그레이션에서 `cron.unschedule('delete-expired-rooms')`를 `if exists`로 선행하거나 동일 jobname 멱등 등록.
- 함수는 cron(슈퍼유저 컨텍스트)에서만 실행 → authenticated grant 없음(클라 호출 불가).

### 3.5 `list_my_rooms()` / `get_room(p_room_id)` 투영 확장
두 RPC 반환에 추가: `delete_scheduled_at timestamptz` · `delete_requested_by uuid`. (DEFINER라 멤버면 조회 가능; 클라가 `delete_requested_by == meId`로 취소권 판정.)

### 3.6 클라 훅 시그니처
- `useLeaveRoom`: `leaveRoom({ roomId }) → Promise<{ scheduled: boolean; roomDeleted: boolean; roomId: string|null; deleteScheduledAt: string|null }>`. snake→camel 매핑(`scheduled`/`room_deleted`/`delete_scheduled_at`/`room_id`). `room_deleted` 또는 `scheduled` 타입 검증 실패 → `LEAVE_ROOM_BAD_RESPONSE`.
- `useCancelRoomDeletion`(신설): `cancelRoomDeletion({ roomId }) → Promise<{ canceled: boolean; roomId: string|null }>`. 실패 시 `mapRoomError`로 한국어 메시지 + throw.
- `useRoom`(get_room) `RoomDetail`에 `deleteScheduledAt: string|null`·`deleteRequestedBy: string|null` 추가.
- `useMyLogs` `MyLog`에 동일 2필드 추가(LogList 배지·후속 대비, 이번 표시는 OUT이나 계약은 투영).
- `errors.ts` `ROOM_ERROR_MESSAGES` 추가: `NOT_SCHEDULED: '이미 삭제 예약이 해제됐거나 없는 로그예요.'` · `NOT_DELETION_REQUESTER: '나가기를 요청한 사람만 취소할 수 있어요.'`.

### 3.7 순수 유틸
`deletionCountdownLabel({ scheduledAt, now }): string` — `scheduledAt - now` → "약 N시간 후 삭제" / <1h "곧 삭제" / 경과 "삭제 처리 중". camelCase, 화살표 함수, named-args(컨벤션).

---

## 4. 화면 · UX (LogScreen, 킷 비종속)

- **헤더 ⋯ (more-horizontal) 버튼** 추가(기존 뒤로가기+제목 행 우측). 탭 → **메뉴 시트**(MuklogDetail SHEET2/MenuRow 패턴 재사용): "로그 나가기"(danger, trash 아이콘).
- **나가기 확인 시트**(danger 확인 패턴):
  - 커플(memberCount≥2): 제목 "로그에서 나갈까요?" / 본문 "이 로그가 **24시간 뒤 삭제**돼요. 그 전에 다시 들어와 취소할 수 있어요. (상대의 기록도 함께 사라져요.)" / danger 버튼 "나가기" + ghost "취소".
  - 솔로(memberCount==1): 제목 "로그를 삭제할까요?" / 본문 "이 로그와 모든 기록이 사라져요. **되돌릴 수 없어요.**" / danger "삭제하기" + ghost "취소".
- **예약삭제 배너**(`room.deleteScheduledAt != null`일 때 헤더 아래·세그 위에 노출, status-negative weak 톤):
  - 요청자(`meId == deleteRequestedBy`): "이 로그는 {deletionCountdownLabel} 예정이에요" + **"삭제 취소"** 버튼(→ `cancelRoomDeletion` → 성공 시 refresh로 배너 사라짐).
  - 상대(요청자 아님): "상대가 로그에서 나가 {deletionCountdownLabel} 예정이에요" (취소 버튼 없음 — info만).
- **상태**: 로딩(기존 spinner) / 빈상태(N/A) / 에러(useLeaveRoom·useCancelRoomDeletion error → Toast 또는 시트 내 메시지) / 성공:
  - 커플 나가기 성공 → 시트 닫고 `refresh()` → 예약 배너 표시(화면 유지).
  - 솔로 삭제 성공 → `navigation.goBack()`(목록 복귀, 로그 사라짐) + 목록 refresh.
  - 취소 성공 → `refresh()` → 배너 사라짐.
- **원티드 토큰**: danger=`status-negative`(#E5484D 토큰), 배너 배경=negative weak, 버튼 radius=`radius.btn`, 간격=spacing 그리드. raw hex 0.

---

## 5. 작업 목록 (각 인수조건 + 테스트)

### 백엔드 (마이그레이션 — SQL은 스모크/계약, 라이브 `supabase db push` 후 검증)
- [ ] **T1. 부분 인덱스 + `leave_room(p_room_id)` 유예 모델 교체** — 인수조건: 커플(2명) 호출 → `delete_scheduled_at≈now+24h`·`delete_requested_by=호출자` 설정, 멤버십·방 보존, 반환 `scheduled:true,room_deleted:false`. 솔로(1명) 호출 → 방+하위 즉시 삭제, 반환 `room_deleted:true`. 멤버 아님 → 멱등 `room_id:null`. — 테스트: RPC 스모크(커플 예약/솔로 즉시/멱등 3케이스).
- [ ] **T2. `cancel_room_deletion(p_room_id)` 신설** — 인수조건: 요청자 호출 → 두 필드 NULL·`canceled:true`. 비요청자(상대) → `NOT_DELETION_REQUESTER`. 예약 없음/방 없음 → `NOT_SCHEDULED`. — 테스트: RPC 스모크 3케이스.
- [ ] **T3. `delete_expired_rooms()` + pg_cron 매시 잡 + Storage 메타 정리** — 인수조건: `delete_scheduled_at<=now`인 방만 삭제(미래 예약·**NULL 예약(솔로 포함) 절대 보존**), 삭제 시 `storage.objects muklog-photos/{room_id}/%` 행 제거 + DB CASCADE. `cron.schedule('delete-expired-rooms','0 * * * *',...)` 등록(멱등). **#2 자동삭제 predicate 없음(폐기, §0).** — 테스트: 함수 직접 호출 스모크(경과 행 삭제·미경과 보존·**예약없는 솔로 로그 보존**·Storage 메타 삭제 확인).
- [ ] **T4. `list_my_rooms`/`get_room` 투영 확장** — 인수조건: 두 RPC 응답에 `delete_scheduled_at`·`delete_requested_by` 포함(예약 없으면 null). — 테스트: 응답 shape 스모크 + 훅 매핑 단위테스트(T6).

### 클라이언트 (단위 테스트 — jest-expo + RNTL)
- [ ] **T5. `useLeaveRoom` 결과 확장** — 인수조건: scheduled 응답 → `{scheduled:true,roomDeleted:false,deleteScheduledAt:<iso>}` 매핑. deleted 응답 → `{roomDeleted:true}`. bad shape → `LEAVE_ROOM_BAD_RESPONSE`. — 테스트: supabase.rpc 모킹 3케이스.
- [ ] **T6. `useCancelRoomDeletion` 신설 + `useRoom`/`useMyLogs` 필드 확장** — 인수조건: cancel 성공 매핑 / 에러 시 한국어 메시지·throw. useRoom·useMyLogs가 두 필드 노출(null 흡수). — 테스트: rpc 모킹 정상·실패, 매핑 단위.
- [ ] **T7. `deletionCountdownLabel` 유틸** — 인수조건: 23h→"약 23시간 후 삭제", 40m→"곧 삭제", 경과→"삭제 처리 중". — 테스트: 경계값 단위테스트.
- [ ] **T8. `errors.ts` 토큰 2종 추가** — 인수조건: `NOT_SCHEDULED`·`NOT_DELETION_REQUESTER` 정확/포함 매칭. — 테스트: mapRoomError 단위.

### UI (LogScreen — 단위/렌더 테스트)
- [ ] **T9. ⋯ 메뉴 + 나가기 확인 시트(커플/솔로 카피 분기)** — 인수조건: ⋯ 탭→메뉴 노출, "로그 나가기" 탭→확인시트, 커플이면 "24시간 뒤 삭제" 카피·솔로면 "되돌릴 수 없어요" 카피. — 테스트: memberCount 2/1 각각 카피 렌더 검증.
- [ ] **T10. 나가기 액션 배선** — 인수조건: 커플 확인→`leaveRoom`→성공 시 refresh·배너 표시(화면 유지). 솔로 확인→성공 시 `goBack`. — 테스트: leaveRoom 모킹, scheduled→refresh 호출·deleted→goBack 호출 검증.
- [ ] **T11. 예약삭제 배너 + 취소 버튼(요청자만)** — 인수조건: `deleteScheduledAt!=null`이고 `meId==deleteRequestedBy` → 배너+취소 버튼, 취소 탭→`cancelRoomDeletion`→refresh. `meId!=deleteRequestedBy` → 배너만(취소 버튼 없음). `deleteScheduledAt==null` → 배너 없음. — 테스트: 3분기 렌더 + 취소 핸들러 호출 검증.

### 완료 기준
- [ ] `npm test` 전체 green (신규 단위/모킹 포함, 회귀 0).
- [ ] `npx tsc --noEmit` 통과.
- [ ] 라이브 스모크 이월 명시: `pg_cron` 확장 활성 + `supabase db push` + cron 1회 수동 실행(`select delete_expired_rooms();`)으로 삭제·Storage 정리 검증.

---

## 5-1. 테스트 케이스 (TDD)

**단위(유틸/훅/화면) ✅**
- `deletionCountdownLabel`: 23h30m→"약 23시간 후", 59m→"곧 삭제", -5m(경과)→"삭제 처리 중", 정확히 0 경계.
- `useLeaveRoom`: 커플 scheduled 매핑 / 솔로 deleted 매핑 / 멤버아님 null / bad shape 에러.
- `useCancelRoomDeletion`: 성공 매핑 / `NOT_DELETION_REQUESTER` 메시지 / `NOT_SCHEDULED` 메시지 / 네트워크 기본 메시지.
- `mapRoomError`: 신규 2토큰 정확·포함 매칭.
- `useRoom`/`useMyLogs`: 두 필드 투영·null 흡수.
- LogScreen: 메뉴→확인시트 카피 분기(커플/솔로), 배너 3분기(요청자/상대/없음), 취소·나가기 핸들러 호출.

**모킹/스모크(SQL·RPC) — 라이브 검증 이월**
- `leave_room` 커플 예약 / 솔로 즉시 / 멤버아님 멱등 / **동시 나가기**(행잠금 → 둘째 멱등, 요청자 보존).
- `cancel_room_deletion` 요청자 / 타인 거부 / 예약없음 / 방없음.
- `delete_expired_rooms` 경과 삭제 / 미경과 보존 / **예약없는 솔로 로그 보존(#2 폐기 회귀 가드)** / Storage 메타 삭제 / CASCADE 하위 정리.

---

## 6. 엣지케이스

- **동시 나가기(커플 2명)**: 둘이 동시에 leave → `for update` 직렬화. 첫째가 예약+요청자 설정, 둘째는 "이미 예약됨" → **멱등 no-op(요청자 보존)** → 요청자 탈취 방지.
- **요청자 취소 ↔ cron 경합**: 취소가 먼저 → cron WHERE 불일치(보존). cron이 먼저 삭제 → 취소가 방 없음 → `NOT_SCHEDULED`(멱등 처리·UI는 목록 복귀).
- **타인(상대) 취소 시도**: `NOT_DELETION_REQUESTER`. UI는 상대에게 취소 버튼 미노출(이중 방어).
- **이미 삭제된 방에 leave/cancel**: 멤버/행 없음 → `room_id:null` 멱등 또는 `NOT_SCHEDULED`. 크래시 없음.
- **솔로 로그 나가기**: 유예 미적용 → 즉시 삭제(0명) + Storage 정리. 예약 경로 안 탐.
- **재예약(요청자 재나가기)**: 이미 예약된 방에서 요청자가 다시 나가기 → 멱등(예약 유지).
- **권한/RLS**: leave/cancel/delete 모두 DEFINER → 내부 `auth.uid()` 스코프. 비멤버는 get_room 단계서 `NOT_A_MEMBER`(기존).
- **네트워크 실패**: leave/cancel 실패 → 목록·배너 불변(refresh 기반 롤백), Toast 에러.
- **빈 상태**: 예약 없는 정상 로그 → 배너 미노출.
- **Storage 고아**: cron이 `storage.objects` 메타 삭제 → 실파일 GC는 환경 의존(라이브 확인 항목). 영상 버킷은 이번 OUT.
- **솔로 로그 보호(#2 폐기, §0)**: cron은 `delete_scheduled_at` 있는 행만 삭제 → 예약 없는 솔로 로그는 24h 지나도 **절대 삭제 안 됨**(영구). 회귀 가드 테스트로 강제(§5-1).

---

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

- `leave_room` 반환 jsonb(snake) ↔ `useLeaveRoom` 매핑(`scheduled`/`room_deleted`/`delete_scheduled_at`/`room_id`).
- `cancel_room_deletion` 에러토큰 ↔ `errors.ts` `ROOM_ERROR_MESSAGES`(`NOT_SCHEDULED`·`NOT_DELETION_REQUESTER`) — SQL `raise` ↔ 매핑 단일 출처 동기화.
- `list_my_rooms`/`get_room` 투영 컬럼 ↔ `MyLog`/`RoomDetail` 필드(`deleteScheduledAt`·`deleteRequestedBy`) ↔ LogScreen 배너 분기(`meId==deleteRequestedBy`).
- RPC 인자명 `p_room_id` ↔ 훅 `supabase.rpc(..., { p_room_id })` (C-LEAVE).
- cron 잡 등록 jobname/주기 ↔ `delete_expired_rooms` predicate(예약 경과만, #2 보류).
- FK ON DELETE CASCADE(muklogs/muklog_photos/wishlist_items/room_members) ↔ cron 단일 `delete from rooms`.
- Storage 경로 규약 `{room_id}/{muklog_id}/{uuid}.jpg`(photoPath.ts) ↔ cron `name like room_id||'/%'` 프리픽스.
- LogScreen 메뉴/확인시트 패턴 ↔ MuklogDetail 기존 패턴(qa-visual: 킷 비종속·기존 패턴 정합).

---

## 8. 비용 가드레일 체크

- [x] **AWS 미사용** — Supabase pg_cron(in-DB) 전용. 외부 스케줄러/AWS 0.
- [x] **외부 호출 0** — cron in-DB, Edge Function·HTTP·invocation 0(D1). Storage 정리도 SQL 메타 DELETE(외부 API 미호출).
- [x] **cron 주기 매시** — run당 인덱스 부분스캔(`idx_rooms_delete_scheduled`, 예약 행만) + 소수 DELETE → 부하·비용 무시 가능(D2).
- [x] **Kakao 호출 0** — 이 기능은 장소 검색 무관.
- [x] **조회 폴링 없음** — 예약 상태는 진입/포커스 refresh(useMyLogs·useRoom 기존 정책 계승), 주기 폴링 금지.
- [x] **Storage 정리로 고아 방지** — 삭제 경로에서 메타 선정리(D5), 무료 티어 용량 보호.
- [x] **#2 자동삭제 폐기** — 솔로 로그 오삭제 방지(§0, 사용자 결정). cron은 #5 예약 경과만 삭제.
</content>
</invoke>
