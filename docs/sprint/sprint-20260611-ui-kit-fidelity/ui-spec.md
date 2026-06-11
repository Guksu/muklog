# UI Spec — 킷 `ui_kits/muklog` → RN 번역 (ui-kit-fidelity)

> ui-publisher 단일 출처. plan.md §3.4(props 계약) + mismatch-map A/B를 RN으로 확정한다.
> 디자인 단일 출처: 킷 `.claude/skills/ui-design/ui_kits/muklog/`. 라인 번호는 현재 파일 기준 재확인 완료.
> 토큰 매핑은 `ui-publishing` 스킬 §1 참조. raw hex/숫자 색은 토큰 경유(아바타/카테고리 도메인 팔레트만 예외 — plan §3.2).

---

## A. 공용 토대 (Task #2 — 완료, 81 테스트 green)

### A8. 토큰 보강 — `src/theme/tokens.ts`
| 추가/변경 | 값 | 출처(킷) |
|---|---|---|
| `color.starFill` | `#FFB23E`(light/dark 미러) | `mk-ui.jsx:42` 채운 별 |
| `radius.action` | `18` | `mk-home` SheetAction(AddSheet 액션 카드) |
| `spacing[7] / [18] / [26]` | 7 / 18 / 26 | 킷 다수 gap·padding(plan A8) |
| 카테고리 그라데이션 | `categories.ts` `colors:[from,to]` 8종 | `mk-data.js:5-14` CAT.grad |

검증: `tokens.spec.ts`(starFill≠warning, radius.action===18, spacing 7/18/26), `categories.spec.ts`(8종 colors·드리프트).

### A1. FoodCover — `src/components/FoodCover.tsx` (신설)
- 킷: `mk-ui.jsx:50-62` `FoodCover` (grad 배경 + 중앙 이모지 + drop-shadow) / `mk-data.js:5-14` CAT.
- RN: `expo-linear-gradient` `<LinearGradient colors start={{0,0}} end={{1,1}}>`(140deg 근사). 이모지=`<Text fontSize=emojiSize>`. 카테고리→그라데이션/이모지는 `categories.ts` `categoryColors`/`categoryEmoji`(cafe 폴백 = 킷 `CAT[cat]||CAT.cafe`).
- **props 계약**: `{ category: string|null; size?: number; radius?=20; emojiSize?=40; style?; children? }`. (children=커버 오버레이; 사진수 배지는 OUT — plan §44.)
- RN 근사: drop-shadow → `textShadow rgba(0,0,0,.12)`(프레젠테이션 전용, 시맨틱 색 아님).
- 데이터(developer): `category`=`muklog.category`. 커버 크기/비율은 소비처(MuklogCard=aspectRatio 16/10, LogCard 미리보기=`size`).

### A2. Button — `src/components/Button.tsx` (확장)
- 킷: `mk-ui.jsx:80-104` MkButton.
- variant: `primary`(accent bg + accentShadow 그림자) / `soft`(primaryWeak + accentStrong) / `ghost`(투명 + fgWeak) / `secondary`(surface + hairline 보더 — **기존 소비처 호환 보존**).
- size: `lg`(pad 16/22, fs 17) / `md`(13/18, 16) / `sm`(9/14, 14) — 킷 실값(컨트롤 내부 수치, enum-style `BUTTON_SIZE`).
- `leftIcon`(IconName, gap 8, 색=텍스트색 토큰), `full`(alignSelf stretch). **full 미지정 시 alignSelf 강제 안 함**(기존 stretch 부모 레이아웃 보존).
- **props 계약**: `{ title; variant?; size?; leftIcon?: IconName; full?; loading?; disabled?; style? }`.

### A3. Chip — `src/components/Chip.tsx` (신설)
- 킷: `mk-ui.jsx:121-136` MkChip. selected=primary+primaryFg / 미선택=surface+fgWeak+hairline 보더, radius full, pad 8×13, gap 5, 600/13.5(SemiBold), emoji 14.
- **props 계약**: `{ label; emoji?; selected?; onPress?; testID? }`. `accessibilityState.selected` 노출.
- 데이터(developer): LogScreen 카테고리 필터("전체"+`useMuklogs` unique cat), 선택 시 리스트 필터.

### A4. MemberBadge — `src/components/MemberBadge.tsx` (신설)
- 킷: `mk-ui.jsx:139-152` MemberBadge. `memberCount≥2` → 💑"둘이"(primaryWeak/accentStrong) / `<2` → 🙋"혼자"(surfaceAlt/**fgWeak**).
- **plan 결정**: solo 텍스트 = `fgWeak`(킷 `--text-alternative`≈fgMuted 대비 가독성 우선 — plan §3.4).
- pad 3/9/3/7, gap 4, 이모지 12, badge typography(700/11.5).
- **props 계약**: `{ memberCount: number; testID? }`. 데이터: `useRoom`/`useMyLogs` `memberCount`.

### A5. Avatar — `src/components/Avatar.tsx` (재작성) + `defaultAvatar`(developer 신설)
- 킷: `mk-ui.jsx:65-77` MkAvatar (color+26 bg, inset ring color+55, 이모지 size×0.5).
- **표시 우선순위(plan §3.3)**: ① `url`→이미지 → ② `userId`→`defaultAvatar({userId})` 이모지+컬러 → ③ `nickname`→이니셜 → ④ 익명 🙂.
- **props 계약**: `{ url?; userId?; nickname?; size?=64; ring?=true }`. **emoji/color는 호출부가 안 넘김 — userId에서 내부 파생**(결정성).
- testID(QA·소비처 주의): `avatar-image` / `avatar-default`(userId) / `avatar-placeholder`(이니셜) / `avatar-anonymous`(🙂).
- RN 근사: inset ring → `borderWidth 2`(레이아웃 영향 있음, 킷 box-shadow inset 근사). 잘못된 색은 `withAlpha`가 원색 흡수.
- `defaultAvatar`는 `@/features/profile/avatarDefault`에서 **모듈 직접 import**(배럴의 훅→supabase 결합 회피).
- 데이터(developer): 본인=`userId`(auth)+`avatarUrl`(useProfile) / 작성자=`createdBy` / 파트너=미보유→`userId`·`url`·`nickname` 모두 생략→익명 🙂.

### A6. Stars — `src/components/Stars.tsx` (색 정합)
- 채움 `color='starFill'`(#FFB23E), 빈 `borderStrong`(--line-strong). 검증: filled 아이콘 color #FFB23E.

### A7. IconButton — `src/components/IconButton.tsx` (신설)
- 킷: `mk-ui.jsx:107-118` MkIconBtn. 40×40 원형, 아이콘 size 22, badge=accent 도트(top7/right8, 8×8, bg색 2px 링).
- **props 계약**: `{ name: IconName; onPress?; size?=22; color?: ColorToken='fg'; bg?: ColorToken; badge?; accessibilityLabel(필수); testID? }`.
- 후속(B6): HomeHeader Plus/Profile 버튼이 IconButton 경유(Task #3에서 비주얼 스왑, 배선은 developer).

---

## 컴포넌트 export
`src/components/index.ts`에 `Chip`/`FoodCover`/`IconButton`/`MemberBadge` 추가 export.

## jest 인프라
`jest.setup.ts`에 `expo-linear-gradient` pass-through View 모킹 추가(네이티브가 colors를 정수 변환 → raw hex 단언 불가 회피). 모든 테스트 공용.

---

## 아이콘셋 보강 (B3 설정 리스트)
`assets/icons/icons.ts`에 킷 verbatim 추가: `bell`·`heart`·`circle-info`(width/height 제거, viewBox 유지). `Icon.tsx` IconName에 `Bell`·`Heart`·`CircleInfo` 등록.

---

## B. 화면별 정합 (Task #3 — 진행 중)

### B1. MuklogCard — **완료** (10 테스트 green, Q6 검증 요청)
- `src/features/muklog/MuklogCard.tsx`. 커버 FoodCover(category, emojiSize 56) + **aspectRatio 16/10**(킷 89, 카드 overflow→radius 0). 작성자 행 22px Avatar(userId=createdBy, ring false) + "내가/짝꿍이 기록"(meId). props 불변(muklog+meId) → 배선 변경 불필요.
- RN 근사: 카테고리 칩 오버레이 글래스(rgba(255,255,255,.82)+blur) → 불투명 surface(blur 미지원). 사진수 배지 OUT(데이터 없음).

### B3. ProfileScreen — **완료** (13 테스트 green, 기존 실패 1건 해소, Q8 검증 요청)
- `src/navigation/screens/ProfileScreen.tsx`. 킷 mk-log.jsx:380-451.
- 96px Avatar(`url` 있으면 이미지 / 없으면 `userId` 디폴트 이모지+컬러) + 우하단 32px 카메라 배지(Pressable, accessibilityLabel "프로필 사진 변경", 탭→기존 `changeAvatar` 이미지 업로드).
- 닉네임 텍스트 + 30px 편집 펜슬(탭→닉네임 편집 Sheet: prefill 입력 + 저장 Button). 검증/저장 로직(validateNickname·saveNickname·canSave)은 기존 그대로 시트로 이전.
- 통계 3칸: 로그(=`useMyLogs` logs.length) / 기록한 맛집(=**"-"** 집계 OUT) / 커플 로그(=memberCount≥2 수). radius.sheet(20) 카드 + shadow.card.
- 설정 리스트 4행(알림·위시리스트·이용안내·설정) bell/heart/circle-info/setting + chevron-right, **비활성 플레이스홀더**.
- **이모지 선택 시트 OUT**(리더 결정/plan §47) — 아바타 커스터마이즈는 이미지 업로드 동선만. ui-spec 근사 사유: 카메라 배지 ring(box-shadow inset) → borderWidth 3 근사.
- 데이터(developer 확인 요망): `userId`(auth) Avatar 전달·`useMyLogs` 통계·`changeAvatar` 업로드 경로는 기존 훅 그대로 배선 완료 — 동작 검증 부탁.

### B5. AddSheet/JoinLogScreen/CodeInput/InviteCodeCard — **완료** (11 테스트 green, Q10)
- AddSheet: SheetAction radius lg→`action`(18). InviteCodeCard: 복사 버튼→공용 Button(primary, sm, accentShadow). CodeInput: 비활성 셀 보더 border→hairline + 셀 lineHeight 24. JoinLogScreen: 스크롤 상단 padding 24→12.

### B4. LogListScreen/LogCard — **완료** (12 테스트 green, Q9)
- self Avatar에 `userId` 전달(디폴트 이모지). 커플 파트너 익명(avatar-anonymous) marginLeft -12 겹침. Badge→**MemberBadge**. 빈상태 🍜 64px. 미리보기 점선 4슬롯·"맛집 N곳" 미표시 유지.

### B2. LogScreen — **헤더·초대영역 완료** (8 테스트 green, Q7). MuklogList 칩/섹션은 developer 인계.
- `src/navigation/screens/LogScreen.tsx`: 헤더 = 아바타 겹침(me url+userId / 커플 익명 파트너 28px, marginLeft -9) + 로그명("{닉}의 기록"/"{닉} ♥ 짝꿍") + MemberBadge. 본인 닉/아바타는 useProfile.
- 초대 영역: **솔로=InviteCodeCard+안내 / 커플=컴팩트 1줄**(link 아이콘 + "초대코드 XXXXXX" + 복사). 기존 "둘이 함께 기록 중" 블록 교체. **AC3 변경**: 커플도 코드 노출(plan §118).
- `link` 아이콘 신규 추가(IconName.Link).
- **developer 인계(MuklogList 내부)**: 섹션 헤더 "우리 맛집 N"(N=muklogs.length, 800/19=typography 필요 시 emptyTitle 근사 또는 h3) + "최근 순"(500/13 fgMuted) / **카테고리 필터 칩 행**: 공용 `Chip`("전체"+`muklogCategoriesInUse` unique cat, 가로 스크롤 gap 7, 선택 시 `filterMuklogsByCategory`). 필터 useState는 developer. FAB right18/bottom26 + accentShadow.

### B6. HomeHeader/HomeTabs — **완료** (4 테스트 green, Q11)
- HomeHeader: 프로필 아바타에 `userId` 전달(url 없으면 결정적 디폴트 이모지). 워드마크/이모지 baseline 정렬 + 이모지 19px.
- HomeTabs: active=primary / inactive=fgWeak (이미 정합). PlusHeaderButton(accent-weak 버블) 유지.

---

## Task #3 종합 — publisher 화면 골격 전부 완료
B1·B3·B4·B5·B6 + B2(LogScreen 헤더·초대영역) 완료. developer가 B2 MuklogList(섹션·필터칩·FAB) 배선 완료 — **공용 Chip + `sectionTitle` 토큰 + spacing[7] 사용해 킷 정합 확인**. 전체 339 테스트 green, tsc 클린. 신규 아이콘: bell·heart·circle-info·link. 신규 토큰: `typography.sectionTitle`(800/19).

## QA 피드백 반영 (post-review)
- **B4 푸터 카피**(QA Q9 Medium): 거짓 음성 "아직 기록한 맛집이 없어요" → count-free "맛집을 기록해보세요"(sprint-planner 확정). LogCard 커플 날짜도 솔로와 동일 "{YYYY.MM.DD} 시작"(sinceLabel Date.now 비결정 회피) — lock 테스트 추가.
- **B2 LogScreen 헤더 MemberBadge 제거**(QA Q7 관찰): 킷 헤더(:17-29)·plan §138 미명시 → 킷 단일 출처 준수로 제거. 커플 여부=아바타 겹침 표현.
- **B3 닉네임 타이포**(QA 마이너): 킷 800/22 vs RN h3(20/SemiBold) — 차기 미세조정 후보(비차단).
- **`--text-alternative` RN 매핑 갈림**(QA 마이너): 카드 작성자 캡션=fgMuted / MemberBadge 솔로=fgWeak. 컨텍스트별 정당, 차기 토큰 정리 시 통일 검토.
plan §5 B1~B6 / §7 Q6~Q11. 우선순위(plan §9): ① 프리미티브(완료) → ② 단일사용자 화면(B1·B3·B5·B6 + B2 솔로) → ③ 파트너-디폴트(B2 커플·B4 겹침).
- B1 MuklogCard: 커버 aspectRatio **16/10** + FoodCover(category) + 작성자 행 22px Avatar(userId=createdBy) + "내가/짝꿍이 기록"(meId 분기).
- B2 LogScreen: 헤더(본인 아바타+로그명) / 커플=컴팩트 초대코드 1줄·솔로=InviteCodeCard / 카테고리 필터 칩 행 / 섹션 "우리 맛집 N"(800/19)+"최근 순" / FAB right18·bottom26·accentShadow.
- B3 ProfileScreen: 96px 아바타(userId)+카메라 배지(이미지 업로드 동선 유지) / 통계 3칸(맛집수="-") / 설정 리스트 4행 / 닉네임 편집 시트 / **이모지 시트 없음**.
- B4 LogListScreen/LogCard: 본인 아바타·MemberBadge(memberCount)·점선 미리보기 4슬롯·"맛집 N곳" 미표시·빈상태 🍜 64px.
- B5 AddSheet/Join/CodeInput/InviteCodeCard: radius.action(18)·hairline 셀·padding 12·복사 버튼 Button(primary).
- B6 HomeHeader/HomeTabs: 워드마크 baseline·이모지 19px·+버튼 accentWeak IconButton·프로필 아바타 36px.

---

# 후속 픽스 (post-QA, LogScreen 영역 비주얼 충실도 4건)

원인 진단 완료 상태에서 킷 정합 4건을 TDD(Red→Green→Refactor)로 수정. 각 이슈: 킷 라인 ↔ RN 매핑 + 토큰/수치 + RN 한계 근사.

## 픽스 1 — 솔로 초대 배너(💌) + 복사 버튼 link 아이콘
**킷:** `mk-log.jsx:33-45`(솔로 accent-weak 배너) + `mk-home.jsx:217-230`(InviteCodeCard `leftIcon="link"`).
**증상:** 솔로 분기가 배너 없이 맨 `InviteCodeCard` + 평문 캡션. 복사 버튼에 link 아이콘 없음(D4 주석이 stale — `assets/icons/icons.ts:25` link 글리프·`IconName.Link` 이미 존재).

| 킷 요소 | RN 매핑 |
|---|---|
| `background: accent-weak; borderRadius 20; padding 16`(:35) | `SoloInviteBanner`(LogScreen.tsx) — `backgroundColor: primaryWeak`, `radius.sheet`(20), `padding spacing[16]`, `gap spacing[12]` |
| `💌`(fontSize 20)(:37) | `RNText style={{fontSize:20, lineHeight:26}}` — lineHeight 헤드룸으로 이모지 클리핑 방지 |
| "연인을 초대해보세요"(700/15 ink)(:38) | `Text variant="navTitle" color="fg"`(16/Bold — 킷 15에 가장 근접한 역할 토큰. 신규 토큰 미신설, navTitle 재사용) |
| 설명문(500/13 ink2)(:40) | `Text variant="bodySm" color="fgWeak"`(14/Medium) |
| `<INVITE compact>`(:43) | `InviteCodeCard code={code}`(공용, compact prop 미구현 — 동일 카드 재사용) |
| `<BTN leftIcon="link">복사`(mk-home:226) | `Button leftIcon={IconName.Link}`(InviteCodeCard.tsx) |

**근사/사유:** 킷 INVITE `compact` 변형은 RN에 미구현 → 표준 InviteCodeCard 재사용(시각 차이 미미). 헤딩 폰트 킷 15px ↔ RN navTitle 16px(전용 토큰 신설 대신 근접 역할 토큰 재사용, 1px 차이 비차단).

## 픽스 2 — 빈 상태 이모지(🍽️) 세로 클리핑
**킷:** 해당 — RN 전용 렌더 이슈(킷 웹은 line-height:1로도 안 잘림).
**수정:** `MuklogList.tsx:172` `emptyEmoji` → `{ fontSize: 44, lineHeight: 56, textAlignVertical: 'center' }`. lineHeight=fontSize×1.27 헤드룸(44→56)으로 큰 이모지 상/하단 글리프 보존. textAlignVertical center로 Android 상하 균형. 테스트: lineHeight > fontSize 단언(디바이스 수치 회귀 lock).

## 픽스 3 — 카드 카테고리 칩 이모지 클리핑
**킷:** `mk-log.jsx:90`(칩 `font: 700 11.5px/1`, padding 5×10, 단일 span에 emoji+label).
**증상:** `Text variant="badge"`는 `ratio:1` → lineHeight==fontSize(12) → 이모지 글리프 세로 클리핑.
**수정(MuklogCard.tsx):** 칩 Text를 킷대로 단일 노드 유지(`{chipEmoji} {chipLabel}`)하되 `style={{lineHeight:16}}` 헤드룸 부여. chip paddingVertical `spacing[4]→spacing[6]`(킷 5 근접, 큰 라인박스 수용).
**근사/사유:** badge 토큰 자체(ratio 1)는 다른 사용처(MemberBadge·Chip은 이모지를 별도 RNText로 분리, InviteCodeCard "초대코드"·CompactInviteRow "복사"는 이모지 없음)에 영향 없어 토큰 미변경 — **이모지가 badge Text에 인라인된 곳은 MuklogCard 칩이 유일**. 글래스 blur는 여전히 불투명 surface 근사(기존 기록 유지).

## 픽스 4 — LogScreen 헤더 뒤로가기 + 타이틀 크기
**킷:** `mk-log.jsx:18-29`(헤더 = chevron-left IconButton size24 + 아바타 겹침28 + 로그명 700/16/1.2).
**네비 구조 진단:** LogScreen은 `AppNavigator`(native-stack)에 `headerShown:true, title:'로그'`로 등록 → **네이티브 "로그" 헤더 + 화면 자체 킷 헤더 = 이중 헤더**. 뒤로가기는 네이티브 헤더에만 있고 킷 헤더엔 없었음.
**결정(킷 단일 출처 준수):** 이중 헤더 제거 — `AppNavigator`에서 LogScreen `headerShown:false`로 변경, 킷대로 화면 자체 헤더에 chevron-left IconButton(좌측) 추가 + `navigation.goBack()` 배선. **의도적 "뒤로가기 없음" 설계 아님**(루트 탭 아님, LogList/JoinLog/PlusHeaderButton에서 push되는 스택 상세 화면 → 뒤로가기 필수).

| 킷 요소 | RN 매핑 |
|---|---|
| `<IBTN chevron-left size24 onClick=onBack>`(:19) | `IconButton name={ChevronLeft} size={24} color="fg" accessibilityLabel="뒤로 가기" onPress={navigation.goBack}` |
| 헤더 `paddingLeft 8, paddingRight 12, paddingBottom 6`(:18) | 인라인 `paddingLeft spacing[8]`, `paddingRight spacing[12]`, `styles.header paddingBottom:6` |
| 아바타+로그명 inner flex `gap8 marginLeft2`(:20) | `styles.headerMain { flex:1, gap spacing[8], marginLeft:2 }` |
| 로그명 700/16/1.2(:25) | **신규 토큰 `typography.navTitle`(16/1.2 Bold)** — 기존 cardTitle(17/1.3) 교체. tokens.spec lock 추가 |

**근사/사유:** 파트너 실데이터 미보유 → 커플 아바타는 익명 디폴트 겹침(기존 유지).

### 픽스 4 회귀 보정 — 헤더 safe-area top inset (MK_STATUS_PAD → insets.top 번역)
**문제(회귀):** 픽스 4에서 LogScreen `headerShown:false`로 네이티브 헤더를 끄며 그 헤더가 제공하던 top inset이 사라짐. 그러나 `Screen edges`는 `['left','right','bottom']`로 `top` 제외 + 헤더 `paddingTop`이 `spacing[12]` 고정이라, 노치/다이나믹 아일랜드 기기에서 뒤로가기·아바타·로그명이 상태바와 겹침. (이전 "근사/사유"의 "Screen edges가 처리" 기술은 오류 — top 미포함이었음.)
**킷 대응:** 헤더 `paddingTop: MK_STATUS_PAD=56`(`mk-ui.jsx:215`, 시뮬레이터 상태바 근사 고정값).
**RN 번역 결정(옵션 b):** 56 고정 금지 — `useSafeAreaInsets().top`으로 동적 번역. 헤더 `paddingTop = insets.top + spacing[8]`로 **HomeHeader.tsx(:52)와 동일 패턴** 일치. 킷의 56은 시뮬레이터 근사값일 뿐이라 기기별 실제 inset으로 대체해야 정확.

| 킷 요소 | RN 매핑 |
|---|---|
| 헤더 `paddingTop: MK_STATUS_PAD=56`(`mk-ui.jsx:215`) | `paddingTop: insets.top + theme.spacing[8]`(`LogScreen.tsx` 헤더 View, `useSafeAreaInsets`). HomeHeader와 동일 |

**TDD lock:** `LogScreen.spec` — `react-native-safe-area-context.useSafeAreaInsets` 가변 모킹(`mockTopInset`). inset=0 vs inset=59 두 렌더의 헤더(`testID="logscreen-header"`) `paddingTop` 차이가 정확히 inset(59)만큼임을 단언 → 동적 반영 lock.
**검증:** `LogScreen.spec` 10 tests green, 전체 `npx jest` 345 tests green, `tsc --noEmit` 클린.

## 후속 픽스 신규/변경 토큰
- `typography.navTitle`(16/1.2, Pretendard-Bold) — LogScreen 헤더 로그명·솔로 배너 헤딩.

## 후속 픽스 검증
- 변경 spec 5종 + 신규 단언(leftIcon·💌배너·back goBack·navTitle·emoji lineHeight·chip lineHeight) green.
- 전체 `npx jest` 344 tests green, `tsc --noEmit` 클린.
