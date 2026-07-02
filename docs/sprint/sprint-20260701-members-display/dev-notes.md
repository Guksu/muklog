# dev-notes — members-display (S5b) · 2단계(백엔드·배선, developer)

ui-publisher 1단계(ui-spec.md) 인계 계약을 소비해 데이터 계층·배선을 구현. **비주얼(ParticipantBlock·LogCard/MuklogCard 제거 결과)은 건드리지 않음.**

## 결과
- `npm test`: **152 suites / 1449 pass green** (1단계 1421 → +28 신규 테스트, 회귀 0).
- `npx tsc --noEmit`: **0 error**.
- git 미수행. 라이브 DB 미접근(마이그레이션 파일만 — 사용자가 `supabase db push`).

## ⚠️ §3.4 아바타 URL 계약 확인 (public 버킷 — signed URL 불필요, 검증 완료)
- 근거: `supabase/migrations/20260610120000_profile_avatars.sql` L16-18 —
  `insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;`
  (주석 L13: "비민감 + 추후 파트너 표시 대비 → public=true").
- 결론: `profiles.avatar_url`은 `getPublicUrl` 산출 **직접 렌더 가능 CDN URL**. `list_room_members`가 값 그대로 투영,
  `Avatar url={member.avatarUrl}`로 바로 렌더. **signed URL 배치 발급 경로(useLogPreviewUrls류) 신설 0.** 설계(architecture §3 profiles)와 정합, 스코프 영향 없음(플래그 해소).

## T9 멤버 데이터 소스 택1 사유 (plan §3.3)
- **선택: MuklogDetailRoute가 `useRoomMembers`를 자체 호출**(리스트에서 members를 전달하지 않음).
- 사유: 상세 화면은 LogScreen 리스트 외 경로(지도 탭 핀 → 상세, 향후 딥링크)에서도 진입 가능 →
  members context가 보장되지 않는다. Route가 로드된 `muklog.roomId`로 직접 1회 페치(useRoom 정책 = 진입 1회 + 폴링 0)가 안전.
  진입 전(로딩)엔 roomId `''` → 빈 배열 폴백 → resolveAuthor가 me/partner 폴백 카피(회귀 0), 로드되면 실명(깜빡임 허용, 크래시 0).
- 비용: 상세 진입당 +1 RPC(list_room_members). 정원 5행 상한, 폴링 0 — 무료 티어 내.

## 생산자 ↔ 소비자 매핑

### T1 RPC `list_room_members(p_room_id uuid)` (신규 마이그레이션)
- 경로: `supabase/migrations/20260701130000_list_room_members.sql` (S5a `20260701120000`보다 뒤 타임스탬프, 신규 파일).
- 시그니처: `returns table (user_id uuid, nickname text, avatar_url text)`, `language plpgsql`, `security definer`, `set search_path = public`.
- 본문 4단계(get_room 패턴 대조, L20260611120000):
  1. `auth.uid()` null → `raise NOT_AUTHENTICATED`.
  2. room 미존재(`not exists rooms`) → `raise ROOM_NOT_FOUND`.
  3. **비멤버(`not exists room_members where room_id=… and user_id=v_uid`) → `raise NOT_A_MEMBER`** (프라이버시 격리 핵심 C4-RLS).
  4. `return query select m.user_id, p.nickname, p.avatar_url from room_members m join profiles p on p.id=m.user_id where m.room_id=p_room_id order by m.joined_at asc`.
- 권한: `revoke all … from public, anon; grant execute … to authenticated;`.
- 에러 토큰 3종 모두 기존 `errors.ts ROOM_ERROR_MESSAGES`에 존재(신규 토큰 0). `avatar_url` = profiles public URL 원문(signed 미개입).
- 검증: SQL 리뷰(라이브 스모크는 사용자 `db push` 후 — 멤버 A 정상 / 비멤버 B는 NOT_A_MEMBER). 훅 레벨은 rpc 모킹으로 shape 검증.

### T2 훅 `useRoomMembers({ roomId })`
- 파일: `src/features/room/useRoomMembers.ts` (+ `.spec.ts` 8케이스).
- 생산자: `supabase.rpc('list_room_members', { p_room_id: roomId })` — 인자명 `p_room_id` RPC 시그니처 일치(C3).
- 매핑 경계: RPC row 배열(snake `{user_id, nickname, avatar_url}`) → `RoomMember[]`(camel `{userId, nickname, avatarUrl}`).
  **setof RPC → `data`는 배열**. `!Array.isArray(data)` → BAD_RESPONSE(기본 메시지). 개별 행 nickname/avatar_url null은 정상(누락 검사 제외).
- 상태: `RoomMembersState = loading | ready{members} | error{message}`(mapRoomError). 진입 1회 + `refresh`, 폴링·Realtime 0(비용 §8).
- **RoomMember 타입은 `logName.ts` 정의를 re-export**(중복 정의 금지, ui-spec §7-1 계약 단일 출처).
- 소비자: LogScreen(ParticipantBlock·logTitleFromMembers) / MuklogDetailRoute(resolveAuthor).

### T3 `resolveAuthor({ createdBy, meId, members })`
- 파일: `src/features/muklog/author.ts` (기존 유지 + 신규 순수 함수·`ResolvedAuthor` 타입). `author.spec.ts` +8 케이스(①매칭 me/partner ②닉null→defaultNickname ③미매칭 me ④미매칭 partner·미로드 ⑤NULL→Deleted ⑥3명 각기 다른 닉).
- 로직: `kind = deriveAuthorKind` → Deleted면 members 무관 `{탈퇴한 사용자, null, null, null}`. 그 외 `members.find(userId===createdBy)`:
  - 매칭 → nickname(=member.nickname ?? defaultNickname), avatarUrl=member.avatarUrl, avatarUserId=createdBy, label=nickname (**3명+ 정확, me/partner 이분법 탈피**).
  - 미매칭(미로드/나간 작성자) → 폴백 카피 me "내가 기록" / partner "짝꿍이 기록"(현행), avatarUrl=null, avatarUserId=createdBy (회귀 0).
- 타입 import는 `@/features/room/logName`(배럴 아님) 직접 — supabase 전이 로드 회피(type-only).
- 소비자: MuklogDetailScreen 작성자 행.

### T5·T6 LogScreen 배선 (`src/navigation/screens/LogScreen.tsx`, `.spec.tsx`)
- **T5 참여자 블록**: `useRoomMembers({ roomId })` 호출 → 'log' 세그 MuklogList `header` 슬롯에
  `membersState.status==='ready'`일 때만 `<ParticipantBlock members meId canInvite={members.length<5} onInvite={handleInvite} />`.
  loading/error → null(best-effort, 리스트 안 막음). wish 세그 미렌더 유지.
  - `handleInvite` = `Clipboard.setStringAsync(room.inviteCode)` + `showToast({message:"초대코드를 복사했어요 · {code}", tone:'positive'})`.
  - **제거/대체**: `SoloInviteBanner`·`CompactInviteRow` 컴포넌트 정의 삭제, 헤더 `avatarSlot`(익명 파트너 겹침) 삭제(LogTitleButton에 미주입), 관련 스타일(avatarStack/compactRow/bannerHead 등)·상수(HEADER_AVATAR_SIZE/COPIED_FEEDBACK_MS) 제거. unused import(Avatar/Icon/Pressable/RNText/ViewStyle) 정리.
- **T6 제목**: 헤더 `LogTitleButton` title을 `displayLogName` → `logTitleFromMembers({name, members, meId, selfNickname})`.
  name 우선(현행), 없으면 멤버 파생(1명 "{나}의 기록"/2명 "A · B"/3명+ "A 외 N명"). members 미로드([])면 유틸 내부 displayLogName 폴백(회귀 0).
  RenameDialog placeholder(`fallbackName`)는 `displayLogName(name:null)` 유지(폴백명 표시). `isCouple`은 RenameDialog extra 게이팅·LeaveLogSheets에 계속 사용.

### T9 MuklogDetail 작성자 매핑
- `src/navigation/screens/MuklogDetailRoute.tsx`: `useRoomMembers({ roomId: state.ready ? muklog.roomId : '' })` → `members`(ready면 배열, 아니면 []) → MuklogDetailScreen `members` prop 주입.
- `src/navigation/screens/MuklogDetailScreen.tsx`: `members?: RoomMember[]`(기본 []) prop 추가. 작성자 행이 `resolveAuthor({createdBy, meId, members})` 소비 →
  label=실 닉(매핑)/폴백 카피(미로드)/탈퇴한 사용자(NULL). Avatar `url = author.avatarUrl ?? (authorIsMe ? meAvatarUrl : null)`, `userId = author.avatarUserId`. 날짜 불변.
- 구 `deriveAuthorKind`/`authorAvatarUserId`/`DELETED_AUTHOR_LABEL` 직접 사용은 resolveAuthor로 대체(카드에서 제거는 ui-publisher T8 소관·불변).

### T10 export + spec
- `src/features/room/index.ts`: `+ useRoomMembers, RoomMembersState`(RoomMember는 logName 정의 재사용/통일 — 중복 export 회피).
- `src/features/muklog/index.ts`: `+ resolveAuthor, ResolvedAuthor`.

## §7 QA 경계면 (developer 담당 1-6·9 자기점검)
1. RPC snake(`user_id/nickname/avatar_url`) ↔ 훅 camel 매핑 — spec 단언(정상/빈/null/비배열). ✅
2. `RoomMembersState` ↔ ParticipantBlock·logTitleFromMembers·resolveAuthor 소비 — members 배열·null 안전. ✅
3. 에러 토큰 3종 ↔ errors.ts(신규 토큰 0) — NOT_A_MEMBER/NOT_AUTHENTICATED 매핑 spec 확인. ✅
4. 멤버십 검사(C4-RLS) ↔ get_room/rename_room 동일 패턴 대조(3단계 순서 동일). ✅
5. avatar_url public URL pass-through(§3.4) ↔ Avatar url 직접 렌더(signed 미개입) — 마이그레이션 실측 근거. ✅
6. resolveAuthor 멤버 매핑 ↔ MuklogDetail 작성자 행 + NULL graceful, 3명+ 매핑 — spec 단언. ✅
9. 구 UI(SoloInviteBanner·CompactInviteRow·헤더 익명 파트너 아바타) 제거 ↔ 참여자 블록 통합 — LogScreen.spec에서 구 배너 부재(💌·"초대코드 XXXXXX" queryByText null) 단언. ✅

## 변경/신규 파일
신규:
- `supabase/migrations/20260701130000_list_room_members.sql`
- `src/features/room/useRoomMembers.ts` · `useRoomMembers.spec.ts`

수정:
- `src/features/muklog/author.ts`(+ resolveAuthor·ResolvedAuthor) · `author.spec.ts`(+8)
- `src/features/room/index.ts`(+ useRoomMembers·RoomMembersState export)
- `src/features/muklog/index.ts`(+ resolveAuthor·ResolvedAuthor export)
- `src/navigation/screens/LogScreen.tsx`(참여자 블록 배선·제목 파생·구 배너/아바타 제거) · `LogScreen.spec.tsx`
- `src/navigation/screens/MuklogDetailScreen.tsx`(members prop·resolveAuthor) · `MuklogDetailScreen.spec.tsx`(+4 T9)
- `src/navigation/screens/MuklogDetailRoute.tsx`(useRoomMembers 배선·members 전달) · `MuklogDetailRoute.spec.tsx`(+4)

## 미완 / 후속
- 라이브 유효화: 사용자 `supabase db push`로 `list_room_members` 적용 필요(앱 코드 재빌드 불필요 — 순수 JS+RPC). 라이브 스모크(멤버 조회 정상·비멤버 NOT_A_MEMBER)는 사용자 검증.
- (문서, plan §11) architecture §5 백로그 S5b 행 추가·§3 참여자 블록 서술 갱신 — 별도 문서 작업(코드 무관).
- 비주얼 충실도(§7-7·8 참여자 블록/카드) = qa-visual 담당.
