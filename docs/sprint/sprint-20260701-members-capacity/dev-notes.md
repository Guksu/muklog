# dev-notes — members-capacity (S5a, 2026-07-01)

## 담당 범위 (정원 확장 = C6 한 묶음)
로그 정원 2→5 확장. MemberBadge(비주얼)는 ui-publisher 담당이라 제외. architecture.md §3 갱신은 리더 담당이라 미편집.

## 변경 파일 목록
| 파일 | 변경 | 유형 |
|------|------|------|
| `supabase/migrations/20260701120000_members_up_to_5.sql` | **신규** — enforce_room_capacity·join_room 정원 2→5 | 생산자(DB) |
| `src/features/room/modes.ts` | `ROOM_CAPACITY = { solo:5, couple:5 }` + C6 주석/stale 주석 정리 | 소비자(클라 단일 출처) |
| `src/features/room/errors.ts` | `ROOM_FULL` 카피 `'이미 2명이 모두 입장한 방이에요.'` → `'로그 정원(5명)이 가득 찼어요.'` | 소비자(에러 매핑) |
| `src/features/room/modes.spec.ts` | ROOM_CAPACITY 5 단언(solo·couple·전체) + describe/주석 5 | 테스트 |
| `src/features/room/errors.spec.ts` | ROOM_FULL 새 카피 + "2명" 부재 단언 추가(3곳 카피 갱신) | 테스트 |
| `src/features/room/useJoinRoom.spec.ts` | ROOM_FULL 매핑 결과 새 카피로 갱신 | 테스트(소비자) |
| `src/navigation/screens/JoinLogScreen.spec.tsx` | 인라인 에러 표시 카피 새 카피로 갱신 | 테스트(소비자) |

## 마이그레이션
- 경로: `supabase/migrations/20260701120000_members_up_to_5.sql` (타임스탬프 `20260701120000` > 기존 최신 `20260622120000`).
- **사용자가 직접 적용**(에이전트 라이브 DB 미접근). `supabase db push` 또는 SQL 에디터 실행.
- 이미 적용된 마이그레이션은 편집하지 않음 — 신규 파일로 create-or-replace override(definer-storage-and-best-effort 원칙).

### join_room 최신 정의 출처 (stale override 주의)
- `join_room`·`enforce_room_capacity`가 등장하는 마이그레이션: `20260609120000_invite_room.sql`, `20260610130000_room_modes.sql`, `20260610150000_multi_log_home.sql`.
- **가장 최신 정의는 `20260610150000_multi_log_home.sql`** — 이것을 베이스로 채택.
  - `enforce_room_capacity()`: 모드 무관 `count(*) >= 2` (room_modes의 모드별 solo=1/couple=2 분기는 multi_log_home에서 이미 폐기). → `>= 5`.
  - `join_room(p_code)`: SOLO/타방 ALREADY_IN_ROOM 가드 제거·같은 로그 PK 멱등·`for update` 잠금·`v_count >= 2` 1차 가드. → `v_count >= 5`. 반환 `{ room_id }` 불변.
- room_modes(중간, 모드별 정원·SOLO 가드)를 베이스로 쓰지 않도록 주의 — 그것을 베이스로 하면 이미 폐기된 SOLO 가드가 부활하는 stale override가 됨. multi_log_home 본문만 숫자 교체.
- **ROOM_FULL 토큰·errcode(P0001) 보존** — errors.ts 매핑과 단일 출처 유지.

## 생산자 ↔ 소비자 매핑 (QA 교차검증용)
| 정원 규칙 | 생산자 | 소비자 | 정합 근거 |
|-----------|--------|--------|-----------|
| 정원 상한 5 (트리거) | `enforce_room_capacity()` `count>=5` (신규 마이그레이션) | `room_members` INSERT 최종 방어 | C6 |
| 정원 1차 가드 5 (RPC) | `join_room` `v_count>=5` (신규 마이그레이션) | `useJoinRoom` → RPC 호출 | C6 |
| ROOM_CAPACITY=5 (클라) | `modes.ts ROOM_CAPACITY` | `index.ts` re-export 소비처 | 트리거 정원식(5)과 단일 출처(C6) |
| ROOM_FULL 카피 | `errors.ts ROOM_ERROR_MESSAGES.ROOM_FULL` | `useJoinRoom.error`, `JoinLogScreen` 인라인 에러 | RPC raise 'ROOM_FULL' ↔ 매핑 단일 출처 |

## C6 정합 근거
- DB 정원식(트리거 `count>=5`, join_room `v_count>=5`)과 클라 `ROOM_CAPACITY.solo=couple=5`가 **같은 스프린트에서 함께 5로 상향** → 단일 출처 일치.
- 트리거가 최종 방어이므로 마이그레이션 미적용 시에는 라이브 정원이 여전히 2(순수 JS 코드는 재빌드 불필요, DB 적용 후 정원 5 유효). plan 완료 기준의 "사용자 마이그레이션 적용" 반영.

## 건드리지 않은 것 (경계 준수)
- `MemberBadge.tsx` (ui-publisher 담당).
- memberCount 파생 로직: `logName.ts`(couple 판정 `>=2`), `useLeaveRoom.ts`·`LeaveLogSheets.tsx`(커플 유예 카피) — 정원 상한이 아니라 "둘 이상 = 커플" 경계라 불변.
- `architecture.md §3` (리더 담당, 중복 편집 방지).
- 이미 적용된 마이그레이션 파일(override만).

## 결과
- `npm test`: **150 suites / 1403 tests 전체 통과**.
- `npx tsc --noEmit`: **0 (EXIT=0)**.
- Red→Green 순서 준수(먼저 modes/errors spec 5·새 카피로 갱신해 7 fail 확인 → 구현 후 green).

## 미완 / 후속 (S5b, 비스코프)
- 멤버 실명·아바타 DEFINER RPC(`list_room_members`)·`useRoomMembers`, LogScreen 참여자 블록, `mkLogTitle`(1/2/3+명) 등은 S5b.
