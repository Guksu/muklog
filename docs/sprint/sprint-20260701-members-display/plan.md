# Sprint: members-display (S5b, 2026-07-01)

## 1. 기능 한줄 정의
로그(방)의 **모든 멤버 실명(닉네임)·아바타를 킷대로 노출**한다 — LogScreen "참여자 N · 최대 5명" 블록(아바타+닉+초대 버튼), 로그 제목이 멤버 이름으로("A · B" / "A 외 N명"), 상세 화면 작성자가 실제 멤버 닉/아바타로 표시된다. co-member 프로필은 **same-room 스코프 DEFINER RPC**로만 읽는다(RLS self-only 우회, 프라이버시 격리).

> 사용자 결정(2026-07-01): (1) 멤버 실명·아바타 노출(킷 시안대로), (2) 현행 `profiles` RLS self-only → **`list_room_members` DEFINER RPC 신설**로 같은 로그 멤버끼리만 닉/아바타 read. S5a(정원 2→5·MemberBadge "N명")는 완료 — 본 스프린트=S5b(킷 델타 §5의 **2부**).

## 2. 범위

### In-scope
1. **`list_room_members(p_room_id)` DEFINER RPC** — 호출자가 해당 로그 멤버일 때만 그 로그 멤버들의 `{ user_id, nickname, avatar_url }`(최대 5행) 반환. 비멤버=`NOT_A_MEMBER`.
2. **`useRoomMembers({ roomId })` 훅** — loading/ready/error 상태, RPC 응답 매핑.
3. **LogScreen 참여자 블록** — 킷 mk-log:79-103 재현: "참여자 {N}" + "· 최대 5명" + 멤버 행(아바타46·i0=나 ring·닉 ellipsis) + 멤버<5면 초대 버튼(dashed 원+plus+"초대"→초대코드 복사 토스트). **기존 솔로 배너 + 커플 컴팩트 행 + 익명 파트너 아바타 겹침을 이 블록으로 통합/대체.**
4. **로그 제목 = 멤버 이름 파생**(킷 `mkLogTitle` mk-ui:272) — 1명 "{나}의 기록", 2명 "A · B", 3명+ "A 외 N명". 사용자 지정 이름(`rooms.name`) 있으면 그 이름 우선(현행 `displayLogName` 유지), 없을 때 폴백을 이 멤버-기반 파생으로 교체.
5. **author→멤버 매핑** — MuklogCard·MuklogDetail 작성자 표시를 멤버 목록의 실 닉/아바타로 매핑. 3명+ 로그 대응. 탈퇴자(createdBy NULL) graceful 유지.
6. **§5 카드 변경**: LogCard(LogListScreen) 아바타 겹침 제거(제목+MemberBadge만). MuklogCard 작성자 줄 제거(상세 MuklogDetail의 작성자+날짜는 유지).

### Out-of-scope (다음/불필요)
- **아바타 signed URL 발급 — 불필요(아래 §3.4 플래그).** `avatars` 버킷이 public이라 `avatar_url`이 곧 CDN URL. RPC가 값을 그대로 투영하고 `Avatar url=` 로 렌더. (`useLogPreviewUrls` 같은 배치 signed URL 경로 신설 안 함.)
- 멤버 프로필 편집·탈퇴·역할·소유자 표시.
- Realtime 멤버 변동 구독(초대/나가기 즉시 반영) — 진입/refresh 1회 조회만(비용 §8).
- 참여자 블록에서 멤버 탭 → 상세/프로필 시트.
- MemberBadge·정원(S5a 완료), FoodCover·인앱 액센트·기타 카피(불변).

## 3. 데이터 · API 계약

### 3.1 신규 RPC `list_room_members(p_room_id uuid)` — SECURITY DEFINER
마이그레이션 신규 파일 `supabase/migrations/{YYYYMMDDHHMMSS}_list_room_members.sql`(사용자가 `supabase db push`로 적용). **기존 마이그레이션 편집 금지 — 신규 파일**(`get_room`/`rename_room` 패턴 그대로).

- **시그니처**: `list_room_members(p_room_id uuid) returns table (user_id uuid, nickname text, avatar_url text)`.
- **언어/보안**: `language sql` 불가(멤버십 검사 필요 시 raise) → **`language plpgsql`, `security definer`, `set search_path = public`**. (권한 검사 후 `return query`.)
- **본문 순서(보안 핵심 C4-RLS, get_room과 동일)**:
  1. `v_uid := auth.uid()`; null → `raise exception 'NOT_AUTHENTICATED'`.
  2. 로그 존재 확인(`exists(select 1 from rooms where id = p_room_id)`); 없으면 `raise exception 'ROOM_NOT_FOUND'`.
  3. **호출자 멤버십 명시 검사**: `not exists(select 1 from room_members where room_id=p_room_id and user_id=v_uid)` → `raise exception 'NOT_A_MEMBER'`. **이 검사가 프라이버시 격리의 핵심** — 없으면 임의 room_id로 타인 멤버 프로필 유출.
  4. `return query select m.user_id, p.nickname, p.avatar_url from room_members m join profiles p on p.id = m.user_id where m.room_id = p_room_id order by m.joined_at asc;`
- **반환 shape (snake)**: `[{ user_id: uuid, nickname: text|null, avatar_url: text|null }]`. 최대 5행(정원 5). `nickname`/`avatar_url`은 nullable(미설정 프로필 → 클라 폴백). `joined_at asc` 정렬(생성자=첫 행, 킷 i===0=나 ring 가정과 별개로 클라가 meId로 "나"를 판정).
- **권한**: `revoke all ... from public, anon; grant execute ... to authenticated;`.
- **에러 토큰**: `NOT_AUTHENTICATED` / `ROOM_NOT_FOUND` / `NOT_A_MEMBER` — **모두 기존 `errors.ts` `ROOM_ERROR_MESSAGES`에 존재(신규 토큰 0)**. `mapRoomError`로 매핑. `avatar_url`은 profiles에 저장된 **public URL 원문**(signed URL 아님, §3.4).

### 3.2 훅 `useRoomMembers({ roomId })`
`src/features/room/useRoomMembers.ts` 신규. `useRoom` 정책 계승(진입 1회 + 명시 `refresh`, 폴링·Realtime 0).

- **입력**: `{ roomId: string }`.
- **RoomMember 타입(camel)**: `{ userId: string; nickname: string | null; avatarUrl: string | null }`.
- **RoomMembersState**: `| { status: 'loading' } | { status: 'ready'; members: RoomMember[] } | { status: 'error'; message: string }`.
- **반환**: `{ state: RoomMembersState; refresh: () => Promise<void> }`.
- **매핑 경계**: RPC row(snake) `{ user_id, nickname, avatar_url }` → `{ userId, nickname, avatarUrl }`. `data`가 배열이 아니면 error(BAD_RESPONSE 패턴, `mapRoomError`). 개별 행의 nickname/avatar_url null은 정상(누락 검사에서 제외).
- **호출**: `supabase.rpc('list_room_members', { p_room_id: roomId })` — 인자명 `p_room_id`가 RPC 시그니처와 일치(C3).
- **export**: `src/features/room/index.ts`에 `useRoomMembers`, `RoomMember`, `RoomMembersState` 추가.

### 3.3 author→멤버 매핑 계약
`src/features/muklog/author.ts`에 **순수 함수 신설**(데이터 레벨, 컨벤션 named-args):

```
resolveAuthor({ createdBy, meId, members })
  → { kind: AuthorKind; label: string; nickname: string | null; avatarUrl: string | null; avatarUserId: string | null }
```
- `kind = deriveAuthorKind({ createdBy, meId })`(기존, NULL→Deleted 최우선).
- **members** = `RoomMember[]`(useRoomMembers.ready일 때) 또는 `[]`(미로드 폴백).
- `kind === Deleted` → `{ label: DELETED_AUTHOR_LABEL, nickname: null, avatarUrl: null, avatarUserId: null }`(기존 graceful, members 무관).
- 그 외 `member = members.find(m => m.userId === createdBy)`:
  - `member` 있음 → `nickname = member.nickname ?? defaultNickname({ userId: createdBy })`, `avatarUrl = member.avatarUrl`, `avatarUserId = createdBy`, `label = nickname`(실명 표시). **3명+ 로그도 정확 매핑**(me/partner 이분법 탈피 — createdBy로 직접 조회).
  - `member` 없음(멤버 미로드 or 이미 나간 작성자) → **폴백**: me면 label "내가 기록"·avatarUserId=createdBy, 아니면 label "짝꿍이 기록"(현행 카피)·avatarUserId=createdBy. avatarUrl=null. **회귀 0**(멤버 미로드 시 기존 동작과 동일).
- **소비**: MuklogDetailScreen(작성자 행), MuklogCard는 §2.6에서 작성자 줄 자체 제거이므로 매핑 소비 없음. (MuklogList가 `members`를 MuklogDetail로 전달하거나 상세 화면이 `useRoomMembers`를 자체 호출 — 배선은 developer가 §7 경계 기준으로 택1, 추가 페치 최소화 원칙.)

### 3.4 ⚠️ 아바타 URL 계약 (signed URL 불필요 — 결정 플래그)
- 기획 지시엔 "co-member avatar_url을 signed URL로 해석하는 경로 필요"라고 적혀 있으나, **`avatars` 버킷은 public**(`20260610120000_profile_avatars.sql`: `insert into storage.buckets(...) values('avatars','avatars',true)`, 주석 "비민감 + **추후 파트너 표시 대비** → public=true").
- 따라서 `profiles.avatar_url`은 **`getPublicUrl`로 생성된 직접 렌더 가능 CDN URL**(muklog 사진의 private 버킷과 다름). `list_room_members`가 이 값을 그대로 투영하고, `Avatar url={member.avatarUrl}`로 바로 표시. **signed URL 배치 발급 경로(useLogPreviewUrls류) 신설 안 함** — 비용·복잡도 절감.
- **명시 계약**: 아바타 해석 주체 = 없음(pass-through). RPC=값 전달 / Avatar 컴포넌트=`url` prop 직접 렌더 / 폴백(url null)=`userId`(=member.user_id) 결정적 디폴트 이모지. 이 플래그를 developer가 확인(설계와 정합, architecture §3 profiles 불변).

### 3.5 스키마 변경
- **없음.** `profiles`·`room_members` 컬럼 불변. RLS 정책 불변(`profiles_select_own` 유지 — self-only). co-member read는 오직 DEFINER RPC 경유(RLS를 우회하되 same-room으로 스코프). 신규 = 함수 1개 + grant.

## 4. 화면 · UX

### 4.1 LogScreen 참여자 블록 (신규, 킷 mk-log:79-103)
- 위치: 세그 'log' 본문 상단(현재 `SoloInviteBanner`/`CompactInviteRow` header 슬롯 자리) — 킷대로 세그 아래 "참여자" 헤더 → 멤버 행 → 섹션 헤더("우리 맛집 N"). **wish 세그엔 미렌더**(현행 정책 유지).
- **헤더**: "참여자 {members.length}"(변형 `fieldLabel`/800·14·fg) + "· 최대 5명"(600·12·fgMuted/alt).
- **멤버 행**(gap 16, flexWrap): 각 항목 = `Avatar size=46 ring={member.userId === meId}`(나=ring) + 닉네임(600·12·ink2/fgWeak, maxWidth 50, `numberOfLines={1}` ellipsis, center). 닉 = `member.nickname ?? defaultNickname({ userId })`.
- **초대 버튼**(members.length < 5일 때만): dashed 원(46, accentLine 2px) + plus(accentStrong) + "초대"(700·12·accentStrong). 탭 → 초대코드 클립보드 복사 + 토스트 `"초대코드를 복사했어요 · {code}"`(킷 mk-log:94, tone positive).
- **상태**: loading→플레이스홀더(스켈레톤/스피너 최소, 블록만 자리) / error→블록 숨김 또는 조용한 폴백(리스트 막지 않음, best-effort) / ready→멤버 행.
- **통합/대체**: `SoloInviteBanner`·`CompactInviteRow`·헤더 아바타 겹침(`avatarSlot`의 익명 파트너)은 이 블록 도입으로 **제거/대체**. 초대코드 표시는 참여자 블록의 "초대" 버튼(복사)으로 일원화. (⋯메뉴 RenameDialog의 `extra` 초대코드는 별개 — 유지 여부는 developer가 킷 대조, 킷 mk-log:154는 솔로만 extra.)

### 4.2 로그 제목
- 헤더 타이틀(`LogTitleButton`) = `displayLogName` 유지하되 **폴백 경로를 멤버-기반으로**: `rooms.name` 있으면 그 이름 / 없으면 `mkLogTitle` 규칙(1명 "{나}의 기록" / 2명 "A · B" / 3명+ "A 외 N명"). 헤더 아바타 겹침(avatarSlot) 제거(참여자 블록으로 이동).
- 순수 유틸 `logTitleFromMembers({ name, members, meId, selfNickname })` 신설 권장(테스트 용이) — `displayLogName`을 확장하거나 래핑.

### 4.3 LogCard(LogListScreen)
- 아바타 겹침(`avatarStack` = 본인 + 익명 짝꿍) **제거**. 제목(`displayLogName`) + `MemberBadge` + "시작일" + chevron만. `cardHeaderBody`가 좌측 정렬로 채움.
- **주의**: LogListScreen은 `list_my_rooms`만 쓰고 멤버 프로필을 안 받는다 → LogCard 제목은 현행 `displayLogName`(본인 닉 폴백) 유지(멤버 이름 파생은 LogScreen 진입 후에만, RPC N회 방지). 카드에서 멤버 실명 파생 안 함(비용 §8).

### 4.4 MuklogCard
- **작성자 행 제거**(킷 MuklogCard는 작성자 줄 없음 — mk-log:180-213 확인). `authorRow` + Avatar + 라벨 삭제. `deriveAuthorKind`/`authorAvatarUserId` import도 카드에선 제거.

### 4.5 MuklogDetail
- 작성자 행 **유지 + 실 멤버 매핑으로 강화**(§3.3 resolveAuthor). 라벨 = 실 닉네임(멤버 매핑 시) / 폴백 "짝꿍이 기록"·"내가 기록"(미로드) / "탈퇴한 사용자"(NULL). 아바타 = `url = resolved.avatarUrl` (없으면 `userId=resolved.avatarUserId` 디폴트). 날짜 표시 불변.

### 원티드 토큰 사용 지점
- 참여자 블록: `spacing[16]`(행 gap)·`spacing[12]`(헤더 marginBottom), 텍스트 변형(fieldLabel/meta/badge), `color.fg`/`fgMuted`/`fgWeak`/`accentStrong`/`accentLine`, `radius.full`(초대 원), Avatar size 46. raw hex 0.

## 5. 작업 목록 (각 인수조건 포함)

- [ ] **T1. `list_room_members` 마이그레이션** — 인수조건: DEFINER 함수가 (a) 미인증→NOT_AUTHENTICATED, (b) 없는 room→ROOM_NOT_FOUND, (c) 비멤버 호출자→NOT_A_MEMBER, (d) 멤버 호출자→해당 로그 멤버들의 `{user_id,nickname,avatar_url}` 반환(joined_at asc, 최대 5행). grant authenticated·revoke anon/public. — 테스트: SQL 리뷰(라이브 적용은 사용자) + 훅 모킹으로 shape 검증.
- [ ] **T2. `useRoomMembers` 훅** — 인수조건: roomId 진입 1회 rpc('list_room_members',{p_room_id}) 호출, 성공→`ready{members}`(snake→camel 매핑), 에러→`error{message}`(mapRoomError), 배열 아님→error. 폴링 없음. — 테스트: supabase.rpc 모킹(정상 배열/에러/비배열/빈배열), 인자 p_room_id 단언.
- [ ] **T3. `resolveAuthor` 유틸** — 인수조건: members에 createdBy 있으면 실 닉/아바타·label=닉 / 없으면 me/partner 폴백 카피 / createdBy NULL→Deleted(members 무관). 3명+ 케이스 정확 매핑. — 테스트: author.spec에 케이스(멤버매칭·미매칭 me·미매칭 partner·NULL·nickname null→defaultNickname).
- [ ] **T4. `logTitleFromMembers` 유틸** — 인수조건: name 있으면 name / 1명→"{나}의 기록" / 2명→"A · B" / 3명+→"A 외 (N-1)명". meId로 "나" 판정, 닉 null→defaultNickname. — 테스트: 1·2·3·5명 + name 지정 케이스.
- [ ] **T5. LogScreen 참여자 블록 배선** — 인수조건: useRoomMembers.ready→"참여자 N"+"· 최대 5명"+멤버 행(각 아바타+닉, 나=ring); members<5→"초대" 버튼 렌더(탭→클립보드 복사+토스트); members===5→초대 버튼 미렌더. 솔로 배너/커플 컴팩트 행/헤더 익명 파트너 아바타 미렌더(대체됨). — 테스트: LogScreen.spec에 useRoomMembers 모킹(1·2·5명), 초대버튼 분기·토스트 호출·구 배너 부재 단언.
- [ ] **T6. 로그 제목 멤버 파생** — 인수조건: name 없는 로그에서 헤더 제목이 1/2/3+명 규칙대로. — 테스트: LogScreen.spec 헤더 텍스트(2명 "A · B", 3명 "A 외 2명").
- [ ] **T7. LogCard 아바타 제거** — 인수조건: LogCard에 avatar-image/avatar-default/avatar-anonymous testID 없음(제목+MemberBadge+시작일+chevron만). — 테스트: LogListScreen.spec에서 카드 내 아바타 부재 단언(queryByTestID null).
- [ ] **T8. MuklogCard 작성자 줄 제거** — 인수조건: MuklogCard에 authorRow/작성자 라벨("내가 기록" 등)·작성자 Avatar 없음. 커버/제목/별점/위치/메모는 유지. — 테스트: MuklogCard.spec에서 "내가 기록"/"짝꿍이 기록" queryByText null, 커버·제목 존재 단언.
- [ ] **T9. MuklogDetail 작성자 실명 매핑** — 인수조건: 멤버 로드 시 작성자 라벨=실 닉·아바타=실 avatar_url(있으면). 미로드/탈퇴 폴백 유지(회귀 0). 날짜 유지. — 테스트: MuklogDetail.spec에 resolveAuthor 결과 반영(실닉 표시·NULL→"탈퇴한 사용자").
- [ ] **T10. index export + spec 갱신** — 인수조건: `useRoomMembers`/`RoomMember`/`RoomMembersState` export, 관련 spec 갱신, `npm test` green + `npx tsc --noEmit` 0.

## 5-1. 테스트 케이스 (TDD)

**단위(유틸·훅·화면) — jest-expo + @testing-library/react-native**
- `resolveAuthor`(T3): ① members에 createdBy 매칭 → 실 닉 label·avatarUrl. ② 매칭·nickname null → defaultNickname 폴백. ③ 미매칭 & createdBy===meId → "내가 기록". ④ 미매칭 & 다른 uid → "짝꿍이 기록". ⑤ createdBy NULL → "탈퇴한 사용자"(members 무관). ⑥ 3명 로그: 서로 다른 두 멤버 작성 글이 각각 다른 닉으로.
- `logTitleFromMembers`(T4/경계): 1명·2명·3명·5명 + name 지정 우선 + 닉 null 폴백.
- `useRoomMembers`(T2): 정상 배열(매핑)·빈 배열(ready empty)·에러 토큰(NOT_A_MEMBER→한국어)·비배열 응답(error)·인자 `p_room_id` 전달 단언.
- LogScreen(T5/T6): members 1명(초대 버튼 O·"참여자 1"·솔로 배너 부재)·2명("A · B"·초대 O)·5명(초대 버튼 X)·error(블록 폴백, 리스트 정상).
- LogCard(T7): 아바타 testID 3종 부재.
- MuklogCard(T8): 작성자 라벨·Avatar 부재, 커버/제목 존재.
- MuklogDetail(T9): 실 닉 표시·NULL 탈퇴자·me/partner 폴백.

**모킹/스모크 대상(SQL·RPC — 단위테스트 경계 밖, `docs/testing-strategy.md`)**
- `list_room_members` SQL(T1): 코드 리뷰로 보안 4단계·grant 검증. RLS 프라이버시(비멤버 차단)는 **라이브 스모크**(사용자 `db push` 후): 멤버 A가 `list_room_members(room)` 정상 / 비멤버 B가 동일 room_id 호출 시 NOT_A_MEMBER(빈/에러). 훅 레벨은 rpc 모킹으로 계약 shape만.

## 6. 엣지케이스
- **1명(솔로 로그)**: 참여자 블록 "참여자 1 · 최대 5명" + 나 아바타(ring) + 초대 버튼. 제목 "{나}의 기록". 상세 작성자=나("내가 기록" or 실 닉).
- **5명 만석**: 초대 버튼 **숨김**(members.length < 5 false). 멤버 행 5개 flexWrap 줄바꿈.
- **탈퇴자 작성 글**: `muklogs.created_by NULL`(ON DELETE SET NULL) → 상세 "탈퇴한 사용자" + 익명 아바타(회귀 0). 참여자 블록엔 탈퇴자 미표시(room_members에서 이미 제거됨 — 나간/탈퇴는 멤버십 행 삭제).
- **아바타 없음**: `avatar_url` null → `Avatar userId=` 결정적 디폴트 이모지(크래시 0). 닉만 있는 멤버·둘 다 없는 멤버 모두 폴백 체인 존재.
- **닉 길이(ellipsis)**: 긴 닉네임 → maxWidth 50 + numberOfLines 1 ellipsis(레이아웃 안 깨짐). 킷 값 정확 재현.
- **닉 미설정 멤버**: `nickname null` → `defaultNickname({ userId })`(동물명+숫자, 화면 간 동일 신원). 제목/블록/상세 일관.
- **동시성(커플 2명)**: 한쪽이 초대로 3번째 멤버 합류 → 상대 화면은 다음 진입/refresh 시 반영(Realtime OUT — 즉시 동기화 안 함, 의도적). 나가기도 동일.
- **권한/RLS**: 비멤버가 임의 room_id로 `list_room_members` 호출 → NOT_A_MEMBER(프라이버시 격리). 미인증 → NOT_AUTHENTICATED.
- **네트워크 실패**: RPC 실패 → 참여자 블록 error 폴백(리스트/화면 막지 않음, best-effort). 상세 작성자=멤버 미로드 폴백(me/partner 카피).
- **멤버 로드 지연 vs 리스트**: 참여자 블록 loading 중에도 먹로그 리스트는 독립 렌더(블록만 자리 유지). 상세 진입 시 멤버 미로드면 폴백 카피 후 로드되면 실명(깜빡임 허용, 크래시 0).
- **입력 한계**: 정원 5(S5a) — 6번째 조인은 join_room이 ROOM_FULL(본 스프린트 무관, 표시만).

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)
1. `list_room_members` SQL 반환 컬럼(snake `user_id/nickname/avatar_url`) ↔ `useRoomMembers` 매핑(camel). 컬럼명·nullable 정합.
2. `useRoomMembers` state shape ↔ LogScreen 참여자 블록·`logTitleFromMembers`·(상세)resolveAuthor 소비. `members` 배열·null 안전.
3. RPC 에러 토큰(NOT_AUTHENTICATED/ROOM_NOT_FOUND/NOT_A_MEMBER) ↔ `errors.ts` ROOM_ERROR_MESSAGES(모두 기존 — 신규 토큰 0 확인).
4. `list_room_members` 멤버십 검사(C4-RLS) ↔ 프라이버시 요구(비멤버 임의 room_id 차단) — get_room/rename_room 동일 패턴 대조.
5. `avatar_url` = profiles public URL ↔ Avatar `url` 직접 렌더(signed URL 미개입, §3.4 플래그) — private 버킷 오인 없는지.
6. `resolveAuthor`(멤버 매핑) ↔ MuklogDetail 작성자 행 + `deriveAuthorKind` NULL graceful(기존) 정합. 3명+ 매핑.
7. 킷 mk-log:79-103 참여자 블록 ↔ RN 구현(아바타 46·ring i0·닉 maxWidth50 ellipsis·초대 dashed 원·"· 최대 5명" 카피) — **qa-visual 담당**.
8. 킷 MuklogCard(작성자 줄 없음)·LogCard(아바타 없음) ↔ RN 제거 후 — **qa-visual 담당**.
9. 구 UI(SoloInviteBanner·CompactInviteRow·헤더 익명 파트너 아바타) 제거 ↔ 참여자 블록 통합 — 회귀/중복 노출 없는지(qa-logic).

## 8. 비용 · 보안 가드레일 체크
- **RPC 호출 1회/로그**: `useRoomMembers`는 LogScreen 진입(roomId 변경) 1회 + 명시 refresh만(useRoom 정책 계승). **폴링·Realtime 0.** LogList 카드에선 멤버 프로필 조회 안 함(list_my_rooms만 — RPC N회 방지).
- **반환 최대 5행**(정원 5) — 페이로드 상한 고정.
- **signed URL 신설 0**(public 버킷 pass-through, §3.4) — Storage 서명 호출·배치 발급 경로 없음.
- **DEFINER 프라이버시**: same-room 스코프 멤버십 검사 필수(비멤버 차단). profiles self-only RLS 불변(우회는 스코프된 RPC로만).
- **Kakao 호출 0 / AWS 미사용** — 본 기능 무관(순수 프로필 표시). Supabase 무료 티어 내.
- **재빌드 불필요**(순수 JS + RPC) — 단 멤버 표시는 사용자 `supabase db push`(list_room_members 적용) 후 라이브 유효. 완료 기준에 포함.

## 9. 역할 분담
- **developer**: `list_room_members` 마이그레이션(SQL, get_room 패턴) · `useRoomMembers` 훅 · `resolveAuthor`/`logTitleFromMembers` 유틸 · LogScreen 참여자 블록 배선 + 구 배너/헤더 아바타 제거 · LogCard 아바타 제거 · MuklogCard 작성자 줄 제거 · MuklogDetail 작성자 매핑 · index export · 테스트(Red→Green).
- **ui-publisher**: 참여자 블록 비주얼 충실도(킷 mk-log:79-103 — 아바타 46/ring/gap16/flexWrap/닉 ellipsis/"· 최대 5명"/초대 dashed 원·plus·accentStrong) · `mkLogTitle` 카피 정합 · LogCard·MuklogCard 카드 비주얼(제거 후 레이아웃) · 토큰 매핑(raw hex 0).
- **qa-logic**: RPC 보안(비멤버 차단·에러 토큰)·훅 매핑·resolveAuthor 3명+·경계면 §7(1-6·9)·비용/프라이버시 가드레일·회귀.
- **qa-visual**: §7(7·8) 킷↔RN 비주얼 충실도.

## 10. 완료 기준
- T1~T10 인수조건 + `npm test` 전체 green + `npx tsc --noEmit` 0.
- qa-report-logic(RPC 프라이버시·매핑·매핑 정확·회귀) + qa-report-visual(참여자 블록·카드 킷 충실) PASS.
- **사용자가 `list_room_members` 마이그레이션 `supabase db push`** + 라이브 스모크(멤버 조회 정상·비멤버 차단). 앱 코드 재빌드 불필요.

## 11. 설계 문서 정합 (플래그)
- architecture §3: "멤버 실명·아바타 노출·참여자 블록은 S5b" 예고 이미 있음 — 본 스프린트가 그 구현. 정원 5·MemberBadge "N명"은 S5a에서 §3 반영 완료. **어긋남 없음.**
- **avatar signed URL 불필요**는 §3.4 플래그로 명시(기획 지시의 "signed URL 경로" 가정을 public 버킷 실측으로 정정 — developer 확인 요망). architecture §3 profiles 불변.
- 본 스프린트 완료 후 architecture §5 백로그에 S5b(members-display) 행 추가·§3 참여자 블록 서술 갱신 권장(developer/문서 담당).
