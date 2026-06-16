# QA Report — Logic / 통합 정합성 (sprint-20260616-room-lifecycle)

> 검증자: qa-logic. 범위: 로직·통합 정합성·기능 스펙·보안/비용 가드레일·#2 폐기 회귀 가드·TDD·컨벤션. **비주얼 충실도 제외(qa-visual 담당).**
> 방법: 생산자(SQL/RPC) ↔ 소비자(훅/화면) 양쪽 동시 읽기 교차검증.
> 결과 요약: **전 항목 PASS. 차단 이슈 0.** `npm test` 1094 passed / 130 suites, `npx tsc --noEmit` 0 에러. 라이브 SQL/cron/Storage 스모크는 계획대로 이월(통과 처리 안 함).

---

## 1. 경계면 교차검증 (생산자 ↔ 소비자)

| # | 경계면 | 생산자 | 소비자 | 판정 |
|---|--------|--------|--------|------|
| B1 | leave_room 반환 shape | `leave_room` jsonb `{ scheduled, room_deleted, delete_scheduled_at, room_id }` (sql:117-120, 131-133) | `useLeaveRoom` snake→camel `{ scheduled, roomDeleted, deleteScheduledAt, roomId }` (useLeaveRoom.ts:50-61) | **PASS** |
| B2 | leave 분기 ↔ nav/refresh | 커플=`scheduled:true,room_deleted:false` / 솔로=`room_deleted:true` | `handleLeave`: `roomDeleted`→`goBack` / else→`refresh` (LogScreen.tsx:453-466) | **PASS** |
| B3 | cancel 반환·에러토큰 | `cancel_room_deletion` `{ canceled, room_id }` + raise `NOT_SCHEDULED`/`NOT_DELETION_REQUESTER`/`NOT_AUTHENTICATED` (sql:175-193) | `useCancelRoomDeletion`(:42-46) + `errors.ts` 토큰 2종(:27-28) | **PASS** |
| B4 | 투영 ↔ 배너 게이팅 | `get_room`(sql:335-336)·`list_my_rooms`(sql:270-271) `delete_scheduled_at`·`delete_requested_by` | `useRoom`(:82-83)·`useMyLogs`(:57-58) `?? null` 흡수 → 배너 `room.deleteScheduledAt ?`(LogScreen.tsx:531) | **PASS** |
| B5 | isRequester 판정 | `delete_requested_by`(=auth.uid 세팅, sql:113) | `meId === room.deleteRequestedBy`(LogScreen.tsx:538) → 요청자만 취소 버튼 | **PASS** |
| B6 | RPC 인자명 `p_room_id` | sql 시그니처 `(p_room_id uuid)` 4함수 | `supabase.rpc('leave_room'/'cancel_room_deletion', { p_room_id })`·`get_room`(useRoom:57) | **PASS** |
| B7 | countdownLabel 경계 | `rooms.delete_scheduled_at`(ISO) | `deletionCountdownLabel({scheduledAt, now})` ≤0/​<1h/≥1h (deletionCountdownLabel.ts:27-33) | **PASS** |
| B8 | cron predicate ↔ 솔로 보호 | `delete_expired_rooms`: `delete_scheduled_at is not null and <= now()` 만(sql:218-219). #2 자동삭제 predicate **부재** | — | **PASS** |
| B9 | Storage 경로 규약 | `_delete_room_cascade`: `name like p_room_id::text || '/%'` (sql:43-44) | photoPath `{room_id}/{muklog_id}/{uuid}.jpg` 프리픽스 | **PASS** |
| B10 | FK CASCADE ↔ 단일 delete | `delete from public.rooms`(sql:46) → muklogs/muklog_photos/wishlist_items/room_members CASCADE | — | **PASS**(계약 일치; 라이브 CASCADE 실효는 이월) |

---

## 2. 기능 스펙 준수 (plan §5 T1~T11 인수조건)

- **T1 leave_room 유예 모델** — 커플(≥2)=24h 예약·멤버십/방 보존(sql:99-120), 솔로(1)=즉시 `_delete_room_cascade`(sql:123-134), 멤버아님 멱등 `room_id:null`(sql:87-91). **이미 예약됨 → 멱등 no-op(요청자 보존)**(sql:103-109). **PASS**(SQL 계약; 라이브 스모크 이월).
- **T2 cancel_room_deletion** — 요청자만 두 필드 NULL(sql:189-193), 비요청자 `NOT_DELETION_REQUESTER`(sql:185-187), 방없음/예약없음 `NOT_SCHEDULED`(sql:175-182). **PASS**.
- **T3 delete_expired_rooms + cron + Storage** — 경과 행만 루프(sql:217-222), `cron.schedule('delete-expired-rooms','0 * * * *',...)` 멱등 등록(sql:232-239), Storage 메타 선정리(sql:43-44). #2 predicate 부재. **PASS**(라이브 cron 등록·실행·Storage 이월).
- **T4 투영 확장** — 두 RPC에 2필드 추가, null 흡수. **PASS** + 단위(useRoom/useMyLogs spec).
- **T5 useLeaveRoom** — 3케이스 매핑 + `LEAVE_ROOM_BAD_RESPONSE` 타입가드. **PASS**(spec 11 케이스, data:null·비-boolean 포함).
- **T6 useCancelRoomDeletion + 투영** — 성공 매핑·토큰 메시지·`CANCEL_ROOM_DELETION_BAD_RESPONSE`. **PASS**.
- **T7 deletionCountdownLabel** — 23h30m/23h/1h경계/40m/59m/0/-5m 전수. **PASS**(경계 명세 충실).
- **T8 errors.ts 2토큰** — 정확·포함 매칭, 키 12종 lock 테스트. **PASS**.
- **T9~T11 LogScreen 배선** — ⋯메뉴→확인시트 커플/솔로 분기, 나가기 scheduled→refresh·deleted→goBack·실패→시트유지, 배너 3분기(요청자/상대/없음)+취소→refresh, 취소실패→토스트+refresh. **PASS**(spec 18 케이스).

---

## 3. 엣지케이스 (plan §6)

| 케이스 | 처리 | 판정 |
|--------|------|------|
| 동시 나가기(커플) | `perform 1 ... for update`(sql:94) 직렬화 → 둘째 `v_existing` 발견 → 멱등 no-op, 요청자 탈취 방지 | **PASS**(코드; 라이브 동시성 이월) |
| 취소 ↔ cron 경합 | `for update`(sql:173) 직렬화. cron 선삭제 시 `not found`→`NOT_SCHEDULED`→UI 토스트+refresh(LogScreen.tsx:474-477) | **PASS** |
| 타인 취소 시도 | RPC `NOT_DELETION_REQUESTER`(sql:185) + UI isRequester=false 버튼 미노출(ScheduledDeletionBanner.tsx:56) 이중 방어 | **PASS** |
| 이미 삭제된 방 leave/cancel | leave 멤버없음→멱등 / cancel 방없음→`NOT_SCHEDULED`. 크래시 없음 | **PASS** |
| 재예약(요청자 재나가기) | 멱등 유지(sql:103-109) | **PASS** |
| 네트워크 실패 | leave 실패→시트 유지·refresh 미호출(LogScreen.tsx:463-465) / cancel 실패→토스트+refresh | **PASS** |
| 빈 상태(예약 없음) | `deleteScheduledAt==null`→배너 미렌더(LogScreen.tsx:531) | **PASS** |
| meId='' (미인증) | `'' === null`=false → false-positive 요청자 판정 없음 | **PASS** |

---

## 4. 보안 · 비용 가드레일

- **RLS/DEFINER 스코프** — 4함수 `security definer set search_path`. 쓰기 모두 `id=p_room_id`/`user_id=v_uid` 스코프 명시(sql:111-114, 124). `_delete_room_cascade`·`delete_expired_rooms`는 `revoke all from public,anon,authenticated`(클라 호출 불가, sql:51·227). leave/cancel만 authenticated grant. **PASS**.
- **AWS 미사용 / 외부 호출 0** — pg_cron in-DB(`cron.schedule`), Storage 정리=`storage.objects` SQL 메타 DELETE. pg_net/http/s3/aws/fetch 호출 0(grep 확인). **PASS**.
- **cron 주기 매시** `'0 * * * *'` + 부분 인덱스 `idx_rooms_delete_scheduled`(예약 행만, sql:24-26). **PASS**.
- **Kakao 호출 0 / 폴링 0** — 신규 Kakao 0. 예약 상태는 진입/포커스 refresh(useRoom·useMyLogs 기존 정책 계승), `setInterval`/Realtime/channel 신규 0(grep 확인). **PASS**.
- **#2 폐기 회귀 가드** — `delete_expired_rooms` predicate에 자동삭제(`mode`/`created_at+24h`/멤버수) 조건 **부재**. 예약 없는 솔로/일반 로그 영구 보호. **PASS(구조적)**. ⚠️ 후술 F1.

---

## 5. 컨벤션 (docs/code-convention.md)

- useCallback/useMemo: 신규 5파일 0건(grep). LogScreen `handleFocus`의 useCallback은 `useFocusEffect` 참조안정 필수 케이스(주석 명시·컨벤션 허용). **PASS**.
- 화살표 const 컴포넌트/훅, named-object 인자(`{ roomId }`/`{ scheduledAt, now }`), useEffect 명명 함수(`clearCompactCopied`/`loadRoomOnId` 등), enum-style 상수(`LogSeg`·카피 상수), raw hex 0(신규 파일 grep, negativeWeak 등 토큰 경유). **PASS**.
- 파일명=심볼명(`useLeaveRoom`·`deletionCountdownLabel`·`LeaveLogSheets`·`ScheduledDeletionBanner`). **PASS**.

---

## 6. TDD · 테스트 품질

- `npm test`: **1094 passed / 130 suites**, 회귀 0.
- `npx tsc --noEmit`: **0 에러**.
- 인수조건↔테스트 대응: T5~T11 전 인수조건에 대응 단위/렌더 테스트 존재(useLeaveRoom 11·useCancelRoomDeletion 6·deletionCountdownLabel 7·errors 다수·useRoom/useMyLogs 투영·LogScreen 18·LeaveLogSheets·ScheduledDeletionBanner).
- 경계·실패 경로 커버: bad-shape(`data:null`·비-boolean), 토큰 에러, 경계값(0/1h/<1h/경과), 3분기 배너, reject 시 시트유지/refresh 미호출.
- **유의미성 표본 검증**: `deletionCountdownLabel` 시간 계산에 off-by-one 주입 → 3 테스트 red 확인(load-bearing). 복원 완료.
- **PASS**.

---

## 7. 발견 / 관찰 (비차단)

- **F1 (MINOR · 이월 연계)** — #2 폐기 회귀 가드가 **구조적(predicate 부재)일 뿐 자동 테스트로 잠겨 있지 않다**. SQL은 본 하네스 단위 대상이 아니므로(plan §5-1 모킹/스모크 이월) 정책과 일치하나, 향후 누가 `delete_expired_rooms`에 자동삭제 조건을 추가해도 `npm test`는 green을 유지한다. → 라이브 스모크(dev-notes 라이브 이월 4번 "예약없는 솔로 로그 보존")를 **반드시 실행**해 잠글 것. 권고: 라이브 검증 시 `delete_scheduled_at is null`인 솔로 로그 1건을 24h+ 과거 `created_at`으로 두고 `select delete_expired_rooms();` 후 잔존 확인.
- **F2 (이월)** — cron 잡 등록(`select * from cron.job`), 1회 수동 실행, Storage 메타 DELETE 실효, **DEFINER 함수 소유자가 `storage.objects` DELETE 권한 보유 여부**, FK CASCADE 실효는 라이브 검증 이월(plan §5 완료기준·dev-notes 라이브 이월). pg_cron 확장 미활성 시 do-블록 실패 가능 → 활성 후 재실행(idempotent).
- **F3 (관찰, 무해)** — `handleLeave`에서 leave_room이 멤버-아님 멱등(`roomDeleted:false`)을 반환하면 `refresh()`만 수행(goBack 없음). 화면에 진입한 사용자는 멤버임이 보장(get_room `NOT_A_MEMBER` 게이트)되어 **도달 불가 경로**. 동작상 문제 없음.

---

## 8. 결론

- 통합 정합성·기능 스펙·엣지케이스·보안/비용 가드레일·#2 폐기 가드·컨벤션·TDD **전 항목 PASS, 차단 이슈 0**.
- `npm test` 1094 green · `tsc` 0 에러 재확인.
- **라이브 SQL/RPC/cron/Storage 스모크는 계획대로 이월**(F1·F2) — 통과 처리하지 않음. 사용자 환경에서 검증 필요.
- developer 추가 작업 불요. **로직 관점 "스프린트 완료 가능"**(라이브 스모크 이월 항목 잔존 명기).
