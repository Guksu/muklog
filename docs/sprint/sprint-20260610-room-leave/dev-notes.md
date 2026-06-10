# Dev Notes — room-leave (방 나가기 즉시)

> 구현자: developer. 입력: `plan.md`(이 디렉토리), `docs/design/architecture.md`.
> 완료기준: `npm test` 전체 통과(18 suites / **141 tests**) + `npx tsc --noEmit` 통과(EXIT 0). 둘 다 확인 완료.
> TDD(Red→Green→Refactor)로 구현. git 작업 없음(사용자 전담). 실 Supabase 적용도 사용자(아래 §적용법).

---

## 1. 구현 범위 (plan §2 In-scope 100% / Out-of-scope 0)

| 작업 | 산출물 | 상태 |
|------|--------|------|
| T1 마이그레이션 | `supabase/migrations/20260610140000_room_leave.sql`(신규) | ✅ |
| T2 나가기 훅 | `src/features/room/useLeaveRoom.ts` + `.spec.ts`(10 tests) | ✅ |
| T3 공개 표면 | `src/features/room/index.ts`에 `useLeaveRoom`/`LeaveRoomResult` 재노출 | ✅ |
| T4 나가기 UI | `src/navigation/screens/ProfileScreen.tsx` 하단 "방 나가기"+Alert+전이 / `.spec.tsx`(+5 tests) | ✅ |
| T5 회귀 가드 | 전체 141 테스트 그린 + tsc 통과. errors.ts·modes.ts **미변경** | ✅ |

**Out-of-scope 준수(미구현 확인):** 24h 유예·취소·자동삭제 cron·room-promote·Room 헤더 배너 — 전부 미착수. `delete_scheduled_at`/`delete_requested_by` 컬럼은 건드리지 않음(항상 NULL).

---

## 2. 변경/신규 파일

**신규**
- `supabase/migrations/20260610140000_room_leave.sql` — `leave_room()` RPC + grant.
- `src/features/room/useLeaveRoom.ts` — 나가기 훅.
- `src/features/room/useLeaveRoom.spec.ts` — 훅 단위 테스트(10).

**수정**
- `src/features/room/index.ts` — `useLeaveRoom`/`LeaveRoomResult` export 1줄 추가(additive).
- `src/navigation/screens/ProfileScreen.tsx` — 나가기 UI/핸들러 추가(기존 닉네임/아바타 로직 불변).
- `src/navigation/screens/ProfileScreen.spec.tsx` — 모킹(room/네비/Alert) 보강 + "방 나가기" describe(5) 추가.

**미변경(회귀 0 보장):** `errors.ts`, `modes.ts`, `useCreateRoom.ts`, `useJoinRoom.ts`, `useMembership.ts`, `MembershipGate.tsx`, `AppNavigator.tsx`, 기존 마이그레이션 2개.

---

## 3. 생산자 ↔ 소비자 매핑 (QA 교차검증용 — plan §7 경계면)

| # | 생산자 | 소비자 | 검증 포인트 / 위치 |
|---|--------|--------|-------------------|
| **C1** | `leave_room` 반환 `{ room_deleted, room_id }`(snake) <br>`migrations/...room_leave.sql:68` | `useLeaveRoom` 파싱 `{ roomDeleted, roomId }`(camel) <br>`useLeaveRoom.ts:35-41` | `room_deleted` 비-boolean/누락 → `LEAVE_ROOM_BAD_RESPONSE` throw. `room_id`는 string|null. |
| **C2** | `leave_room` **무인자** 시그니처 <br>`...room_leave.sql:30` | `supabase.rpc('leave_room')` 인자 전달 안 함 <br>`useLeaveRoom.ts:32` | 오버로드 없음(무인자 단일). 스펙 `expect(rpc).toHaveBeenCalledWith('leave_room')`. |
| **C-RLS** | DEFINER 삭제 `where room_id=v_room_id and user_id=v_uid` <br>`...room_leave.sql:57` | "본인 외 행 무영향" | 스코프 명시(타인 `room_members` 행 무영향). SQL 스모크. |
| **C-CONC** | `perform 1 from rooms where id=v_room_id for update`(삭제 **전**) <br>`...room_leave.sql:54` | 마지막 두 멤버 동시 나가기 | 직렬화로 고아 빈 방 방지. SQL 스모크. |
| **C-DEL** | 잔여 count 0 확인 **후** `delete from rooms`(CASCADE) <br>`...room_leave.sql:60-66` | 솔로/혼자 커플 나가기 | 잔여≥1은 방 보존(`v_deleted=false`). SQL 스모크. |
| **C-NAV** | 성공 시 `void membership.refresh()` + `navigation.reset({index:0,routes:[{name:Onboarding}]})` <br>`ProfileScreen.tsx`(handleLeave) | `MembershipGate`가 no-room/in-room 동일 NavigationContainer 노드 렌더 | 언마운트 없이 Onboarding 유지. OnboardingScreen.goToRoom 거울. 스펙으로 reset/refresh 호출 검증. |
| **C-IDEM** | 멤버 아님 → `{room_deleted:false, room_id:null}`(에러 아님) <br>`...room_leave.sql:50-52` | 재호출/이미 나감 → 동일 Onboarding 전이 | 훅·화면 스펙 모두 검증. |
| **C-REG** | 신규 RPC/훅/화면(additive) | 기존 create/join/정원/profile 스펙·tsc | 141 테스트 그린, errors.ts·modes.ts 미변경. |

---

## 4. leave_room() RPC 동작 순서 (plan §3.1 충실 구현)

1. `auth.uid()` null → `raise 'NOT_AUTHENTICATED'`. (`:45`)
2. `room_members where user_id=v_uid`로 방 조회 → 없으면 **멱등** `{false,null}` 반환. (`:50`)
3. **방 행 `for update` 잠금**(함정②, 삭제 전). (`:54`)
4. **본인 행만 삭제** `where room_id=v_room_id and user_id=v_uid`(함정①). (`:57`)
5. 잔여 `count(*)` 조회. (`:60`)
6. 잔여 0 → `delete from rooms`(CASCADE), `v_deleted=true` / 잔여≥1 → 보존(함정③). (`:63-66`)
7. `{ room_deleted: v_deleted, room_id: v_room_id }` 반환. (`:68`)

권한: `revoke all ... from public, anon` + `grant execute ... to authenticated`(create/join 패턴).

---

## 5. 마이그레이션 적용법 (⚠️ 사용자 수행 — 에이전트 git/DB 미실행)

신규 파일이므로 **실 Supabase에 반영 필요**(코드 머지만으로는 DB에 함수가 안 생김):

```bash
# 방법 A) Supabase CLI (권장)
supabase db push        # supabase/migrations/ 미적용분 일괄 적용

# 방법 B) 수동 — Supabase 대시보드 > SQL Editor에서
#   supabase/migrations/20260610140000_room_leave.sql 전체 내용 붙여넣고 실행
```

- 재실행 가능(idempotent): `create or replace function` + 권한 재선언 → 중복 실행 무해.
- 기존 마이그레이션 2개는 손대지 않았으므로 이미 적용된 환경에서도 본 파일만 추가 적용하면 됨.

**SQL 스모크(사용자 디바이스/실DB 권장 시나리오):**
1. 솔로방 생성 → ProfileScreen "방 나가기" → 확인 → Onboarding 복귀. DB: `rooms`/`room_members` 해당 행 삭제 확인.
2. 커플방 2인 → 한쪽 나가기 → 방 보존(남은 1인 in-room 유지) → 남은 1인도 나가기 → 방 삭제.
3. 동시 나가기(두 기기 거의 동시) → 고아 빈 방 없음(한 쪽이 방 삭제).
4. 멤버 아닌 세션에서 `leave_room()` 직접 호출 → 에러 없이 `{false,null}`.

---

## 6. 코드 컨벤션 준수 체크
- useCallback/useMemo 미사용. 컴포넌트·훅 화살표 const.
- 우리 함수 인자 = named-object(예: `mapRoomError({ error })`). `leaveRoom()`은 무인자(RPC 계약).
- 도메인 식별 문자열 = enum-style(`Routes.Onboarding`). 라우트 리터럴 직접 사용 안 함.
- 스타일 = 원티드 토큰(`theme.spacing`/`theme.color.error` via `<Text color="error">`/`<Button variant="secondary">`). **raw hex 0**.
- 에러 토큰 신규 0 — 기존 `mapRoomError`(NOT_AUTHENTICATED/기본) 재사용. `LEAVE_ROOM_BAD_RESPONSE`는 훅 내부 가드용(기본 메시지로 흡수).

---

## 7. 미완/핸드오프
- **C-FUTURE(문서화만):** 차기 `muklog-editor`가 `muklogs` 테이블 생성 시 `muklogs.room_id → rooms(id) ON DELETE CASCADE` 선언해야 방 삭제가 먹로그/사진까지 완전 정리됨. 현재 테이블 부재로 강제 불가(plan §3.3).
- SQL 단위 테스트는 경계 밖(testing-strategy) → 위 SQL 스모크로 사용자 검증.
- architecture.md §3·§4·§5·§7 갱신은 sprint-planner가 plan §부록대로 반영(developer 범위 외).
