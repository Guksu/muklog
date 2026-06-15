# Sprint: 로그 이름 (log-name)

> 설계 단일 출처: `docs/design/architecture.md` §3(데이터모델)·§4(화면)·§5(백로그)·§7(미해결 '로그 식별/이름').
> 디자인 단일 출처: 킷 `templates/muklog` — 특히 `mk-log.jsx:9-105`(헤더 pencil + "로그 이름" 편집 시트).
> 이 슬라이스는 architecture §7이 "미도입(자동/생략)으로 결정"하고 별도 슬라이스로 미뤄둔 **'로그 이름'** 슬라이스다.

---

## 1. 기능 한줄 정의

사용자가 자신이 속한 로그(방)에 **이름을 붙이고(최대 20자) 다시 수정**할 수 있고, 그 이름이 **LogList 카드 제목**과 **LogScreen 헤더 제목**에 표시되며, 이름이 없으면 멤버 수 기반 폴백 표기로 돌아간다.

---

## 2. 범위

### In-scope
- `rooms.name` 컬럼 신설(nullable text).
- 이름 **수정** RPC `rename_room(p_room_id, p_name)` (DEFINER + 멤버 검증, name만 갱신) — rooms 쓰기는 RPC-only 패턴(§결정1).
- `list_my_rooms()` / `get_room()` RPC에 `name` 투영 추가.
- `useMyLogs`(MyLog) · `useRoom`(RoomDetail)에 `name: string | null` 매핑.
- 이름 정규화/검증 유틸 + 폴백 표기 유틸(순수 함수, 단위 테스트 대상).
- 이름 수정 훅 `useRenameRoom`.
- LogList 카드 제목 + LogScreen 헤더 제목에 이름 표시(없으면 본인 닉 기반 폴백 — §결정2).
- 이름 편집 **진입점 = LogScreen 헤더 제목 탭(✏️)** (§결정3).

### Out-of-scope (후속 명시)
- **대표 이미지/커버**(로그 썸네일) — 후속 `log-cover` 슬라이스.
- **로그 삭제/나가기** — `room-leave`(dormant)·`room-lifecycle`.
- LogList 카드에서의 인라인 rename(목록 화면 롱프레스/스와이프) — 이번엔 LogScreen 진입점 1곳만.
- 파트너 실프로필(닉네임) 노출 — profiles RLS=self-only 유지(§결정2). 파트너 닉 기반 커플 폴백("A ♥ B")은 도입하지 않는다(커플 폴백은 "{내닉} ♥ 짝꿍" — 파트너는 "짝꿍" 고정).
- 이름 변경 실시간 동기화(파트너 화면 즉시 반영) — Realtime 미도입. 다음 진입/refresh 시 반영(비용 가드레일).
- 이름 글자수 외 금칙어/이모지 필터링·중복 이름 검사 — 불필요(개인 라벨).

---

## 3. 데이터 · API 계약

### 3.1 테이블 변경 (마이그레이션 신설: `20260615120000_log_name.sql`)
- `rooms`에 컬럼 추가:
  ```sql
  alter table public.rooms add column if not exists name text;  -- nullable. NULL=이름 미지정(폴백 표기).
  ```
- **RLS 변경 없음.** rooms는 `rooms_select_member`(select)만 존재하고 insert/update/delete 정책 없음 → 직접 update 거부 → 쓰기는 DEFINER RPC만(§결정1). `rooms_update_*` 정책 신설 안 함.

### 3.2 신규 RPC — `rename_room(p_room_id uuid, p_name text)` (SECURITY DEFINER)
기존 `get_room`/`leave_room`과 동일한 DEFINER + 멤버 검증 패턴.

- **반환(성공)**: `jsonb { "room_id": uuid, "name": text | null }` — 서버가 정규화한 최종 name(빈/공백→null)을 그대로 돌려줌(클라가 동일 정규화하지만 서버 값이 단일 출처).
- **에러 토큰**: `NOT_AUTHENTICATED` / `NOT_A_MEMBER` / `ROOM_NOT_FOUND` / `NAME_TOO_LONG`.
- **본문 규칙**(SQL):
  1. `auth.uid()` null → `NOT_AUTHENTICATED`.
  2. `p_room_id` rooms 미존재 → `ROOM_NOT_FOUND`.
  3. 호출자가 `room_members`에 그 방 멤버 아님 → `NOT_A_MEMBER`. (get_room §보안핵심과 동일 — DEFINER는 RLS 우회하므로 멤버 검사 필수.)
  4. 정규화: `v_name := nullif(btrim(coalesce(p_name, '')), '')` → 공백 trim 후 빈 문자열이면 NULL(폴백 복귀).
  5. 길이: `char_length(v_name) > 20` 이면 `NAME_TOO_LONG`(서버 2차 방어; 앱 1차 차단). 길이는 trim 후 기준.
  6. `update rooms set name = v_name where id = p_room_id`.
  7. `return jsonb_build_object('room_id', p_room_id, 'name', v_name)`.
- **권한**: `revoke all ... from public, anon; grant execute ... to authenticated;` (기존 RPC 동일).
- **멤버 누구나 수정 가능**(생성자 한정 아님 — 커플 공용 라벨이므로 둘 다 변경 가능. created_by 검사 안 함).

### 3.3 기존 RPC 투영 확장 (같은 마이그레이션에서 `create or replace`)
- **`list_my_rooms()`**: returns table에 `name text` 컬럼 추가. select에 `r.name` 추가.
  - 신 반환 형: `room_id uuid, mode text, member_count int, created_at timestamptz, joined_at timestamptz, name text`.
  - ⚠️ returns table 시그니처 변경 → `create or replace function` 시 컬럼 추가는 OK(반환 타입 변경이라 drop 필요할 수 있음 — 안전하게 `drop function if exists public.list_my_rooms();` 후 재생성). 권한 재선언 동반.
- **`get_room(p_room_id)`**: jsonb에 `name` 키 추가.
  - 신 반환: `{ room_id, invite_code, member_count, mode, name }` (name = `r.name`, nullable).
  - jsonb 반환이라 시그니처 불변 → `create or replace`로 본문만 교체. 키 추가는 기존 소비자(useRoom)에 비파괴(누락 키는 무시됨, 추가 키 안전).

### 3.4 프론트 계약

#### 정규화/검증 유틸 — `src/features/room/logName.ts` (신설, 순수)
```ts
export const LOG_NAME_MAX_LENGTH = 20;  // ⚠️ DB rename_room NAME_TOO_LONG 기준(20)과 단일 출처(C-LEN).

// 입력 정규화: trim 후 빈 문자열이면 null(폴백 복귀). 서버 nullif(btrim()) 와 동일 규칙.
export const normalizeLogName = ({ input }: { input: string }): string | null => { ... }
//   "  " → null, "우리 맛집  " → "우리 맛집", "" → null.

// 길이 초과 여부(정규화 후 기준). 앱 1차 차단용.
export const isLogNameTooLong = ({ input }: { input: string }): boolean => { ... }
//   20자 이하 false, 21자 true (한글/이모지 등 코드포인트 길이 기준 — JS [...str].length로 grapheme 근사).

// 표시 폴백(§결정2 B' — 본인 닉네임 기반). name 있으면 name, 없으면 본인 닉 기반 폴백.
//   ⚠️ 파트너 닉네임 미사용(profiles RLS self-only) → 커플은 "짝꿍" 고정. selfNickname은 self-profile에서 로드.
export const displayLogName = ({
  name,
  memberCount,
  selfNickname,
}: {
  name: string | null;
  memberCount: number;
  selfNickname: string | null;
}): string => { ... }
//   name="우리 맛집"                                  → "우리 맛집"
//   name=null, memberCount<2,  selfNickname="민"      → "민의 기록"     (솔로)
//   name=null, memberCount>=2, selfNickname="민"      → "민 ♥ 짝꿍"     (커플 — 파트너는 "짝꿍" 고정)
//   name=null, memberCount<2,  selfNickname=null/""   → "내 로그"       (닉 부재 안전 폴백)
//   name=null, memberCount>=2, selfNickname=null/""   → "우리 로그"     (닉 부재 안전 폴백)
```
> ⚠️ 길이 카운트는 `[...input].length`(코드포인트)로 산정 — `String.length`는 이모지/일부 한글 조합에서 surrogate pair를 2로 세는 함정. 앱 1차 차단과 DB `char_length`가 미세하게 다를 수 있으나 DB가 최종 방어. 입력 maxLength도 20.

#### 수정 훅 — `src/features/room/useRenameRoom.ts` (신설)
```ts
export const useRenameRoom = () => {
  // renameRoom({ roomId, name }): Promise<{ roomId: string; name: string | null }>
  //   - name(원문)을 normalizeLogName으로 정규화한 값을 p_name으로 전달(서버도 재정규화 — 이중).
  //   - supabase.rpc('rename_room', { p_room_id: roomId, p_name: normalized })  ⚠️ 인자명 p_room_id/p_name 정확 일치(C-ARG).
  //   - 성공: { roomId, name }(서버 반환 name = 최종 정규화값) 반환.
  //   - 실패: setError(mapRoomError({error})) 후 throw.
  return { renameRoom, loading, error };
};
```
- **낙관적 갱신 여부**: 이번 슬라이스는 **비-낙관적**(저장 성공 후 `useRoom.refresh()` 호출로 헤더 갱신, LogList는 다음 진입 시 갱신). 낙관적 로컬 상태는 도입하지 않음(복잡도↓, refresh 일관). → 인수조건/테스트는 "성공 후 refresh가 호출된다"로 검증.

#### 타입 변경
- `MyLog`에 `name: string | null` 추가(`useMyLogs.ts` — `toMyLog` 매핑 `name: row.name ?? null`, `MyLogRow`에 `name: string | null`).
- `RoomDetail`에 `name: string | null` 추가(`useRoom.ts` — RoomRow에 `name?: string | null`, ready 매핑에 `name: row.name ?? null`). ⚠️ `useRoom`의 응답 누락 검사(`!row.room_id || ...`)에 name은 **추가하지 않음**(name은 nullable이므로 누락=정상).

#### 에러 매핑 — `src/features/room/errors.ts`
- `ROOM_ERROR_MESSAGES`에 `NAME_TOO_LONG: '이름은 20자까지 쓸 수 있어요.'` 추가. ⚠️ SQL raise 토큰과 단일 출처 동기화.

---

## 4. 화면 · UX

> 비주얼(시트/헤더/카드 디자인·토큰·radius·간격)은 **ui-publisher** 몫. 여기선 화면·UX **계약**만. 디자인 출처 = 킷 `mk-log.jsx:9-105`.

### 4.1 LogScreen 헤더 (편집 진입점)
- 현재: 아바타 겹침 + `logTitle({nickname, isCouple})` 텍스트(읽기 전용 `Text`).
- 변경: 제목 영역을 **탭 가능**하게 + **pencil 아이콘**(킷 `mk-log:32-41` — 아바타+제목+✏️를 하나의 버튼으로). 탭 → 이름 편집 시트 open.
- 제목 텍스트 = `displayLogName({ name: room.name, memberCount: room.memberCount, selfNickname: meNickname })`. (`meNickname`은 LogScreen이 이미 로드하는 self-profile 닉.)
- accessibilityLabel: "로그 이름 편집".

### 4.2 이름 편집 시트 (신규 컴포넌트, 킷 `mk-log:91-102` 재현)
- 공용 `Sheet` 프리미티브 사용(safe-area·maxHeight 캡은 ui-fidelity-audit에서 정비됨). 제목 "로그 이름".
- 본문: 단일 텍스트 입력(`autoFocus`, `maxLength={20}`, `placeholder = 폴백명`=`displayLogName({ name: null, memberCount, selfNickname: meNickname })`), 초기값 = 이름 있으면 name·없으면 빈 문자열(폴백을 placeholder로 보여줌). 힌트: "💡 우리만의 이름을 지어보세요. 비워두면 기본 이름으로 돌아가요." 저장 버튼(full, lg).
- 동작:
  - 저장 → `useRenameRoom.renameRoom({roomId, name: draft})` → 성공 시 시트 닫기 + `useRoom.refresh()` + 토스트 "로그 이름을 변경했어요"(킷 `mk-log:25`).
  - 빈/공백 입력 저장 → 정규화 null → 서버 name=null → 폴백명 복귀(토스트 동일).
  - 21자 시도 → 앱 maxLength로 1차 차단(입력 자체가 20에서 멈춤). 우회 입력 시 서버 `NAME_TOO_LONG` → 에러 메시지 표시.
- 상태: idle(입력) / saving(저장 버튼 로딩·비활성) / error(에러 메시지 inline 또는 Alert).

### 4.3 LogList 카드 제목
- 현재: `cardTitle({nickname, isCouple})`.
- 변경: `displayLogName({ name: log.name, memberCount: log.memberCount, selfNickname: self.nickname })`. (`self.nickname`은 LogList가 이미 로드하는 self-profile 닉.)
- 카드에서는 **편집 진입점 없음**(탭=LogScreen 진입 유지). 편집은 LogScreen에서만.

### 4.4 상태 표
| 상태 | LogList 카드 | LogScreen 헤더 | 편집 시트 |
|------|-------------|---------------|----------|
| name 있음 | name 표시 | name 표시 | 초기값=name |
| name 없음(null) | 폴백(솔로 "{내닉}의 기록" / 커플 "{내닉} ♥ 짝꿍") | 폴백(동일) | 초기값="" + placeholder=폴백 |
| 저장 중 | — | — | 버튼 로딩 |
| 저장 실패 | — | (기존 값 유지) | 에러 메시지 + 재시도 가능 |

---

## 5. 작업 목록 (각 인수조건 포함)

- [ ] **T1. 마이그레이션 `20260615120000_log_name.sql`** — `rooms.name` 컬럼 + `rename_room` RPC + `list_my_rooms`/`get_room` name 투영 + 권한.
  - 인수조건: `rename_room(roomId, '우리 맛집')` 호출 → 멤버면 `rooms.name='우리 맛집'`, 반환 `{room_id, name:'우리 맛집'}`. 비멤버 호출 → `NOT_A_MEMBER`. 21자 → `NAME_TOO_LONG`. 공백만 → name=null 반환.
  - 테스트: RPC/RLS 스모크(멤버 성공·비멤버 거부·길이 거부·공백→null) — DB는 모킹/스모크 경계.
- [ ] **T2. `logName.ts` 정규화/검증/폴백 유틸** — `normalizeLogName`·`isLogNameTooLong`·`displayLogName`·`LOG_NAME_MAX_LENGTH`.
  - 인수조건: `normalizeLogName({input:'  우리 맛집  '})==='우리 맛집'`; `normalizeLogName({input:'   '})===null`; `isLogNameTooLong` 20자 false/21자 true; `displayLogName` name 우선 · null+memberCount2+selfNickname"민"="민 ♥ 짝꿍" · null+1+"민"="민의 기록" · selfNickname null이면 "우리 로그"/"내 로그".
  - 테스트: 순수 단위(정상·경계 20/21·공백·빈·이모지 길이).
- [ ] **T3. `useRenameRoom` 훅** — RPC 래퍼(인자명 p_room_id/p_name) + 정규화 전달 + loading/error.
  - 인수조건: `renameRoom({roomId,name:'  X '})` → `rpc('rename_room',{p_room_id:roomId,p_name:'X'})` 호출(정규화 후 전달), 반환 `{roomId, name}`; RPC 에러 시 throw + error 세팅.
  - 테스트: supabase.rpc 모킹(성공 반환·인자명·정규화 전달·에러 throw·loading 토글).
- [ ] **T4. `useMyLogs`/`useRoom`에 name 매핑** — MyLog·RoomDetail·Row 타입 + 매핑 추가.
  - 인수조건: RPC 행에 `name:'X'` → `MyLog.name==='X'`; name 누락/null → `null`. `get_room` name → `RoomDetail.name`; 누락 시 ready 유지(에러 아님).
  - 테스트: 기존 useMyLogs/useRoom spec에 name 매핑 케이스 추가(name 값·null·누락).
- [ ] **T5. 에러 매핑 `NAME_TOO_LONG` 추가** — `ROOM_ERROR_MESSAGES`.
  - 인수조건: `mapRoomError({error:new Error('NAME_TOO_LONG')})==='이름은 20자까지 쓸 수 있어요.'`.
  - 테스트: errors.spec 케이스 추가.
- [ ] **T6. 이름 편집 시트 컴포넌트 + LogScreen 헤더 진입점 배선** — pencil 탭 → 시트 → 저장 → refresh + 토스트.
  - 인수조건: 헤더 제목 탭 → 시트 open(초기값=현재 name 또는 빈+폴백 placeholder); "우리 맛집" 입력+저장 → 시트 닫힘 + 헤더 제목 "우리 맛집"; 빈 저장 → 폴백명 복귀.
  - 테스트: LogScreen.spec — 탭→시트 open, 저장 시 renameRoom+refresh 호출, 표시명 갱신(useRenameRoom·useRoom 모킹). (비주얼 충실도는 qa-visual.)
- [ ] **T7. LogList 카드 제목 displayLogName 적용** — `cardTitle` → `displayLogName`.
  - 인수조건: log.name='X' 카드 → "X" 표시; name=null·memberCount2·selfNickname"민" → "민 ♥ 짝꿍"; null·1·"민" → "민의 기록".
  - 테스트: LogListScreen.spec — name 있는 로그/없는 로그(솔로·커플 폴백) 제목 렌더.
- [ ] **T8. 전체 `npm test` green** — 회귀 0(기존 useMyLogs/useRoom/LogScreen/LogList spec 포함).
  - 인수조건: `npm test` 통과.

---

## 5-1. 테스트 케이스 (TDD)

### 순수 단위 (유틸·훅·화면 — `docs/testing-strategy.md` ✅ 단위)
- **`logName.normalizeLogName`**: 정상("우리 맛집"→그대로) / 경계(앞뒤 공백 trim) / 공백만→null / 빈→null / 탭·개행 공백 trim.
- **`logName.isLogNameTooLong`**: 19자 false / 20자 false(경계) / 21자 true / 이모지 포함 코드포인트 카운트.
- **`logName.displayLogName`**: name 있음→name / name=null & memberCount<2 & selfNickname"민"→"민의 기록" / name=null & memberCount>=2 & "민"→"민 ♥ 짝꿍" / selfNickname null & memberCount<2→"내 로그" / selfNickname null & >=2→"우리 로그" / name='' (혹시 빈 문자열)→폴백(방어).
- **`useRenameRoom`**(supabase.rpc 모킹): 성공(반환 매핑·인자명 p_room_id/p_name·정규화된 p_name 전달) / RPC error → throw + error 세팅 / loading true→false / 공백 입력 → p_name=null 전달.
- **`useMyLogs`**(rpc 모킹): name 포함 행 → MyLog.name / name null·누락 → null / 기존 매핑 회귀.
- **`useRoom`**(rpc 모킹): name 포함 → RoomDetail.name / name 누락 → ready 유지(name=null, 에러 아님) / 기존 invite_code·member_count 누락은 여전히 error.
- **`errors.mapRoomError`**: NAME_TOO_LONG → 한국어 메시지 / 포함 매칭.
- **LogScreen.spec**(훅 모킹): 헤더 제목=displayLogName / 탭→시트 open / 저장→renameRoom 호출·성공 시 refresh·시트 close / saving 중 버튼 비활성 / 저장 에러 → 메시지.
- **LogListScreen.spec**(훅 모킹): name 카드 제목 / 폴백 카드 제목 / 카드 탭=LogScreen 네비(편집 아님, 회귀).

### 모킹/스모크 (SQL·RPC·RLS — ✅ 모킹·스모크 경계)
- **`rename_room` RPC 스모크**: 멤버 성공(name 반영·반환) / 비멤버 → NOT_A_MEMBER / 없는 room → ROOM_NOT_FOUND / 21자 → NAME_TOO_LONG / 공백만 → name=null / 미인증 → NOT_AUTHENTICATED.
- **`list_my_rooms`/`get_room` 투영 스모크**: name 컬럼/키 반환(있을 때 값·없을 때 null).
- **격리(타 로그) 스모크**: A가 자기 멤버 로그만 rename, 비멤버 로그 rename 시도는 NOT_A_MEMBER로 차단(로그 격리).

---

## 6. 엣지케이스

- **빈 상태/폴백**: name=null인 모든 기존 로그 → 폴백명으로 표시(마이그레이션 후 모든 기존 행 name=NULL → 깨짐 없이 폴백). 신규 로그도 name=NULL로 시작.
- **입력 경계**: 20자 정확(허용) / 21자(maxLength로 입력 차단 + 서버 NAME_TOO_LONG 2차) / 공백만(→null 폴백 복귀) / 앞뒤 공백(trim) / 이모지·한글 조합(코드포인트 카운트, DB char_length 최종 방어).
- **권한/RLS**: 비멤버가 RPC 직접 호출 → NOT_A_MEMBER(get_room과 동일 보안핵심 — DEFINER RLS 우회하므로 멤버 검사 필수). 멤버면 created_by 아니어도 수정 가능(커플 공용).
- **동시성(커플 2명)**: 두 멤버가 거의 동시에 다른 이름으로 저장 → 마지막 update가 이김(last-write-wins, name은 단일 스칼라라 충돌 손상 없음). 상대 화면은 다음 진입/refresh에 최신값(Realtime 미도입 — OUT). 명시적 잠금 불요(단일 컬럼 갱신).
- **네트워크 실패**: 저장 중 RPC 실패 → error 메시지 + 시트 유지(입력 보존) + 재시도 가능. 헤더는 기존 표시명 유지(낙관적 갱신 안 하므로 잘못된 값 노출 없음).
- **삭제된 로그**: rename 직전 로그가 leave_room로 삭제됨(드묾) → ROOM_NOT_FOUND. 에러 메시지 "로그를 찾을 수 없어요"(기존 토큰).
- **인증**: 세션 만료 중 저장 → NOT_AUTHENTICATED → "세션이 만료됐어요"(기존).
- **stale 목록**: LogScreen에서 이름 변경 후 뒤로 가면 LogList는 이전 화면 마운트 상태 — 다음 진입/포커스 refresh 전엔 옛 제목 가능. 이번 슬라이스는 LogScreen refresh만 보장(LogList 자동 refresh는 OUT — 비용/복잡도). 사용자가 목록 재진입 시 최신.

---

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

1. **`rename_room` SQL 반환 `{room_id, name}` ↔ `useRenameRoom` 매핑** — 키명(snake) · name nullable · 인자명 `p_room_id`/`p_name` 정확 일치(오타 시 조용히 실패).
2. **`rename_room` 에러 토큰(SQL raise) ↔ `errors.ROOM_ERROR_MESSAGES`** — `NAME_TOO_LONG`/`NOT_A_MEMBER`/`ROOM_NOT_FOUND`/`NOT_AUTHENTICATED` 단일 출처 동기화.
3. **`list_my_rooms` returns table `name` ↔ `useMyLogs.MyLogRow`/`toMyLog`** — 컬럼 추가가 매핑에 반영, null 안전.
4. **`get_room` jsonb `name` 키 ↔ `useRoom.RoomRow`/ready 매핑** — name 누락이 BAD_RESPONSE로 오판되지 않음(누락 검사에서 name 제외).
5. **`LOG_NAME_MAX_LENGTH`(20) ↔ DB `rename_room` char_length 기준(20) ↔ 입력 maxLength(20)** — 길이 단일 출처 3중 일치(C-LEN).
6. **`displayLogName` 폴백 규칙 ↔ LogList 카드 ↔ LogScreen 헤더** — 같은 유틸(`{name, memberCount, selfNickname}`)로 두 화면 표시명 일관. 두 화면 모두 self-profile 닉(`self.nickname`/`meNickname`)을 selfNickname으로 전달(파트너 닉 미사용, 커플은 "짝꿍" 고정).
7. **`normalizeLogName`(앱) ↔ `nullif(btrim())`(SQL)** — 공백→null 규칙 동일(이중 정규화).
8. **편집 진입점 = LogScreen만, LogList 카드 탭 = 네비게이션** — 회귀(카드 탭이 시트를 열지 않음).

---

## 8. 비용 가드레일 체크

- **Kakao 호출**: 없음(이 기능은 Kakao 미사용).
- **Realtime**: 미도입 — 이름 변경 동기화는 다음 진입/refresh(폴링/구독 없음). architecture §7 "Realtime 비용 콘텐츠 스프린트 검토"와 정합.
- **조회 횟수**: rename 성공 후 `useRoom.refresh()` 1회만(폴링 없음). LogList는 자동 refresh 안 함(추가 RPC 호출 0). useMyLogs/useRoom의 "진입 1회 + 명시 refresh" 정책 계승.
- **이미지/Storage**: 대표 이미지는 OUT(후속) — 이번 슬라이스 Storage 미사용.
- **AWS 미사용**: Supabase RPC/Postgres만. 컬럼 1개 추가(무료 티어 영향 0).

---

## 9. 핵심 결정 (확정 — 오케스트레이터/사용자 락인 2026-06-15)

### 결정 1 — rename 메커니즘: `rename_room(p_room_id, p_name)` RPC (DEFINER + 멤버 검증, name만 갱신)
- rooms는 invite_room.sql:71부터 insert/update/delete RLS 정책이 없고(직접 쓰기 거부) 모든 쓰기를 DEFINER RPC(`create_room`/`join_room`/`leave_room`/`get_room`)로 수행한다. `rename_room`은 이 패턴을 따른다. **`rooms_update_member` RLS는 폐기**(신설하지 않음) — update 정책은 name 외 컬럼(invite_code·mode·delete_*)까지 멤버에게 노출되어 컬럼 단위 제약이 불가능하기 때문. RPC는 본문이 name만 갱신하도록 강제한다.
- **멤버 누구나 수정한다**(생성자 한정 아님 — 커플 공용 라벨). created_by 검사 없음.

### 결정 2 — 폴백 전략: B'(본인 닉네임 기반)
- `displayLogName({ name, memberCount, selfNickname })`:
  - `name` 있으면 → `name`.
  - `name=null` & 솔로(memberCount<2) → `"{selfNickname}의 기록"`.
  - `name=null` & 커플(memberCount>=2) → `"{selfNickname} ♥ 짝꿍"`.
  - `selfNickname`이 null/빈 문자열이면 안전 폴백 → 솔로 `"내 로그"` / 커플 `"우리 로그"`.
- **파트너 닉네임은 사용하지 않는다.** profiles RLS=self-only(invite_room.sql:54)라 파트너 프로필을 클라가 읽을 수 없으므로 파트너는 "짝꿍" 고정 표기. `selfNickname`은 두 화면이 이미 로드하는 self-profile 닉에서 전달 — 별도 RPC 닉네임 확장 없음(list_my_rooms/get_room은 닉네임을 반환하지 않는다).

### 결정 3 — 편집 진입점: LogScreen 헤더 제목 탭(✏️)
- 킷 `mk-log.jsx:32-41`의 패턴(헤더 아바타+제목+✏️ = 탭 가능 버튼) → "로그 이름" 편집 시트.
- **표시**: LogList 카드 제목 + LogScreen 헤더 제목 둘 다(읽기). **편집은 LogScreen 헤더만** — LogList 카드 인라인 rename은 OUT(카드 탭=LogScreen 진입 유지).

### 결정 4 — 검증 규칙: trim → 빈/공백 null(폴백 복귀), 최대 20자(코드포인트), 앱 maxLength 1차 + DB char_length 2차
- 빈/공백 → null → 폴백명. 길이 단일 출처 `LOG_NAME_MAX_LENGTH=20`(C-LEN). 금칙어/중복 검사 없음(개인 라벨).

---

## 10. 의존성 / 이전 스프린트 정합

- **multi-log-home**(`20260610150000`): `list_my_rooms` 시그니처 변경 대상 — name 컬럼 추가 시 `drop+recreate` 필요(returns table 타입 변경). 기존 5컬럼 소비자(useMyLogs) 회귀 검증 필수.
- **log-invite**(`20260611120000`): `get_room` jsonb에 name 키 추가(비파괴). useRoom 소비.
- **ui-fidelity-audit**: 공용 `Sheet`(safe-area·maxHeight 캡)·`SubBar`·LogScreen 헤더 구조 확정됨 → 편집 시트는 공용 Sheet 재사용, 헤더는 기존 구조에 pencil+탭만 추가.
- **마이그레이션 규칙**: 기존 마이그레이션 미수정, 신규 `20260615120000_log_name.sql` additive. 재실행 가능(`add column if not exists`·`create or replace`·`drop function if exists` 후 재생성). 실 적용은 사용자 `supabase db push`.
