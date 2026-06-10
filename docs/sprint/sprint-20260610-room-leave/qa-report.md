# QA Report: 방 나가기(즉시) — room-leave

> 검증자: qa-inspector · 일자: 2026-06-10
> 입력: `plan.md`, `dev-notes.md`, 소스(`useLeaveRoom.ts`, `ProfileScreen.tsx`, `20260610140000_room_leave.sql`)
> 방법: 경계면 **양쪽 동시 읽기**(생산자↔소비자 교차비교) + load-bearing 표본 + 회귀 가드.

## 종합 판정: ✅ PASS (모든 인수조건 통과, 회귀 0)

- `npx tsc --noEmit`: **EXIT 0**
- `npx jest`: **18 suites / 141 tests 전부 통과** (baseline 17/126 → +1 suite `useLeaveRoom.spec`(10) +5 `ProfileScreen.spec` = +15)
- 변경 범위 additive: 신규 `useLeaveRoom.ts(+spec)`·`20260610140000_room_leave.sql`, 수정 `index.ts`(1줄 재노출)·`ProfileScreen.tsx(+spec)`·`architecture.md`(plan §부록 문서갱신). **`errors.ts`·`modes.ts`·기존 마이그레이션 2개 무변경(git diff 공백 확인) → C-REG 충족.**

---

## 1. 인수조건별 통과/실패 (plan §5 작업 + §7 경계면)

| 작업 | 인수조건 | 판정 | 근거 |
|------|---------|------|------|
| **T1** leave_room RPC | DEFINER·무인자·`search_path=public`, 본인행만 삭제→잔여0이면 `delete rooms`, ≥1 보존, 멤버아님 멱등, `NOT_AUTHENTICATED`, grant/revoke, idempotent | ✅(SQL은 스모크) | `room_leave.sql:29-74`. 동작순서 plan §3.1과 1:1 |
| **T2** useLeaveRoom 훅 | 무인자 `rpc('leave_room')`, snake→camel, BAD_RESPONSE 가드, rpcError 매핑, loading 전이 | ✅ | `useLeaveRoom.ts:27-50` + spec 10건 |
| **T3** index 재노출 | `useLeaveRoom`/`LeaveRoomResult` export, tsc 통과 | ✅ | `index.ts:6` |
| **T4** ProfileScreen UI | 하단 "방 나가기"+Alert(확인/취소), 확인→leaveRoom→refresh+reset(Onboarding), 실패 인라인·전이없음, 토큰만 | ✅ | `ProfileScreen.tsx:123-206` + spec 5건 |
| **T5** 회귀 가드 | npm test 그린, tsc 통과, create/join/정원/profile/errors/modes 불변 | ✅ | 18/141 그린, diff 공백 |

## 2. 경계면 교차검증 (생산자 ↔ 소비자 양쪽 읽기)

| # | 경계면 | 생산자 | 소비자 | 판정 |
|---|--------|--------|--------|------|
| **C1** snake→camel | `room_leave.sql:68` `jsonb_build_object('room_deleted',v_deleted,'room_id',v_room_id)` + 멱등 `:50` `{false,null}` | `useLeaveRoom.ts:35-41` `room_deleted`(boolean 강제)·`room_id`(string\|null) → `{roomDeleted,roomId}` | ✅ 매핑 정확. 비-boolean/누락 → `LEAVE_ROOM_BAD_RESPONSE`(spec 3건) |
| **C2** 무인자 계약 | SQL 단일 시그니처 `leave_room()`(오버로드 없음) | `useLeaveRoom.ts:32` `rpc('leave_room')` 인자 전달 0 | ✅ spec `toHaveBeenCalledWith('leave_room')` |
| **C-RLS** DEFINER 삭제 스코프 | `room_leave.sql:57` `delete ... where room_id=v_room_id and user_id=v_uid` | "본인 외 행 무영향" | ✅ PK(room_id,user_id)+스코프 명시 → 정확히 호출자 1행. 타인 멤버십 불변 (DB 스모크 1·2·4) |
| **C-CONC** 동시 나가기 | `room_leave.sql:54` `perform 1 from rooms ... for update`(삭제 **전**) | 커플 마지막 2인 동시 나가기 | ✅ 동일 rooms 행 잠금으로 직렬화 → 선행은 잔여1 보존, 후행은 잔여0 삭제. 고아 빈 방 불가 (DB 스모크 3) |
| **C-DEL** 빈 방 명시 삭제 | `room_leave.sql:60-66` 잔여 count **후** `v_remaining=0`일 때만 `delete rooms`(CASCADE) | 솔로/혼자 커플 나가기 vs 잔여1 보존 | ✅ FK 방향(rooms→members) 정합. 멤버1행 삭제만으론 방 미삭제 → 명시 DELETE. 잔여≥1 `v_deleted=false` 보존 |
| **C-NAV** 상태전이 | `ProfileScreen.tsx:126-127` `void refresh()` + `navigation.reset({index:0,routes:[{name:Onboarding}]})` | `MembershipGate.tsx:29-37` no-room/in-room **동일 NavigationContainer 노드** | ✅ `goToRoom`(OnboardingScreen.tsx:48-51)의 정확한 거울. initialRouteName 변경만으론 전이 안 됨 → reset이 실제 이동 담당. **load-bearing 검증됨**(아래 §3) |
| **C-IDEM** 멱등 | `room_leave.sql:49-51` 멤버 아님 → `{false,null}` | `ProfileScreen.tsx:188` 멱등도 동일 Onboarding 전이 | ✅ spec "멱등 성공도 reset(Onboarding)" |
| **C-FUTURE** 미래 cascade | `delete rooms` CASCADE 가정 | 차기 `muklogs.room_id` FK | ✅(문서화만) muklogs/photos 테이블 부재 → §4 미검증 분류 |
| **C-REG** 회귀 | additive 신규 | 기존 create/join/정원/profile | ✅ git diff: errors.ts·modes.ts·기존 마이그 무변경, 18/141 그린 |

**Provider 트리 정합 확인**: `AuthGate.tsx:24-27` → `MembershipProvider` → `MembershipGate` → NavigationContainer → AppNavigator → ProfileScreen. ProfileScreen의 `useMembershipContext()`(`ProfileScreen.tsx:48`)는 OnboardingScreen과 동일 Provider 하위에서 정상 해소됨 → 런타임 throw 없음.

## 3. 테스트 의미성(load-bearing) 표본 검증

최고위험 경계면 **C-NAV**의 `navigation.reset` 호출을 일시 제거 → `npx jest ProfileScreen` 실행:
- ✕ "확인 시 leaveRoom→refresh+reset(Onboarding)" **실패**
- ✕ "멱등 성공도 Onboarding 전이" **실패**
- ✓ "실패 시 reset/refresh 미호출" 통과 유지(정상)
→ 정확히 2건만 빨개짐 → **전이 단언이 load-bearing(껍데기 아님)**. 즉시 원복(`ProfileScreen.tsx` 14/14 그린 회복, git diff 잔여 0 확인).

## 4. 미검증 (단위 경계 밖 — 통과로 처리하지 않음)

testing-strategy상 SQL·RPC·RLS·트리거·동시성은 단위 대상 아님 → **클라 계약은 모킹으로 검증 완료**, 실제 DB 동작은 **사용자 실DB 스모크 필수**:
1. 솔로방 나가기 → `rooms`/`room_members` 행 삭제 + Onboarding 복귀
2. 커플 2인 → 한쪽 나가기 방 보존(남은1인 in-room) → 마지막 나가기 방 삭제
3. 동시 나가기(두 기기) → 고아 빈 방 없음
4. 멤버 아닌 세션 직접 호출 → `{false,null}` 무에러

(dev-notes §5에 동일 시나리오 명시. SQL `for update`/스코프 삭제/count 분기 로직은 코드 리뷰상 plan §3.1과 정확히 일치하나, 실DB 행위 자체는 사용자 확정 전까지 "미검증".)

## 5. 범위 준수(오버구현 점검)

- ✅ 24h 유예·취소·cron·room-promote·나가기 배너 **미구현**(plan §2 Out-of-scope 준수). lifecycle 컬럼(`delete_scheduled_at`/`delete_requested_by`)은 건드리지 않음(항상 NULL).
- ✅ 신규 에러 토큰 0(`errors.ts` 무변경). `LEAVE_ROOM_BAD_RESPONSE`는 훅 내부 가드로 기본 메시지 흡수.

## 6. 코드 컨벤션 (전수 grep)

- ✅ `useCallback`/`useMemo` 0건, `export function` 0건, 인라인 `useEffect(()=>` 0건, raw hex 0건 (신규/수정 파일 대상 grep).
- ✅ named-object 인자(`mapRoomError({error})`), `leaveRoom()` 무인자는 RPC 계약. enum-style `Routes.Onboarding`. 파일명=심볼명.

## 7. 비차단 관찰(Nit, 수정 권고 아님)

- **dev-notes §3 SQL 라인 참조 드리프트**: dev-notes가 C-RLS `:62`/C-CONC `:59`/C-DEL `:68-71`로 인용하나 실제 `room_leave.sql`은 각각 `:57`/`:54`/`:63-66`(약 5줄 어긋남). **로직·동작은 정확**, 문서 라인번호만 초안 기준. 향후 참조 시 본 리포트 §2 라인을 기준으로.

## 8. 미해결

없음. 모든 인수조건 통과. 단, **§4 SQL 스모크 4건은 사용자 실DB 적용·확인이 출시 전 선결**(에이전트 경계 밖).
