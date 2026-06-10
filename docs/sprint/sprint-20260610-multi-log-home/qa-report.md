# QA 리포트 — sprint-20260610-multi-log-home

> 작성: team-lead 직접 수행(세션 중단으로 qa-inspector 배경 에이전트 종료 → 오케스트레이터가 교차검증 대행).
> 기준: **as-built 디스크 진실** = 트리밍(로그 입장 UI OUT → log-invite) + leave_room 인자화. (developer 08:18 "전체 스코프+dormant" 보고는 부정확 → 디스크 기준으로 정정 검증.)

## 종료 기준
| 항목 | 결과 |
|------|------|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npx jest` | ✅ 23 suites / 147 tests 전부 통과 |

## 경계면 교차검증 (생산자 ↔ 소비자 양쪽 동시 읽기)

| ID | 경계면 | 판정 | 근거 |
|----|--------|------|------|
| C1 | `list_my_rooms()` RPC 반환 컬럼 ↔ `useMyLogs` `MyLogRow` ↔ `MyLog` 매핑 | ✅ | RPC `returns table(room_id uuid, mode text, member_count int, created_at timestamptz, joined_at timestamptz)` ↔ `MyLogRow` 동일 키 ↔ `toMyLog` snake→camel 정확 |
| C2 | 멤버 수 집계(솔로/커플 배지) | ✅ | DEFINER RPC가 RLS 우회로 `member_count` 집계(클라 직접 select는 자기행만 → count=1 한계 회피). `LogListScreen` 배지 `memberCount>=2 ? '둘이':'혼자'` — mode 컬럼 아닌 멤버수 파생(C2 의도) |
| C3 | 게이트 제거: `AuthGate` authenticated → `MyLogsProvider`+`HomeTabs` 직행 | ✅ | `MembershipGate`/`OnboardingScreen`/`useMembership`/`RoomTabs`/`MuklogTabScreen` 삭제(git D). 멤버십 분기 없음 |
| C4 | `+`버튼 ↔ `create_room` ↔ `myLogs.refresh` | ✅ | `PlusHeaderButton` = "로그 생성" 단일 액션 → `createRoom()` → `refresh()`(화면 전환 없어 목록 직접 갱신). 중복 생성 `creating` 비활성 1차 방지 |
| C5 | 카드 탭 → `LogScreen{roomId}` | ✅ | `LogListScreen` `navigate(Routes.LogScreen,{roomId})` ↔ `AppStackParamList[LogScreen]:{roomId}` 일치. `LogScreen`은 최소 stub(범위 정합) |
| C6 | `enforce_room_capacity` 정원 ↔ `modes.ts ROOM_CAPACITY` | ✅ | 트리거 `count(*) >= 2`(모드별 solo=1 폐기) ↔ `ROOM_CAPACITY {solo:2, couple:2}` 동기화. 단일 출처 일치 |
| C7 | `create_room` 1인1방 가드 제거 | ✅ | `ALREADY_IN_ROOM` 실제 `raise` 문 0건(전부 제거 설명 주석) → 한 사용자 다중 로그 생성 가능 |
| C8 | `join_room` 솔로/타방 가드 제거 + 정원2 | ✅ | `SOLO_ROOM_NOT_JOINABLE`·타방 `ALREADY_IN_ROOM` raise 0건. `v_count >= 2` 정원 방어 유지. 같은 로그 PK 멱등 보존(RPC 선반영 — UI는 log-invite) |
| C9 | 빈 목록 상태 | ✅ | `list_my_rooms` 0행 → `useMyLogs` `{status:'ready', logs:[]}`(에러 아님) → `LogListScreen` 빈 상태 UI("아직 로그가 없어요 + + 버튼 안내") |
| C-LEAVE | `leave_room(p_room_id)` ↔ `useLeaveRoom({roomId})` | ✅(의도된 deferral) | 마이그레이션 §5 `drop leave_room()` → `leave_room(p_room_id uuid)` 재생성. `useLeaveRoom` `leaveRoom({roomId})` → `rpc('leave_room',{p_room_id})`. **UI 호출부 0**(LogScreen 본구현 시 wiring) |

## 회귀 / 의도된 변경 구분
- **회귀 0(불변 유지)**: `create_room`(가드만 제거, 코어 로직 불변)·`profile` 편집(닉네임/아바타)·`code.ts`·`errors.ts` 본문.
- **의도된 변경(멀티 로그 전환)**: 온보딩/멤버십 게이트 제거, `useMembership`(단일 maybeSingle) → `useMyLogs`(목록) 교체, `RoomTabs`→`HomeTabs`, `ProfileScreen` 나가기 섹션 제거(`leave_room` UI 호출부 제거 → LogScreen로 이전). 관련 spec 삭제/대체 정당(`useMembership.spec`·`OnboardingScreen.spec` 삭제).

## 범위 준수 (오버구현 0)
- 로그 입장(join) UI(`JoinLogScreen`·액션시트 입장 분기)·초대코드 표시 UI·맛집 엔트리·지도 본구현·로그 이름 편집 = **미구현(OUT-OF-SCOPE)**. `join_room`/`useJoinRoom`/`leave_room` RPC·훅 계약은 선반영(다음 `log-invite`가 즉시 사용).

## 잔여/메모
- `rooms.mode` 컬럼·`ROOM_MODES`는 stale·미사용으로 잔존(무해). 멀티 로그 모델에선 멤버수 파생이 진짜 기준.
- `leave_room(p_room_id)`·`useLeaveRoom`는 UI 호출부 0(dead-path 아님 — 차기 LogScreen 나가기에서 사용). 단위 계약만 검증됨.
- **사용자 선결(에이전트 경계 밖)**: 마이그레이션 `20260610150000_multi_log_home.sql` 실 Supabase 적용(`supabase db push`) 필요. SQL/RLS/RPC 실DB 동작은 단위 밖 → 적용 후 스모크 권장(로그 생성→목록+1, 다중 로그 생성, 빈 목록, RLS 내 로그만).

## 결론
**전체 PASS · 회귀 0 · 차단 이슈 0 · 오버구현 0.** 트리밍+인자화 기준으로 경계면 C1~C9·C-LEAVE 전부 정합. 스프린트 완료 가능.
