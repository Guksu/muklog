# Dev Notes — log-name (로그 이름)

> developer 산출. 데이터·로직·배선. UI 비주얼 충실도는 ui-publisher/qa-visual. plan.md §3·§5·§7 기준.
> 결과: `npm test` **811 passed / 107 suites green**, `npx tsc --noEmit` 0 error, **회귀 0**.

## 1. 변경/신규 파일

### 백엔드 (마이그레이션)
- `supabase/migrations/20260615120000_log_name.sql` (신설, additive·재실행 가능)
  - ① `rooms.name text` 컬럼 추가(`add column if not exists`, nullable). RLS 변경 없음(쓰기는 RPC-only).
  - ② `rename_room(p_room_id uuid, p_name text)` RPC(SECURITY DEFINER) 신설 — 멤버검증 + name-only update.
  - ③ `list_my_rooms()` **drop + recreate** — returns table에 `name text` 추가(반환 타입 변경이라 replace 불가 → drop 필수).
  - ④ `get_room(p_room_id)` `create or replace` — jsonb에 `name` 키 추가(시그니처 불변, 비파괴).
  - 권한: 각 함수 `revoke all from public, anon` + `grant execute to authenticated`.

### 프론트 (순수 유틸 · 훅 · 타입 · 에러)
- `src/features/room/logName.ts` (신설, 순수) — `LOG_NAME_MAX_LENGTH=20`, `normalizeLogName`, `isLogNameTooLong`(코드포인트 `[...str].length`), `displayLogName`.
- `src/features/room/logName.spec.ts` (신설) — 19건.
- `src/features/room/useRenameRoom.ts` (신설) — `renameRoom({roomId,name})` → 정규화 → `rpc('rename_room',{p_room_id,p_name})` → `{roomId,name}`. loading/error.
- `src/features/room/useRenameRoom.spec.ts` (신설) — 6건(rpc 모킹).
- `src/features/room/errors.ts` (수정) — `NAME_TOO_LONG: '이름은 20자까지 쓸 수 있어요.'` 추가.
- `src/features/room/errors.spec.ts` (수정) — NAME_TOO_LONG 정확/포함 매칭 + 키 개수 9→10.
- `src/features/room/useMyLogs.ts` (수정) — `MyLog.name`·`MyLogRow.name?`·`toMyLog`에 `name: row.name ?? null`.
- `src/features/room/useMyLogs.spec.ts` (수정) — name 매핑 케이스(값/null/누락).
- `src/features/room/useRoom.ts` (수정) — `RoomDetail.name`·`RoomRow.name?`·ready 매핑 `name: row.name ?? null`. **누락 검사에 name 제외**(nullable).
- `src/features/room/useRoom.spec.ts` (수정) — name 값/null/키누락 케이스.
- `src/features/room/index.ts` (수정) — `useRenameRoom`·`LOG_NAME_MAX_LENGTH`·`normalizeLogName`·`isLogNameTooLong`·`displayLogName` export 추가. (LogNameSheet/LogTitleButton export는 ui-publisher가 추가함.)

### 프론트 (화면 배선 — Part B)
- `src/navigation/screens/LogScreen.tsx` (수정) — 헤더 inner row → `LogTitleButton`(avatarSlot+title+✏️), 제목=`displayLogName({name,memberCount,selfNickname:meNickname})`, pencil 탭→`LogNameSheet` open, 저장→`useRenameRoom.renameRoom`→성공 시 close + `useRoom.refresh()`(1회). 실패 시 시트 유지+에러.
- `src/navigation/screens/LogScreen.spec.tsx` (수정) — useRenameRoom 모킹 + T6 7건(표시명·시트 open·저장·refresh·빈입력·실패·saving).
- `src/navigation/screens/LogListScreen.tsx` (수정) — `cardTitle()` 제거 → `displayLogName({name:log.name,memberCount,selfNickname:self.nickname})`. 카드 탭=LogScreen 네비 유지(편집 진입점 없음 — 회귀).
- `src/navigation/screens/LogListScreen.spec.tsx` (수정) — name 카드/폴백(솔로·커플) 3건.
- `src/features/profile/profileStats.spec.ts` (수정) — MyLog 픽스처에 `name: null`(타입 정합만, 로직 불변).

### ui-publisher 산출(참고 — 내가 배선한 계약 소비처)
- `src/features/room/components/LogNameSheet.tsx` / `.spec.tsx`
- `src/features/room/components/LogTitleButton.tsx` / `.spec.tsx`

## 2. 계약 shape (생산자 ↔ 소비자 — §7 경계면)

| # | 생산자 | shape | 소비자 | 매핑 |
|---|--------|-------|--------|------|
| 1 | `rename_room` 반환 | jsonb `{ room_id: uuid, name: text\|null }` | `useRenameRoom` | `{ roomId: room_id, name }`. 인자명 `p_room_id`/`p_name` 정확 일치. |
| 2 | `rename_room` raise 토큰 | `NOT_AUTHENTICATED`/`ROOM_NOT_FOUND`/`NOT_A_MEMBER`/`NAME_TOO_LONG` | `errors.ROOM_ERROR_MESSAGES` | 4토큰 모두 매핑 존재. NAME_TOO_LONG 신규(단일 출처 SQL↔errors.ts). |
| 3 | `list_my_rooms` returns table | `..., name text`(6번째 컬럼) | `useMyLogs.MyLogRow`/`toMyLog` | `name: row.name ?? null`. 누락/null → null. |
| 4 | `get_room` jsonb | `{ ..., name: text\|null }` | `useRoom.RoomRow`/ready 매핑 | `name: row.name ?? null`. **누락 검사에서 name 제외**(누락=정상, BAD_RESPONSE 아님). |
| 5 | `LOG_NAME_MAX_LENGTH=20` | 상수 | DB `char_length>20` + 입력 `maxLength=20` | C-LEN 3중 일치. |
| 6 | `displayLogName({name,memberCount,selfNickname})` | string | LogList 카드 + LogScreen 헤더 | 동일 유틸·동일 인자. selfNickname=self-profile 닉(파트너는 "짝꿍" 고정). |
| 7 | `normalizeLogName`(trim→빈 null) | string\|null | `useRenameRoom`이 p_name으로 전달 | DB `nullif(btrim())`와 동일(이중 정규화). |
| 8 | LogTitleButton.onEdit(LogScreen만) | — | LogList 카드 탭=네비(편집 아님) | 회귀 유지(카드는 시트 미오픈). |

### LogNameSheet props 계약(ui-publisher) ↔ LogScreen 배선
`open`=editOpen / `initialValue`=`room.name ?? ''` / `placeholder`=`displayLogName({name:null,...})`(폴백명) / `saving`=renaming / `error`=renameError / `onClose`=close / `onSave`=원문 draft 그대로(정규화는 useRenameRoom 내부).

## 3. 마이그레이션 적용법
- 사용자 환경에서: `supabase db push` (또는 SQL 에디터에서 `20260615120000_log_name.sql` 실행).
- additive·재실행 가능. 기존 마이그레이션 미수정.
- ⚠️ `list_my_rooms`는 returns table 시그니처 변경이라 `drop function if exists` 후 재생성됨(반환 타입 변경 → replace 불가). 적용 시 일시적으로 함수가 없는 구간 없음(같은 트랜잭션/순차 실행).

## 4. RPC 스모크 체크리스트 (DB는 단위 대상 아님 → 수동/스모크)
- [ ] 멤버가 `rename_room(roomId, '우리 맛집')` → `rooms.name='우리 맛집'`, 반환 `{room_id, name:'우리 맛집'}`.
- [ ] 비멤버 호출 → `NOT_A_MEMBER`.
- [ ] 없는 room → `ROOM_NOT_FOUND`.
- [ ] 21자 → `NAME_TOO_LONG`.
- [ ] 공백만('   ') → name=null 반환(폴백 복귀), `rooms.name=NULL`.
- [ ] 미인증 → `NOT_AUTHENTICATED`.
- [ ] `list_my_rooms` 반환 행에 name 컬럼(값/null) 포함.
- [ ] `get_room` 반환 jsonb에 name 키(값/null) 포함.
- [ ] created_by 아닌 멤버도 rename 성공(커플 공용 라벨).

## 5. 비용 가드레일 정합 (§8)
- Realtime 미도입. rename 성공 후 `useRoom.refresh()` **1회만**(LogScreen.spec lock). LogList 자동 refresh 0(다음 진입 시 갱신).
- Kakao 미사용. 컬럼 1개 추가(무료 티어 영향 0). AWS 미사용.

## 6. 미해결 / 협의 필요
- **토스트("로그 이름을 변경했어요")**: plan §4.2가 토스트를 명시하나 코드베이스에 토스트 프리미티브가 **없다**(기존 화면들도 inline state·goBack 복귀로 피드백). LogNameSheet에도 토스트 없음. 현재는 **성공 시 시트 close + refresh**로 피드백을 대체함(킷 `mk-log:25` showToast의 RN 대응 프리미티브 부재). 토스트가 필요하면 ui-publisher에 공용 Toast 프리미티브 신설 요청 필요 — 오케스트레이터 판단 요망.
- LogScreen.spec의 LogNameSheet/LogTitleButton은 **경량 테스트 더블**로 모킹함. 실 컴포넌트를 requireActual하면 `@/components` 경유 배럴 순환(TDZ)이라 로직 더블로 대체(배선 검증만). 컴포넌트 비주얼·자체 동작은 각 컴포넌트 spec(ui-publisher) + qa-visual이 커버.
