# QA Report — Logic / 통합 정합성 (sprint-20260701-members-display, S5b)

판정: **PASS** (코드 결함 0, 미해결=라이브 스모크만) — qa-logic 에이전트.
`npm test` 1449 passed / 152 suites, `tsc --noEmit` 0. Load-bearing 표본(useRoomMembers 매핑 파괴) → RED 확인.

## 경계면 (§7-1~6·9)
1. **RPC 프라이버시(최우선) — PASS.** `20260701130000_list_room_members.sql:29-69` 보안 4단계 = `get_room` 패턴 일치: NOT_AUTHENTICATED(38) → ROOM_NOT_FOUND(43) → **NOT_A_MEMBER 비멤버 차단(49-54, room-존재 뒤·데이터 앞 정확 위치)** → join profiles order by joined_at asc(58-63). `security definer`+`set search_path=public`, `revoke anon/public`+`grant authenticated`.
2. **RPC↔훅 shape — PASS.** setof(snake) ↔ `useRoomMembers`(camel), `Array.isArray` 방어(setof=배열), 인자 `p_room_id`(C3), null 안전. `RoomMember` 단일출처(logName.ts), 훅 re-export.
3. **에러 토큰 — PASS.** 3종 모두 `errors.ts` 기존(신규 0), mapRoomError 경유.
4. **resolveAuthor — PASS.** Deleted 최우선(NULL 함정 회피) → members.find(createdBy) 3명+ 정확 → nickname null→defaultNickname → 미매칭 me/partner 폴백(회귀 0). MuklogDetail 소비 정합.
5. **avatar public 버킷 — PASS.** `20260610120000_profile_avatars.sql:16-18 public=true` 실측 → avatar_url 직접 렌더(signed URL 미개입).
6. **구 UI 제거 회귀(§7-9) — PASS.** SoloInviteBanner·CompactInviteRow 완전 제거(dead code 아님), 헤더 익명 파트너 아바타 제거, 초대코드 접근은 참여자 블록 초대 버튼(복사+토스트)이 대체, wish 세그 미렌더 유지, 중복 노출 0.

## 가드레일·TDD·비용 — PASS
- RPC 1회/로그(폴링·Realtime 0), 최대 5행. **LogListScreen에 useRoomMembers 참조 0**(RPC N 방지). T1~T10↔테스트 대응·엣지(1/5명·탈퇴자·아바타없음·닉null·미로드) 커버. 컨벤션(useCallback/useMemo 0·raw hex 0). Supabase 무료 티어·시크릿 없음.

## 미해결 (사용자 액션)
- **라이브 스모크**: 사용자 `supabase db push` 후 — 멤버 A 정상 / 비멤버 B 동일 room_id→NOT_A_MEMBER. DEFINER RLS 우회는 라이브에서만 실측(SQL 리뷰상 get_room 동형이라 정확).

## FYI (비차단)
- `MuklogDetailRoute`가 muklog 로드 전 `useRoomMembers({roomId:''})` 1회 fire → best-effort 흡수(members=[], 폴백). 기존 `roomId ?? ''` 패턴과 동일 무해. 수정 불요.

> qa-logic 에이전트 회신을 리더가 본 파일로 보존(하네스 규칙 3).
