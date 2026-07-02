# ui-spec — members-display (S5b) · 퍼블리싱 1단계 (ui-publisher)

디자인 단일 출처: 킷 `.claude/skills/ui-design/templates/muklog/` — `mk-log.jsx:79-103`(참여자 블록)·`mk-ui.jsx:272`(mkLogTitle)·`mk-log.jsx:180-213`(MuklogCard, 작성자 줄 없음)·킷 LogCard(`mk-home.jsx`, 카드 아바타 없음).

본 1단계 = **비주얼 shell + 순수 유틸**만. LogScreen 참여자 블록 배선·RPC·useRoomMembers·resolveAuthor·MuklogDetail 매핑은 **developer 2단계**. 아래 "props/유틸 계약"을 그대로 소비하라.

---

## 1. ParticipantBlock (신규) — 킷 mk-log:79-103 ↔ RN 매핑

파일: `src/features/room/components/ParticipantBlock.tsx` (콜로케이션) + `.spec.tsx`. export: `@/features/room` 배럴에 `ParticipantBlock`, `ParticipantBlockProps` 추가.

presentational — **useRoomMembers 호출 안 함**. 데이터는 props 주입.

### props 계약 (developer 배선용)
```ts
type ParticipantBlockProps = {
  members: RoomMember[];   // joined_at asc. useRoomMembers.ready → members
  meId: string;            // 현재 uid — meId 매칭 멤버에 ring
  canInvite: boolean;      // = members.length < 5 (만석이면 초대 버튼 숨김)
  onInvite: () => void;    // 탭 콜백 — 클립보드 복사 + 토스트는 developer 배선
};
```
- `RoomMember` = `{ userId: string; nickname: string | null; avatarUrl: string | null }` — `@/features/room`에서 export(아래 §5). developer의 `useRoomMembers` 반환 타입과 **동일 shape이어야 한다**(계약 단일 출처).
- **loading/error 상태는 상위(LogScreen)가 소유**: ready일 때만 이 블록 렌더, error/loading이면 미렌더/폴백(plan §4.1 best-effort). 블록 자체는 상태 분기 없음.
- `onInvite`는 순수 콜백 — 초대코드(`log.inviteCode`)·클립보드·토스트 `"초대코드를 복사했어요 · {code}"`(킷 mk-log:94, tone positive)는 developer가 LogScreen에서 배선.

### 킷 라인 ↔ RN 매핑 (qa-visual 대조용)
| 킷 mk-log | 요소 | RN |
|---|---|---|
| :81 `padding "12px 20px 2px"` | 블록 패딩 | `paddingTop spacing[12]` · `paddingHorizontal spacing[20]` · `paddingBottom spacing[2]` |
| :82 헤더 행 `baseline, gap 7, marginBottom 12` | 헤더 | `flexDirection row, alignItems 'baseline', gap spacing[7], marginBottom spacing[12]` |
| :83 `"참여자 N"` 800/14 mk-ink | 헤더 좌 | `Text variant="participantHeader" color="fg"` (신규 토큰 800/14) |
| :84 `"· 최대 5명"` 600/12 text-alternative | 헤더 우 | `Text variant="participantMeta" color="fgMuted"` (신규 토큰 600/12) |
| :86 멤버 행 `gap 16, flexWrap, flex-start` | 행 | `flexDirection row, flexWrap 'wrap', gap spacing[16], alignItems 'flex-start'` |
| :88 항목 `column, gap 6, width 50` | 각 항목 | `flexDirection column, alignItems center, gap spacing[6], width 50` |
| :89 `AV2 size 46 ring={i===0}` | 아바타 | `Avatar size 46 ring={member.userId === meId}` — **킷 i===0 대신 meId 판정**(RPC joined_at asc라 생성자=첫 행 ≠ 항상 나. plan §3.1 주석 준수, 킷보다 정확) |
| :90 닉 600/12 mk-ink2, maxWidth50, center, ellipsis | 닉 | `Text variant="participantMeta" color="fgWeak" numberOfLines={1} style={{maxWidth:50, textAlign:'center'}}` · 폴백 `defaultNickname({userId})` |
| :93 `length < 5` | 초대 버튼 조건 | `canInvite` prop (developer가 `members.length < 5` 주입) |
| :95 dashed 원 46, `2px dashed --mk-accent-line`, radius 999 | 초대 원 | `View width/height 46, borderRadius radius.full, borderWidth 2, borderStyle 'dashed', borderColor color.accentLine` |
| :96 `plus 20 --mk-accent-strong` | plus | `Icon name={IconName.Plus} size 20 color="accentStrong"` |
| :98 `"초대"` 700/12 --mk-accent-strong | 라벨 | `Text variant="participantInvite" color="accentStrong"` (신규 토큰 700/12) |

testID: `participant-block`, `participant-invite`.

### RN 미재현/근사 (사유)
- 킷 `i===0` ring → **meId 매칭 ring**으로 대체(근사 아님, 개선). joined_at asc 정렬에서 첫 행이 생성자라 "나"와 불일치할 수 있으므로 meId로 판정(plan §3.1·§6 준수).
- 아바타 표시 우선순위는 기존 `Avatar` 프리미티브 그대로: `avatarUrl`(public URL, plan §3.4 pass-through) → `userId` 결정적 디폴트(이모지+컬러) → 익명. raw hex 0.

---

## 2. logTitleFromMembers (순수 유틸) — 킷 mkLogTitle mk-ui:272

파일: `src/features/room/logName.ts` 확장(기존 `displayLogName` 옆). export: `@/features/room`에 `logTitleFromMembers`, `RoomMember`.

### 계약 (developer 소비용)
```ts
logTitleFromMembers({
  name: string | null,      // rooms.name — 있으면 무조건 우선
  members: RoomMember[],    // joined_at asc. 빈 배열 = 미로드
  meId: string,             // 1명일 때 "나" 판정
  selfNickname: string | null,
}): string
```
규칙(킷 mk-ui:272 정합):
- `name` 있음 → `name` (현행 rooms.name 우선 유지)
- `members` 0(미로드) → `displayLogName` 폴백으로 회귀(**회귀 0**, 솔로 취급)
- 1명 → `"{나}의 기록"` (selfNickname 우선 → me 멤버 닉 → `defaultNickname(meId)`)
- 2명 → `"A · B"` (joined_at asc 순서)
- 3명+ → `"A 외 (N-1)명"`
- 닉 null 멤버 → `defaultNickname({ userId })` 폴백(#3, 화면 간 신원 일관)

developer 배선(plan §4.2): 헤더 `LogTitleButton` 제목을 `displayLogName` → `logTitleFromMembers`로 교체(name 우선은 동일). 이 유틸은 로직성이 강하니 **developer가 최종 소유·배선**해도 됨(계약은 위 시그니처 고정). 단위 테스트 7종(name·1·2·3·5명·닉null·미로드) 통과.

---

## 3. LogCard 아바타 제거 — 킷 LogCard(아바타 없음)

파일: `src/navigation/screens/LogListScreen.tsx`.
- `LogCard` 헤더의 `avatarStack`(본인 디폴트 + 커플이면 익명 파트너 겹침) **제거**. 제목(`displayLogName` **현행 유지**)+`MemberBadge`+"시작일"+chevron만 좌측 정렬.
- 제거된 심볼: `CARD_AVATAR_SIZE` 상수, `avatarStack` 스타일, `isCouple` 지역변수. `Avatar` import는 **유지**(empty-hero self 아바타 62px가 사용).
- **제목은 멤버 실명 파생 안 함** — LogList는 `list_my_rooms`만 쓰고 멤버 프로필 미보유(RPC N회 방지, plan §4.3·§8). `displayLogName`(self 닉 폴백) 그대로.
- spec: LogCard 내 `avatar-default`/`avatar-image`/`avatar-anonymous` testID **부재** 단언(커플·솔로 둘 다). 제목·배지 존재 유지.

---

## 4. MuklogCard 작성자 줄 제거 — 킷 mk-log:180-213(작성자 줄 없음)

파일: `src/features/muklog/MuklogCard.tsx`.
- 작성자 행(`authorRow` = `Avatar` + 라벨 "내가 기록/짝꿍이 기록/탈퇴한 사용자") **제거**. 커버·제목·별점·위치줄·메모 2줄 **유지**.
- 제거된 import: `Avatar`(카드에선 미사용), `AuthorKind`·`DELETED_AUTHOR_LABEL`·`authorAvatarUserId`·`deriveAuthorKind`. `AUTHOR_AVATAR_SIZE` 상수·`authorRow` 스타일 제거.
- `meId` prop은 **props 타입에 유지**(MuklogList 배선 계약·MuklogDetail 작성자 매핑 대비)하되 **카드는 미소비**(destructure 안 함 → unused 없음). MuklogList 콜사이트 무변경.
- `author.ts`는 **그대로 유지**(MuklogDetail이 resolveAuthor에서 소비 — developer 2단계). 카드만 소비 중단.
- spec: `avatar-default`/`avatar-anonymous`/`avatar-image` 부재 + "내가 기록"/"짝꿍이 기록"/"탈퇴한 사용자" 텍스트 부재 + 커버(food-cover-gradient)·제목 존재 단언.

---

## 5. 토큰 변경 — `src/theme/tokens.ts`

신규 typography 역할 토큰 3종(킷 mk-log:83-98 실수치 정합, raw hex/숫자 0):
| 토큰 | 값 | 킷 근거 |
|---|---|---|
| `participantHeader` | 800/14, lh 17(1.2), SUIT-Bold | mk-log:83 "참여자 N"(한글 클리핑 해소, 킷 lh1) |
| `participantMeta` | 600/12, lh 14(1.2), SUIT-SemiBold | mk-log:84 "· 최대 5명"(text-alternative) · mk-log:90 멤버 닉(mk-ink2, 1줄 ellipsis) — 겸용 |
| `participantInvite` | 700/12, lh 14(1.2), SUIT-Bold | mk-log:98 "초대"(accent-strong) |

색은 **전부 기존 토큰 경유**(신규 색 0): `fg`(mk-ink)·`fgMuted`(text-alternative)·`fgWeak`(mk-ink2)·`accentStrong`(mk-accent-strong)·`accentLine`(mk-accent-line)·`radius.full`. tokens.spec의 `Object.values(typography)` SUIT- 전수 검사 통과.

RoomMember 타입도 `logName.ts`에 정의·export(§2 계약).

---

## 6. 변경/신규 파일 목록

신규:
- `src/features/room/components/ParticipantBlock.tsx` · `ParticipantBlock.spec.tsx`

수정:
- `src/features/room/logName.ts` (+ `logTitleFromMembers`, `RoomMember` 타입) · `logName.spec.ts` (+7 케이스)
- `src/features/room/index.ts` (+ `logTitleFromMembers`, `RoomMember`, `ParticipantBlock`, `ParticipantBlockProps` export)
- `src/theme/tokens.ts` (+ participantHeader/Meta/Invite 3 토큰)
- `src/navigation/screens/LogListScreen.tsx` (LogCard 아바타 제거) · `LogListScreen.spec.tsx` (아바타 부재 단언)
- `src/features/muklog/MuklogCard.tsx` (작성자 줄 제거) · `MuklogCard.spec.tsx` (작성자 부재 단언)

---

## 7. developer 인계 (2단계 소비 계약 요약)

1. **`RoomMember`** = `{ userId; nickname: string|null; avatarUrl: string|null }` — `useRoomMembers`가 이 shape로 매핑(snake→camel). `@/features/room`에서 이미 export됨. **useRoomMembers.ts는 이 타입을 re-export하거나 동일 정의로 통일**(중복 정의 금지).
2. **ParticipantBlock** — LogScreen 'log' 세그에서 `useRoomMembers.ready`일 때 `<ParticipantBlock members meId canInvite={members.length<5} onInvite={복사+토스트} />`. loading/error는 미렌더/폴백(상위 소유). 구 `SoloInviteBanner`/`CompactInviteRow`/헤더 익명 파트너 아바타 제거(대체).
3. **logTitleFromMembers** — `LogTitleButton` 제목 파생을 이 유틸로 교체(name 우선). developer 최종 소유 가능(계약 고정).
4. **MuklogCard.meId** — props 유지(미소비). MuklogDetail 작성자 매핑(resolveAuthor)은 developer가 별도 배선.
5. 신규 토큰 3종은 tokens에 이미 반영 — developer 추가 작업 없음.

## 8. 완료 상태 (1단계)
- `npm test` 전체 **1421 pass / 151 suites green**. `npx tsc --noEmit` **0 error**.
- raw hex/숫자 색 0. 화살표·named-args 컨벤션 준수. git 미수행.
- qa-visual 대조 포인트: §1 표(킷 mk-log:79-103 ↔ ParticipantBlock) · §3 LogCard 아바타 부재 · §4 MuklogCard 작성자 줄 부재.
