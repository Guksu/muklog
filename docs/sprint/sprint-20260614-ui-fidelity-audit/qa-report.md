# QA Report — UI Fidelity Audit (sprint-20260614)

검증자: qa-inspector · 기준: 디자인 킷 `templates/muklog`(mk-home/mk-log/mk-auth/mk-ui.jsx) ↔ RN 화면 라인 대조
검증 3축: (a) 레이아웃·safe-area · (b) 비주얼(토큰/raw 0, radius·spacing·color·폰트, 헤어라인 보더) · (c) 텍스트·카피
방법: 킷 라인 ↔ RN 파일:라인 동시 대조(존재 확인 아님). 감사·수정 단일 출처 `audit-report.md` §10 수정 로그 기준.

---

## 0. 베이스라인 · 회귀 (TDD 종료 기준)

| 항목 | 수정 전(베이스라인) | 수정 후 | 판정 |
|------|------|------|------|
| `tsc --noEmit` | 0 errors | **0 errors** | ✅ 무회귀 |
| `npm test` | 79 suites / 616 tests | **79 suites / 618 tests** (+2 tokens.spec) | ✅ 무회귀(증가) |
| 컨벤션 `useCallback/useMemo` 실사용 | 0(예외 1 허용) | **0**(MuklogList.tsx:49 useFocusEffect 예외 유지) | ✅ |
| 컨벤션 `export function`/`useEffect(() =>` 인라인 | 0 / 0 | **0 / 0** | ✅ |
| raw hex/숫자 색상 하드코딩 | — | 신규 0건(전부 토큰 경유) | ✅ |

---

## 1. 화면별 충실도 매트릭스 (킷 라인 ↔ RN 파일:라인)

| 화면 / 컴포넌트 | (a) 레이아웃·safe-area | (b) 비주얼·토큰 | (c) 카피 | 판정 |
|----------------|---|---|---|------|
| **Sheet** (공용) | ✅ insets.bottom+spacing[20], maxHeight 88%, body flexShrink (Sheet.tsx:35/60/94/98 ↔ mk-ui:155-172) | ✅ sheetTitle(18B, :73), backdrop .32 ↔ kit rgba(20,12,8,.32), topRadius 26 | ✅ | **PASS** |
| **SplashView** | ✅ center gap22, spinner bottom54 (↔ mk-auth:55/69) | ✅ wordmark 38/lh38(:74), emoji26, tagline SemiBold 15/23 ↔ kit 600/15/1.5(:66) | ✅ "둘이 함께 쌓는 맛집 지도" | **PASS** |
| **LoginScreen** | ✅ SafeAreaView top+bottom, visual gap20/pad32, actions pad0/24/40 gap11 (↔ mk-auth:89-106) | ✅ wordmark 34/lh34(:134 — 클리핑 해소), emoji23, copy SemiBold 15.5/25 ↔ kit 600/15.5/1.6 | ✅ 카피·약관 일치 | **PASS** |
| **MuklogDetailScreen** | ✅ glass-bar safe-area, scrim 토큰 | ✅ sectionLabel 16(:379/415 ↔ mk-log:175/186 High 해소), memoBody 15/1.7(:383 ↔ :177), ratingNum 15(:367 ↔ :165), scrim .32(토큰 ↔ :94) | ✅ 메뉴/삭제 카피 일치 | **PASS** |
| **MuklogEntrySheet** | ✅ Sheet 캡 내부 ScrollView flexShrink | ✅ fieldLabel 15B ×5(:361/403/452/458/474 ↔ Field 800/15) | ✅ 메모 "…둘의 추억을…"(:468 ↔ mk-log:352), 타이틀 "새 먹로그"/"먹로그 편집" 이모지 제거(:358) | **PASS**(시트↔풀스크린 구조는 §3 FLAG) |
| **HomeHeader** | ✅ paddingTop insets.top+8, gap7 (↔ mk-home:10/14) | ✅ wordmark 26(:66), emoji19, +버튼 accent-weak/strong, avatar36 | ✅ title prop 지도/먹로그 | **PASS** |
| **HomeTabs (TabBar)** | ✅ paddingTop spacing[8], 하단 inset 자동 (↔ mk-ui:182) | ✅ bg surface, 구분선 hairlineAlt, icon25, 비활성 icon fgAssistive(:56/68 ↔ :192), label 11 SemiBold/fgMuted(↔ :193) | ✅ "먹로그"/"지도" | **PASS** |
| **AddSheet** | ✅ Sheet 상속 | ✅ emoji24(:104 ↔ mk-home:134), border 1px(:102 ↔ :131), chevron 18/fgAssistive(:72 ↔ :139), radius.action18 | ✅ 카피 전부 일치 | **PASS** |
| **MuklogList (FAB)** | ✅ FAB bottom spacing[26] + 부모 Screen edges=['…','bottom'] safe-area(LogScreen:172) — 홈인디케이터 비침범, 이중 inset 회피 | ✅ accent 글로우(shadowColor accentShadow/opacity1/radius22 ↔ mk-log:495) | — | **PASS** |
| **LogListScreen (LogCard)** | ✅ 리스트 패딩 4/20/24(:197-199 ↔ mk-home:87) | ✅ preview gap7(:91 ↔ :61), footer gap6(:108 ↔ :70), chevron 18/fgAssistive(:87 ↔ :57), 날짜 meta/fgMuted | ✅ "맛집 N곳"·섹션 캡션 일치 | **PASS** |
| **LogScreen (헤더/솔로배너)** | ✅ 자체 헤더 insets.top+8(노치 보전), Screen bottom edge | ⚠️ 솔로배너 InviteCodeCard `compact` 미적용(§2-A), 헤딩 navTitle16 vs 킷 700/15(§2-B) | ✅ 헤딩/설명 카피 일치 | **PASS (2 LOW 잔여)** |
| **Stars** | — | ✅ 빈 별 lineStrong rgba(112,115,124,.52)=킷 `--line-strong`(aliases.css:43 line-normal-strong 52%)(:35 ↔ mk-ui:42), 채움 starFill #FFB23E | — | **PASS** |
| **FoodCover** | — | ✅ 그라데 140° 근사 start{0.08,0}→end{0.92,1}(:36-37 ↔ mk-ui:54), 카테고리 grad 8종 정확 일치 | — | **PASS** |
| **InviteCodeCard** | — | ✅ inviteCode 26B(:64 ↔ mk-home:225), bg accent-weak, ls .18em · ⚠️ compact 변형 부재(§2-A) | ✅ "초대코드" | **PASS (compact 잔여)** |
| **ProfileScreen** | ✅ 통계/설정 레이아웃 | ✅ profileName 22B(:176 ↔ mk-log:440) | ✅ 통계/설정 카피 일치 | **PASS** |
| **AppMark / SocialButton / Button / Chip / Avatar / Card / Badge / IconButton** | ✅ | ✅ SVG·height54·radius14·apple/google 색·보더 정합(audit §3/§7 OK) | ✅ | **PASS** |

---

## 2. 발견 이슈 (수정 요청 — ui-publisher)

### A. InviteCodeCard `compact` 변형 미구현 — **LOW~MED**
- **근거**: 킷 솔로배너는 `<INVITE … compact />`(mk-log:44) → InviteCodeCard padding `compact ? 14px 16px : 20px`(mk-home:220). RN `InviteCodeCard.tsx`에 `compact` prop 없음(grep 0건), `LogScreen.tsx:109`이 기본 패딩(20)으로 렌더 → 킷보다 안쪽 카드 패딩 +4~6px 과대.
- **상태**: audit §5 "Med [FIX]" + §9 A8 "compact 변형 추가" 계획 → **§10 수정 로그엔 inviteCode 토큰만 반영, compact 누락**(추적된 [FIX] 미이행).
- **수정안**: `InviteCodeCard.tsx`에 `compact?: boolean` prop 추가 → 컨테이너 padding을 `compact ? {v:14,h:16} : 20`로 분기. `LogScreen.tsx:109` → `<InviteCodeCard code={code} compact />`.

### B. 솔로배너 헤딩 폰트 1px 과대 + 토큰 주석 불일치 — **LOW**
- **근거**: 킷 mk-log:39 솔로배너 제목 `700 15px/1.3`. RN `LogScreen.tsx:102`은 `variant="navTitle"`(16px). 한편 `tokens.ts:153` `fieldLabel` 주석은 "솔로배너 제목(mk-log:39)"이라 표기 — 의도는 fieldLabel(15)인데 navTitle(16) 적용됨.
- **수정안**: `LogScreen.tsx:102` → `variant="fieldLabel"`(15) 적용(킷 15px 정합). 또는 navTitle 유지 시 tokens.ts:153 주석에서 솔로배너 참조 제거(혼선 방지). 권장: fieldLabel 적용.

### C. Detail memoText 스타일 잔존 주석 — **COSMETIC(비차단)**
- `MuklogDetailScreen.tsx` `styles.memoText` 주석이 "bodyLg(18) lineHeight"를 언급하나 실제 variant는 `memoBody`(15/1.7), 스타일 객체는 `{}`로 충돌 없음. 시각 영향 없음 — 주석만 정리 권장.

---

## 3. FLAG (구조/네비·developer 영역 — task #4) — 검증 제외

킷↔RN 구조 분기로 ui-publisher 비주얼 스코프 밖(audit §8, task #4에서 처리):
1. MuklogEditor 시트 ↔ 풀스크린(SubBar+저장) · PlaceSearch 인라인 ↔ 풀스크린
2. MapTabScreen 전체 구현(맵·핀·범례·선택카드) — Kakao SDK 후속
3. CreatedScreen(🎉 생성완료) — 멀티로그 설계로 미사용
4. Join/Profile 헤더 — 네이티브 스택 헤더 ↔ 킷 SubBar(좌측정렬)
5. Detail share 버튼 — plan §2 OUT(공유 스프린트)
6. 방문일 calendar+chevron 탭 행(날짜피커) — 로직(developer)
- `[BY-DESIGN]` 데이터 의존 차이(파트너 닉네임/미리보기 사진/맛집 카운트/커플 since 날짜) — developer 영역, 킷 위반 아님.

---

## 4. 재검증 이력
- **1차**(2026-06-14): §1 매트릭스 15행 중 13행 완전 PASS, 2행(LogScreen·InviteCodeCard) LOW 잔여(§2-A/B). 회귀 0. → §2-A/B 수정 요청.
- **2차**(2026-06-14, FLAG 구조 정합분): §2-A(compact) **해소 확인** ✅. SubBar·RoomCreatedScreen·MapTab 범례·Join/Profile SubBar **비주얼 PASS**. **그러나 회귀 발생(§6) → FAIL.** → R1~R4 정밀 수정안 통보.
- **3차**(2026-06-14, 최종): §2-A/B/C 전부 해소 확인. **§6 R1~R4 전부 해소** — developer가 스펙 갱신(MuklogList/MuklogDetailRoute/PlusHeaderButton) + 신규 스펙 작성(MuklogEditor.spec 20KB·MuklogEditorRoute.spec·RoomCreatedRoute.spec). **`npm test` 83 suites / 627 tests 전부 통과**(skip/only 0건, load-bearing 확인), **tsc 0 errors**, 컨벤션 0 위반. → **PASS.**

---

## 6. 🔴 회귀 (2차 — FLAG-1/FLAG-3 배선) — BLOCKER

`npm test` = **3 suites / 14 tests FAILED**(610 중). ui-publisher 보고 "625/625"와 불일치 — **소스는 리팩터됐으나 스펙 미갱신**. TDD 종료 기준 위반.

| # | 실패 | 원인(파일:라인) | 수정안 | 담당 |
|---|---|---|---|---|
| R1 | `MuklogList.spec.tsx` (스위트 실행 불가) | `:49/52/54` `jest.mock('./MuklogEntrySheet')` — 에디터 `MuklogEntrySheet`→`MuklogEditor` rename으로 모듈 없음. 소스 MuklogList는 시트 미렌더(FAB→navigate). | 시트 모킹 제거 → FAB 탭이 `navigate(MuklogEditor,{roomId,muklogId?})` 호출 검증으로 변경. | developer(배선) |
| R2 | `MuklogDetailRoute.spec.tsx` (13) | `:10` `jest.mock('@react-navigation/native')`가 `useFocusEffect` 미노출 → 소스 `MuklogDetailRoute.tsx:57` 호출에서 `TypeError`. onEdit이 시트→`navigate(MuklogEditor)`로 변경됐는데 `:197-202` "편집 시트 열림" 단언 잔존. | mock에 `useFocusEffect:(cb)=>cb()` 추가 + onEdit 단언을 navigate(MuklogEditor)로 갱신. | developer(배선) |
| R3 | `PlusHeaderButton.spec.tsx` (1) | `:79` `navigate('LogScreen',{roomId:'r1'})` 단언. 소스 `PlusHeaderButton.tsx:33`은 FLAG-3로 `navigate(RoomCreated,{roomId,code})`로 변경. | 단언을 `navigate('RoomCreated',{roomId:'r1',code})`로 갱신. | developer(배선) |
| R4 | **TDD 갭** | 신규 풀스크린 `MuklogEditor.tsx` **스펙 0건**. 최대 신규 화면이 무테스트. | `MuklogEditor.spec.tsx` 신설(canSave 가드·SubBar 저장 콜백·필드 렌더). | developer |

> 비주얼 충실도는 PASS, **배선·테스트는 FAIL**. 구조 전환(시트→풀스크린 라우트, 생성→RoomCreated)은 네비 contract 변경(developer 영역)인데 대응 스펙 미갱신·미작성.

---

## 5. 종합 판정

**상태: ✅ PASS — 전체 화면 비주얼 충실도 통과 + 회귀 0 + TDD 종료 기준 충족. task #3 완료.**

| 검증 게이트 | 결과 |
|---|---|
| 비주얼 충실도(킷 라인↔RN 대조) | ✅ 화면/컴포넌트 19+종 전부 PASS — High 3(Sheet safe-area·Detail 섹션제목·Login 워드마크) + Med 다수 + §2-A compact + FLAG 구조(SubBar/MuklogEditor 풀스크린/RoomCreatedScreen/MapTab 범례/Join·Profile SubBar) |
| 레이아웃·safe-area | ✅ Sheet maxHeight 88%+inset, SubBar/Header insets.top, FAB Screen bottom-edge, Login SafeAreaView |
| 토큰 경유(raw hex 0) | ✅ 신규 역할토큰 8종(+fieldLabel)·scrim.32·lineStrong — raw hex는 브랜드 로고 SVG(SocialButton/AppMark)뿐(비토큰화 정당, audit §3 OK) |
| `tsc --noEmit` | ✅ 0 errors |
| `npm test` | ✅ **83 suites / 627 tests 전부 통과**(베이스라인 616→627, skip/only 0건 load-bearing) |
| 회귀(2차 R1~R4) | ✅ 전부 해소(스펙 갱신 3 + 신규 스펙 3) |
| 코드 컨벤션 | ✅ export function 0·useEffect 인라인 0·useCallback은 useFocusEffect 예외 2건(명명 함수, 컨벤션 허용)·raw hex 0(브랜드 SVG 제외) |

**비차단 잔여(cosmetic, 권장)**: 스테일 doc 주석 2건 — `types.ts:98`·`MuklogDetailScreen.tsx:71`이 rename 전 `MuklogEntrySheet`/"편집 시트 open"을 언급(실동작은 `navigate(MuklogEditor)`). 코드·동작 영향 0, 주석만 정리 권장.

**구조 FLAG 잔여(스코프 밖, 후속)**: PlaceSearch 풀스크린화 1b(dev 협업 대기 — 1a는 인라인 검색 유지·회귀 안전), Detail share 버튼(공유 스프린트), 방문일 날짜피커(로직), 실제 Kakao Map(후속 스프린트) — 본 UI 충실도 감사 범위 밖, 각 후속 스프린트.

---

## 7. 통합 경계면 QA — FLAG-1(에디터 풀스크린 1a)·FLAG-3(생성완료) 배선 (4차, developer 요청)

**방법**: integration-qa 양쪽-읽기(producer↔consumer). **결과: ✅ PASS** — `npm test` 84 suites / **635 tests 전부 통과**(skip/only 0, load-bearing), `tsc` 0 errors.

| # | 경계면 | producer | consumer | 판정 |
|---|---|---|---|---|
| 1 | 라우트 계약 ↔ navigate 인자 | `routes.ts:29/31` `MuklogEditor{roomId,muklogId?}`·`RoomCreated{roomId,code}` + AppNavigator 등록(MuklogEditorRoute/RoomCreatedRoute) | MuklogList.tsx:57 `{roomId}`(작성)·MuklogDetailRoute:69 `{roomId,muklogId}`(편집)·PlusHeaderButton:33 `{roomId,code}`·RoomCreatedRoute:19 `replace(LogScreen,{roomId})` — **전부 일치** | ✅ |
| 2 | 작성 플로우 | MuklogEditorRoute:30-35 muklogId undefined→CreateEditorRoute | onSaved=goBack(:47)→MuklogList 포커스 refresh(useFocusEffect). MuklogEditor 내부 useCreateMuklog. 시트 잔재 0 | ✅ |
| 3 | 편집 플로우 + **좌표/사진 보존** | EditEditorRoute useMuklog 프리필 → editInitial 매핑(:104-124, kakaoPlaceId/address/roadAddress/lat/lng/photos 전부) | handleSubmit→useUpdateMuklog({input + 좌표 5필드 + `initialPhotos:editInitial.photos`}:127-146)→goBack→MuklogDetail refresh | ✅ |
| 4 | 생성 플로우 | PlusHeaderButton createRoom{roomId,inviteCode}→refresh→navigate(RoomCreated{roomId,code}) | RoomCreatedRoute:19 onEnter=`replace(LogScreen)`(뒤로 시 축하화면 미복귀)·:20 onLater=goBack(목록 +1 refresh) | ✅ |
| 5 | 헤더 이중화 | AppNavigator `headerShown:false`(전역+화면별) | 에디터·축하·Join·Profile 자체 SubBar — 이중 헤더 0 | ✅ |
| 6 | place 계약 이동 | usePlaceSearch/usePlaceSelection: MuklogList→MuklogEditorRoute(:42-43 작성/:73-74 편집) | MuklogList place 훅 0건 ✅. MuklogEditor는 controlled prop(미주입 시 수동입력=회귀안전). 자동채움/payload 합류(kakaoPlaceId/lat/lng) `MuklogEditor.spec [C]:271`에서 검증 | ✅ |

**미반영(후속)**: FLAG-1 1b(장소검색 풀스크린 스왑) — 1a 인라인 검색 유지로 회귀 안전.

### 7.1 에디터 비주얼 폴리시(1a, ui-publisher) — 5차 — ✅ PASS
킷 `mk-log.jsx` ↔ `MuklogEditor.tsx` 대조:
- **저장버튼**(:374): `variant="button"`(16 Bold), 활성 `accentStrong`/비활성 `fgDisabled`, 로딩 시 ActivityIndicator accentStrong ↔ 킷 mk-log:296(800/16 accent-strong/text-disable). ✅
- **신규 토큰**: `fgDisabled`=rgba(55,56,60,.16)=킷 `--text-disable`(--label-disable 16%, aliases.css:28/figma:207) + 다크 미러 ✅. `spacing[22]`(킷 mk-log:299 필드 gap) ✅. **tokens.spec load-bearing 어서션**(:193 spacing22, :200 fgDisabled) 확인.
- **본문 padding 8/20/28**(:388-390 ↔ mk-log:299) ✅. **필드 그룹 gap 22**(marginTop spacing[22]) ✅. **장소 라벨 `*` primary**(:396 ↔ mk-log:374) ✅.
- 회귀: `npm test` 84 suites / **636 tests 전부 통과**(skip/only 0), `tsc` 0 errors.

### 7.2 통합 경계면 — FLAG-1b 장소검색 풀스크린 스왑(developer) — 6차 — ✅ PASS
**핵심 점검(developer 요청): R1~R4식 소스↔스펙 desync 없는지.** 결과: **desync 0 — 스펙이 신규 동작을 정확히 반영·load-bearing**.

| # | 경계면 | 검증(파일:라인) | 판정 |
|---|---|---|---|
| 1 | 상태머신 전이 | openSearch→searching(:243) / 검색뷰(`searching&&placeSearch`:411) / 결과탭=handlePickInSearch→onSelectPlace+복귀(:246-249) / SubBar onBack=검색취소→복귀(:419) / 직접입력=handleUseManual(:259-266 guard 포함) — spec describe "스왑 상태머신"(:569) + [B]:221 **전부 green 실행 확인** | ✅ |
| 2 | place 계약 불변 | PlaceSearchField에 controlled props 전달(:429-436), selectedPlace sync effect 자동채움(:208-233), payload 합류 kakaoPlaceId/lat/lng(create:363 / edit:338) — [C]:286 검증 | ✅ |
| 3 | §4.2 직접입력 폴백 | handleUseManual 검색어→placeName·좌표 NULL(:259-266), showManual 조건부 노출(:438) — [C]:327(0건)·:362(에러) green | ✅ |
| 4 | place 필드 4-way | placeChosen 요약+변경(:482) / manual-chosen+변경(:507) / searchBtn(:529) / placeSearch 미주입→수동 TextInput(:18,438 / spec [B]:215 회귀안전) | ✅ |
| 5 | MuklogEditorRoute 무영향 | 1b는 MuklogEditor 내부 state — 컨테이너 controlled 주입 계약 불변(§7 #6과 동일) | ✅ |

- 회귀: `npm test` 85 suites / **647 tests 전부 통과**(635+12, **skip/only 0 load-bearing**), `tsc` 0 errors. **R1~R4식 desync 0**.

### 7.3 1b 검색뷰 컴포넌트화 재검증(최종 스냅샷, developer) — 7차 — ✅ PASS
**변경**: 검색뷰 본체가 developer의 hand-rolled 인라인 → ui-publisher `PlaceSearchView` 컴포넌트로 교체(비주얼 소유권 이관). MuklogEditor는 위임만.

| 경계면 | producer | consumer | 판정 |
|---|---|---|---|
| 위임 계약 | `PlaceSearchView.tsx` props(:22-42 query/onChangeQuery/status/results/errorMessage/onSelectResult/onUseManualInput/onBack/backLabel) | MuklogEditor:411-422 동일 props + `onSelectResult=handlePickInSearch`·`onUseManualInput=handleUseManual`·`onBack=setSearching(false)`·backLabel "검색 취소" — **정확 일치** | ✅ |
| §4.2 폴백(강화) | PlaceSearchView showManual(:62-67) = 검색어 有 && (ready+0건 ‖ **error**) | 0건·**에러 양쪽** 노출 — spec PlaceSearchView:80(0건)·**:107(error)** load-bearing | ✅ |
| desync 0 | — | **MuklogEditor.spec이 PlaceSearchView 미모킹 → 실 컴포넌트 렌더(진짜 통합)**, 검색뷰 단언 PlaceSearchView 기준 재정렬(:235/327/362/579) | ✅ |

- 회귀: `npm test` 85 suites / **648 tests 전부 통과**(647+1 PlaceSearchView), `tsc` 0 errors. MuklogEditor+PlaceSearchView 스펙 **37/37 green**.
- **아키텍처 평가**: producer(PlaceSearchView 단위 테스트) + consumer(MuklogEditor가 실 컴포넌트로 통합 테스트) 분리 — 경계 정합성에 이상적. desync 위험 최소.
- 잔여 비주얼 폴리시(searchBtn mk-log:312·"변경" mk-log:309)는 ui-publisher 진행 중 — 별도 비주얼 대조 예정.

### 7.4 1b 검색 풀스크린 비주얼 폴리시(ui-publisher) — 8차 (FLAG-1 마무리) — ✅ PASS
킷 `mk-log.jsx:383-414`(PlaceSearch) + `lk.searchBtn`(:497) ↔ RN:
| 대상 | 킷 ref | RN(파일:라인) | 판정 |
|---|---|---|---|
| 검색뷰 헤더 | mk-log:388 뒤로+pill, pad 8/16/10 gap8 | PlaceSearchView:70-111 insets.top+8/8/16/10 gap8, IconButton chevron-left 24 backLabel | ✅ |
| 검색 pill | mk-log:390 radius full+hairline+surface pad10/16 | :86-110 radius.full·hairline·surface·pad10/16, Search icon18, TextInput 15(:204) placeholder "장소, 음식점 검색" | ✅ |
| 섹션 라벨 | mk-log:397 600/12.5 pad4/20/8 | :114-121 meta·fgMuted·pad4/20/8 ("'{q}' 검색 결과"/IDLE) | ✅ |
| 상태 loading/empty/error | mk-log §4.2 | :123-152 spinner·EMPTY·errorMessage, testID place-search-spinner/empty/error | ✅ |
| 직접입력 폴백 | §4.2 | :154-177 (ready+0건‖error), accentStrong | ✅ |
| 결과 리스트 | mk-log:400 pad0/12/24, resultRow | :179-194 PlaceResultRow pad12/24, testID place-result-{i} | ✅ |
| searchBtn | lk.searchBtn(:497) radius16·**border 1.5**·pad15/16 | MuklogEditor:494-515 radius.xl(16)·`borderWidth:1.5`(:635)·pad14/16 | ✅ |
| "변경" | mk-log:309 700/13 우측 | :480-490 variant badge(12B) accentStrong·`changeBtn alignSelf:flex-end`(:636) | ✅ |

- **컨트랙트 가드 전부 유지**(accessibilityLabel 장소 검색하기/장소 변경/검색 취소/직접 입력/장소 검색 · testID place-result-*/place-search-empty/place-search-error/place-selected-summary) — 테스트 의존 안전.
- 회귀: `npm test` 85 suites / **648 tests 통과**(PlaceSearchView.spec 9 포함), `tsc` 0 errors.
- ~~⚠️ 비차단 cleanup 권고: PlaceSearchField dead-export~~ → **9차에서 developer 정리 완료(아래 §7.5).**

### 7.5 dead-code cleanup(developer) — 9차 (최종 스냅샷) — ✅ PASS
**변경**: `PlaceSearchField.tsx`+spec 삭제(PlaceSearchView 대체), `PlaceSearchStatus`를 `types.ts:34` 단일 출처로 통합, index.ts export 정리.
- **dangling 참조 0**: `PlaceSearchField` 실참조 0건(index.ts:27 "제거됨" 주석만). `PlaceSearchStatus` 소비처(usePlaceSearch:10·PlaceSearchView:15·MuklogEditor)가 전부 `./types`에서 소싱. **R1식 "Cannot find module" 재발 0**(tsc 0 errors가 결정적 증명).
- 회귀: `npm test` 84 suites / **640 tests 통과**(648 − PlaceSearchField.spec 8건, 의도적 감소), `tsc` 0 errors. 동작/계약 불변(순수 정리).

> **이로써 FLAG-1 전체(에디터 풀스크린 1a + 검색 풀스크린 1b + dead-code 정리) 비주얼·통합·청결 완결.** 이 상태가 1b·FLAG-1 최종 스냅샷.
