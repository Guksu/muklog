# Sprint Plan — `log-invite` (커플 초대 흐름 완성)

> 슬러그: `sprint-20260611-log-invite` · 날짜: 2026-06-11 · 단일 기능: **로그 초대(코드 표시·복사 + 입장 UI)**
> 설계 단일 출처: `docs/design/architecture.md` §4·§5(백로그 `log-invite` 행). UI 단일 출처: `ui-design` 스킬 muklog 킷
> (`mk-home.jsx`의 AddSheet/JoinScreen/CodeInput/CreatedScreen/InviteCodeCard/SubBar, `mk-ui.jsx`의 Sheet/MkButton).
> 테스트 전략: `docs/testing-strategy.md`(TDD Red→Green→Refactor, jest-expo + @testing-library/react-native). 코드 컨벤션: `docs/code-convention.md`.

---

## 1. 기능 한 줄 정의

LogScreen에서 그 로그의 **6자리 초대코드를 표시·복사**하고, 헤더 + 버튼의 **액션시트에서 "초대코드로 입장"** 을 골라 `JoinLogScreen`에서 코드를 입력하면 `join_room`으로 **2번째 멤버가 합류(=커플화)** 되는 흐름을 완성한다.

---

## 2. 범위 (Scope)

### In-scope
1. **초대코드 조회 계약**: LogScreen이 해당 로그의 `invite_code` + `member_count` + `mode`를 1 round-trip으로 얻는다 (`get_room(p_room_id)` DEFINER RPC, §4 결정).
2. **LogScreen 채우기**: `InviteCodeCard`(코드 표시 + 복사, expo-clipboard) + 솔로/커플 분기 안내. (맛집 리스트·상세·에디터는 OUT — `muklog-list` 이후.)
3. **+ 버튼 액션시트(AddSheet)**: 헤더 + → "새 로그 만들기 / 초대코드로 입장" 시트. 생성=기존 `createRoom()`, 입장=`JoinLogScreen` 이동.
4. **JoinLogScreen(JoinScreen + CodeInput)**: 6셀 코드 입력(`normalizeInviteCodeInput`·`isInviteCodeComplete` 재사용) → `join_room` → `myLogs.refresh()` → 해당 LogScreen 이동. 실패 시 인라인 에러.
5. **라우팅**: `routes.ts`에 `JoinLog` 등록 + `AppNavigator`에 스크린 등록.
6. **Sheet 공용 컴포넌트**: `src/components/Sheet.tsx`(mk-ui `Sheet` 재현, 액션시트/모달 베이스) 신설.

### Out-of-scope (명시적 제외 — 추측 금지)
- 맛집(먹로그) 엔트리: 리스트/상세/에디터/사진/영상 → `muklog-list`·`muklog-editor`·`muklog-detail`·`muklog-video`.
- 짝꿍 프로필 카드(파트너 닉네임/아바타) **데이터 조회**: room_members RLS=자기 행만 → 파트너 프로필을 읽으려면 별도 RPC 필요. 이번엔 **멤버 수(솔로/커플)만** 표시하고 파트너 신원 표시는 차기 슬라이스로 미룬다(아래 §11 분할 제안 참고).
- 로그 나가기 UI(`leave_room(p_room_id)` 호출부) — dormant 유지, 차기 LogScreen 슬라이스.
- 카카오/지도/장소검색 일체.
- 코드 **공유시트(OS share)** — 이번은 클립보드 복사까지만.

---

## 3. 사전 사실 확인 (기존 코드/스키마 정독 결과)

| 항목 | 상태 | 출처 |
|------|------|------|
| `join_room(p_code)` RPC: 솔로 조인 허용·정원2·로그별 멤버십 멱등 | ✅ 선반영 | `20260610150000_multi_log_home.sql` |
| `useJoinRoom` (joinRoom/loading/error, snake→camel) | ✅ 선반영(미사용) | `src/features/room/useJoinRoom.ts` |
| `normalizeInviteCodeInput`·`isInviteCodeComplete`·`INVITE_CODE_LENGTH`·`INVITE_CODE_CHARSET` | ✅ 선반영 | `src/features/room/code.ts` |
| `mapRoomError`(INVALID_CODE/ROOM_FULL/NOT_AUTHENTICATED…) | ✅ 선반영 | `src/features/room/errors.ts` |
| `rooms_select_member` RLS: 멤버는 자기 로그 row(`invite_code` 포함) SELECT 가능 | ✅ 확인 | `20260609120000_invite_room.sql:66-71` |
| `room_members_select_own` RLS: **자기 행만** → 클라가 member_count 직접 집계 불가 | ✅ 확인(함정) | `20260609120000_invite_room.sql:74-76` |
| `useMyLogs`/`MyLogsProvider`: `{ roomId, mode, memberCount, createdAt, joinedAt }` + `refresh()` | ✅ 선반영 | `src/features/room/useMyLogs.ts` |
| `createRoom()` 반환에 `inviteCode` 포함 | ✅ | `src/features/room/useCreateRoom.ts` |
| `expo-clipboard@~7.0.1` 의존성 존재, **레포 내 사용처 0** | ✅(신규 사용) | `package.json` |
| 공용 `Sheet` 프리미티브 **없음** → 신설 필요 | ⚠️ | `src/components/index.ts` |
| Icon 셋에 `link`/`copy`/`check` 글리프 **없음** (mk 킷 `leftIcon="link"` 사용분) | ⚠️(대체) | `src/components/Icon.tsx` |
| `LogScreen` stub / `PlusHeaderButton` 단일 생성 / `JoinLog` 라우트 미등록 | ⚠️(채울 대상) | 각 파일 |

---

## 4. 핵심 결정 (Decisions)

### D1. 초대코드 조회 = 신규 `get_room(p_room_id)` DEFINER RPC (primary)
**왜 RPC인가**
- LogScreen은 카드 탭뿐 아니라 입장 직후·앱 재진입·딥링크로도 진입 가능 → `useMyLogs` 캐시에 해당 row가 없을 수 있다(목록 미조회/stale). 화면 자체가 자급(self-sufficient)해야 한다.
- `member_count`는 클라이언트가 직접 못 읽는다(`room_members_select_own` RLS = 자기 행만 → count 항상 1). DEFINER RPC만이 정확한 멤버 수를 준다(이미 `list_my_rooms`도 같은 이유로 DEFINER).
- 1 round-trip으로 `invite_code` + `member_count` + `mode`를 일관 스코프(멤버십 검사 내장)로 가져온다.

**계약**
```
get_room(p_room_id uuid) → jsonb
  성공: { "room_id": uuid, "invite_code": text, "member_count": int, "mode": text }
  에러 토큰(raise exception): NOT_AUTHENTICATED / NOT_A_MEMBER / ROOM_NOT_FOUND
```
- SECURITY DEFINER, `set search_path = public`.
- **RLS 함정(C-RLS)**: DEFINER → RLS 우회 → 본문에서 `auth.uid()`가 `p_room_id`의 멤버인지 **명시 검사 필수**(누락 시 임의 로그 코드 노출 = 초대 시스템 붕괴). 비멤버 → `NOT_A_MEMBER` raise(존재하는 코드라도 멤버 아니면 거부).
- 존재하지 않는 room_id → `ROOM_NOT_FOUND`.
- `member_count = (select count(*) from room_members where room_id = p_room_id)`.
- 마이그레이션: `supabase/migrations/20260611120000_log_invite.sql`. additive(신규 함수만, 기존 함수 미수정). idempotent(`create or replace` + grant/revoke 재선언). `grant execute … to authenticated; revoke … from public, anon;`.

**대안(no-migration fallback, 채택 안 함)**: `useMyLogs` 캐시에서 `memberCount` + 클라 `select invite_code from rooms where id=roomId`. → 캐시 미스/stale·2 round-trip·LogScreen↔목록 결합 때문에 비채택. developer가 마이그레이션 적용을 사용자에게 못 맡기는 상황이면 fallback 가능하나, 그 경우 plan 갱신 후 진행.

### D2. CreatedScreen은 도입하지 않는다 (스코프 최소화 권장안)
- mk 킷 `CreatedScreen`(생성 직후 코드 공유 전용 화면)은 **이번 미도입**. 이유: 생성 후 곧장 **그 로그의 LogScreen으로 이동**하면 LogScreen의 `InviteCodeCard`가 이미 코드 공유 UX를 100% 제공 → 화면 중복. UX 동등 + 화면/테스트 1개 절감.
- 단, 현재 `PlusHeaderButton`의 "생성=화면 전환 없음, refresh만" 동작을 **"생성 → 해당 LogScreen으로 navigate"** 로 바꾼다(생성자가 코드를 바로 보고 공유하도록). refresh는 navigate 전/후 1회 유지(목록 +1).
  - ⚠️ 회귀 주의: 기존 PlusHeaderButton spec("화면 전환이 없으므로 refresh만")이 깨진다 → spec도 함께 갱신(§5 T7).

### D3. 솔로/커플 분기 표시 (LogScreen)
- `member_count === 1`(솔로): `InviteCodeCard`(코드+복사) **표시** + 안내문 "초대코드로 짝꿍을 초대하세요".
- `member_count >= 2`(커플): 코드 카드 **숨김** + "둘이 함께 기록 중이에요" 안내(MemberBadge "둘이" 톤). 코드를 굳이 노출하지 않음(정원 찼으므로).
- 로딩/에러/`roomId` 누락 분기 각각 안전 처리(아래 §6 화면).

### D4. 복사 버튼 아이콘
- Icon 셋에 `link`/`copy` 없음 → `InviteCodeCard` 복사 버튼은 **텍스트 "복사"** 로 표기(글리프 없이). 브랜드 규칙(이모지/텍스트 글리프 아이콘 금지)은 **아이콘 위치 한정** 규칙이며, 버튼 라벨 텍스트는 허용. mk 킷의 `leftIcon="link"`는 아이콘셋 확장(별도 슬라이스) 전까지 생략. (대안: assets/icons에 `link.svg` 추가는 OUT — 아이콘셋 슬라이스로 미룸.)

### D5. 입장 성공 후 네비게이션
- `join_room` 성공 → `myLogs.refresh()`(목록에 +1/멱등) → **그 로그의 LogScreen으로 `navigation.replace`**(JoinLog를 스택에서 치워 뒤로가기 시 코드 입력으로 안 돌아오게). 토스트/Alert 없이 화면 전환으로 성공 피드백.

---

## 5. 데이터·API 계약 (developer 구현 계약)

### 5.1 신규 RPC `get_room(p_room_id uuid)` — 마이그레이션 `20260611120000_log_invite.sql`
```
요청:  supabase.rpc('get_room', { p_room_id: roomId })   // 인자명 p_room_id 정확히 일치
응답(성공): { room_id: string, invite_code: string, member_count: number, mode: 'solo'|'couple' }
에러: rpcError.message ∈ { 'NOT_AUTHENTICATED', 'NOT_A_MEMBER', 'ROOM_NOT_FOUND' } (또는 텍스트 포함)
```

### 5.2 신규 훅 `useRoom({ roomId })` — `src/features/room/useRoom.ts`
- 생산자: `get_room` RPC. 소비자: LogScreen.
- 반환:
```ts
type RoomDetail = { roomId: string; inviteCode: string; memberCount: number; mode: RoomMode };
type RoomDetailState =
  | { status: 'loading' }
  | { status: 'ready'; room: RoomDetail }
  | { status: 'error'; message: string };
// { state, refresh }  — useMyLogs와 동일한 "진입 1회 + refresh" 정책(폴링 금지, 비용 가드레일 §10).
```
- snake→camel 매핑(`room_id`→`roomId`, `invite_code`→`inviteCode`, `member_count`→`memberCount`).
- 응답 형 누락(`!invite_code` 등) → 에러 상태(`useCreateRoom`의 `BAD_RESPONSE` 패턴 준용).
- effect 명명 함수(`loadRoomOnId`)·deps `[roomId]`·`useCallback` 금지(컨벤션).
- 에러 메시지: `mapRoomError`에 신규 토큰 추가(§5.5) 후 그걸로 매핑.

### 5.3 기존 재사용 (변경 없음)
- `useJoinRoom`(`joinRoom({ code })` → `{ roomId }`, loading/error). JoinLogScreen이 소비.
- `code.ts`(`normalizeInviteCodeInput({ raw })`, `isInviteCodeComplete({ code })`, `INVITE_CODE_LENGTH=6`).
- `useMyLogsContext().refresh`(입장/생성 후 목록 갱신).

### 5.4 네비게이션 계약
- `routes.ts`: `Routes.JoinLog = 'JoinLog'` 추가. `AppStackParamList[Routes.JoinLog]: undefined`.
- `AppNavigator`: `<Stack.Screen name={Routes.JoinLog} component={JoinLogScreen} options={{ ...detailHeaderOptions, title: '초대코드 입장' }} />` (또는 SubBar 자체 헤더 + `headerShown:false` — mk 킷 SubBar 재현 시 후자 선택 가능. developer 재량, 단 뒤로가기 동작 보장).
- LogScreen 진입 파라미터: 기존 `{ roomId: string }` 그대로.

### 5.5 에러 토큰 동기화 (`errors.ts`)
`ROOM_ERROR_MESSAGES`에 신규 추가(get_room 토큰):
```
NOT_A_MEMBER:   '이 로그에 접근할 권한이 없어요.'
ROOM_NOT_FOUND: '로그를 찾을 수 없어요.'
```
- ⚠️ 토큰 문자열은 SQL(raise) ↔ errors.ts 단일 출처 동기화(C2 교차검증).
- 기존 토큰(INVALID_CODE/ROOM_FULL/NOT_AUTHENTICATED/ALREADY_IN_ROOM…) 불변.

---

## 6. 화면 / UX

### 6.1 `LogScreen`(채움) — `src/navigation/screens/LogScreen.tsx`
- `useRoute().params.roomId` → 없으면 기존 "로그를 찾을 수 없어요"(불변).
- `useRoom({ roomId })` 분기:
  - `loading` → 중앙 `ActivityIndicator`(또는 스켈레톤). 토큰 색.
  - `error` → 안내 + 다시 시도(`refresh`) 버튼.
  - `ready`:
    - 상단: 로그 헤더 영역(생성일/MemberBadge 톤 — Badge 컴포넌트 재사용 가능).
    - 솔로(`memberCount===1`): `InviteCodeCard` + "초대코드로 짝꿍을 초대하세요" 안내.
    - 커플(`memberCount>=2`): 코드 카드 숨김 + "둘이 함께 기록 중이에요".
    - 하단: "맛집 기록은 곧 추가돼요"류 placeholder(muklog-list 자리). (OUT 표시)

### 6.2 `InviteCodeCard` — `src/components/InviteCodeCard.tsx`(공용) 또는 `features/room/`
- mk `InviteCodeCard` 재현: `accent-weak`(primaryWeak) 배경, radius 20(`theme.radius.sheet`≈20 또는 card22), "초대코드" 라벨(accentStrong, letterSpacing) + 코드(대형, letterSpacing 넓게) + "복사" 버튼.
- 복사: `expo-clipboard`의 `setStringAsync(code)` → 성공 시 토스트/Alert("초대코드를 복사했어요"). RN엔 토스트 기본 없음 → 간단 인라인 "복사됨" 상태(2초) 또는 `Alert`. developer 재량(테스트 가능하게 노출).
- props: `{ code: string }`. JSDoc.

### 6.3 `AddSheet` — `src/navigation/AddSheet.tsx`(또는 PlusHeaderButton 내부)
- mk `AddSheet`/`SheetAction` 재현(공용 `Sheet` 위): 두 행 — "새 로그 만들기"(🥢, "혼자 시작하고, 나중에 초대해요") / "초대코드로 입장"(💌, "연인이 보낸 6자리 코드 입력").
- 생성 → 시트 닫고 `createRoom()` → 성공 시 생성된 roomId의 LogScreen으로 navigate + refresh(§D2).
- 입장 → 시트 닫고 `navigation.navigate(Routes.JoinLog)`.

### 6.4 `Sheet`(공용 프리미티브) — `src/components/Sheet.tsx`
- mk-ui `Sheet` 재현: RN `Modal`(transparent) 또는 절대배치 오버레이 + 하단 슬라이드 패널. 딤 배경 탭 → onClose. 핸들바 + 옵션 title.
- props: `{ visible: boolean; onClose: () => void; title?: string; children }`. 토큰 스타일(card bg, radius sheet 20, 딤).

### 6.5 `JoinLogScreen` — `src/navigation/screens/JoinLogScreen.tsx`
- mk `JoinScreen` + `CodeInput` 재현. SubBar(뒤로) 또는 stack 헤더.
- 상태: `code`(string), `onChangeText`→`normalizeInviteCodeInput({ raw })`로 정규화 후 setCode.
- `CodeInput`(6셀): `value` 글자별 셀 렌더 + 숨김 `TextInput`(autoCapitalize="characters", autoCorrect={false}, maxLength=6, keyboardType 기본). 현재 입력 셀 하이라이트(accent border + accentWeak 글로우).
- 입장 버튼: `isInviteCodeComplete({ code })` 일 때만 활성. 누르면 `joinRoom({ code })`.
  - 성공: `refresh()` → `navigation.replace(Routes.LogScreen, { roomId })`.
  - 실패: `useJoinRoom.error`(이미 매핑된 메시지)를 **인라인 에러 텍스트**로 표시(코드 입력 아래). 정원/중복/잘못된 코드 모두 토큰별 메시지.

### UX 톤
- 모든 색/간격/타이포/radius = `useTheme()` 토큰(웜 muklog 값). 이모지(🍽️/💌/🥢) 허용(킷 정책). 텍스트 글리프 아이콘 금지(§D4).

---

## 7. 작업 목록 (파일 단위, TDD Red→Green→Refactor 순서)

> 각 작업: 먼저 실패 테스트(Red) → 최소 구현(Green) → 컨벤션 정리(Refactor). 인수조건(AC)은 §8과 1:1.

- [ ] **T1 — 마이그레이션 `get_room` RPC** (`supabase/migrations/20260611120000_log_invite.sql`)
  - 단위 테스트 대상 아님(실 DB) → 스모크. 클라 측은 모킹된 응답/에러로 계약 검증(T2).
  - AC: 멤버면 `{room_id,invite_code,member_count,mode}` 반환 / 비멤버 `NOT_A_MEMBER` / 없는 id `ROOM_NOT_FOUND` / 미인증 `NOT_AUTHENTICATED`. DEFINER + 멤버십 검사 + grant authenticated/revoke anon.
- [ ] **T2 — `useRoom` 훅 + spec** (`src/features/room/useRoom.ts`, `useRoom.spec.ts`)
  - supabase 모킹. AC: 성공 시 snake→camel 매핑 `{roomId,inviteCode,memberCount,mode}` `ready` / rpcError 시 `error`(mapRoomError 메시지) / 응답 형 누락 시 `error` / 진입 1회 조회 + refresh.
- [ ] **T3 — `errors.ts` 토큰 추가 + spec** (`errors.ts`, `errors.spec.ts`)
  - AC: `NOT_A_MEMBER`/`ROOM_NOT_FOUND` 정확/포함 매칭 → 지정 한국어. 기존 토큰 불변(회귀).
- [ ] **T4 — 공용 `Sheet` + spec** (`src/components/Sheet.tsx`, `Sheet.spec.tsx`, barrel export)
  - AC: `visible=false`면 미렌더 / `visible=true`면 children·title 렌더 / 딤 배경 탭 → onClose 호출 / 패널 탭은 onClose 미호출.
- [ ] **T5 — `InviteCodeCard` + spec** (`src/components/InviteCodeCard.tsx` 또는 `features/room/InviteCodeCard.tsx`, spec, barrel)
  - expo-clipboard 모킹. AC: `code` 표시 / 복사 버튼 탭 → `Clipboard.setStringAsync(code)` 호출 + "복사됨" 피드백 노출 / 텍스트 글리프 아이콘 없음.
- [ ] **T6 — `CodeInput` + spec** (`JoinLogScreen` 내부 또는 분리 컴포넌트, spec)
  - AC: 6셀 렌더 / 입력값을 `normalizeInviteCodeInput`로 정규화(소문자→대문자·혼동문자/공백 제거·6자 컷) / 글자별 셀 채움 / 현재 셀 하이라이트.
- [ ] **T7 — `AddSheet` + `PlusHeaderButton` 갱신 + spec** (`PlusHeaderButton.tsx`, `AddSheet.tsx`, 각 spec)
  - AC: + 탭 → 시트 열림(2개 액션) / "새 로그 만들기" → `createRoom()` → 성공 시 생성 roomId LogScreen navigate + `refresh()` / "초대코드로 입장" → `navigation.navigate(JoinLog)` / 생성 실패 시 Alert(매핑 메시지)·navigate/refresh 미발생 / creating 중 비활성.
  - ⚠️ **기존 PlusHeaderButton spec 갱신**(단일 생성 → 액션시트 + navigate). 회귀 테스트로 명시.
- [ ] **T8 — `JoinLogScreen` + spec** (`src/navigation/screens/JoinLogScreen.tsx`, spec)
  - useJoinRoom·useMyLogsContext·navigation 모킹. AC: 미완성(6자 미만) 시 입장 버튼 비활성 / 6자 완성 시 활성 / 입장 성공 → `refresh()` + `navigation.replace(LogScreen,{roomId})` / 실패(INVALID_CODE/ROOM_FULL) → 인라인 에러 메시지 표시·네비게이션 없음 / 로딩 중 버튼 busy.
- [ ] **T9 — `routes.ts` + `AppNavigator` 등록 + spec 영향** (`routes.ts`, `AppNavigator.tsx`)
  - AC: `Routes.JoinLog` 추가, 스크린 등록. 타입(`AppStackParamList`)에 JoinLog 포함. (네비 컨테이너는 모킹 — testing-strategy §네비.)
- [ ] **T10 — `LogScreen` 채움 + spec 갱신** (`LogScreen.tsx`, `LogScreen.spec.tsx`)
  - useRoom 모킹. AC: roomId 없음/undefined → 안전 메시지(기존 불변) / loading → 로더 / error → 에러+재시도 / 솔로(memberCount 1) → InviteCodeCard + 초대 안내 / 커플(memberCount≥2) → 코드 숨김 + "둘이 함께 기록 중" / muklog-list placeholder.
  - ⚠️ 기존 LogScreen spec(준비 중 placeholder)은 useRoom 도입으로 갱신.
- [ ] **T11 — 배럴/통합 정리** (`features/room/index.ts` 등): `useRoom`/`RoomDetail` export. tsc·전체 `npm test` 통과.

---

## 8. 인수조건 (검증 가능 — 정상·경계·실패)

### 초대코드 표시·복사 (LogScreen / InviteCodeCard)
- AC1(정상): 솔로 로그 LogScreen 진입 → 그 로그의 6자리 `inviteCode`가 화면에 표시된다.
- AC2(복사): 복사 버튼 탭 → `Clipboard.setStringAsync(code)`가 그 코드로 호출되고 "복사됨" 피드백이 보인다.
- AC3(분기-커플): `memberCount>=2`면 초대코드 카드가 **표시되지 않고** "둘이 함께 기록 중" 문구가 보인다.
- AC4(경계-roomId 없음): `route.params` 없음/`{}` → "로그를 찾을 수 없어요"(크래시 없음, 기존 회귀).
- AC5(실패-조회): `get_room` 에러(`NOT_A_MEMBER`/네트워크) → 에러 안내 + 재시도 버튼, 코드 미표시.

### + 액션시트 분기 (AddSheet / PlusHeaderButton)
- AC6: + 탭 → 시트에 "새 로그 만들기"·"초대코드로 입장" 2개 액션이 보인다.
- AC7(생성): "새 로그 만들기" 탭 → `createRoom()` 호출 → 성공 시 생성된 roomId의 LogScreen으로 이동 + `refresh()` 1회.
- AC8(입장 진입): "초대코드로 입장" 탭 → `JoinLog` 라우트로 이동.
- AC9(생성 실패): `createRoom` reject → Alert(매핑 메시지), 이동/refresh 없음.

### 코드 입력 → join (JoinLogScreen / CodeInput)
- AC10(정규화): "abc 12" 입력 → 셀에 "ABC12"(소문자 대문자화·공백 제거·혼동문자 제거). `0/O/1/I` 입력은 무시(charset 외).
- AC11(경계-버튼 활성): 5자 → 입장 버튼 비활성, 6자(`isInviteCodeComplete`) → 활성.
- AC12(성공/커플화): 유효 코드 입장 → `joinRoom({code})` → `refresh()` → `navigation.replace(LogScreen,{roomId})`. (정원 1→2 합류 = 커플화. 이후 LogScreen은 AC3 경로로 커플 표시.)
- AC13(실패-없는 코드): `INVALID_CODE` → 인라인 "초대코드를 다시 확인해 주세요." 표시, 네비게이션 없음.
- AC14(실패-정원 초과): `ROOM_FULL`(이미 2명) → 인라인 "이미 2명이 모두 입장한 방이에요.", 네비게이션 없음.
- AC15(실패-이미 멤버): 내가 이미 멤버인 로그 코드 입력 → `join_room` 멱등 성공(`{room_id}`) → 에러 없이 그 LogScreen으로 이동(중복 가입 안 일어남, 목록 +1 아님).

### RLS / 권한
- AC16: `get_room`은 **비멤버**가 임의 roomId로 호출 시 `NOT_A_MEMBER`(코드 미노출). (스모크/DB — 단위 모킹으로 토큰→메시지만 검증.)
- AC17: 내가 멤버인 로그만 코드 표시(DEFINER 본문 멤버십 검사 — 교차검증 §9).

---

## 9. 엣지케이스 (다각도)

1. **이미 멤버인 로그 코드 입력**: `join_room` 멱등 성공 → 그 로그로 이동. 목록 중복 안 됨(`list_my_rooms`는 멤버십 PK 1행). (AC15)
2. **자기 솔로 로그 코드를 자기가 입력**: 위와 동일(이미 멤버) → 멱등 성공, 화면만 그 로그로. 커플화 안 됨(여전히 1명).
3. **만석(2) 로그 조인**: `ROOM_FULL` 인라인 에러. (AC14)
4. **코드 정규화/대소문자**: 입력 정규화(클라 `normalizeInviteCodeInput`) + 서버 `upper(trim())` 2중. 소문자·공백·혼동문자(0/O/1/I) 안전. (AC10)
5. **오프라인/네트워크 실패**: get_room/join_room rpcError → 기본 메시지("연결에 실패했어요…"). LogScreen은 에러+재시도, JoinLog는 인라인 에러. 버튼 재활성(loading 해제).
6. **동시성(커플 두 명)**: 마지막 1자리에 두 명이 동시 조인 → `join_room`의 `for update` 잠금 + 정원 트리거 → 한 명만 성공, 다른 한 명 `ROOM_FULL`. (서버 보장, 클라는 토큰 표시.)
7. **LogScreen 캐시 미스/딥링크 진입**: `useRoom`이 자급 조회(목록 캐시 비의존)라 코드 표시 정상.
8. **빈 상태**: 로그 0개에서 + → AddSheet → 생성/입장 모두 가능(빈 목록과 무관).
9. **생성 직후 코드**: 생성 → LogScreen 이동 → `useRoom`이 갓 만든 로그의 코드 조회(생성자=멤버이므로 통과). (생성 RPC가 반환한 inviteCode를 navigate params로 넘겨 초기 표시 최적화 가능하나 필수는 아님 — developer 재량, 단 get_room 결과를 단일 출처로.)
10. **연속 탭/중복 제출**: 입장/생성 버튼 loading 중 비활성(1차 방지), 서버 멱등(2차). 시트 중복 오픈 방지(visible 상태).
11. **코드 복사 권한**: expo-clipboard는 권한 불필요(쓰기). 실패 시 조용히 무시 또는 안내.

---

## 10. 비용 가드레일 체크 (architecture.md §6)

- [x] **AWS 미사용** — Supabase RPC만. 신규 인프라 없음.
- [x] **폴링 금지** — `useRoom`은 "진입 1회 + 명시적 refresh"(useMyLogs 정책 계승). 주기 조회/구독 없음. Realtime 미도입(이번 슬라이스).
- [x] **round-trip 최소화** — `get_room` 1콜로 code+count+mode(클라 2콜·캐시 결합 회피).
- [x] **이미지/Kakao 무관** — 이 기능은 미디어·지도 호출 없음(해당 가드레일 N/A).
- [x] **Clipboard** — 로컬 작업(네트워크 0).

---

## 11. 스코프 점검 / 분할 제안

이번 슬라이스는 **단일 기능(초대 흐름: 코드 표시·복사 + 입장 UI)** 로 한 스프린트에 적정하다. 다만 신규 표면이 여러 개(RPC 1·훅 1·화면 1·컴포넌트 3·라우트 1)라 **상한선**에 가깝다. 아래는 의도적으로 **분리**해 과대 방지:

- **(분리됨) 파트너 신원 표시**: 커플 로그에서 짝꿍 닉네임/아바타 카드(mk LogCard의 `me ♥ partner`) → room_members RLS=자기 행만이라 파트너 프로필 조회 RPC가 추가로 필요 → **차기 슬라이스 `log-partner`(또는 muklog-list와 함께)**. 이번엔 멤버 수 기반 "둘이/혼자"만.
- **(분리됨) CreatedScreen**: §D2대로 미도입(LogScreen이 대체).
- **(분리됨) OS 공유시트**: 클립보드 복사까지만.
- **(분리됨) 아이콘셋 확장**(`link`/`copy`): §D4대로 텍스트 라벨로 대체, 아이콘 추가는 별도.
- **(분리됨) 로그 나가기 UI**: `leave_room(p_room_id)` 호출부는 차기 LogScreen 슬라이스.

→ **결론: 분할 불필요(이대로 진행). 단 위 5개 항목은 명시적 OUT으로 고정.**

---

## 12. QA(qa-inspector)가 교차검증할 경계면

| ID | 경계면 | 검증 포인트 |
|----|--------|------------|
| C1 | `get_room` 응답(snake) ↔ `useRoom` 매핑(camel) | `room_id/invite_code/member_count/mode` ↔ `roomId/inviteCode/memberCount/mode` 누락·오타 없음 |
| C2 | SQL `raise '<TOKEN>'` ↔ `errors.ts` ROOM_ERROR_MESSAGES | `NOT_A_MEMBER`/`ROOM_NOT_FOUND` 양쪽 동기화. 기존 토큰 불변 |
| C3 | rpc 인자명 ↔ RPC 시그니처 | `rpc('get_room',{p_room_id})`·`rpc('join_room',{p_code})` 인자명 정확 일치(오타 시 조용한 실패) |
| C4-RLS | DEFINER `get_room` 본문 멤버십 검사 | `auth.uid()` 멤버 아닐 때 `NOT_A_MEMBER`(임의 로그 코드 노출 차단) — 보안 핵심 |
| C5-RLS | `member_count` 출처 | 클라 직접 select 아님(room_members self-only) → 반드시 DEFINER RPC 집계 |
| C6 | `INVITE_CODE_CHARSET` ↔ CodeInput 정규화 | `normalizeInviteCodeInput` 사용(자체 정규식 재작성 금지), charset 일치 |
| C7 | 네비게이션 라우트 | `Routes.JoinLog` 등록·`AppNavigator` 스크린·`replace`/`navigate` 대상 일치 |
| C8 | join 성공 후 상태 흐름 | `refresh()` 호출 + `replace(LogScreen,{roomId})` + LogScreen이 커플(2명) 반영 |
| C9 | 회귀 | create_room/leave_room/multi-log-home(목록·빈상태)/profile/ui-redesign 토큰·동작 불변. PlusHeaderButton spec 갱신은 의도된 변경 |
| C10 | expo-clipboard 호출 | `setStringAsync(code)` 인자가 표시 코드와 동일 |

---

## 13. 완료 기준 (Definition of Done)

- [ ] 모든 인수조건(AC1–AC17)에 대응하는 테스트 존재 + **`npm test` 전체 통과**.
- [ ] `npx tsc --noEmit` 타입 에러 0.
- [ ] 코드 컨벤션 100%(화살표 함수, named-object 인자, useEffect 명명 함수, useCallback/useMemo 미사용, enum-style 상수, 토큰 스타일링, util/훅 JSDoc).
- [ ] UI는 ui-design muklog 킷 충실 재현(웜 토큰, 이모지 허용, 텍스트 글리프 아이콘 금지).
- [ ] 마이그레이션 `20260611120000_log_invite.sql` additive·idempotent. (실 적용은 사용자 환경 — `supabase db push`/SQL 에디터.)
- [ ] 회귀: 기존 스프린트 산출 동작 불변(C9). 갱신된 spec(PlusHeaderButton/LogScreen)은 명시적·의도적.
- [ ] git 작업 없음(커밋·푸시는 사용자 전담).
</content>
</invoke>
