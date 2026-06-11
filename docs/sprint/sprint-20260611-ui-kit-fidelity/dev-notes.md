# Dev Notes — ui-kit-fidelity 스프린트 (developer / Task #4)

> 역할: 데이터·로직 배선. 비주얼·프리미티브·화면 골격은 ui-publisher 영역.
> 기준: plan.md(§3 데이터 계약, §5 작업목록) + 리더 결정(무백엔드 UI-only).
> **백엔드 변경 0건** — DDL·RPC·쿼리 추가 없음. 기존 훅 shape 그대로 사용.

---

## 1. 신규 순수 유틸 (백엔드 무관, 화면 props와 독립 — 선행 완료)

### 1.1 `src/features/profile/avatarDefault.ts` ✅ (plan §3.2, A5 / QA Q5)
결정적 디폴트 아바타 — avatarUrl 없는 프로필에 userId 해시로 안정적 이모지+컬러 부여(DB 저장 없음).
- **API**: `defaultAvatar({ userId?: string|null }) → { emoji, color }`. 빈/null/undefined → 팔레트 0번 폴백(throw 없음).
- **상수**: `AVATAR_EMOJIS`(12 동물 페이스), `AVATAR_COLORS`(12색, **도메인 데이터라 raw hex 허용** — plan §3.2. 토큰 아님). 같은 인덱스 페어.
- **결정성**: 같은 userId → 항상 동일. 해시 = 31진 다항 + |0(32비트, 플랫폼 무관).
- **생산자 → 소비자**: `avatarDefault.ts` → **ui-publisher Avatar.tsx**(url 없을 때 내부 파생, plan §3.4) / MuklogCard(createdBy를 userId로) / 각 화면.
- **테스트**: `avatarDefault.spec.ts` 9/9 통과(팔레트 페어링·결정성·다양성·폴백).
- **전달**: ui-publisher에 import 계약 SendMessage 완료(2026-06-11).

### 1.2 `src/features/muklog/filterByCategory.ts` ✅ (plan §5 B2 / QA Q7)
LogScreen 카테고리 필터 칩 행의 순수 로직(선택 state는 화면 보유).
- **API**:
  - `muklogCategoriesInUse({ muklogs }) → MuklogCategoryKey[]` — 리스트에 존재하는 카테고리만, `MUKLOG_CATEGORY_KEYS`(킷 정의) 순서, 중복/null/미지 제외.
  - `filterMuklogsByCategory({ muklogs, category }) → Muklog[]` — category=null("전체")이면 원본 참조 반환.
- **생산자 → 소비자**: `useMuklogs`(보유) → 이 유틸 → **ui-publisher LogScreen 골격**(Chip 행 + 필터된 리스트).
- **테스트**: `filterByCategory.spec.ts` 6/6 통과.

### 1.3 `src/features/profile/profileStats.ts` ✅ (plan §5 B3 / QA Q8)
ProfileScreen 통계 3칸 — 보유 데이터(useMyLogs)만.
- **API**: `computeProfileStats({ logs }) → { logCount, coupleCount, spotCount: null }`. `SPOT_COUNT_UNAVAILABLE = null`(맛집 총합 집계 미보유 → 화면 "-" 표기, 차기 백엔드).
- **파생 규칙**: coupleCount = memberCount≥2 수(mode 컬럼 아님, plan 함정3).
- **생산자 → 소비자**: `useMyLogs`(보유) → 이 유틸 → **ui-publisher ProfileScreen 골격**(통계 카드 3칸).
- **테스트**: `profileStats.spec.ts` 4/4 통과.

**소계: 신규 유틸 3종 / 테스트 19 통과 / tsc 0 에러.**

---

## 2. 화면 배선 (ui-publisher 골격 도착 후 — 대기/진행 중)

> 게이팅: ui-spec.md props 계약 + 프리미티브(Task #2)·화면 골격(Task #3) 도착 화면부터.
> 핸드오프 순서(team-lead 확정): B1 MuklogCard → B3 ProfileScreen → B5 시트 → B4 LogListScreen → B2 LogScreen.

### B1 MuklogCard ✅ (ui-publisher 골격에 배선 포함, props 불변)
- `Avatar userId={muklog.createdBy}` → `defaultAvatar` 결정적 익명 아바타(작성자별 안정). `authorLabel = createdBy===meId ? '내가 기록' : '짝꿍이 기록'`. `FoodCover category={muklog.category}`.
- props 계약(muklog+meId) 불변 → MuklogList 카드 바인딩 변경 없음. 테스트 10/10 green.
- 참고: 본인 글 avatarUrl 이미지 표시는 plan §3.3 "가능"(선택) — B1 AC는 createdBy 디폴트 파생만 요구하므로 디폴트-only로 충족(스코프 내).
- **QA Q6 ✅ 통과**(2026-06-11): 생산자(types.ts Muklog) ↔ 소비자(MuklogCard) 경계면 정합, createdBy non-null 보장, 결측 4종 처리, snake→camel 일관, props 불변. 경계면 이슈 0.

### B3 ProfileScreen ✅ (ui-publisher 골격 → developer 데이터 배선)
- **아바타**: `<Avatar url={profile.avatarUrl} userId={userId} size={96}>` — url 우선/없으면 userId 디폴트 이모지. 카메라 배지 Pressable → 기존 `changeAvatar`(이미지 업로드 동선 유지). → **ProfileScreen.spec red 1건 해소**(이제 url 없으면 `avatar-default`, nickname null 빈상태도 `avatar-default`).
- **닉네임**: 펜슬 → Sheet(prefill·validateNickname·canSave·saveNickname→refresh). 기존 로직 시트로 이전.
- **통계 3칸**: `computeProfileStats({ logs })`(useMyLogs.logs)로 **일원화**(ui-publisher 인라인 계산 → 테스트된 단일 출처로 교체). 로그수=logs.length / 기록한 맛집=spotCount(null)→"-" / 커플=memberCount≥2.
  - ⚠️ 이때 `ProfileScreen.spec.tsx`의 `@/features/profile` 모킹 팩토리에 `jest.requireActual('.../profileStats')` 추가(computeProfileStats가 undefined가 되지 않도록). profileStats는 MyLog를 type-only import → supabase/room 런타임 미연결이라 requireActual 안전.
- **데이터 소스 확인**(ui-publisher 질의 응답): 통계 소스=useMyLogs(memberCount 보유) 의도 정확. logCount/coupleCount/spotCount 계산 plan §B3 일치.
- **생산자 → 소비자**: useProfile(nickname/avatarUrl)·useUpdateProfile(save/change)·useMyLogs(logs) → ProfileScreen. computeProfileStats(profile feature) → 통계 카드.
- **검증**: ProfileScreen.spec 13/13, 전체 스위트 331/331 green, tsc 0. **이전 red 1건 완전 해소**.
- **파일 점유 해제**: ProfileScreen.tsx + spec 편집 완료(ui-publisher에 반환).

| 화면 | 배선 내용 | 생산자 → 소비자 | 상태 |
|---|---|---|---|
| B1 MuklogCard | Avatar `userId=createdBy` 파생, meId 분기 라벨 | useMuklogs → MuklogCard | ✅ 완료(배선 정합 확인) |
| B2 LogScreen+MuklogList | 카테고리 필터 state + filterByCategory(MuklogList), 로그명/헤더/컴팩트 코드(LogScreen 검증) | useRoom+useProfile+useMuklogs → LogScreen/MuklogList | ✅ 완료 |
| B3 ProfileScreen | computeProfileStats(logs 전달), 카메라 배지→기존 changeAvatar | useProfile+useMyLogs → ProfileScreen | ✅ 완료 |
| B4 LogListScreen | 본인 아바타 userId, MemberBadge memberCount, 파트너 익명 | useMyLogs+useProfile → LogCard | ✅ 완료(ui-publisher 배선, 정합 확인) |

### B4 LogListScreen ✅ (ui-publisher 골격+배선, developer 데이터 검증)
- `useSelfDisplay({userId})`가 userId 노출 → `Avatar url={avatarUrl} userId={userId} nickname={nickname}`(본인, url 우선/디폴트). 커플 파트너=익명 `Avatar url=null userId=null nickname=null`(🙂, plan §3.3).
- `MemberBadge memberCount={log.memberCount}`(useMyLogs, member_count→camel). 카드 타이틀 `cardTitle` 솔로/커플 분기.
- 미리보기 4 점선 슬롯(집계 OUT 플레이스홀더), "맛집을 기록해보세요" count-free 카피(맛집수 미표시, plan §B4). 빈상태 🍜 64px.
- onPress → navigate(LogScreen, {roomId}). 데이터 경계면 정합 확인, 추가 배선 불필요.
- ⚠️ 코드 중복(경미): `cardTitle`(LogListScreen) ↔ `logTitle`(LogScreen) 동일 로직 — 두 화면 분산. 비차단(차기 정리 가능).

### B2 LogScreen + MuklogList ✅ (LogScreen 골격=ui-publisher / MuklogList 필터=developer)
- **LogScreen.tsx(ui-publisher 구현, developer 데이터 검증)**: `useProfile({userId:meId})`→meNickname(null→"나" 폴백)·meAvatarUrl. `logTitle` 솔로 "{닉}의 기록"/커플 "{닉} ♥ 짝꿍"(파트너 "짝꿍" 폴백, plan §117). 헤더 본인 `Avatar url+userId`/커플 익명 `Avatar url=null userId=null`(🙂). 컴팩트 초대코드 행(Clipboard, 커플)/InviteCodeCard(솔로). → 데이터 경계면 전부 정합 확인.
  - 참고: LogScreen 헤더 MemberBadge는 ui-publisher가 제거(QA 관찰 — 킷 헤더엔 멤버 배지 없음, 커플은 아바타 겹침으로만 표현). `room.memberCount`는 여전히 isCouple(≥2) 분기(아바타 겹침·로그명·컴팩트/InviteCodeCard)에 소비 — 데이터 경로 영향 없음. (MemberBadge 자체는 B4 LogListScreen LogCard에서 사용.)
- **MuklogList.tsx(developer 배선)**: 카테고리 필터 `useState<string|null>`(null="전체") + `muklogCategoriesInUse(muklogs)` 칩 행(Chip 프리미티브, "전체"+존재 카테고리, 가로 스크롤 gap 7) + `filterMuklogsByCategory({muklogs,category})` 적용. **"우리 맛집 N"=전체 muklogs.length(필터 무관)**. FAB right18/bottom26(ui-publisher 스펙 적용). 빈 목록=칩 행 미표시.
  - testID: `chip-all`/`chip-{cat}`. 필터 테스트 5종 추가(MuklogList.spec 11/11).
- **생산자 → 소비자**: useMuklogs(muklogs) → muklogCategoriesInUse/filterMuklogsByCategory → Chip 행+필터 리스트. useRoom/useProfile → LogScreen 헤더.
- **검증**: 전체 338 green, tsc 0.
- ✅ **타이포 정합 완료**: ui-publisher가 `typography.sectionTitle`(800/19, Bold) 추가 → MuklogList 섹션 헤더 `h3`→`sectionTitle`, "최근 순" `sectionCaption`→`meta`(fgMuted) 교체. 339 green 유지.

---

## 2-1. 최종 상태 (Task #4 완료)
- **전체 테스트 339/339 green, `tsc --noEmit` 0 에러.**
- 신규 유틸 3종(avatarDefault·filterByCategory·profileStats) + B1·B2·B3·B4 데이터 배선 완료. B5 배선 불필요.
- **QA 교차검증 전부 통과**: Q6(MuklogCard) ✅ / Q8(ProfileScreen) ✅ / Q9(LogListScreen) ✅ / Q7(LogScreen+MuklogList 필터) ✅.
- **컨벤션 준수**: useCallback/useMemo 0, 화살표 const, named-object 인자, useEffect 명명 함수(clearCompactCopied 등), enum-style 상수, 토큰만(아바타 도메인 팔레트는 plan §3.2 예외). git 0.
- **핸드오프 규칙**: 모든 화면 파일 ui-publisher와 순차 점유/반환(동시편집 0). developer 편집 파일: avatarDefault·filterByCategory·profileStats(신규), MuklogList(필터+sectionTitle), ProfileScreen(통계 일원화)+spec mock.

## 3. 차기 백엔드 스프린트 백로그 (이번 OUT — 리더 결정으로 분리)
plan §9 정리와 동일. 본 스프린트 플레이스홀더 → 차기 실값 교체:
1. `profiles.avatar_emoji/avatar_color` 영속 + 이모지 선택 시트 (현재: defaultAvatar 결정적 디폴트).
2. 파트너 프로필 DEFINER RPC(get_room/list_my_rooms에 members) → 커플 로그명 실이름·파트너 실아바타 (현재: 익명 디폴트 아바타).
3. `list_my_rooms` 집계(spotCount·previewCategories) → ProfileScreen "기록한 맛집" 실값·LogCard 미리보기 FoodCover (현재: "-"·점선 빈슬롯).
> 컴포넌트 props가 확장 수용하도록 설계됨(Avatar userId 파생, MuklogCard createdBy 파생) → 교체 비용 최소.

---

# 후속 픽스 (LogScreen 영역 비주얼 충실도 4건) — ui-publisher

킷 정합 4건 TDD 수정. 상세 매핑은 ui-spec.md "후속 픽스" 참고.

## 변경 파일
- `src/components/InviteCodeCard.tsx` — 복사 Button `leftIcon={IconName.Link}` 추가, stale D4 주석 갱신.
- `src/components/InviteCodeCard.spec.tsx` — link 아이콘 단언 추가.
- `src/navigation/screens/LogScreen.tsx` — `SoloInviteBanner`(💌+헤딩+설명+InviteCodeCard) 신설, 헤더에 chevron-left 뒤로가기 IconButton + `navigation.goBack()` 배선, 로그명 `navTitle`(16) 적용, 헤더 inner row 레이아웃(킷 정합).
- `src/navigation/screens/LogScreen.spec.tsx` — useNavigation mock(mockGoBack), 💌 배너·뒤로가기 goBack 단언, 솔로 카피 교체.
- `src/navigation/AppNavigator.tsx` — LogScreen `headerShown:false`(이중 헤더 제거, 화면 자체 헤더 단일화).
- `src/features/muklog/MuklogList.tsx` — `emptyEmoji` lineHeight 56 헤드룸.
- `src/features/muklog/MuklogList.spec.tsx` — 빈 이모지 lineHeight>fontSize 단언.
- `src/features/muklog/MuklogCard.tsx` — 칩 Text `lineHeight:16` + paddingVertical spacing[6](이모지 클리핑 방지).
- `src/features/muklog/MuklogCard.spec.tsx` — 칩 lineHeight>fontSize 단언.
- `src/theme/tokens.ts` + `tokens.spec.ts` — `typography.navTitle`(16/1.2 Bold) 신설.

## 이슈별 처리 요약
1. **솔로 배너+link 아이콘**: InviteCodeCard 복사 버튼 leftIcon=Link(글리프 이미 존재, D4 주석 stale였음). LogScreen 솔로 분기를 킷 accent-weak 배너(💌+헤딩+설명+InviteCodeCard)로 교체.
2. **빈 이모지 클리핑**: 🍽️ fontSize44에 lineHeight56(×1.27) + textAlignVertical center.
3. **칩 이모지 클리핑**: badge 토큰(ratio1) 유지, 칩 Text에 lineHeight16 헤드룸 + paddingVertical6. 이모지 인라인 badge는 MuklogCard 칩이 유일(타 사용처 무영향).
4. **헤더 뒤로가기+타이틀**: 이중 헤더(네이티브 "로그"+자체 킷헤더) 진단 → 네이티브 헤더 제거, 킷대로 chevron-left IconButton+goBack 추가, 로그명 navTitle(16).

## 남은 판단필요 항목
- **이슈4 네비 설계(보고)**: LogScreen은 의도적 "뒤로가기 없음" 설계가 아니었음 — native-stack 상세 화면(LogList/JoinLog/PlusHeaderButton에서 push). 이중 헤더(네이티브+자체)가 실제 문제였고 킷 단일 출처 준수로 네이티브 헤더를 숨기고 자체 헤더로 일원화함. **사용자 확인 권장**: 네이티브 헤더 제거가 다른 진입 경로(딥링크 등)의 뒤로가기에 영향 없는지 디바이스 스모크 1회.
- **솔로 배너 헤딩 폰트**: 킷 15px ↔ RN navTitle 16px(전용 토큰 미신설). 1px 차이 비차단, 차기 미세조정 후보.
- **칩 글래스 blur**: 여전히 불투명 surface 근사(RN blur 미지원, 기존 기록 유지).
