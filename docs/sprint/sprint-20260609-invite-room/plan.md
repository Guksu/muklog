# Sprint: 익명 인증 + 초대코드 방 생성/입장 (invite-room)

> 입력: `docs/design/architecture.md`(§1 결정, §3 데이터 모델, §4 화면), 이전 스프린트 `docs/sprint/sprint-20260609-setup/`(dev-notes 핸드오프, `src/navigation/devFlags.ts` 임시 토글).
> 산출물: 이 plan.md → developer 구현(dev-notes.md) → qa-inspector 검증(qa-report.md).

---

## 1. 기능 한줄 정의

앱을 처음 켠 사용자가 **익명 세션을 자동으로 얻고**, **방을 만들어 6자리 초대코드를 받거나** / **상대가 준 코드를 입력해 그 방에 입장**하여, 다음 실행부터는 곧바로 방(RoomTabs) 화면으로 들어갈 수 있다. (방은 최대 2명 = 커플.)

---

## 2. 범위

### In-scope
- **DB 스키마** (`supabase/migrations/`): `profiles`, `rooms`, `room_members` 테이블 + FK + RLS + 트리거(방 인원 2명) + 초대코드 `UNIQUE`. architecture §3 그대로.
- **SECURITY DEFINER RPC** 2종: `create_room()`, `join_room(p_code)`. 코드로 방 찾기/입장이 RLS("본인 멤버 방만 select")와 충돌하므로, 검증·삽입을 서버에서 안전하게 수행.
- **profiles 보장(upsert)**: 익명 세션 확보 시 본인 `profiles` 행 생성(닉네임/아바타 NULL 시작). setup `AuthProvider`의 TODO 해소. → FK 무결성 선행.
- **방 만들기 흐름**: `create_room()` 호출 훅 + 생성된 코드 노출 UI(복사) → RoomTabs.
- **방 입장 흐름**: 6자리 코드 입력 UI + `join_room()` 호출 훅 + 에러 처리.
- **멤버십 기반 분기**: 멤버십 조회 훅/프로바이더 → 본인 멤버십 있으면 RoomTabs, 없으면 Onboarding. **`src/navigation/devFlags.ts` 및 화면 내 dev 토글 버튼 전부 제거.**

### Out-of-scope (다음 스프린트)
- 프로필 **편집**(닉네임/아바타 업로드) → `profile` 스프린트. (이번엔 행 생성만, 값은 NULL.)
- 먹로그 CRUD / 지도 / 장소검색 / Storage / Kakao / Realtime.
- 방 **나가기 / 재초대 / 방 삭제** (MVP 이후). 코드 **만료/회전**도 미구현.
- 상대(파트너) 프로필 표시(닉네임/아바타) — `profiles` cross-member RLS는 이번에 열지 않음(own-only).

---

## 3. 데이터 · API 계약

> 마이그레이션 파일은 `supabase/migrations/<timestamp>_invite_room.sql` 단일 파일 권장(또는 순번 분할). 아래 DDL/정책/함수는 **계약**이며, 실 Supabase 적용(`db push` 또는 SQL 에디터)은 **사용자 환경 의존**(dev-notes에 명시).

### 3.1 테이블 (DDL 요지)

```sql
-- profiles : auth.users 1:1
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nickname   text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- rooms : 초대코드 보유 방
create table public.rooms (
  id          uuid primary key default gen_random_uuid(),
  invite_code text not null unique,         -- 6자리, 서버 생성 (3.4 charset)
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now()
);

-- room_members : 방당 최대 2명 (PK로 중복 가입 차단)
create table public.room_members (
  room_id   uuid not null references public.rooms(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
```

### 3.2 RLS 정책 (모든 테이블 `enable row level security`)

| 테이블 | 작업 | 정책(USING / WITH CHECK) | 비고 |
|--------|------|--------------------------|------|
| `profiles` | select | `id = auth.uid()` | own-only (파트너 표시는 범위 외) |
| `profiles` | insert | WITH CHECK `id = auth.uid()` | AuthProvider upsert용 |
| `profiles` | update | `id = auth.uid()` | (편집은 profile 스프린트지만 정책은 미리 둠) |
| `rooms` | select | `id in (select room_id from public.room_members where user_id = auth.uid())` | **본인 멤버 방만.** 코드로 찾기는 RPC로 우회 |
| `rooms` | insert/update/delete | **정책 없음(직접 금지)** | `create_room` RPC(DEFINER)만 삽입 |
| `room_members` | select | `user_id = auth.uid()` | **자기 행만.** self-join RLS 재귀 회피. 멤버십 게이트가 이걸로 조회 |
| `room_members` | insert/delete | **정책 없음(직접 금지)** | RPC(DEFINER)만 삽입 |

> ⚠️ `room_members` select를 "같은 방 모든 멤버"로 짜면 **RLS 자기참조 무한재귀** 오류. 이번 범위에선 `user_id = auth.uid()`로 충분(게이트는 "내 멤버십 유무"만 필요). 파트너 가시성은 추후 SECURITY DEFINER helper로 확장.

### 3.3 인원 2명 제한 — 이중(트리거 + 앱) + 동시성

```sql
-- (DB) BEFORE INSERT 트리거: 현재 인원이 2 이상이면 차단
create or replace function public.enforce_room_capacity()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.room_members where room_id = NEW.room_id) >= 2 then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;
  return NEW;
end; $$;

create trigger trg_room_capacity
  before insert on public.room_members
  for each row execute function public.enforce_room_capacity();
```

- **앱 1차 차단**: `join_room`이 삽입 전 `count >= 2`면 `ROOM_FULL` 반환(빠른 경로).
- **DB 2차 차단**: 위 트리거(최종 방어).
- **동시성(마지막 1자리 동시 입장)**: `join_room` RPC가 삽입 전에 `select ... from public.rooms where id = v_room_id for update`로 **방 행을 잠가 직렬화**한다. 먼저 들어온 트랜잭션이 커밋되면 두 번째는 잠금 해제 후 갱신된 count(=2)를 보고 `ROOM_FULL`. (트리거는 그래도 최종 방어로 유지.) `room_members` PK는 동일인 중복 삽입을 차단.

### 3.4 초대코드 생성 — **서버(RPC) 전담**

- charset: **대문자 24자(A–Z 중 `O`,`I` 제외) + 숫자 8자(0–9 중 `0`,`1` 제외) = 32자**, 길이 6 → 32^6 ≈ 1.07e9.
- 생성 위치: **`create_room` RPC 내부 루프**. `invite_code UNIQUE` 위반 시 재생성, 최대 **8회** 재시도. 소진 시 `CODE_GENERATION_FAILED`.
- **클라이언트 코드 생성 유틸은 만들지 않는다**(충돌 검사 왕복·경합 회피). 클라이언트는 입력 화면에서 **검증/정규화만**(3.6) 한다. — 이 결정은 의도적이며 QA C6에서 양쪽 charset 일치를 본다.

### 3.5 RPC 계약 (SECURITY DEFINER, `set search_path = public`, `grant execute to authenticated`)

> 두 함수 모두 `returns jsonb` — Supabase JS `rpc()` 호출 시 `data`는 jsonb **객체**(배열 아님). 필드는 snake_case, 훅에서 camelCase로 매핑.
> 에러는 `raise exception '<TOKEN>'`로 발생 → Supabase JS `error.message`가 토큰을 담음. 훅이 토큰 → 한국어 메시지로 매핑(3.7, C2).
> 익명 사용자도 Supabase에서 `authenticated` 역할 → `grant execute to authenticated` 필요. `auth.uid()` null이면 `NOT_AUTHENTICATED`.

#### `create_room() returns jsonb`
반환: `{ "room_id": "<uuid>", "invite_code": "<6자리>" }`

동작:
1. `v_uid := auth.uid()`; null이면 `raise 'NOT_AUTHENTICATED'`.
2. `profiles`에 `v_uid` 없으면 방어적 `insert ... on conflict do nothing` (AuthProvider 선행 보장이 1차, 이건 안전망).
3. 이미 어떤 방의 멤버면(`exists(select 1 from room_members where user_id=v_uid)`) `raise 'ALREADY_IN_ROOM'`. (1인 1방 불변식)
4. 코드 생성 루프(3.4): `insert into rooms(invite_code, created_by) values(code, v_uid)` 시도, `unique_violation`이면 재시도. 8회 소진 시 `raise 'CODE_GENERATION_FAILED'`.
5. `insert into room_members(room_id, user_id) values(new_room_id, v_uid)`.
6. `return jsonb_build_object('room_id', new_room_id, 'invite_code', code)`.

| 에러 토큰 | 조건 |
|-----------|------|
| `NOT_AUTHENTICATED` | 세션 없음 |
| `ALREADY_IN_ROOM` | 호출자가 이미 다른 방 멤버 |
| `CODE_GENERATION_FAILED` | 코드 충돌 8회 연속(매우 드묾) |

#### `join_room(p_code text) returns jsonb`
반환: `{ "room_id": "<uuid>" }`

동작:
1. `v_uid := auth.uid()`; null이면 `raise 'NOT_AUTHENTICATED'`.
2. `profiles` 안전망 upsert(동 create_room 2).
3. `v_code := upper(trim(p_code))`. (정규화는 서버에서도 한 번 더)
4. `select id into v_room from rooms where invite_code = v_code`. 없으면 `raise 'INVALID_CODE'`.
5. 호출자 기존 멤버십 확인:
   - 이미 **이 방** 멤버면 → **멱등 성공**: `return jsonb_build_object('room_id', v_room)` (자기 방 재입장은 에러 아님 → RoomTabs로).
   - **다른 방** 멤버면 → `raise 'ALREADY_IN_ROOM'`.
6. `select id from rooms where id = v_room for update` (동시성 직렬화, 3.3).
7. `if (select count(*) from room_members where room_id = v_room) >= 2 then raise 'ROOM_FULL'`.
8. `insert into room_members(room_id, user_id) values(v_room, v_uid)` (트리거 최종 방어; 트리거가 `ROOM_FULL` raise 가능).
9. `return jsonb_build_object('room_id', v_room)`.

| 에러 토큰 | 조건 |
|-----------|------|
| `NOT_AUTHENTICATED` | 세션 없음 |
| `INVALID_CODE` | 코드에 해당하는 방 없음(오타/미존재) |
| `ALREADY_IN_ROOM` | 호출자가 **다른** 방 멤버 |
| `ROOM_FULL` | 방 인원 이미 2 (count 또는 트리거) |

> (자기 방 재입장은 토큰 없이 성공 반환 — 5번 분기.)

### 3.6 프론트 훅 시그니처 (`src/features/room/` 권장)

```ts
// 멤버십 게이트용 — 앱 진입 1회 조회 + 성공 후 refresh (폴링 금지)
type MembershipState =
  | { status: 'loading' }
  | { status: 'no-room' }
  | { status: 'in-room'; roomId: string }
  | { status: 'error'; message: string };

useMembership(): { state: MembershipState; refresh: () => void };
//   내부: supabase.from('room_members').select('room_id').eq('user_id', uid).maybeSingle()
//   1행 → in-room(roomId), 0행 → no-room, 에러 → error.
//   (1인 1방 불변식 → 최대 1행. RLS가 user_id=auth.uid()로 이미 한정하지만 eq도 명시.)

// 방 만들기
useCreateRoom(): {
  createRoom: () => Promise<{ roomId: string; inviteCode: string }>;
  loading: boolean;
  error: string | null;   // 사용자용 한국어 메시지(매핑됨) 또는 null
};
//   내부: supabase.rpc('create_room') → data.room_id / data.invite_code 매핑

// 방 입장
useJoinRoom(): {
  joinRoom: (code: string) => Promise<{ roomId: string }>;
  loading: boolean;
  error: string | null;
};
//   내부: supabase.rpc('join_room', { p_code: code }) → data.room_id 매핑
```

`MembershipProvider`(context)로 `state`/`refresh()`를 트리에 노출 → 게이트와 Onboarding이 공유. 생성/입장 성공 시 `refresh()` 호출로 상태 일관성 유지.

### 3.7 에러 토큰 → 한국어 메시지 매핑 (`mapRoomError`, C2)

| 토큰 | 메시지(예시) |
|------|--------------|
| `INVALID_CODE` | "초대코드를 다시 확인해 주세요." |
| `ROOM_FULL` | "이미 2명이 모두 입장한 방이에요." |
| `ALREADY_IN_ROOM` | "이미 참여 중인 방이 있어요." |
| `CODE_GENERATION_FAILED` | "코드 생성에 실패했어요. 잠시 후 다시 시도해 주세요." |
| `NOT_AUTHENTICATED` | "세션이 만료됐어요. 앱을 다시 시작해 주세요." |
| (네트워크/그 외) | "연결에 실패했어요. 다시 시도해 주세요." |

> 매핑은 `error.message`의 토큰 정확 일치 우선, 미일치 시 기본(네트워크) 메시지. 토큰 문자열은 **RPC ↔ 매핑 유틸이 단일 출처**여야 함(C2).

---

## 4. 화면 · UX

### 화면 흐름 (architecture §4 준수)
```
AuthGate (setup) : loading→Splash / error→AuthError(재시도) / authenticated→↓
  └─ MembershipGate (신규)
        loading  → SplashView
        error    → 멤버십 에러 뷰(재시도 = refresh)
        no-room  → AppNavigator initialRoute = Onboarding
        in-room  → AppNavigator initialRoute = RoomTabs
```

### Onboarding (한 화면, 내부 step 상태로 3모드 — 새 라우트 추가 없이)
| step | 내용 | 상태별 UX |
|------|------|-----------|
| `choose` | "방 만들기"(primary) / "초대코드 입력"(secondary) 버튼 | 기본 빈 상태 |
| `create-result` | 생성된 **6자리 코드 크게 표시** + 복사 버튼 + "방으로 가기" | 생성 중=Button loading / 실패=메시지+재시도 / 성공=코드 표시 |
| `join` | 6자리 코드 입력 + "입장" 버튼 + "뒤로" | 입력<6자=입장 disabled / 제출 중=loading / 실패=인라인 에러 메시지(입력 유지) / 성공=RoomTabs 이동 |

- **입력 정규화/검증(클라, C6)**: 대문자 자동 변환, charset(3.4) 외 문자 차단, 최대 6자, 공백 trim. `autoCapitalize="characters"`, `autoCorrect=false`.
- **성공 전이(C8)**: create/join 성공 → `membership.refresh()` 호출 + `navigation.reset({ index:0, routes:[{ name: Routes.RoomTabs }] })` (결정적 즉시 전이; 뒤로가기로 Onboarding 복귀 방지).
- **컴포넌트**: 기존 `Screen`/`Text`/`Button` 재사용. 코드 입력은 RN `TextInput` + 토큰 스타일(신규 `CodeInput` 컴포넌트 또는 인라인).

### 원티드 토큰 사용 지점
- 버튼: `Button` primary/secondary(이미 토큰화). 텍스트: `Text` variant(코드 표시는 큰 variant, 예 `h1`/`h2`)·`color`.
- 화면 배경/패딩: `Screen`(`color.bg`, `spacing`). 코드 박스/입력 테두리: `radius`, `color`(border/fg), 간격 `spacing`. **raw hex 금지**(setup B3 규칙 유지).

---

## 5. 작업 목록 (각 인수조건 포함)

> 마이그레이션 SQL 작성·코드/계약 완성까지가 에이전트 범위. **실 Supabase 적용은 사용자**(dev-notes 명시). 각 모듈 완성 시 qa-inspector에 생산자↔소비자 경로 명시해 incremental 교차검증 요청.

- [ ] **T1. 마이그레이션: 테이블 3종 + FK** — 인수: `profiles/rooms/room_members`가 §3.1 DDL대로 생성. `rooms.invite_code UNIQUE`, `room_members` PK `(room_id,user_id)`, FK는 `profiles.id`/`auth.users.id` 참조. `gen_random_uuid()` 사용(pgcrypto/pg 확장 가용 확인).
- [ ] **T2. RLS 정책** — 인수: 세 테이블 RLS 활성화 + §3.2 표대로. `rooms.select`는 멤버 방만, `room_members.select`는 `user_id=auth.uid()`(재귀 없음), `rooms`/`room_members` 직접 insert 정책 없음(클라 직접 insert 시 거부).
- [ ] **T3. 인원 2명 트리거** — 인수: `room_members`에 3번째 insert 시도 시 `ROOM_FULL` 예외. 트리거가 `before insert`로 동작.
- [ ] **T4. `create_room()` RPC** — 인수: 인증 사용자가 호출 시 `{room_id, invite_code}` 반환, `rooms`+`room_members` 1건씩 생성, 코드 6자리·charset 준수. 이미 방 멤버면 `ALREADY_IN_ROOM`. 코드 충돌은 내부 재시도.
- [ ] **T5. `join_room(p_code)` RPC** — 인수: 유효 코드 → `{room_id}` 반환·멤버 추가. 없는 코드 `INVALID_CODE` / 2명 찬 방 `ROOM_FULL` / 다른 방 멤버 `ALREADY_IN_ROOM` / 자기 방 재입장은 성공(멱등). 삽입 전 방 행 `for update` 잠금.
- [ ] **T6. RPC 권한/안전** — 인수: 두 함수 `security definer` + `set search_path=public` + `grant execute on function ... to authenticated`. anon/public 불필요 권한 미부여. 익명 세션으로 호출 성공.
- [ ] **T7. profiles upsert(AuthProvider)** — 인수: 익명 세션 확보 직후 `profiles` 본인 행 보장(`upsert {id}, onConflict id, ignoreDuplicates`). **upsert 성공 후에만** `authenticated` 전이(실패 시 error 상태 → 재시도). setup TODO 주석 제거. → 이후 RPC FK 위반 0.
- [ ] **T8. `useMembership` + `MembershipProvider`** — 인수: 앱 진입 시 1회 조회로 `no-room`/`in-room(roomId)`/`error` 판정. `refresh()` 호출 시 재조회. 폴링/반복호출 없음.
- [ ] **T9. 멤버십 게이트 + 분기, devFlags 제거** — 인수: `in-room`이면 RoomTabs, `no-room`이면 Onboarding으로 진입. `src/navigation/devFlags.ts` 파일 삭제, `AppNavigator`의 `DEV_NAV` import·각 화면 dev 토글 버튼 제거(grep `DEV_NAV`/`devFlags` 결과 0건). `tsc --noEmit` 통과.
- [ ] **T10. `useCreateRoom` 훅** — 인수: `createRoom()`이 RPC 호출→`{roomId, inviteCode}` 반환. loading/error 상태 노출. 에러는 `mapRoomError`로 한국어.
- [ ] **T11. `useJoinRoom` 훅** — 인수: `joinRoom(code)`가 RPC 호출→`{roomId}` 반환. 토큰별 에러 메시지 매핑. loading/error 노출.
- [ ] **T12. `mapRoomError` 유틸** — 인수: §3.7 토큰 전체를 한국어로 매핑, 미일치/네트워크는 기본 메시지. RPC 토큰 문자열과 1:1.
- [ ] **T13. OnboardingScreen 3모드 UI** — 인수: choose/create-result/join step 전환. 코드 표시(복사)·코드 입력(6자 검증·대문자·charset 필터). 로딩/에러/성공 상태 모두 화면 반영. 토큰만 사용(raw hex 0).
- [ ] **T14. 성공 전이** — 인수: create/join 성공 시 `refresh()` + `navigation.reset`으로 RoomTabs 진입, 뒤로가기로 Onboarding 복귀 불가. 앱 재실행 시 멤버십 게이트가 곧장 RoomTabs.

---

## 6. 엣지케이스

**인증/세션**
- 익명 세션 실패 → setup `AuthProvider` error 화면(기존). **profiles upsert 실패도 error**로 전이(FK 무결성 보호) → 재시도.
- RPC 호출 시 세션 만료/없음 → `NOT_AUTHENTICATED` → "앱 재시작" 안내.

**코드 입력(입장)**
- 존재하지 않는/오타 코드 → `INVALID_CODE`, 입력값 유지하고 인라인 메시지.
- 혼동문자(`0/O/1/I`)는 charset 외 → 클라 입력 단계에서 차단(또는 입력돼도 서버에서 `INVALID_CODE`).
- 소문자/공백 입력 → 대문자·trim 정규화(클라+서버 양쪽).
- 6자 미만 → "입장" 버튼 disabled.

**방 정원/소속 (입력 한계: 인원 2)**
- 이미 2명 찬 방 입장 → `ROOM_FULL`.
- 자기 방에 자기가 또 입장(같은 방 재입장) → **에러 아님, 멱등 성공** → RoomTabs.
- 이미 다른 방 소속 사용자가 입장/생성 시도 → `ALREADY_IN_ROOM`. (게이트가 보통 Onboarding을 건너뛰므로 드물지만 RPC가 최종 방어.)

**동시성 (커플 2명)**
- 마지막 한 자리에 **두 사람 동시 입장** → 방 행 `for update` 직렬화 + 트리거 → 한 명 성공, 다른 한 명 `ROOM_FULL`.
- 같은 코드 동시 생성 충돌 → `invite_code UNIQUE` + RPC 재시도로 흡수.
- 한 사용자가 두 기기에서 동시 create → `ALREADY_IN_ROOM`(2번째) 또는 PK 충돌로 1방만 생성.

**네트워크/조회**
- create/join 중 네트워크 끊김 → 훅 error → 화면 재시도 버튼(중복 방 생성 방지: 성공 응답 받기 전까지 RoomTabs 미전이).
- 멤버십 조회 실패 → 게이트 error 뷰 + `refresh()` 재시도.
- **RLS로 막힌 조회**: 코드로 방을 직접 `select`하면 RLS(멤버 방만)로 0행 → 잘못된 `INVALID_CODE`처럼 보임. **그래서 입장은 반드시 `join_room` RPC 경로**(DEFINER)로만. 클라가 `rooms`를 직접 코드 조회하지 않음(C 검증 포인트).

**빈 상태**
- 방 없음 = Onboarding 자체가 빈 상태(자연스러운 진입). 멤버십 로딩 중 = Splash.

---

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

| # | 생산자 | 소비자 | 확인 포인트 |
|---|--------|--------|-------------|
| **C1** | `create_room`/`join_room` 반환 jsonb (`room_id`,`invite_code` snake) | `useCreateRoom`/`useJoinRoom` 파싱(`roomId`/`inviteCode` camel) | 필드명·jsonb 객체(배열 아님)·매핑 일치 |
| **C2** | RPC `raise` 토큰(`INVALID_CODE`/`ROOM_FULL`/`ALREADY_IN_ROOM`/`CODE_GENERATION_FAILED`/`NOT_AUTHENTICATED`) | `mapRoomError` switch ↔ 화면 메시지 | 토큰 문자열 1:1, 누락 토큰 0, 기본 메시지 fallback |
| **C3** | `room_members` RLS select(`user_id=auth.uid()`) | `useMembership` 쿼리(`eq('user_id', uid)`) | 게이트 분기 정확. self-join 재귀 없음 |
| **C4** | 테이블 컬럼/FK(`profiles.id`,`rooms.created_by`,`room_members` PK) + AuthProvider profiles upsert(선행) | RPC insert 문 | FK 위반 0 — upsert가 RPC보다 먼저 완료됨 보장 |
| **C5** | 트리거 `enforce_room_capacity` + `rooms ... for update` | `join_room` 동시성 경로 | 3번째/동시 입장 → `ROOM_FULL`, 한 명만 성공 |
| **C6** | invite_code charset/길이(서버 생성, 3.4) | JoinRoom 입력 필터·정규화(클라) | 같은 32자 charset·6자·대문자·trim 일치 |
| **C7** | 멤버십 게이트 state(`no-room`/`in-room`) | `AppNavigator` initialRoute(Onboarding/RoomTabs) + devFlags 제거 | 분기 정확, `DEV_NAV`/`devFlags` 잔존 import 0, tsc 통과 |
| **C8** | create/join 성공 → `refresh()`+`navigation.reset(RoomTabs)` | 멤버십 게이트 상태 + 재실행 진입 | 성공 후 RoomTabs, 뒤로가기 복귀 불가, 재실행 시 동일 결과 |
| **C9** | `grant execute ... to authenticated` (RPC) | 익명 세션 RPC 호출 | 익명 사용자 호출 권한 OK, 직접 테이블 insert는 거부 |
| **C10** | `profiles` insert RLS(`with check id=auth.uid()`) | AuthProvider upsert payload(`{id: userId}`) | 본인 행만 생성, payload 키 일치 |

---

## 8. 비용 가드레일 체크

- **AWS 미사용.** 백엔드는 Supabase 무료 티어만(Postgres + 익명 Auth). Storage/Edge Function/Kakao **이번 범위 없음**.
- **왕복 최소화**: 방 생성/입장을 **각 1회 RPC**로 완결(코드 생성·충돌 재시도·검증·삽입 모두 서버 1회). 코드 생성 충돌 재시도는 서버 내부 루프 → 클라 왕복 없음.
- **멤버십 조회는 앱 진입 1회 + 성공 후 refresh**만. **폴링/주기 조회 금지.** Realtime 미사용(범위 외).
- 이미지 압축 / Kakao 디바운스·캐싱 / viewport 조회 → **이번 기능에 해당 없음**(다음 스프린트).

---

## 부록. setup → invite-room 전환 메모 (developer 참고)
- `src/navigation/devFlags.ts` **삭제**, `AppNavigator.tsx`의 `DEV_NAV` import 및 `initialRouteName = DEV_NAV.initial...` → 멤버십 기반으로 교체.
- `OnboardingScreen.tsx`/`MuklogTabScreen.tsx`의 **dev 토글 버튼 제거**, OnboardingScreen은 실제 3모드 UI로 대체.
- `AuthProvider.tsx`의 `// TODO(profile 스프린트): profiles upsert` 주석 → 본 스프린트에서 **upsert 구현으로 대체**(닉네임/아바타 값 편집은 여전히 profile 스프린트).
- `routes.ts`: 새 라우트 추가 없이 Onboarding 내부 step 상태로 처리(권장). 필요 시에만 라우트 확장.
