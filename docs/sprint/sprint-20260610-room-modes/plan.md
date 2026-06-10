# Sprint: 솔로/커플 방 모드 (생성 시 선택) (room-modes)

> 입력: `docs/design/architecture.md`(§1 방 모드 결정, §3 데이터 모델 `rooms.mode`/삭제 라이프사이클·정원 트리거 모드화, §4 Onboarding 모드 선택, §5 백로그 `room-modes` 행, §7 솔로→커플 전환).
> 기존 산출: `docs/sprint/sprint-20260609-invite-room/plan.md`(계약 스타일), `supabase/migrations/20260609120000_invite_room.sql`(rooms/room_members 스키마·정원 트리거·RLS·create_room/join_room RPC), `src/features/room/*`.
> 산출물: 이 plan.md → developer 구현(dev-notes.md) → qa-inspector 검증(qa-report.md). **TDD 전제**(Red→Green→Refactor, `npm test` 통과가 완료 기준).

---

## 1. 기능 한줄 정의

방을 만들 때 사용자가 **솔로방(혼자, 정원 1, 영구)** 또는 **커플방(둘이, 정원 2, 초대코드 공유)** 중 하나를 **생성 시점에 선택**하고, 선택한 모드대로 방·멤버십이 만들어진다. 솔로방은 코드 공유 화면 없이 곧장 방으로 진입하고, 커플방은 기존 초대코드 흐름을 그대로 따른다. 정원·입장 거부는 **모드별 정원**으로 정확히 동작한다.

---

## 2. 범위

### In-scope
- **마이그레이션 확장**(`supabase/migrations/20260610130000_room_modes.sql`):
  - `rooms`에 `mode text NOT NULL`(`'solo'|'couple'`, CHECK 제약) 컬럼 추가 + **기존 행 backfill `'couple'`**.
  - `rooms`에 `delete_scheduled_at timestamptz` / `delete_requested_by uuid → profiles` **선반영(스키마만)**.
  - 정원 트리거 `enforce_room_capacity()` **모드별 일반화**(solo=1, couple=2).
  - `create_room()` → **`create_room(p_mode text default 'couple')`** 시그니처 변경(⚠️ 기존 무인자 오버로드 **DROP 후 재생성**).
  - `join_room()`에 **솔로방 입장 거부 가드** 추가(`SOLO_ROOM_NOT_JOINABLE`).
- **프론트 계약**: `useCreateRoom().createRoom({ mode })` 시그니처화 + 반환에 `mode` 추가. `RoomMode` 타입·정원 상수.
- **에러 매핑 확장**: `INVALID_MODE`, `SOLO_ROOM_NOT_JOINABLE` 토큰 추가(`errors.ts`, C2).
- **Onboarding 모드 선택 UI**: "방 만들기" → 모드 선택 step(솔로/커플). 솔로 성공 시 코드 화면 생략하고 즉시 RoomTabs, 커플 성공 시 기존 코드 표시 흐름.
- **회귀 보장**: 기존 커플방 생성/입장(invite-room)이 동작·테스트 모두 깨지지 않음.

### Out-of-scope (다음 조각/스프린트)
- **솔로 → 커플 전환(초대코드 사후 발급)**: 본 plan §9에 **설계만 구체화**(architecture §7 요구 충족)하고 **구현은 분리 제안 → 차기 `room-promote` 스프린트**. 근거는 §9·§2 결정 박스 참조.
- **삭제 라이프사이클 동작**: `delete_scheduled_at`/`delete_requested_by`는 **컬럼만 선반영**. 나가기 UI·취소·자동삭제 cron은 `room-lifecycle` 스프린트(architecture §5·§7).
- **Room 헤더/탭 화면**: RoomTabs는 아직 stub(`room-tabs` 스프린트 예정). 본 스프린트는 생성 후 RoomTabs로 reset 전이까지만(기존과 동일).
- 먹로그/지도/Storage/Kakao/Realtime/프로필 편집.

---

## 2-결정. 솔로↔커플 전환을 이번 스프린트에 넣지 않는 이유 (명시)

architecture §7은 "솔로방의 커플 전환(초대코드 사후 발급) **상세 흐름**을 room-modes 스프린트에서 **구체화**"하라고 한다. 본 plan은 그 요구를 **§9에서 설계로 구체화**하되 **구현은 분리**한다. 근거:
1. **1 스프린트 = 1 기능**: 이번 단일 기능은 "생성 시 모드 선택 + 정원 모드화"다. 전환은 별도 사용자 흐름(새 RPC·새 UI·invite_code 가시성 토글)이다.
2. **전환 UI를 둘 곳이 없음**: 전환 진입점은 architecture §4상 **Room 헤더**인데, Room/RoomTabs 화면은 아직 stub(`room-tabs` 스프린트 미진행). 지금 구현하면 둘 곳이 없어 임시 UI를 만들어야 함 → 낭비·재작업.
3. **스키마는 전환을 미리 지원**: 솔로방도 invite_code를 발급(§3.1 결정)하므로, 차기 전환 스프린트는 `mode` 플립 + 정원 1→2만 하면 되어 **코드 재생성 불필요**. 즉 이번 스프린트가 전환의 **선결 조건을 완비**한다.

→ team-lead: 위 결정에 이견 있으면 알려주세요. 기본은 **전환 OUT-OF-SCOPE + §9 설계 구체화**로 진행합니다.

---

## 3. 데이터 · API 계약

> 마이그레이션은 **새 파일** `supabase/migrations/20260610130000_room_modes.sql`(기존 invite_room.sql은 수정하지 않음 — 이미 적용된 환경 고려, ALTER로 증분). 재실행 가능(idempotent)하게 작성. 실 Supabase 적용은 **사용자 환경 의존**(dev-notes 명시).

### 3.1 `rooms` 컬럼 추가 + backfill (DDL 요지)

```sql
-- mode: 생성 시 확정. solo=정원1 / couple=정원2.
alter table public.rooms
  add column if not exists mode text not null default 'couple'
    check (mode in ('solo', 'couple'));
-- ↑ add column ... default 'couple' 가 기존 행을 'couple'로 backfill(전부 커플방이었음). 회귀-안전.
--   default는 유지(직접 insert 차단되어 사실상 create_room만 기록, 안전망으로 'couple' 둠).

-- 삭제 라이프사이클 — 선반영(스키마만, 동작은 room-lifecycle 스프린트)
alter table public.rooms
  add column if not exists delete_scheduled_at timestamptz;     -- NULL=예약 없음
alter table public.rooms
  add column if not exists delete_requested_by uuid references public.profiles(id);
```

> **결정: 솔로방도 `invite_code`를 서버 생성한다(`NOT NULL UNIQUE` 유지).**
> - 회귀-안전: `invite_code` 컬럼 제약을 건드리지 않음(nullable 완화·backfill 불필요).
> - 전환-준비: 차기 솔로→커플 전환 시 코드가 이미 있어 재생성 불필요(§9).
> - 단, 솔로방 코드는 **UI에 노출하지 않고** `join_room`이 **입장 거부**한다(§3.4). 즉 발급은 하되 "사용되지 않는" 코드.

### 3.2 정원 트리거 모드별 일반화

```sql
create or replace function public.enforce_room_capacity()
returns trigger language plpgsql as $$
declare
  v_capacity int;
  v_count    int;
begin
  -- 모드별 정원: solo=1, couple=2
  select case when mode = 'solo' then 1 else 2 end
    into v_capacity
    from public.rooms where id = new.room_id;
  if v_capacity is null then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;

  select count(*) into v_count
    from public.room_members where room_id = new.room_id;
  if v_count >= v_capacity then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;
  return new;
end; $$;
-- 트리거 재바인딩은 invite_room.sql 것 재사용(이미 before insert on room_members). create or replace로 본문만 교체.
```

- **회귀**: couple 정원은 여전히 2. 기존 invite-room 동시성/3번째 입장 테스트 의미 보존.
- solo 정원 1: 생성자 본인(0→1)은 통과, 그 이후 어떤 멤버 insert도 `ROOM_FULL`.

### 3.3 `create_room(p_mode text default 'couple')` RPC

> ⚠️ **마이그레이션 함정**: 기존 함수는 `create_room()`(무인자). `create or replace function create_room(p_mode text ...)`는 시그니처가 달라 **새 오버로드를 추가**할 뿐 기존 무인자 함수를 남긴다 → 두 오버로드 공존으로 `rpc('create_room')` 호출이 모호해질 수 있음. **반드시 먼저 `drop function if exists public.create_room();`** 로 무인자 버전을 제거한 뒤 새 함수를 생성한다. (권한 grant/revoke도 새 시그니처로 재선언.)

반환: `{ "room_id": "<uuid>", "invite_code": "<6자리>", "mode": "<solo|couple>" }`

동작(기존 invite_room §3.5 흐름 + mode 반영):
1. `v_uid := auth.uid()`; null → `raise 'NOT_AUTHENTICATED'`.
2. **모드 검증**: `p_mode`가 `'solo'|'couple'` 아니면 `raise 'INVALID_MODE'`.
3. `profiles` 안전망 upsert(`on conflict do nothing`).
4. 이미 방 멤버면 `raise 'ALREADY_IN_ROOM'`(1인 1방 불변식).
5. 코드 생성 루프(기존 charset/8회 재시도 동일) — **솔로/커플 공통으로 발급**.
   `insert into rooms(invite_code, created_by, mode) values(code, v_uid, p_mode)`.
6. `insert into room_members(room_id, user_id) values(new_room_id, v_uid)`(트리거 0→1 통과, solo·couple 공통).
7. `return jsonb_build_object('room_id', new_room_id, 'invite_code', code, 'mode', p_mode)`.

| 에러 토큰 | 조건 |
|-----------|------|
| `NOT_AUTHENTICATED` | 세션 없음 |
| `INVALID_MODE` | `p_mode ∉ {solo, couple}` (신규) |
| `ALREADY_IN_ROOM` | 호출자가 이미 방 멤버 |
| `CODE_GENERATION_FAILED` | 코드 충돌 8회 연속 |

> **회귀**: 인자 없이 `rpc('create_room')` 호출 시 `default 'couple'` → 기존과 동일하게 커플방 생성 + (신규)`mode:'couple'` 추가 반환. 기존 소비자는 `mode`를 안 읽어도 무해(additive).

### 3.4 `join_room(p_code text)` — 솔로방 입장 거부 가드 추가

반환·기존 토큰은 invite_room §3.5 그대로. **추가 가드**:

동작 순서(중요 — 자기 방 재입장 멱등성 보존):
1. `NOT_AUTHENTICATED` 체크 + profiles 안전망.
2. `v_code := upper(trim(p_code))`; `select id, mode into v_room_id, v_mode from rooms where invite_code=v_code`; 없으면 `INVALID_CODE`.
3. **기존 멤버십 분기 먼저**:
   - 같은 방 멤버 → **멱등 성공** 반환(솔로 생성자가 자기 코드 재입력해도 여기서 성공).
   - 다른 방 멤버 → `ALREADY_IN_ROOM`.
4. **솔로방 가드**(위 분기에서 "이 방 멤버 아님"이 확정된 뒤): `if v_mode = 'solo' then raise 'SOLO_ROOM_NOT_JOINABLE'`.
5. `for update` 잠금 + 모드별 정원 count(solo는 4에서 이미 차단되므로 실질 couple=2) → `ROOM_FULL`.
6. `insert into room_members ...`(트리거 최종 방어) → `{room_id}` 반환.

| 에러 토큰 | 조건 |
|-----------|------|
| `NOT_AUTHENTICATED` / `INVALID_CODE` / `ALREADY_IN_ROOM` / `ROOM_FULL` | 기존과 동일 |
| `SOLO_ROOM_NOT_JOINABLE` | 타인이 솔로방 코드로 입장 시도(신규) |

> 솔로 생성자 자신의 재입장은 3번에서 멱등 성공으로 빠지므로 `SOLO_ROOM_NOT_JOINABLE`에 걸리지 않는다(순서 보장 필수, C5b).

### 3.5 RPC 권한 재선언

```sql
-- 새 시그니처로 revoke/grant 재선언(무인자 drop 후이므로 필수)
revoke all on function public.create_room(text)  from public, anon;
grant execute on function public.create_room(text) to authenticated;
-- join_room(text) 권한은 변동 없음(본문만 교체). 재선언해도 무해.
```

### 3.6 프론트 훅 시그니처 (`src/features/room/`)

```ts
// 신규: 방 모드 타입 + 정원 상수 (code.ts 또는 modes.ts)
export type RoomMode = 'solo' | 'couple';
export const ROOM_MODES = { solo: 'solo', couple: 'couple' } as const;  // enum-style 상수(컨벤션)
export const ROOM_CAPACITY: Record<RoomMode, number> = { solo: 1, couple: 2 };

// 변경: createRoom이 named-object 인자로 mode를 받고, 반환에 mode 포함
export type CreateRoomResult = { roomId: string; inviteCode: string; mode: RoomMode };

useCreateRoom(): {
  createRoom: (args: { mode: RoomMode }) => Promise<CreateRoomResult>;
  loading: boolean;
  error: string | null;
};
//   내부: supabase.rpc('create_room', { p_mode: mode })
//        → data.room_id / data.invite_code / data.mode 매핑(snake→camel)
//        → room_id·invite_code·mode 누락 시 'CREATE_ROOM_BAD_RESPONSE'

// useJoinRoom: 시그니처 불변( joinRoom({ code }) ). 에러 매핑만 신규 토큰 흡수(errors.ts 공통).
```

> **회귀 주의(developer)**: 기존 `OnboardingScreen.handleCreate`의 `await createRoom()` → `await createRoom({ mode })`로 변경. 기존 `useCreateRoom.spec.ts`도 새 시그니처/반환(mode)로 갱신해야 함(TDD: 스펙 먼저 Red).

### 3.7 에러 토큰 → 한국어 메시지 매핑 확장 (`errors.ts`, C2)

기존 5종 유지 + 추가:

| 토큰 | 메시지(예시) |
|------|--------------|
| `INVALID_MODE` | "방 모드 선택이 올바르지 않아요." |
| `SOLO_ROOM_NOT_JOINABLE` | "혼자 쓰는 방에는 입장할 수 없어요." |

> 토큰 문자열은 **RPC(SQL) ↔ `ROOM_ERROR_MESSAGES` 단일 출처**. 신규 2토큰 양쪽 동기화(C2).

---

## 4. 화면 · UX

### Onboarding step 흐름 (라우트 추가 없이 내부 step 확장)

기존 `choose | create-result | join` → **`select-mode` 추가**:

| step | 내용 | 전이 |
|------|------|------|
| `choose` | "방 만들기"(primary) / "초대코드 입력"(secondary) | 방 만들기 → `select-mode`, 초대코드 → `join` |
| `select-mode` (신규) | "혼자 기록할래요(솔로)" / "둘이 함께 기록할래요(커플)" + "뒤로" | 솔로 → `createRoom({mode:'solo'})`, 커플 → `createRoom({mode:'couple'})` |
| `create-result` | (커플만) 6자리 코드 표시 + 복사 + "방으로 가기" | 기존과 동일 |
| `join` | 6자리 코드 입력 + "입장" + "뒤로" | 기존과 동일(+ 솔로코드 입력 시 `SOLO_ROOM_NOT_JOINABLE` 인라인 에러) |

- **솔로 성공 전이**: `createRoom({mode:'solo'})` 성공 → **create-result 생략** → 곧장 `goToRoom()`(refresh + `navigation.reset(RoomTabs)`). 코드 화면 없음.
- **커플 성공 전이**: `createRoom({mode:'couple'})` 성공 → `create-result`(코드 표시) → "방으로 가기" → `goToRoom()`. **기존 동작 유지**.
- 생성 중 로딩: 선택한 모드 버튼에 `loading`. 실패 시 `createError` 인라인 + step은 `select-mode` 유지(입력 손실 없음).
- 원티드 토큰만 사용(raw hex 0). 기존 `Button`/`Text`/`Screen` 재사용. 모드 설명 보조문구는 `Text variant="bodySm" color="fgWeak"`.

---

## 5. 작업 목록 (모듈 단위, TDD 순서)

> 각 모듈: **Red(스펙)** → **Green(구현)** → **Refactor**. SQL/RPC/트리거는 단위 대상 아님 → 모킹된 응답으로 클라 계약만 검증 + 실DB는 사용자 스모크(testing-strategy). 모듈 완성 시 qa-inspector에 생산자↔소비자 경로 명시.

- [ ] **T1. 마이그레이션: `rooms` 컬럼 + backfill** — 인수: `20260610130000_room_modes.sql`이 `mode`(NOT NULL, CHECK in(solo,couple), default 'couple'로 기존 행 backfill) + `delete_scheduled_at` + `delete_requested_by`(FK profiles) 추가. idempotent(`add column if not exists`). 기존 invite_room.sql 미변경.
- [ ] **T2. 정원 트리거 모드화** — 인수: `enforce_room_capacity()`가 `rooms.mode`로 정원(solo 1/couple 2) 산정. solo방 2번째 멤버 insert → `ROOM_FULL`. couple방 3번째 → `ROOM_FULL`(회귀). `room` 없으면 `ROOM_NOT_FOUND`.
- [ ] **T3. `create_room(p_mode)` RPC** — 인수: **무인자 오버로드 DROP 선행**. `p_mode='solo'` → solo방+코드+멤버 생성, 반환 `{room_id, invite_code, mode:'solo'}`. `p_mode='couple'`(또는 기본) → 기존과 동일 + `mode:'couple'`. 잘못된 mode → `INVALID_MODE`. 이미 멤버 → `ALREADY_IN_ROOM`. 권한 `create_room(text)` to authenticated 재grant.
- [ ] **T4. `join_room` 솔로 가드** — 인수: 솔로방 코드를 **타인**이 입력 → `SOLO_ROOM_NOT_JOINABLE`. 솔로 **생성자 본인** 재입력 → 멱등 성공(가드 전 멤버십 분기). 커플방 입장은 기존과 동일(회귀).
- [ ] **T5. `errors.ts` 토큰 2종 추가** — 인수(스펙 먼저): `INVALID_MODE`/`SOLO_ROOM_NOT_JOINABLE` → 지정 한국어. 기존 5토큰 매핑 불변. 미일치는 기본 메시지. RPC 토큰과 1:1.
- [ ] **T6. `RoomMode`/`ROOM_MODES`/`ROOM_CAPACITY` 상수** — 인수(스펙 먼저): `ROOM_CAPACITY.solo===1`, `.couple===2`. enum-style 상수·named export. `index.ts` 재노출.
- [ ] **T7. `useCreateRoom({ mode })` 변경** — 인수(스펙 먼저, 기존 spec 갱신): `createRoom({mode:'solo'})` → `rpc('create_room',{p_mode:'solo'})` 호출, `{roomId,inviteCode,mode:'solo'}` 매핑. 커플 동일. `mode` 누락 응답 → `CREATE_ROOM_BAD_RESPONSE`. loading/error 전이 유지.
- [ ] **T8. OnboardingScreen `select-mode` step** — 인수: choose→방 만들기→select-mode 노출. 솔로 선택 → 코드 화면 **생략**하고 RoomTabs reset. 커플 선택 → create-result 코드 표시(기존). 실패 시 인라인 에러+step 유지. 토큰만 사용.
- [ ] **T9. 회귀 가드** — 인수: `npm test` 전체 그린(기존 invite-room/profile 스펙 포함). `tsc --noEmit` 통과. 기존 커플 생성/입장 흐름 행위 불변(코드 표시·복사·전이).

---

## 6. 엣지케이스

**모드 선택/생성**
- `mode` 누락/오타(`p_mode=null`/`'couples'`) → `INVALID_MODE`(서버 방어). 클라는 select-mode 버튼이 값 고정이라 정상 경로에선 미발생.
- 이미 방 멤버가 또 생성(모드 무관) → `ALREADY_IN_ROOM`.
- 솔로 생성 성공인데 응답에 `mode` 누락 → `CREATE_ROOM_BAD_RESPONSE`(훅 방어).

**솔로방 + 초대코드**
- 타인이 솔로방 코드 입력 → `SOLO_ROOM_NOT_JOINABLE`(정원 트리거 `ROOM_FULL`보다 **명확한 메시지** 우선).
- 솔로 생성자 본인이 자기 코드 입력(드묾) → 멱등 성공(같은 방 멤버 분기). 순서 의존(§3.4 4번) — QA C5b.
- 솔로방 코드가 UI에 노출되지 않음 → 정상 경로에선 타인이 코드를 알 수 없음(가드는 방어).

**정원 경계(모드별)**
- 솔로방: 생성자(1명) 외 어떤 입장도 거부. count 1 == capacity 1.
- 커플방: 2명까지(회귀). 3번째 `ROOM_FULL`. 마지막 1자리 동시 입장 → `for update` 직렬화 + 트리거(기존 동시성 보존).

**기존 데이터 마이그레이션**
- invite_room 시기 생성된 기존 rooms 행 → `mode` backfill `'couple'`. 정원 2 유지 → 기존 커플 동작 그대로.
- 마이그레이션 **재실행**(idempotent): `add column if not exists` / `create or replace` / `drop function if exists` 로 안전.
- **함정**: `create_room()` 무인자 잔존 시 오버로드 충돌 → 반드시 DROP 선행(§3.3).

**네트워크/상태**
- create 중 끊김 → 훅 error + 재시도(성공 전 RoomTabs 미전이 → 중복 방 방지, 기존과 동일).
- 솔로 생성 성공 직후 reset 전 membership.refresh 실패 → 게이트 error 뷰 재시도(기존 경로 재사용).

**빈/로딩 상태**
- select-mode 진입 시 기본(빈) — 모드 미선택 상태에서 생성 액션 없음(버튼이 곧 선택).

---

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

| # | 생산자 | 소비자 | 확인 포인트 |
|---|--------|--------|-------------|
| **C1** | `create_room` 반환 jsonb(`room_id`,`invite_code`,`mode` snake) | `useCreateRoom` 파싱(camel + `mode`) | 신규 `mode` 필드 매핑·누락 시 BAD_RESPONSE |
| **C2** | RPC `raise` 토큰(+`INVALID_MODE`,`SOLO_ROOM_NOT_JOINABLE`) | `ROOM_ERROR_MESSAGES` ↔ 화면 메시지 | 신규 2토큰 1:1, 누락 0, 기존 5토큰 불변 |
| **C3** | `rpc('create_room',{p_mode})` 인자명 | RPC 파라미터 `p_mode` | 인자명 정확 일치(불일치 시 default로 조용히 couple 생성되는 함정) |
| **C4** | `rooms.mode` CHECK + 트리거 정원식 | `ROOM_CAPACITY`(solo1/couple2) | DB 정원과 클라 상수 일치 |
| **C5a** | 트리거 `enforce_room_capacity`(모드별) | solo 2번째/couple 3번째 insert | 각각 `ROOM_FULL`, 한 명만 성공 |
| **C5b** | `join_room` 분기 순서(멤버십 → 솔로가드) | 솔로 생성자 자기코드 재입력 | 멱등 성공(가드에 안 걸림), 타인은 `SOLO_ROOM_NOT_JOINABLE` |
| **C6** | `create_room()` 무인자 DROP + `create_room(text)` 권한 | 익명 세션 `rpc('create_room')`/`{p_mode}` 호출 | 오버로드 단일·권한 OK·기본 couple 동작 |
| **C7** | Onboarding `select-mode` 분기(솔로 코드화면 생략 / 커플 표시) | 성공 전이(`refresh`+`reset(RoomTabs)`) | 솔로=코드화면 없이 RoomTabs, 커플=코드 표시 후 전이 |
| **C8** | `mode` backfill `'couple'` + 기존 invite-room 흐름 | 기존 스펙 전체 / tsc | 회귀 0(`npm test` 그린, 커플 행위 불변) |

---

## 8. 비용 가드레일 체크

- **AWS 미사용.** Supabase 무료 티어(Postgres + 익명 Auth)만. Storage/Edge/Kakao **이번 범위 없음**.
- **왕복 최소화**: 방 생성은 모드 무관 **1회 RPC**로 완결(코드 생성·삽입 서버 1회). 솔로방도 추가 왕복 없음.
- **멤버십 조회는 진입 1회 + 성공 후 refresh**만(폴링 금지, 기존 정책 유지).
- 솔로방 invite_code 발급은 서버 1회 생성으로 추가 비용 없음(전환 대비 선결).
- 이미지 압축/Kakao 디바운스/viewport 조회 → 이번 기능 **해당 없음**.

---

## 9. (설계 구체화만) 솔로 → 커플 전환 — 차기 `room-promote` 스프린트 핸드오프

> architecture §7 "구체화" 요구 충족용 **설계 메모**. 본 스프린트에서 **구현하지 않음**.

- **진입점**: Room 헤더(솔로방일 때만) "파트너 초대하기" → `room-tabs` 스프린트 완료 후 배치 가능.
- **전환 RPC(안)** `promote_room_to_couple() returns jsonb`:
  1. 호출자가 해당 솔로방의 멤버·`mode='solo'`인지 검증(아니면 `NOT_SOLO_ROOM`/`NOT_AUTHENTICATED`).
  2. `update rooms set mode='couple' where id=...` (정원 1→2로 사실상 확대). **코드 재생성 불필요**(이미 발급됨, §3.1 결정의 이득).
  3. 반환 `{room_id, invite_code, mode:'couple'}` → 기존 커플 코드 공유 화면 재사용.
- **선결 완비**: 본 스프린트가 (a) 솔로방 invite_code 발급, (b) 정원 트리거 모드화, (c) `mode` 컬럼·CHECK를 마련하므로 전환은 `update mode` + UI만 남음.
- **엣지(차기 정의)**: 전환 중 정원 경합, 전환 후 두 번째 멤버 입장(이제 solo가드 해제됨), 전환 취소 가능 여부.

---

## 부록. developer 핸드오프 메모

- 마이그레이션은 **신규 파일**(invite_room.sql 미수정). 순서: `drop function create_room()` → `alter rooms add ...` → `create or replace enforce_room_capacity` → `create create_room(text)` → `create or replace join_room`(솔로가드) → 권한 재grant.
- **함정 1**: `create_room` 오버로드 — 무인자 DROP 누락 시 두 함수 공존. 반드시 DROP 선행.
- **함정 2**: `rpc('create_room', { p_mode })` 인자명 오타 시 default 'couple'로 **조용히** 커플 생성됨(에러 없이 잘못 동작) → 솔로 선택이 무시됨. C3에서 인자명 검증.
- **TDD 순서 권장**: T5/T6(순수 유틸·상수) → T7(훅) → T8(화면) → 마이그레이션/RPC(T1~T4, SQL은 스모크) 병행. 기존 `useCreateRoom.spec.ts`/Onboarding 동작은 새 시그니처로 **먼저 Red**.
- git 작업 금지(사용자 전담). 실 Supabase 적용도 사용자.
</content>
</invoke>
