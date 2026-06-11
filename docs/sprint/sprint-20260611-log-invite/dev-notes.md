# Dev Notes — `log-invite` (커플 초대 흐름 완성)

> 스프린트: `sprint-20260611-log-invite` · 구현 완료 · TDD(Red→Green→Refactor)
> 완료 기준: **`npm test` 217/217 통과**(이전 184 → +33) · **`npx tsc --noEmit` 에러 0** · 코드 컨벤션 100%(useCallback/useMemo 0·raw hex 0).

---

## 1. 생산자 ↔ 소비자 매핑 (QA 교차검증용)

| ID | 생산자(producer) | 소비자(consumer) | 계약 shape / 키 |
|----|------------------|------------------|-----------------|
| C1 | `get_room(p_room_id)` RPC → jsonb (snake) | `useRoom` → `RoomDetail`(camel) | `room_id/invite_code/member_count/mode` ↔ `roomId/inviteCode/memberCount/mode` |
| C2 | SQL `raise '<TOKEN>'`(get_room) | `errors.ts` `ROOM_ERROR_MESSAGES` | `NOT_A_MEMBER`→'이 로그에 접근할 권한이 없어요.' / `ROOM_NOT_FOUND`→'로그를 찾을 수 없어요.' (기존 7토큰 불변, 총 9) |
| C3 | RPC 시그니처 인자명 | 훅 rpc 호출 | `rpc('get_room',{p_room_id})` / `rpc('join_room',{p_code})` 정확 일치 |
| C4-RLS | `get_room` DEFINER 본문 멤버십 검사 | (서버 보안) | `room_members`에 `(p_room_id, auth.uid())` 없으면 `NOT_A_MEMBER` raise → **임의 로그 코드 노출 차단(보안 핵심)** |
| C5-RLS | `member_count = count(*) room_members`(DEFINER 집계) | `useRoom`/LogScreen 솔로·커플 분기 | 클라 직접 select 아님(room_members self-only RLS → count 항상 1이라 RPC 필수) |
| C6 | `code.ts` `normalizeInviteCodeInput`/`INVITE_CODE_LENGTH` | `CodeInput` | 자체 정규식 재작성 금지 — 유틸 그대로 위임. `INVITE_CODE_CHARSET` 단일 출처 |
| C7 | `routes.ts` `Routes.JoinLog` + `AppNavigator` 등록 | PlusHeaderButton(`navigate(JoinLog)`)·JoinLogScreen(`replace(LogScreen,{roomId})`) | 라우트명·params 일치 |
| C8 | join 성공 흐름 | JoinLogScreen | `joinRoom({code})` → `myLogs.refresh()` → `navigation.replace(LogScreen,{roomId})` → LogScreen이 커플(2명) 반영 |
| C10 | `expo-clipboard.setStringAsync(code)` | InviteCodeCard 복사 버튼 | 인자 = 표시 코드와 동일 |

---

## 2. 신규 파일

### 마이그레이션
- `supabase/migrations/20260611120000_log_invite.sql` — `get_room(p_room_id uuid)` DEFINER RPC 신설(additive·idempotent, 기존 파일 미수정).
  - 반환(성공): `{ room_id, invite_code, member_count, mode }`. 에러: `NOT_AUTHENTICATED` / `ROOM_NOT_FOUND` / `NOT_A_MEMBER`.
  - **순서**: 미인증 → 로그 존재 확인(`ROOM_NOT_FOUND`) → **멤버십 검사(`NOT_A_MEMBER`)** → member_count 집계 → 반환.
  - `grant execute … to authenticated; revoke … from public, anon;`

### 프론트
- `src/features/room/useRoom.ts` — `useRoom({ roomId })` → `{ state, refresh }`. snake→camel 매핑, 형 누락 시 `error`(BAD_RESPONSE→기본 메시지), 진입 1회 + refresh(폴링/Realtime 없음). `useMyLogs` 정책 계승.
- `src/components/Sheet.tsx` — 공용 하단 시트(mk-ui Sheet 재현). RN `Modal`(transparent) + 딤 배경(탭→onClose) + 패널(핸들바·옵션 title·children, 탭 전파 차단). testID `sheet-backdrop`/`sheet-panel`.
- `src/components/InviteCodeCard.tsx` — 코드 표시(대형·letterSpacing) + "복사" 버튼(`expo-clipboard.setStringAsync` 첫 사용처) + "복사됨" 2초 피드백(명명 타이머). accessibilityLabel `초대코드 복사`. D4: 복사 버튼은 **텍스트 라벨**(글리프 아이콘 없음).
- `src/navigation/screens/CodeInput.tsx` — 6셀 코드 입력. 숨김 `TextInput`(autoCapitalize/autoCorrect) + 셀 6개(현재 셀 하이라이트). 정규화는 `normalizeInviteCodeInput` 위임(C6). testID `code-hidden-input`/`code-cell-{i}`.
- `src/navigation/screens/JoinLogScreen.tsx` — JoinScreen+CodeInput 재현. 6자 완성 시 입장 활성 → `joinRoom`→`refresh`→`replace(LogScreen)`. 실패 시 `useJoinRoom.error` 인라인 표시(💌 이모지).
- `src/navigation/AddSheet.tsx` — `Sheet` 위 2액션(🥢 새 로그 만들기 / 💌 초대코드로 입장). 순수 프리젠테이션(onCreate/onJoin/creating 주입). 생성 행 creating 중 비활성.

## 3. 변경 파일

- `src/features/room/errors.ts` — `NOT_A_MEMBER`/`ROOM_NOT_FOUND` 토큰 2개 추가(7→9). 헤더 주석에 get_room/useRoom/JoinLogScreen 소비자 반영.
- `src/features/room/index.ts` — `useRoom`/`RoomDetail`/`RoomDetailState` export.
- `src/components/index.ts` — `Sheet`/`InviteCodeCard` export.
- `src/navigation/routes.ts` — `Routes.JoinLog` + `AppStackParamList[JoinLog]: undefined`. LogScreen 주석 갱신.
- `src/navigation/AppNavigator.tsx` — `JoinLog` 스크린 등록(`title:'초대코드 입장'`).
- `src/navigation/PlusHeaderButton.tsx` — **의도적 동작 갱신(D2/§7 T7)**: 단일 생성 → AddSheet 분기. "새 로그 만들기"→`createRoom()`→성공 시 `navigate(LogScreen,{roomId})`+`refresh()` / "초대코드로 입장"→`navigate(JoinLog)`. 생성 실패 시 Alert(매핑 메시지)·navigate/refresh 없음. creating 중 +버튼 비활성.
- `src/navigation/screens/LogScreen.tsx` — stub → `useRoom` 분기 채움. roomId 누락=안전 메시지(회귀 유지) / loading=로더(`logscreen-loading`) / error=메시지+다시 시도(refresh) / 솔로=InviteCodeCard+안내 / 커플=코드 숨김+"둘이 함께 기록 중이에요" / 하단 맛집 placeholder.

### 변경 spec (의도적 갱신 — 회귀로 명시)
- `PlusHeaderButton.spec.tsx`: 단일 생성 → 액션시트+navigate(AC6·AC7·AC8·AC9).
- `LogScreen.spec.tsx`: placeholder → useRoom 분기(AC1·AC3·AC4·AC5).
- `errors.spec.ts`: 7토큰 → 9토큰(log-invite 2종).

### 신규 spec
`useRoom.spec.ts`(6) · `Sheet.spec.tsx`(4) · `InviteCodeCard.spec.tsx`(3) · `CodeInput.spec.tsx`(4) · `JoinLogScreen.spec.tsx`(5) · `AddSheet.spec.tsx`(4).

---

## 4. 사용자 액션 (필수)

1. **마이그레이션 적용** — `get_room` RPC는 원격 DB에 미적용 상태(에이전트는 DB push 미수행). 실행:
   ```
   supabase db push
   ```
   또는 Supabase 대시보드 SQL 에디터에서 `supabase/migrations/20260611120000_log_invite.sql` 전체 실행.
   - 적용 전까지 LogScreen 진입 시 `get_room` 호출이 실패 → LogScreen은 에러+다시 시도로 안전 처리(크래시 없음)되나 코드는 표시되지 않는다.
2. **디바이스 스모크**(단위 대상 외) — 실제 클립보드 복사, Modal 시트 슬라이드, 키보드/CodeInput 포커스, 2번째 멤버 join으로 커플화 후 코드 숨김.

### 보안 메모 (C4-RLS — 반드시 유지)
`get_room`은 SECURITY DEFINER라 RLS를 우회한다. 본문의 **멤버십 검사(`NOT_A_MEMBER` raise)** 가 누락되면 누구나 임의 `roomId`로 다른 커플의 `invite_code`를 읽어 초대 시스템이 붕괴한다. 함수 본문 수정 시 멤버십 검사 블록을 절대 제거하지 말 것.

---

## 5. 모킹 안내 (테스트)

- `useRoom.spec`: `@/lib/supabase` rpc 모킹(성공/에러/형누락/refresh).
- `LogScreen.spec`/`PlusHeaderButton.spec`/`JoinLogScreen.spec`: `@/features/room` 배럴 모킹(순수 `code`/`errors`는 `requireActual`, 훅/컨텍스트만 jest.fn) + `@react-navigation/native` 모킹 + `expo-clipboard` 모킹. supabase/AsyncStorage 비유입.
- `CodeInput.tsx`는 의도적으로 `@/features/room/code`에서 직접 import(배럴 경유 시 supabase→AsyncStorage 로드로 테스트 환경 깨짐).
- jest 변수 호이스팅: 모킹 참조 변수는 `mock` 접두사 필요(`mockReplace`/`mockNavigate`).

---

## 6. OUT-OF-SCOPE (이번 미구현 — 명시)

- 맛집(먹로그) 리스트/상세/에디터/사진/영상(차기 `muklog-*`). LogScreen 하단 placeholder만.
- 파트너 신원(닉네임/아바타) 표시 — room_members self-only RLS로 파트너 프로필 RPC 별도 필요(차기 `log-partner`). 이번은 멤버 수 기반 "혼자/둘이"만.
- `CreatedScreen`(D2 미도입 — LogScreen이 대체).
- OS 공유시트(클립보드 복사까지만), 아이콘셋 `link/copy` 확장(D4 텍스트 라벨), 로그 나가기 UI(`leave_room` 호출부 dormant 유지).
- 카카오/지도/장소검색 일체.

---

## 7. QA 교차검증 요청 (qa-inspector)

incremental 검증 권장 경계면: **C1**(get_room↔useRoom 키), **C2**(SQL 토큰↔errors.ts 9토큰), **C4-RLS**(get_room 멤버십 검사), **C7/C8**(JoinLog 라우트·join 후 refresh+replace+커플 반영), **C10**(clipboard 인자). 회귀: create_room/leave_room/multi-log-home(목록·빈상태)/profile/ui-redesign 토큰·동작 불변(PlusHeaderButton spec 갱신은 의도된 변경).
