# Sprint: members-capacity (S5a, 2026-07-01)

## 단일 기능
ui-design 킷 델타 **§5의 1부** — **로그 정원 2 → 5** 확장 + **MemberBadge "N명"** 반영. (멤버 표시 UI = 참여자 블록·LogCard·MuklogCard·mkLogTitle·멤버 프로필 RPC는 **S5b**.)

> 사용자 결정(2026-07-01): (1) 멤버 실명·아바타 노출 지향(→ S5b에서 same-room DEFINER RPC), (2) S5를 둘로 분할. 본 스프린트=S5a(정원 확장 + 배지).

## 배경 (현행)
- 정원 2 하드캡: `enforce_room_capacity()` 트리거 `count >= 2`, `join_room` RPC `v_count >= 2`(`supabase/migrations/20260609120000_invite_room.sql`, 이후 multi-log-home에서 정원2 통일).
- `ROOM_CAPACITY = {solo:2, couple:2}`(`modes.ts`) — **트리거 정원식과 단일 출처(C6)**.
- `errors.ts` `ROOM_FULL: '이미 2명이 모두 입장한 방이에요.'` (하드코딩 "2명").
- `MemberBadge`: `memberCount>=2 → 💑 "둘이"` / `<2 → 🙋 "혼자"`.

## 스코프 (정원 확장 = C6 정합 한 묶음)
1. **마이그레이션 신규 파일** `supabase/migrations/{YYYYMMDDHHMMSS}_members_up_to_5.sql`:
   - `enforce_room_capacity()` 트리거: `>= 2` → `>= 5`.
   - `join_room` RPC 내부 `v_count >= 2` → `>= 5`.
   - `ROOM_FULL` 에러 토큰·의미 유지(정원 초과). (이미 적용된 마이그레이션은 편집 금지 — 신규 파일로 override. `definer-storage-and-best-effort` 메모.)
   - **사용자가 직접 적용**(에이전트는 라이브 DB 미접근). 완료 기준에 포함.
2. **`src/features/room/modes.ts`** — `ROOM_CAPACITY = {solo:5, couple:5}` (트리거 5와 C6 동기화). 관련 주석 갱신. spec 갱신.
3. **`src/features/room/errors.ts`** — `ROOM_FULL` 카피를 정원 일반화: 예) `'로그 정원(5명)이 가득 찼어요.'`(또는 킷 톤). "2명" 하드코딩 제거.
4. **`src/components/MemberBadge.tsx`** — 킷 §5 mk-ui:143-153 정합: **이모지(💑/🙋) 제거**, 텍스트 `memberCount <= 1 ? '혼자' : `${memberCount}명``. 컨테이너 색(primaryWeak/surfaceAlt·accentStrong/fgWeak)·pad·radius 불변. spec 갱신(💑 부재·"N명" 단언).
5. **`docs/design/architecture.md`** — §3(정원 2→5)·관련 서술(로그 정원 = 5) 갱신. `rooms.mode`/솔로 파생은 불변(호환).

## 비스코프 (→ S5b)
- 멤버 실명·아바타 노출 DEFINER RPC(`list_room_members`)·`useRoomMembers` 훅.
- LogScreen 참여자 블록(N·최대5명 + 아바타·이름 + 초대 버튼), LogCard 아바타 제거, MuklogCard 작성자 줄 제거, `mkLogTitle`(1/2/3+명), author me/partner→멤버 매핑.
- FoodCover·인앱 액센트·기타 카피 불변.

## 인수조건 (TDD)
- AC1. 마이그레이션 SQL이 트리거·join_room 정원을 5로 상향(ROOM_FULL 토큰 보존). 리뷰로 검증(라이브 적용은 사용자).
- AC2. `ROOM_CAPACITY` solo·couple 모두 5, **트리거 정원식(5)과 일치(C6)**. modes.spec 갱신.
- AC3. `ROOM_FULL` 카피에 "2명" 없음(정원 일반화). errors 관련 spec 갱신.
- AC4. MemberBadge: 1명→"혼자", 2~5명→"N명"(2명·3명·5명 케이스), 이모지 미렌더. couple(>=2) 색 유지. spec 갱신.
- AC5. `npm test` 전체 통과 + `npx tsc --noEmit` 0. 기존 정원2 가정 테스트(있으면) 5로 정합.

## 완료 기준
- AC1~5 + qa-report-logic(C6 정원 정합·트리거/RPC 정확·회귀) + qa-report-visual(MemberBadge 킷 충실) PASS.
- **사용자가 마이그레이션 적용**(라이브 정원 5 반영). 앱 코드는 재빌드 불필요(순수 JS), 단 정원 5는 DB 적용 후 유효.

## 데이터 계약
- `room_members` 스키마 불변(행 수 상한만 2→5). `join_room`/`enforce_room_capacity` 정원식 변경. `list_my_rooms`·`member_count` 집계 shape 불변.
