# QA Report — ui-kit-fidelity 스프린트

> 검증자: qa-inspector. 방법: 킷(`ui_kits/muklog`)↔RN "양쪽 동시 읽기" + 컨벤션 grep + `npm test`/`tsc`.
> 분류: ✅통과 / ❌실패(파일:라인+수정안) / ⚠️미검증(사유).
> 라인 근거는 검증 시점 기준.

---

## Task #2 — 공용 프리미티브 + 토큰 (ui-publisher) — ✅ 통과

검증 라운드 1 (2026-06-11). 빌드 게이트: `tsc --noEmit` 0, `jest` 328 pass / 1 fail(아래 ※ 다운스트림, Task#2 결함 아님).

### Q1. FoodCover — ✅
- 킷 `mk-data.js:5-14` CAT.grad 8종 ↔ `categories.ts:11-18` `colors[from,to]`: **8종 전부 hex 정확 일치**(pasta #FFD9A8/#FF9E7D … izakaya #FFCBB8/#E8806B).
- `FoodCover.tsx:46` cafe 폴백 = 킷 `CAT[cat]||CAT.cafe` 정합. `LinearGradient` start{0,0}→end{1,1}(140deg 근사), radius 기본 20, emojiSize 40 — 킷 정합.
- drop-shadow→`textShadow rgba(0,0,0,0.12)`(`FoodCover.tsx:73`): 프레젠테이션 전용 근사, ui-spec §A1 기록. 시맨틱 색 아님 → raw 예외 정당.

### Q2. Button — ✅
- 킷 `mk-ui.jsx:81-93` ↔ `Button.tsx:29-33`: pad/fs 실값 정확 일치(lg 16/22·17, md 13/18·16, sm 9/14·14).
- variant skin: primary=accent bg+accentShadow(`:82-91`), soft=primaryWeak+accentStrong(`:67,75`), ghost=투명+fgWeak(`:71,79`) — 킷 정합. secondary 호환 보존(킷에 없는 기존 소비처용, ui-spec 명시).
- leftIcon gap 8(`styles.row:136`), full→alignSelf stretch(`:102`), disabled opacity 0.45(`:100`) — 킷 정합.

### Q3. Chip — ✅
- 킷 `mk-ui.jsx:121-136` ↔ `Chip.tsx`: selected primary/primaryFg·미선택 surface/fgWeak/hairline 보더(`:28-33`), pad 8×13·gap 5(`:53-60`), 600/13.5(spotCount+fontSize override `:63`), emoji 14(`:62`), radius full. `accessibilityState.selected` 노출(`:38`).

### Q4. MemberBadge — ✅ (솔로 텍스트 의도적 편차 승인)
- 킷 `mk-ui.jsx:139-152` ↔ `MemberBadge.tsx`: ≥2 💑둘이(primaryWeak/accentStrong)·<2 🙋혼자(surfaceAlt/fgWeak), pad 3/9/3/7·gap 4(`:39-48`), 이모지 12, badge 700/11.5 — 정합.
- **편차**: 솔로 텍스트색. 킷 `--text-alternative`(≈fgMuted) → RN `fgWeak`. plan §3.4 결정(가독성 우선)으로 의도적. **승인** — fgWeak가 더 진해 대비 양호, 도메인적으로 무해. 솔로 배경도 킷 `--fill`→`surfaceAlt` 매핑 합리.

### Q5. Avatar — ✅
- 킷 `mk-ui.jsx:65-77` ↔ `Avatar.tsx`: 우선순위 url>userId디폴트>이니셜>익명🙂 구현(`:43-111`). 디폴트 bg `color+26`·ring `color+55`(`:75-77`) = 킷 정확 정합. 이모지 size×0.5(`:81`). inset ring→borderWidth 2 근사(레이아웃 영향, ui-spec 기록).
- `withAlpha`(`:29`) 잘못된 hex 안전 흡수. testID 4종(image/default/placeholder/anonymous) 계약 명확.
- `avatarDefault.ts`: 결정적 31진 해시(`:49-56`), userId→이모지+컬러 페어, falsy→0번 폴백. 도메인 팔레트 raw hex는 plan §3.2 예외(테마 토큰 아님) 정당.

### A6. Stars — ✅
- `Stars.tsx:35` 채움 `starFill`(=#FFB23E `tokens.ts:30,52`), 빈 `borderStrong`. 킷 `mk-ui.jsx:42`(#FFB23E/--line-strong) 정합. raw hex 0(토큰 경유).

### A7. IconButton — ✅
- 킷 `mk-ui.jsx:106-118` ↔ `IconButton.tsx`: 40×40 원형, icon 22, badge 도트 top7/right8·8×8·2px 링(`:76-84`), color/bg 토큰, accessibilityLabel 필수. 정합.

### A8. 토큰 — ✅
- `tokens.ts`: `starFill` #FFB23E light/dark(`:30,52`, dark는 lightColor 스프레드 상속), `radius.action`=18(`:76`), `spacing` 7/18/26 추가(`:71`). 카테고리 그라데이션 categories.ts SSOT.

### 컨벤션 — ✅
- useCallback/useMemo 실호출 0(주석 negation만). `export function` 컴포넌트/훅 0(전부 화살표 const). named-object 인자 준수. raw hex in 프리미티브: FoodCover textShadow rgba 1건(근사, 정당) 외 0. 파일명=심볼명.

### 로드베어링 표본 — ✅
- `MemberBadge.spec`(bg/텍스트색 토큰 단언), `Avatar.spec`(color+26/+55 알파·우선순위 testID), `tokens.spec`(starFill≠warning·action===18·spacing 7/18/26) — 핵심 단언 깨면 빨개지는 구조.

---

## ❌ / ⚠️ 트래킹

### ※ ProfileScreen.spec.tsx:119 실패 — developer 소관(Task#4, 예상된 다운스트림)
- 증상: `getByTestId('avatar-placeholder')` 기대인데 Avatar 계약 변경(userId 미전달+nickname null → `avatar-anonymous`)으로 미스.
- **Task#2 프리미티브 결함 아님.** ui-spec.md §"다운스트림 영향"에 사전 기록된 의도된 파급.
- 조치(B3/Task#4, developer): ProfileScreen이 `userId`(auth) 전달(96px) → 디폴트 이모지+컬러. 테스트를 `avatar-default`(userId 有)/`avatar-anonymous`(userId null 빈상태)로 갱신.

---

## B1 MuklogCard (Q6) — ui-publisher(비주얼) + developer(데이터) — ✅ 통과

검증 라운드 1 (2026-06-11). `MuklogCard.spec` 10/10 green, tsc 0(전체 트리 포함).

### 비주얼 충실도 — 킷 `mk-log.jsx:80-118` ↔ `MuklogCard.tsx` ✅
- 커버: `FoodCover radius=0 emojiSize=56 aspectRatio 16/10`(`:52,118`) = 킷 `:89` 정확 정합. 카드 overflow:hidden(`:117`).
- 카테고리 칩 오버레이: top12/left12·radius full·badge(700/11.5)·fgWeak(`:54-72`) = 킷 `:90`. blur 글래스→불투명 surface 근사(RN blur 미지원, ui-spec 기록).
- 사진수 배지(킷 `:93-96`): OUT — plan §44(데이터 없음), 정상 누락.
- 타이틀 행 gap8 + cardTitle(700/17) flex1 numberOfLines1 + Stars14(`:78-83`) = 킷 `:99-102`. 위치줄·메모 2줄 클램프·작성자 행 22px Avatar(ring 없음)+라벨(`:85-110`) 정합.

### 데이터 경계면 (생산자 useMuklogs ↔ 소비자 MuklogCard) ✅
- `types.ts:7-18` Muklog{category|null, createdBy:string(uuid), rating|null, area|null, visitedAt|null, memo|null, placeName} ↔ 카드 소비 키 전부 일치. shape 변경 0.
- `createdBy` non-null → `<Avatar userId={createdBy}>`(`:106`) 항상 `avatar-default` 결정적 익명(작성자별 안정 이모지). 작성자 anonymous 폴백 없음 — 정상.
- 결측 처리 전부 구현+테스트: category null→칩 숨김(`:35`), area null→날짜만(`:38`), memo null→행 생략(`:92`), visitedAt null→`formatVisitedDate`가 '날짜 미정'(`formatVisitedDate.ts:17`).
- props 계약 `{muklog, meId}` 불변 → MuklogList 바인딩 영향 0.
- snake→camel: useMuklogs `toMuklog`가 `created_by→createdBy` 매핑, 카드는 camelCase 일관 소비.

### 로드베어링 — ✅
`MuklogCard.spec`: aspectRatio 16/10, avatar-default 22px, meId 라벨 양분기('내가/짝꿍이 기록'), 메모 numberOfLines=2, 칩 null 숨김, area/visitedAt/memo null 결측 — 핵심 단언 깨면 빨개지는 구조.

### ⚠️ 마이너 관찰(비차단, ui-publisher 인지용)
- `--text-alternative` 매핑 일관성: 본 카드 작성자 캡션은 `fgMuted`, 그런데 MemberBadge 솔로는 `fgWeak`로 매핑됨. 각자 컨텍스트별로 정당(소형 배지 가독성 vs 캡션 톤)하나 동일 킷 토큰의 RN 매핑이 갈림 — 차기 토큰 정리 시 통일 고려.
- nearest-token 근사(spacing[5/9/11/15] 부재): 칩 pad 5→4, 본문 padding 15→16, 메모 margin 9→8, 작성자 marginTop 11→12. 각 1px 내외, plan A8 nearest 정책 정당.

---

---

## B3 ProfileScreen (Q8) — ui-publisher(비주얼) + developer(데이터) — ✅ 통과

검증 라운드 1 (2026-06-11). `ProfileScreen.spec` 13/13 green. **기존 red(ProfileScreen.spec:119) 해소 확인.** 전체 스위트 333 pass(병렬 3회 연속 안정).

### 비주얼 충실도 — 킷 `mk-log.jsx:380-451` ↔ `ProfileScreen.tsx` ✅
- 96px 아바타(`:152` `url→이미지/userId→디폴트`) + 카메라 배지 32px right2/bottom2·borderWidth3(inset ring 근사)·camera16 primaryFg(`:153-164`) = 킷 `:397-400`.
- 닉네임 + 편집 버튼 30px(surfaceAlt 원형, setting 아이콘15 fgWeak)(`:167-182`) = 킷 `:402-407`(킷도 setting 기어 아이콘).
- 통계 3칸 surface/radius.sheet/shadow.card, value h2(22) accentStrong·label caption fgMuted·borderLeft hairline(`:186-209`) = 킷 `:411-417`. **"기록한 맛집"="-"**(집계 OUT, plan §38 — 킷 totalSpots 대비 의도적 스코프 컷).
- 설정 4행 bell/heart/circle-info/setting + chevron, gap13/pad14, borderBottom hairline(`:212-237`) = 킷 `:421-429`. 신규 아이콘 3종 추가 확인(Icon.tsx:28-30).
- 닉네임 편집 시트: input border2 primary·radius.control·pad14/16·autoFocus·maxLength + Button lg full(`:247-283`) = 킷 `:433-439`. + prefill·canSave(변경+검증+미저장 시만 활성) 가드 추가(킷보다 견고).
- **이모지 선택 시트 OUT 확인** — 킷 `:441-449` 미구현이 정상(plan §47 리더 결정, 아바타=이미지 업로드만). ✅
- SubBar: 킷 `:391` SUBBAR(title="프로필"·onBack)은 네비게이터가 제공(`AppNavigator.tsx:35` `title:'프로필'` + detailHeader back). ✅

### 데이터 경계면 ✅
- `userId` 단일 출처 = `useAuth` state.userId(`:48`) → Avatar/useProfile/useUpdateProfile/useMyLogs 일관 전달.
- **useMyLogs 경계**: `MyLog{ memberCount }`(`useMyLogs.ts:20`, snake `member_count`→camel `:47` 매핑) ↔ 소비자 `log.memberCount`(`:112`) **정확 일치**. 커플 카운트=`memberCount>=2`.
- useProfile{nickname, avatarUrl} / useUpdateProfile{saveNickname, changeAvatar, savingNickname, uploadingAvatar, error} 전부 정확 소비. saveNickname({nickname}) named-arg 일치.
- **기존 red 해소 메커니즘**: Avatar에 `userId={state.userId}` 배선(`:152`) → url/nickname null이어도 `avatar-default`. 테스트도 `avatar-default`/`avatar-image`/빈상태 단언으로 갱신(spec:82-91,161-166). **실질 수정(껍데기 아님)** 확인.

### 컨벤션 ✅
- raw hex 0(`ProfileScreen.tsx`), useEffect 명명 함수(`syncNicknameDraft :65`), 화살표 const, named-object 인자.

### 로드베어링 ✅
`ProfileScreen.spec` 13건: 상태분기(loading/error→refresh), avatar-default/avatar-image, changeAvatar 호출, 통계 계산(3/-/2), 설정 4행, 닉네임 prefill/disabled/save→refresh, 빈상태 — 핵심 단언 load-bearing.

### ⚠️ 마이너 관찰(비차단)
- 닉네임 타이포: RN `h3`(20/SemiBold) vs 킷 `800/22`. 통계 value는 fontSize22 정합이나 닉네임은 약간 작음. 차기 미세조정 후보(비차단).

---

## ⚠️ 빌드 게이트 운영 노트 (team 인지)
- 검증 중 **전체 스위트 11 fail**을 1회 포착했으나, ui-publisher가 B5 파일(InviteCodeCard.tsx 등)을 **동시 저장 중인 과도기 상태**였음(테스트 수 331→333 증가). 직후 병렬 3회 연속 333 green으로 안정 — **실 회귀 아님(편집 중 캡처)**.
- 잠재 리스크(현재 green, 비차단): `npm test`=병렬 `jest`, jest 설정에 `resetMocks/restoreMocks` 없음. InviteCodeCard/LogScreen의 `await waitFor`(clipboard 비동기) 테스트는 워커 경합 시 타임아웃 민감 가능. **빌드 게이트는 편집이 멈춘 settled 트리에서 판정 권장.**

---

---

## B3 데이터 배선 (developer Q8) — ✅ 통과
- `ProfileScreen.tsx:112`가 인라인 계산 → **`computeProfileStats({logs})`**(테스트된 단일 출처) 소비. `spotCount ?? '-'`(:115) = SPOT_COUNT_UNAVAILABLE(null)→"-". loading/error→[]→0/-/0.
- `profileStats.spec` 로드베어링(toEqual 전체·빈배열·coupleCount·spotCount null). 경계: computeProfileStats(MyLog[]) ↔ useMyLogs 정합. 실 통합 확인(껍데기 아님).

## B5 미세 정합 (ui-publisher Q10) — ✅ 통과
- AddSheet `SheetAction` borderRadius `theme.radius.action`(18)(`AddSheet.tsx:40`) = 킷 SheetAction.
- InviteCodeCard 복사 버튼 공용 `Button(primary, size sm)` + a11y "초대코드 복사"(`InviteCodeCard.tsx:68-74`). useEffect 명명 함수(clearCopiedFeedback). primaryWeak 카드·radius.sheet 정합.
- CodeInput 비활성 셀 `hairline`·채움/활성 `primary`(`CodeInput.tsx:57`), cellChar lineHeight 24(:86), accent-weak glow shadow 근사. raw hex 0.
- JoinLogScreen paddingTop `spacing[12]`·좌우/하단 24(`:49-51`).
- raw hex/rgba 0(B4/B5 신규 화면 전수).

## B4 LogListScreen (Q9) — ⚠️ 조건부 통과 (1 Medium 발견)

킷 `mk-home.jsx:29-101` ↔ `LogListScreen.tsx`. `LogListScreen.spec` 12/12 green.

### 통과 ✅
- 본인 아바타(url/userId 42px) + 커플 시 익명 파트너(`avatar-anonymous` 🙂) marginLeft -12 겹침(`:61-74`) = 킷 `:40-43`. 솔로는 파트너 없음.
- `MemberBadge(memberCount)` 교체(`:80`) = 킷 `:51`. 이름 솔로"{닉}의 기록"/커플"{닉} ♥ 짝꿍"(`cardTitle :31`) — 짝꿍 익명(plan §3.3).
- 빈상태 🍜 64px·emptyTitle(800/21)(`:122-124`) = 킷 `:103-107`. 서브카피 + 점선 "새 로그 시작하기" CTA(accentLine 2px, accentStrong) = 킷 `:88-95`.
- 날짜 "YYYY.MM.DD 시작"(formatLogDate). 경계: useMyLogsContext MyLog{memberCount,createdAt,roomId} 소비·navigate(LogScreen,{roomId})·useProfile/useCreateRoom 정합.

### ❌ Medium — 카드 푸터 "아직 기록한 맛집이 없어요" 오버클레임
- `LogListScreen.tsx:110` **무조건** "아직 기록한 맛집이 없어요" 렌더(가드 없음). spec `:173`도 이 카피를 "정직 표기"로 단언.
- **문제**: list_my_rooms(MyLog)에 맛집 수 없음 → 데이터 부재인데 화면은 **"0곳"을 사실로 단언**. 실제 muklog가 있는 로그도 "없어요"로 표시되어 **LogScreen 실제 내용과 모순**. 팀이 표방한 "정직" 원칙에 오히려 위배(거짓 음성).
- **권고**: 거짓 카운트 단언 제거 → 중립 카피("맛집을 기록해보세요" 등) 또는 라인 생략. 데이터(맛집 수)가 진짜 생기면 그때 동적화.
- 라우팅: 카피=ui-publisher / 플레이스홀더 정책 결정=sprint-planner / (실값 소스는 백엔드 후속, developer 인지).

### ⚠️ 마이너 관찰(비차단)
- 커플 날짜: 킷 `:53`은 커플=`함께한 지 N일`(SINCE), 솔로=`시작`. RN은 양쪽 모두 "시작" 정적 날짜(상대시간 회피). 미세 충실도 갭 — ui-publisher 인지.
- 미리보기 4슬롯: 킷 `:62-65`는 실 muklog→FoodCover 미리보기 + 빈슬롯, RN은 **전 슬롯 점선 빈칸**(MyLog에 muklogs 없음→정직 플레이스홀더). mismatch-map B4 "FoodCover 미리보기 데이터 연결" 미구현 — sprint-planner 인지(쿼리 비용상 descope 합리, 단 문서화 필요).
- chevron RN size20/fgMuted vs 킷 size18/fgAssistive — 미세.

---

---

## B2 LogScreen 헤더·초대영역 (ui-publisher Q7 부분) — ✅ 통과 (Q7 나머지 미검증)

킷 `mk-log.jsx:9-52` ↔ `LogScreen.tsx`. `LogScreen.spec` 8건 green. 트리 settled 333 green, tsc 0.

### 통과 ✅
- 헤더 아바타 겹침: me(url+userId 28px) + 커플 익명 파트너(28px marginLeft -9)(`:130-138`) = 킷 `:21-24`. 로그명 솔로"{닉}의 기록"/커플"{닉} ♥ 짝꿍"(`logTitle :26`) — 짝꿍 익명 폴백(plan §117).
- 초대영역: 솔로=InviteCodeCard + "초대코드로 짝꿍을 초대하세요"(`:149-155`) / 커플=CompactInviteRow(link15 fgMuted + "초대코드 {code}" + 복사 accentStrong, copied→복사됨)(`:51-68`) = 킷 `:46-52`.
- **AC3 교차스프린트 역전 — 정당 확인.** 커플도 코드 노출은 plan.md:120(="둘이 함께 기록 중" 블록→컴팩트 코드 행 교체)·:138·:166이 명시 승인. log-invite의 "코드 숨김"을 의도적으로 덮어씀. 회귀 아님.
- 경계면: useRoom `RoomDetail{inviteCode, memberCount}`(snake invite_code/member_count 매핑) ↔ `room.inviteCode`/`room.memberCount`(`:124,148,151`) 정확 일치. useProfile(meId)→nickname/avatarUrl, useAuth meId 정합.
- 코드 보안: error 상태에서 코드 미노출(spec:82 AC5 단언). 컨벤션: useEffect 명명 함수(clearCompactCopied), raw hex 0.

### ⚠️ 마이너 관찰(비차단)
- **MemberBadge가 헤더에 추가됨**(`:142`) — 킷 LogScreen 헤더(`:17-29`)엔 MemberBadge 없음. plan §138 B2 헤더 목록에도 미명시. 앱 일관성상 무해한 enrichment이나 킷/plan 초과 항목 → ui-publisher 의도 확인 권장.
- **솔로 초대 따뜻함 갭**: 킷 솔로(`:33-45`)는 💌 + "연인을 초대해보세요" 헤딩 + 설명("이 코드를 보내면…") 포함 강조 배너. RN은 InviteCodeCard + 1줄 카피로 단순화(plan:120 "솔로=InviteCodeCard" 선택). 온보딩 카피 warmth 일부 손실 — plan 사항이라 비차단.
- 이중 헤더: 네비게이터 "로그" 제너릭 타이틀 + 콘텐츠 헤더(아바타+로그명) 병존(킷은 단일 헤더에 back+아바타+로그명). RN 네이티브 적응 — 비차단.
- spec 파일 헤더 주석(`LogScreen.spec.tsx:2`) "커플(코드 숨김)"이 잔존(실제 테스트는 커플 코드 노출 단언) — 스테일 주석, ui-publisher/developer 정리 권장.

### ⚠️ Q7 나머지 미검증 (developer MuklogList 배선)
- 섹션 헤더 "우리 맛집 N"(800/19)+"최근 순", 카테고리 필터 칩 행(전체+useMuklogs unique cat), 입력 FAB(right18/bottom26+accentShadow) — `MuklogList`(developer) 영역. 배선 완료 후 Q7 나머지 + ①Chip 필터 경계면 검증 예정.

---

---

## B6 HomeHeader/HomeTabs (ui-publisher Q11) — ✅ 통과

킷 `mk-home.jsx:6-26`(HomeHeader)·`mk-ui.jsx:175-199`(MkTabBar) ↔ `HomeHeader.tsx`/`HomeTabs.tsx`. `HomeHeader.spec` 4 green, 전체 338 green, tsc 0.

### 통과 ✅
- HomeHeader: 워드마크 "먹로그"(wordmark 800/26, letterSpacing -0.5)+🍽️ 19px **baseline 정렬**(`:59-65,94`) = 킷 `:14-16`. 컨테이너 left20/right12/bottom12 + safe-area top(`:52-55`) = 킷 `:10`.
- 프로필 아바타 36px(userId/url/nickname)(`HomeHeaderAvatar :27-37`) = 킷 `:21`. 탭→Routes.Profile(`:72`).
- PlusHeaderButton 40 원형 **accent-weak 버블**(primaryWeak bg + Plus24)(`PlusHeaderButton.tsx:54-64`) = 킷 IBTN `:19`(bg accent-weak).
- HomeTabs: 먹로그(Bubble/BubbleFill)·지도(Location) 2탭, active primary/inactive fgWeak(`HomeTabs.tsx:27-28,42-58`) = 킷 MkTabBar. 공통 커스텀 헤더 `header:()=><HomeHeader/>`.
- 경계: useAuth userId→useProfile→Avatar 정합. raw hex 0, memo 0. tabBarIcon 콜백 객체인자=라이브러리 contract 예외(주석 명시).

### ⚠️ 마이너 관찰(비차단)
- Plus 아이콘 색: 킷 IBTN은 `accent-strong`(#1F4FE0), RN은 `primary`(#3366FF). 1단계 톤 차 — 미세.
- HomeHeader left gap `spacing[6]` vs 킷 gap 7(A8에서 `spacing[7]` 신설됨 → 7로 맞추면 정확). 미세.
- HomeTabs 비활성: 킷 아이콘=text-assistive·라벨=text-alternative, RN 둘 다 fgWeak. 미세 톤 차.

---

## B4 푸터 카피 — sprint-planner 정책 확정(2026-06-11), 수정 대기 中
- planner 결정: 카드 푸터 거짓음성 → **count-free 중립 카피**("맛집을 기록해보세요" 기본) 채택. 미리보기 점선/파트너 익명 = **의도된 descope**(plan §2 OUT③·§5 B4·§9-3, mismatch-map B4 노트).
- **QA 인수조건**(재검증 시): 푸터에 "없어요"류 카운트 단언 0 + 맛집 유무·솔로/커플 무관 동일 문구. spec(`LogListScreen.spec.tsx:173`)도 카운트 단언 제거로 갱신.
- 상태: **ui-publisher 카피 수정 대기** → 반영되면 재검증.

---

---

## B4 푸터 카피 재검증 — ✅ 해소 (Medium close)
- `LogListScreen.tsx:110` "아직 기록한 맛집이 없어요" → **"맛집을 기록해보세요"**(count-free, 맛집 유무·솔로/커플 무관 동일·참). spec `LogListScreen.spec.tsx:181` 새 카피 단언 + `:183` 옛 카피 부재 단언. planner 인수조건 충족. ❌Medium → ✅.
- (트리비얼) `LogListScreen.tsx:8` 주석에 옛 카피 잔존 — 비기능 스테일 주석.

## B2 Q7 나머지 — MuklogList (developer Q7) — ✅ 통과
킷 `mk-log.jsx:54-78` ↔ `MuklogList.tsx`. `MuklogList.spec` 11/11 green.
- 섹션 헤더 "우리 맛집 {count}"(`:49` variant **sectionTitle 800/19** = tokens.ts:109, 킷 :56) + "최근 순"(meta) baseline space-between. **N = state.muklogs.length 필터 무관 전체 수**(`:35`) = 킷 `:56`. spec `:137-144`가 칩 필터 후에도 "우리 맛집 2" 유지를 명시 단언(검증포인트① 충족).
- 필터 칩 행: `Chip` "전체"(chip-all, category===null) + `muklogCategoriesInUse(muklogs)`(CAT 정의순·null/미지 배제, `filterByCategory.ts:13`) → `chip-{key}` emoji/label(`:102-117`), gap `spacing[7]`. 빈 목록→칩 행 미표시(spec:157). 필터=`filterMuklogsByCategory`(null→원본)(`:122`).
- FAB: right `spacing[18]`·bottom `spacing[26]`·primary 원형·Plus26 primaryFg(`:131-147`) = plan §B2 위치.
- 빈 상태(ready & 0): 🍽️ + "아직 기록한 맛집이 없어요"(여기선 useMuklogs가 실제 0 확인 → **참**, B4 푸터와 다름) + 안내.
- 경계: useMuklogs Muklog[] ↔ 칩 도출·필터·MuklogCard(meId) 정합. filterByCategory 순수함수 테스트 분리.
- 마이너(비차단): **FAB 그림자 `shadow.md`(블랙) — plan/mismatch-map B2는 accentShadow 의도**. accent 틴트 그림자로 바꾸면 정확(Button primary와 일관). ui-publisher 인지.

---

## ✅ 최종 검증 결과 (2026-06-11)

**전 모듈 통과. 빌드 게이트 green.**
- 게이트: 병렬 `npm test` 339/339 (settled 트리 2회 연속) · `runInBand` 339/339 · `tsc --noEmit` 0.
- 커버리지: 프리미티브+토큰(A1~A8) ✅ / B1 MuklogCard ✅ / B2 LogScreen(헤더·초대+MuklogList) ✅ / B3 ProfileScreen ✅ / B4 LogListScreen ✅(푸터 카피 해소) / B5 미세정합 ✅ / B6 HomeHeader/HomeTabs ✅.
- 컨벤션: useCallback/useMemo 실호출 0, `export function` 컴포넌트/훅 0, raw hex(테마) 0(FoodCover textShadow·아바타/카테고리 도메인 팔레트는 명시 예외), useEffect 명명 함수, 파일명=심볼명 — 전수 통과.
- 경계면: snake→camel 매핑(member_count/invite_code/created_by), 생산자 훅↔소비자 화면 shape 전부 정합. 계약 불일치 0.

**의도된 미구현(planner 승인 descope — 통과 처리):** 미리보기 FoodCover 데이터 연결, 파트너 실데이터(익명 대체), 맛집 집계 spot_count, 커플 "함께한 지 N일" → 모두 백엔드 후속(plan §9-3).

**잔여 마이너(비차단, 차기 미세조정 후보):** FAB accentShadow, B6 Plus 아이콘 accentStrong·HomeHeader gap7·탭 비활성 톤, B3 닉네임 800/22, B2 솔로 초대 warmth(plan §118 의도 유지), 트리비얼 스테일 주석(LogScreen.tsx:3, LogListScreen.tsx:8). **기능/계약/빌드 영향 없음.**

### 후속 라운드 해소(2026-06-11, 재검증)
- **B2 헤더 MemberBadge 초과 → 해소.** ui-publisher가 헤더 MemberBadge 제거(킷 단일 출처 정합, 커플 여부는 아바타 겹침으로 표현). import·spec 둘이/혼자 단언도 제거, LogScreen.spec 스테일 주석 갱신. 339 green·tsc 0 재확인. (LogScreen.tsx:3 doc 주석에 "+ MemberBadge" 잔존 — 트리비얼.)
- **B4 커플 날짜 → 해소/정합.** `LogListScreen.tsx:82`가 솔로·커플 모두 `formatLogDate + " 시작"`, sinceLabel/Date.now 부재(planner plan §5 B4 ✅확정). 킷 "함께한 지"는 데이터-상대시간 회피로 의도적 통일.
- **B2 Q7 ①(Chip 필터) 재확인** — MuklogList 필터 배선 완료분, "우리 맛집 N" 필터 무관 유지(spec:137-144) 재확인 통과.

### 후속 라운드 2 해소(2026-06-11, B6 마이너 + 칩 bleed)
- B6-1 Plus 아이콘 `primary→accentStrong`(PlusHeaderButton:64) ✅ 킷 IBTN 정합.
- B6-2 HomeHeader 좌측 gap `spacing[6]→[7]`(HomeHeader:59) ✅ 킷 정확.
- B6-3 HomeTabs 비활성 라벨 `fgMuted`·먹로그 아이콘 `fgAssistive` ✅. (트리비얼: **지도 탭 아이콘은 `fgWeak` 잔존**(HomeTabs:58) — 먹로그 탭과 톤 불일치, 둘 다 fgAssistive 권장. 비차단.)
- MuklogList 칩 행 edge-bleed(marginHorizontal -20 + paddingHorizontal 20)(:101,104) ✅ 킷 overflow-x.
- LogListScreen:8 스테일 주석 정리 ✅. 게이트 339/339·tsc 0 재확인.

**최종 판정(유지): 스프린트 인수조건 충족 — 완료 가능.** 게이트 339/339 green·tsc 0. 잔여는 전부 비차단 트리비얼(지도탭 아이콘 톤 1건, LogScreen.tsx:3 doc 주석).

---

## 후속 픽스 검증 (2026-06-11, LogScreen 비주얼 충실도 4건)

ui-publisher가 수정한 4건(솔로 초대 배너+link 아이콘 / empty 이모지 클리핑 / 카드 칩 이모지 클리핑 / 헤더 뒤로가기+타이틀)을 킷(mk-log.jsx, mk-home.jsx) 라인 ↔ RN 양쪽 동시 대조로 교차검증.

**판정: 조건부 PASS** — 게이트 344/344 green · tsc 0. 킷 충실도·경계면·테스트 진정성·컨벤션 모두 통과하나 **이슈4(헤더)에서 safe-area top 회귀 1건(주의 등급)** 발견 → ui-publisher 조치 권장.

### 픽스 1 — 솔로 초대 배너 + 복사버튼 link 아이콘 ✅ PASS
- **킷 충실도(킷 mk-log:33-45 ↔ LogScreen.tsx:87-111)**: accent-weak 배경 카드(`primaryWeak`/radius `sheet`(20)/padding 16) ✅. 💌(fontSize 20) + 헤딩 "연인을 초대해보세요" ✅. 설명문 "이 코드를 보내면 둘이 함께 기록하는 커플 로그가 돼요." 문구 일치 ✅(LogScreen.tsx:106). 내부 InviteCodeCard 배너 중첩 ✅. 커플 컴팩트 행(link + "초대코드 XXXXXX" + 복사, 킷 mk-log:48-51) ✅(LogScreen.tsx:46-85).
- **킷 충실도(킷 mk-home InviteCodeCard:227 leftIcon="link" ↔ InviteCodeCard.tsx:73)**: 복사 버튼 `leftIcon={IconName.Link}` ✅.
- **경계면 정합**: `IconName.Link`(Icon.tsx:31)→`'link'`→`ICON_SVG.link`(icons.ts:25) 글리프 존재 ✅. Button `leftIcon?: IconName`(Button.tsx:39) prop shape 일치, primary variant fgToken으로 아이콘 재색칠 ✅. InviteCodeCard가 코드/복사 모두 처리 — 솔로 배너에서 코드 1회만 렌더(중복 없음) ✅.
- **참고(비차단)**: 솔로 배너 헤딩에 `variant="navTitle"`(16/Bold) 사용 — 킷은 15px/700. navTitle은 헤더 로그명용으로 신설된 토큰인데 배너 헤딩에 재사용됨. 1px 차이 + 토큰 의미 약간 어긋남(트리비얼). 별도 토큰 불요, 현행 수용.

### 픽스 2 — empty 이모지 클리핑 ✅ PASS
- **MuklogList.tsx:174** `emptyEmoji: { fontSize: 44, lineHeight: 56, textAlignVertical: 'center' }`. 비율 1.27 → 🍽️ 상/하단 글리프 보존에 충분한 헤드룸. 테스트가 `lineHeight > fontSize`를 단언(회귀 lock) ✅.

### 픽스 3 — 카드 칩 이모지 클리핑 ✅ PASS
- **MuklogCard.tsx:124 + 65** chipText `lineHeight: 16`(badge fontSize 12, 비율 1.33) + paddingVertical 6. 킷 mk-log:90 단일 span(이모지+라벨) 구조 유지 ✅. 클리핑 해소 수치로 적정.
- **테스트 진정성**: MuklogCard.spec:39-46이 칩 텍스트 style을 flatten해 `lineHeight > fontSize` 단언 — 존재확인 아닌 실수치 회귀 lock ✅.
- **잔존 패턴 점검**: 동일 "이모지+타이트 lineHeight(==fontSize)" 패턴은 타이포 토큰 강제 lineHeight를 가진 곳에만 발생. FoodCover(`lineHeight: undefined`로 자연 행높이, 커버 56/92)·Chip(14)·MemberBadge(12)·Avatar(size×0.5)는 명시 lineHeight 없이 폰트 자연 행높이(≈1.2×) → 클리핑 없음. **잔존 위험 없음** ✅.

### 픽스 4 — 헤더 뒤로가기 + 타이틀 ⚠️ 조건부 PASS (회귀 1건)
- **킷 충실도(킷 mk-log:18-29 ↔ LogScreen.tsx:171-196)**: chevron-left IconButton(size 24) + 아바타 겹침(28px, 파트너 marginLeft -9) + 로그명(navTitle 16/Bold, 킷 700/16) 구조 일치 ✅. paddingBottom 6, 좌8/우12, headerMain marginLeft 2 ✅.
- **경계면 정합**:
  - `navTitle` 토큰(tokens.ts:110, 16/1.2/Bold) ↔ `TypographyVariant`(typography 키 파생) — 타입 정합 ✅. tsc 0.
  - `navigation.goBack()`(LogScreen.tsx:179) ↔ AppNavigator(headerShown:false, :42). LogScreen은 **AppNavigator 단일 등록**, 진입 경로 3곳(PlusHeaderButton navigate / JoinLogScreen replace / LogListScreen navigate) 모두 동일 스택 내부 → 하단에 HomeTabs 엔트리 존재하므로 자체 헤더 back→goBack 실제 동작 ✅.
  - headerShown:false는 **LogScreen만** 적용(Profile·JoinLog는 detailHeaderOptions로 native 헤더 유지) → 다른 화면 헤더 영향 없음 ✅. 이중 헤더 방지 의도 정확.
- **🔴 회귀(주의 등급) — safe-area top 미처리 / 노치 겹침 위험**:
  - 킷 헤더는 `paddingTop: SP2` = `MK_STATUS_PAD` = **56px**(mk-ui.jsx:215, "다이나믹 아일랜드/상태바 확보")로 상태바를 클리어한다.
  - RN 번역은 `paddingTop: theme.spacing[12]` = **12px**로 축소(LogScreen.tsx:173) + `Screen edges={['left','right','bottom']}`로 **top 엣지 제외**(LogScreen.tsx:170). 즉 native 헤더 제거(headerShown:false)로 사라진 top inset을 **자체 헤더도 SafeAreaView도 보충하지 않는다.**
  - 결과: 노치/다이나믹 아일랜드 기기에서 뒤로가기 버튼·아바타·로그명이 상태바와 겹친다. 솔로/커플 무관 전 디바이스 영향.
  - 다른 self-header 없는 화면(Profile·JoinLog)은 native 헤더가 top inset을 대신 처리하므로 무사 — **이 회귀는 LogScreen 단독**(headerShown:false + top 엣지 제외 + 고정 12px 동시 충족 화면).
  - ui-spec.md·dev-notes.md에 `MK_STATUS_PAD`(56) → RN 번역 기록 **없음** → 의도된 결정 아닌 누락으로 분류.
  - **권장 조치(ui-publisher)**: 택1 — (a) `Screen edges`에 `'top'` 추가하여 SafeAreaView가 inset 처리(가장 단순, 단 헤더 위 bg 패딩이 추가됨), 또는 (b) `useSafeAreaInsets().top`을 헤더 `paddingTop`에 더해 킷 SP2(56) 의미 재현(`paddingTop: insets.top + spacing[?]`). 단위 테스트로 헤더 paddingTop이 인셋 반영하는지 lock 권장(현재 LogScreen.spec에 top inset 검증 없음 — 테스트 공백).

### 테스트 진정성 / 게이트
- LogScreen.spec(154줄): 배너 문구·💌·goBack 호출(fireEvent.press→toHaveBeenCalledTimes 1)·컴팩트 행을 **실제 단언**. 빈 스냅샷·존재확인만 아님 ✅. InviteCodeCard.spec:44-46 link 아이콘 testID 단언 ✅. MuklogCard.spec:39-46 칩 lineHeight>fontSize 단언 ✅.
- **공백**: 픽스4 safe-area top inset을 검증하는 테스트 없음(회귀가 테스트로 잡히지 않음).
- `npm test` 전체 **344/344 PASS**, `tsc --noEmit` **0 에러** 재확인 ✅.

### 컨벤션
- 터치 파일(LogScreen/InviteCodeCard/MuklogCard/MuklogList) raw hex **0**(토큰 경유) ✅. 화살표 const 컴포넌트(`function` 선언 0) ✅. named-args(`logTitle({nickname,isCouple})`) ✅. useEffect 명명 함수(`clearCompactCopied`/`clearCopiedFeedback`) + 명명 cleanup ✅.

### 후속 픽스 종합 판정
**조건부 PASS** — 킷 충실도·경계면·테스트·컨벤션 통과(344/344·tsc 0). 차단 이슈 없으나 **픽스4의 safe-area top 회귀(주의)** 는 실제 노치 기기에서 헤더 가림을 유발하므로 ui-publisher 조치 권장(edges top 추가 또는 useSafeAreaInsets, + inset 테스트 lock). 이 1건 외 잔여는 비차단 트리비얼(navTitle 배너 재사용 1px).
