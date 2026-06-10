# Dev Notes — UI 리디자인 슬라이스 A

- **스프린트:** `sprint-20260610-ui-redesign`
- **작성:** developer (단독)
- **범위:** plan.md 슬라이스 A (토큰 정합 + 공용 컴포넌트 + 신규 Icon/Card/Badge + 핵심 화면 + 헤더 버튼 아이콘화). 슬라이스 B는 OUT-OF-SCOPE.
- **방침:** UI-only(동작·네비·훅 계약 불변), TDD(Red→Green), 코드 컨벤션 100%, 이모지 0, raw hex 0.

---

## 1. 완료 기준 결과

| 게이트 | 결과 |
|---|---|
| `npm test` | **27 suites / 170 tests 통과** (baseline 23/147 → 신규 4 suites·23 tests 추가) |
| `npx tsc --noEmit` | **EXIT 0 (통과)** |
| raw hex 0 (AC-3) | 컴포넌트/화면 코드 **0건** (tokens.ts·spec 제외). 아이콘 SVG는 `currentColor`만(색 hex 0). |
| 이모지 0 (AC-6) | **렌더 JSX(제품 화면) 이모지 0건.** 잔존 `⚠️`/`★`/`→`는 전부 `//` 코드 주석(기존 코드, 제품 화면 아님) → 브랜드 규칙("제품 화면 이모지 금지") 충족. |
| 글리프 잔존 0 (엣지5) | 화면 코드의 `+`·`›` **0건** (spec의 `queryByText('›')` 부재 단언만 잔존 — 의도적). |
| border→hairline (AC-4) | 카드/입력/아바타/버튼 secondary/탭바 전부 `hairline`. `theme.color.border` 소비처 **0건**(토큰은 호환 보존). |

---

## 2. 변경/신규 파일

### 신규
| 파일 | 내용 |
|---|---|
| `src/theme/tokens.spec.ts` | 토큰 값 단언 (AC-1/2/5, 다크 키 일관성, spacing 28) |
| `src/components/Icon.tsx` | currentColor SVG 아이콘 컴포넌트. enum-style `IconName`, `color` 토큰 해석 |
| `src/components/Icon.spec.tsx` | name 렌더·color 해석·size 적용 (AC-7) |
| `src/components/Card.tsx` | 헤어라인 보더 surface(그림자 0), card radius 16. `onPress` 시 Pressable |
| `src/components/Card.spec.tsx` | children·hairline·radius16·그림자0·누름 |
| `src/components/Badge.tsx` | pill 라벨, tone primary/neutral, 이모지 없음 |
| `src/components/Badge.spec.tsx` | label·pill radius·primary tone 배경 |
| `assets/icons/icons.ts` | ui-design 글리프 13종 currentColor SVG 원본(plus·chevron-right/left·person·person-fill·location·bubble·bubble-fill·camera·star·star-fill·close·setting) |
| `__mocks__/react-native-svg.js` | jest용 SvgXml/Svg 경량 스텁(외부 SDK 모킹) |

### 변경
| 파일 | 변경 |
|---|---|
| `src/theme/tokens.ts` | palette.blue에 interactive/hover/active(#3366FF급) + coolGray(hairline) 추가. primary=#3366FF, brand=#0066FF 분리. 신규 시맨틱 키 brand/hairline/hairlineAlt/surfaceAlt/fgAssistive. surface=white 재정의. radius control10/card16/sheet20. spacing 28. body 계열 family→Pretendard-Medium. darkColor 신규 키 미러링. |
| `src/components/Button.tsx` | radius md→control, secondary 보더 border→hairline |
| `src/components/Avatar.tsx` | 보더 border→hairline, placeholder ground surface→surfaceAlt |
| `src/components/index.ts` | Icon/Card/Badge export 추가 |
| `src/navigation/screens/LogListScreen.tsx` | 인라인 카드→`Card`, 인라인 배지→`Badge`, `›` 텍스트→`Icon chevron-right`, 빈 상태에 `Icon bubble`(이모지 아님) 추가 |
| `src/navigation/screens/LogListScreen.spec.tsx` | chevron 아이콘 존재 + `›` 부재 단언 추가 (AC-9) |
| `src/navigation/screens/ProfileScreen.tsx` | 입력 radius lg→control, 보더→hairline, bg→surfaceAlt, placeholder 색 fgMuted→fgAssistive |
| `src/navigation/PlusHeaderButton.tsx` | `+` Text→`Icon plus`(color primary) |
| `src/navigation/PlusHeaderButton.spec.tsx` | plus 아이콘 존재 + `+` 부재 단언 추가 (AC-8) |
| `src/navigation/ProfileHeaderButton.tsx` | "프로필" Text→`Icon person`(color primary). 접근성 라벨 유지 |
| `src/navigation/ProfileHeaderButton.spec.tsx` | person 아이콘 존재 + 텍스트 부재 단언 추가 (AC-8) |
| `src/navigation/HomeTabs.tsx` | tabBar borderTopColor border→hairline, 탭 아이콘 도입(먹로그=bubble/bubble-fill, 지도=location) |
| `package.json` | react-native-svg 15.8.0 추가(`npx expo install`) |

---

## 3. 토큰 변경표

| 키 | before | after |
|---|---|---|
| `primary` | #0066FF (blue.50) | **#3366FF** (blue.interactive) |
| `primaryHover` | blue.45 #005EEB | **#2B5CE6** (interactiveHover) |
| `primaryActive` | blue.40 #0054D1 | **#1F4FD6** (interactiveActive) |
| `brand` | (없음) | **#0066FF** (신규, blue.50 — 워드마크/대형 헤드라인) |
| `fgMuted` | neutral.80 #B0B0B0 | **neutral.70 #9B9B9B** (4단계 램프로 재정렬) |
| `fgAssistive` | (없음) | **neutral.80 #B0B0B0** (신규, placeholder/disabled 한정) |
| `surface` | neutral.99 #F7F7F7 | **#FFFFFF** (카드면) |
| `surfaceAlt` | (없음) | **#F7F7F8** (신규, 입력/배지 보조 면) |
| `hairline` | (없음) | **rgba(112,115,124,0.22)** (신규, 카드/입력/아바타 보더) |
| `hairlineAlt` | (없음) | **rgba(112,115,124,0.08)** (신규) |
| `radius.control` | (md=8 사용) | **10** (신규, 버튼/입력) |
| `radius.card` | (lg=12 사용) | **16** (신규, 카드) |
| `radius.sheet` | (없음) | **20** (신규, 차기 시트용) |
| `spacing[28]` | (없음) | **28** (4px 그리드 보강) |
| `typography.body/bodyLg/bodySm` family | Pretendard-Regular | **Pretendard-Medium** |

> 호환 정책: 기존 키(border, borderStrong, radius.md/lg/xl, sm)는 **이름·존재 유지**(값 일부 갱신, 소비처 없음). darkColor는 신규 키 전부 미러링(tsc 키 일관성 — `tokens.spec.ts`가 light/dark 키 집합 동일 단언).

---

## 4. 글리프 → 아이콘 매핑 (이모지 금지)

| 위치 | before(글리프) | after(아이콘) |
|---|---|---|
| PlusHeaderButton | `+` (Text h3) | `Icon name=Plus color=primary` |
| ProfileHeaderButton | "프로필" (Text) | `Icon name=Person color=primary` |
| LogListScreen 카드 | `›` (Text h3) | `Icon name=ChevronRight color=fgMuted` |
| LogListScreen 빈 상태 | (텍스트만) | `Icon name=Bubble`(40, fgMuted) 추가 — 이모지 아닌 in-house 아이콘 |
| HomeTabs 먹로그 탭 | (아이콘 없음) | `Icon Bubble/BubbleFill`(focused 변형) |
| HomeTabs 지도 탭 | (아이콘 없음) | `Icon Location` |

접근성: 헤더 버튼의 `accessibilityLabel`("로그 만들기"/"프로필") **유지**(스크린리더 회귀 0). Card 카드는 `accessibilityLabel="로그 열기"` 유지.

---

## 5. 기존 spec 교체 사유

| spec | 추가/교체 | 사유 |
|---|---|---|
| PlusHeaderButton.spec | 케이스 추가 | 글리프→아이콘 전환 검증(AC-8). 기존 동작 케이스 전부 유지(회귀 0) |
| ProfileHeaderButton.spec | 케이스 추가 | 동일(AC-8) |
| LogListScreen.spec | 케이스 추가 | chevron 아이콘 검증(AC-9). 기존 배지/생성일/navigate 단언 유지 |
| tokens/Icon/Card/Badge.spec | 신규 | 토큰 값·Icon·Card·Badge 렌더 검증 |

> 기존 spec의 텍스트/testID/핸들러/navigate 단언은 **하나도 삭제하지 않음.** 추가 단언만 했다(UI-only 동작 불변 보증). placeholder 텍스트 "닉네임을 입력하세요"·"닉네임을 입력해 주세요." 등 카피 전부 불변.

---

## 6. 생산자 ↔ 소비자 매핑 (QA 교차검증용)

| 생산자(토큰/컴포넌트) | 소비자(화면/컴포넌트) | 계약 |
|---|---|---|
| `tokens.color.primary=#3366FF` | Button(primary bg)·PlusHeaderButton·탭바 active·LogList 스피너 | 모든 인터랙티브 블루 일괄 반영 |
| `tokens.color.hairline` | Card·Button(secondary)·Avatar·ProfileScreen 입력·HomeTabs 탭바 | 솔리드 회색 보더 0, 반투명 헤어라인만 |
| `tokens.radius.control=10` | Button·ProfileScreen 입력 | 컨트롤 라운드 10 |
| `tokens.radius.card=16` | Card → LogListScreen 카드 | 카드 라운드 16 |
| `Icon(IconName, color)` | PlusHeaderButton·ProfileHeaderButton·LogListScreen·HomeTabs 탭바 | `name` enum + `color` 토큰 키. SvgXml currentColor 재색칠 |
| `Card({children,onPress,accessibilityLabel})` | LogListScreen LogCard | onPress→navigate(LogScreen,{roomId}) 불변 |
| `Badge({label,tone})` | LogListScreen LogCard | label = memberBadgeLabel 파생("둘이"/"혼자") 불변 |

> 동작 경계(useMyLogsContext/useNavigation/useCreateRoom/useProfile/useUpdateProfile)·라우트(Routes)·RPC 인자: **전부 불변.** `src/features/**`는 변경 0(타입 확장도 불필요 — Text의 ColorToken은 tokens.ts 확장으로 자동 수용).

---

## 7. react-native-svg 도입 / 재빌드 안내 (사용자 액션)

- **설치 완료:** `react-native-svg@15.8.0` (`npx expo install`로 SDK52 호환 버전).
- **네이티브 재빌드 필요(사용자 몫):** react-native-svg는 네이티브 모듈 → **Dev Client 1회 재빌드** 후에야 실기기/시뮬에서 아이콘이 렌더된다.
  - `npm run ios` 또는 `npm run android` (로컬 prebuild) 또는 EAS 빌드.
- **app.json 변경 불필요:** config plugin 없이 자동 링크된다(podspec/gradle autolinking). 추가 plugin 항목 없음.
- **jest:** 단위는 `__mocks__/react-native-svg.js` 스텁으로 통과(testing-strategy "외부 SDK=모킹"). 실제 글리프 시각 렌더는 디바이스 스모크로 확인.

---

## 8. 슬라이스 B 잔여 (차기)

- HomeTabs는 이번에 탭 아이콘까지 처리(저비용이라 A에 포함). 단 **헤더 타이틀 타이포 고도화·Splash/AuthError/MapTab 톤 정돈**은 미수행(B).
- `SplashView`/`AuthErrorView`/`MapTabScreen`: **코드 변경 없음.** 기존 토큰 키만 쓰므로 primary/surface/typography 값 변경의 혜택은 자동 반영되나, 빈 상태 아이콘/톤 고도화는 B.
- EmptyLogs 일러스트/아이콘 고도화(현재는 bubble 단일 아이콘), Wanted Sans 브랜드 헤드라인 도입(미도입 — plan §4-2 결론) → B.
- 미사용 토큰 정리(border/borderStrong/radius.md/lg/xl): 호환을 위해 보존. 차기에 소비처 확인 후 정리 가능.

---

## 9. 미완/주의

- 없음(슬라이스 A 전 항목 구현·테스트·tsc 통과).
- 주의: `darkColor`는 토큰 키만 미러링(MVP light 고정, ThemeProvider scheme='light'). 다크 토글 UI는 미도입(plan 엣지1).

---

## 10. 디자인 충실화 추가분 (슬라이스 A 보정 — mk-home 레퍼런스 재현)

> 사용자 지적 3건(①헤더 다름 ②하단 "새 로그 시작하기" 없음 ③카드 디자인 다름) 보정. UI-only(동작·네비·훅 계약·백엔드 불변). **이모지 정책 변경: muklog 킷 그대로 이모지 허용**(헤더 🍽️, 빈상태 🍜, 카드 타이틀 ♥). raw hex는 여전히 0(토큰만).

### 10-1. 이모지 정책 변경 (중요)
- 직전 빌드는 "이모지 0"이었으나, 사용자 확정 결정으로 **muklog 킷의 음식/관계 이모지를 제품 화면에서 사용**한다(CLAUDE.md 정정 반영).
- 도입 이모지: 헤더 워드마크 옆 `🍽️`, 빈 상태 `🍜`, 카드 커플 타이틀의 `♥`(텍스트 글리프). raw hex 색은 0 유지(토큰만).

### 10-2. 신규/변경 파일
| 파일 | 구분 | 내용 |
|---|---|---|
| `src/navigation/HomeHeader.tsx` | **신규** | 홈 커스텀 헤더(mk-home HomeHeader 재현). 좌: 워드마크 "먹로그"(h2=Pretendard-Bold, letterSpacing -0.5)+🍽️. 우: `PlusHeaderButton`(버블) + 프로필 아바타(36, 누르면 Profile). 아바타는 `useAuth(userId)`→`useProfile`로 본인 닉/아바타. SafeArea top inset + spacing 패딩. |
| `src/navigation/HomeHeader.spec.tsx` | **신규** | 워드마크·🍽️·+버튼·프로필 navigate·아바타 url/placeholder 분기 (5 케이스). |
| `src/navigation/HomeTabs.tsx` | 변경 | 기본 네비 헤더(title+headerRight)→`header: () => <HomeHeader />` 공통(먹로그·지도 탭). `HomeHeaderRight`/`ProfileHeaderButton` import 및 `styles` 제거. |
| `src/navigation/PlusHeaderButton.tsx` | 변경 | 평면 아이콘→**액센트-weak 버블**(40×40 원형, `primaryWeak` bg, `primary` plus 아이콘). 기존 동작/접근성("로그 만들기")/spec 단언(icon-plus·"+"부재) **전부 유지**. |
| `src/navigation/screens/LogListScreen.tsx` | 변경 | 카드 골격 충실화 + 하단 CTA + 빈 상태(mk EmptyLogs) 재현. 아래 §10-3·10-4 참조. |
| `src/navigation/screens/LogListScreen.spec.tsx` | 변경 | 빈상태(로그 만들기→createRoom→refresh)·카드 플레이스홀더("아직 기록한 맛집이 없어요")·날짜("YYYY.MM.DD 시작")·하단 CTA(createRoom) 케이스 추가. 기존 navigate·배지·chevron·loading/error 단언 유지. `/\+ 버튼/` 카피 단언은 빈상태 카피 변경으로 "로그 만들기" 버튼 단언으로 교체. |

> `ProfileHeaderButton.tsx`/`.spec.tsx`: HomeTabs에서 더 이상 소비하지 않으나(헤더 자체 아바타 버튼으로 대체) 컴포넌트/스펙은 **삭제하지 않고 보존**(독립 유효, 회귀 0).

### 10-3. 카드 골격 (LogCard — mk-home 재현, 데이터 없는 부분은 정직한 플레이스홀더)
- **상단 행**: `Avatar`(본인) + 커플(memberCount≥2)이면 익명 `Avatar`(nickname=null) 겹침(`marginLeft: -spacing[12]`) — 짝꿍 실데이터 미존재 → 익명 플레이스홀더. 이름 = `cardTitle`: 솔로 `"{닉}의 기록"` / 커플 `"{닉} ♥ 짝꿍"`. `Badge`(둘이/혼자, memberCount 파생) + 날짜 `"YYYY.MM.DD 시작"` + `Icon chevron-right`.
- **중간**: 미리보기 사진 4슬롯 — 사진 데이터 없음 → **빈 점선 슬롯**(`surfaceAlt` bg, `hairline` dashed 1px, radius lg, aspectRatio 1). 가짜 음식 이모지 채우지 않음(정직).
- **하단**: `Icon location`(primary) + `"아직 기록한 맛집이 없어요"`(맛집 0곳 placeholder).
- 탭 → `navigate(LogScreen, { roomId })` **불변**. 본인 닉/아바타는 `useProfile`(추가 페치 아님 — 프로필은 이미 조회되는 데이터).

### 10-4. 하단 "새 로그 시작하기" CTA (mk.addRow 재현)
- `FlatList` `ListFooterComponent` = `CreateLogCta`: 투명 배경 + **2px dashed `primary` 보더** + `Icon plus`(primary) + "새 로그 시작하기"(body, primary).
- onPress = `handleCreate`(= `createRoom()` → `refresh()`, 실패 시 Alert) — `PlusHeaderButton`과 동일 계약. `creating`(loading) 중 비활성(onPress=undefined → Card가 View로 렌더, opacity 0.5).

### 10-5. 빈 상태 (EmptyLogs — mk-home 재현)
- `🍜`(display 40) + "아직 로그가 없어요"(h2) + "로그를 만들고 초대코드로 연인을 초대해\n함께 다닌 맛집을 기록해보세요."(body, fgWeak, center) + `Button "로그 만들기"`(primary, leftIcon 자리엔 Button 미지원이라 텍스트만; onPress=handleCreate, creating 중 loading).
- 기존 "오른쪽 위 + 버튼으로…" 안내 카피는 헤더에 +버튼이 여전히 있으나, 빈 상태에 직접 생성 버튼을 두는 mk 패턴으로 대체.

### 10-6. 생산자 ↔ 소비자 매핑 (QA 교차검증)
| 생산자 | 소비자 | 계약 |
|---|---|---|
| `useAuth().state.userId` (authenticated) | `HomeHeader`·`LogListScreen` | userId → `useProfile`/`useSelfDisplay` 주입. 비인증 시 폴백 아바타/'나'. |
| `useProfile({ userId })` | `HomeHeader`(아바타)·`LogCard`(아바타/닉) | `{ nickname, avatarUrl }` ready 시 사용. 추가 RPC/페치 없음. |
| `useCreateRoom().createRoom` | `LogListScreen`(빈상태 버튼·하단 CTA) | 무인자 호출 → 성공 시 `refresh()`. `PlusHeaderButton`과 동일. |
| `useMyLogsContext().refresh` | `LogListScreen` 생성 성공 후 | 목록 즉시 +1. |
| `Routes.Profile` | `HomeHeader` 아바타 버튼 | `navigate(Routes.Profile)` (ProfileHeaderButton과 동일 대상). |
| `MyLog.{roomId,memberCount,createdAt}` | `LogCard` | roomId→navigate / memberCount→배지·커플 골격 / createdAt→"YYYY.MM.DD 시작". |

### 10-7. 플레이스홀더로 남긴 데이터 의존 부분 (백엔드 미존재 → 차기)
- **짝꿍(파트너) 이름·아바타**: `muklogs`/멤버 프로필 join 부재 → 커플 카드는 본인 아바타 + **익명 아바타 겹침** + 타이틀 "{닉} ♥ 짝꿍"(익명 표기). 실데이터는 멤버 프로필 조회 도입 시.
- **미리보기 사진**: `muklogs` 테이블/사진 컬럼 미존재 → **빈 점선 슬롯 4개**(가짜 이모지 없음).
- **맛집 수**: 동일 사유 → "아직 기록한 맛집이 없어요"(0곳 고정 문구). 실집계는 muklogs 도입 후 "맛집 N곳 기록했어요"로 교체.

### 10-8. 완료 기준 결과 (충실화 후)
| 게이트 | 결과 |
|---|---|
| `npm test` | **28 suites / 177 tests 통과** (보정 전 27/170 → HomeHeader 5 + LogList 추가 2 케이스). |
| `npx tsc --noEmit` | **EXIT 0**. |
| raw hex 0 | 변경 파일(HomeHeader/LogListScreen/PlusHeaderButton/HomeTabs) **0건**(토큰만). |
| 이모지 | **허용(이번 결정)** — 🍽️/🍜/♥ 의도적 사용. |

---

## 디테일 정합 보정 (muklog 웜 변형 킷 — `ui_kits/muklog`)

사용자 지적("폰트크기·카드 박스 쉐이프·스트로크 색상 부족")에 따라 일반 원티드 값으로 어긋나 있던 토큰을 muklog 킷(index.html `:root --mk-*`, mk-ui.jsx, mk-home.jsx) 실수치에 정확히 맞췄다. UI-only, 동작/네비/훅 불변.

### 토큰 before → after (`src/theme/tokens.ts`)

| 시맨틱 | before(틀림) | after(킷) | 킷 출처 |
|---|---|---|---|
| primary | #3366FF | #3366FF (유지) | --mk-accent |
| accentStrong [신규] | (brand=#0066FF로 오용) | **#1F4FE0** | --mk-accent-strong |
| primaryWeak | #EAF2FE | **#EAF0FF** | --mk-accent-weak |
| accentLine [신규] | 없음 | **#BFD0FF** | --mk-accent-line |
| accentShadow [신규] | 없음 | **rgba(51,102,255,0.30)** | --mk-accent-shadow |
| fg | #171717(쿨) | **#2A2422**(웜) | --mk-ink |
| fgWeak | #737373 | **#5C5550** | --mk-ink2 |
| radius.card | 16 | **22** | --mk-radius-card |
| radius.control | 10 | **14** | --mk-radius-btn |
| shadow.card [신규] | 없음 | color #785A46 / op .10 / r10 / off{0,2} / elev2 | --mk-shadow-card(rgba 120,90,70) |

- 신규 키(accentStrong/accentLine/accentShadow)는 **light/dark 양쪽 미러링**(tokens.spec 키 일관성 단언 통과). dark 대응: accentStrong=#4F95FF, accentLine=rgba(79,149,255,.40), accentShadow=rgba(51,102,255,.45).
- `palette`에 `blue.accentStrong/accentWeak/accentLine`, `warm.ink/ink2`, `accentShadow`, `shadowWarm(#785A46)` 추가.

### typography 신규 역할 토큰 (킷 실수치)

| role | 크기/family | 킷 적용처 |
|---|---|---|
| wordmark | 26 / Bold (800) | HomeHeader "먹로그" |
| cardTitle | 17 / Bold (700) /1.3 | LogCard 타이틀 |
| emptyTitle | 21 / Bold (800) /1.3 | EmptyLogs 제목 |
| sectionCaption | 14 / Medium (500) /1.5 | "둘만의 맛집 지도를…" |
| meta | 13 / Medium (500) | 카드 날짜 메타(12.5 정수근사) |
| spotCount | 14 / SemiBold (600) | "맛집 N곳"(13.5 근사) |
| badge | 12 / Bold (700) | MemberBadge(11.5 근사) |
| button | 16 / Bold (700) | Button 라벨 |

> RN은 weight를 fontFamily로 잡으므로(fonts.ts: Regular/Medium/SemiBold/Bold) 800·700→Bold, 600→SemiBold, 500→Medium 매핑. 비정수 크기(12.5/13.5/11.5)는 정수 근사.

### 컴포넌트 변경 (생산자 토큰 ↔ 소비처)

| 파일 | 변경 |
|---|---|
| `components/Card.tsx` | 헤어라인 보더 **제거** → `theme.shadow.card`(소프트 웜 섀도우) 적용. borderWidth 삭제. radius.card=22 자동 반영. |
| `components/Button.tsx` | primary에 `0 6px 16px accentShadow` 근사 섀도우(shadowColor=accentShadow, op1, r16, off{0,6}, elev4) 추가. 라벨 `body`→`button`(700). radius.control=14 자동 반영. |
| `components/Badge.tsx` | 텍스트 `caption/primary`→`badge/accentStrong`. 배경 primaryWeak(=#EAF0FF) 자동 반영. |
| `components/Avatar.tsx` | inset ring 2px 근사(borderWidth 1→**2**). StyleSheet import 정리. |
| `navigation/HomeHeader.tsx` | 워드마크 `h2`(24)→`wordmark`(26/800). |
| `navigation/screens/LogListScreen.tsx` | cardTitle/meta/spotCount/sectionCaption/emptyTitle 역할 토큰 적용. 미리보기 슬롯 radius lg(12)→control(14). 하단 CTA 보더 primary→**accentLine**, plus·라벨 primary→**accentStrong**, 라벨 `button`(700). CTA는 투명표면이라 Card 섀도우 무력화(shadowOpacity 0/elevation 0). |

### 갱신한 spec (TDD — 새 값으로 의미 있는 단언 유지)

| spec | 갱신 |
|---|---|
| `theme/tokens.spec.ts` | accentStrong=#1F4FE0 / primaryWeak=#EAF0FF / accentLine=#BFD0FF / accentShadow / fg·fgWeak 웜잉크 / radius control14·card22 / shadow.card / typography 역할 크기 단언 추가. |
| `components/Card.spec.tsx` | "헤어라인 보더+radius16+그림자0" → "소프트 웜 섀도우(#785A46)+radius22+보더없음". |
| `components/Badge.spec.tsx` | primaryWeak 배경 #EAF2FE → **#EAF0FF**. |
| `components/Icon.spec.tsx` | 기본 fg #171717 → **#2A2422**(웜 잉크). |

### 완료 기준 결과 (보정 후)

| 게이트 | 결과 |
|---|---|
| `npm test` | **28 suites / 184 tests 통과** (보정 전 177 → tokens +7 신규 단언). |
| `npx tsc --noEmit` | **EXIT 0**. |
| raw hex 0 | 변경 컴포넌트 본문 **0건**(토큰만). |

### QA 교차검증 포인트
- 토큰 SSOT ↔ 소비처: accentStrong/accentLine/accentShadow 신규 키가 Badge·CTA·Button 섀도우에서 정확히 소비되는지.
- dark 미러링 키 일관성(tokens.spec 'darkColor 동일 키' 통과 확인).
- Card 섀도우 전환이 모든 Card 소비처(LogCard·CTA·ProfileScreen 입력은 Card 아님)에 의도대로 적용되는지 — CTA만 섀도우 무력화.
