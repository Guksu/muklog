# UI Fidelity Audit — 전체 화면 비주얼 충실도 전수 감사

> 디자인 단일 출처: 킷 `templates/muklog`(`.claude/skills/ui-design/templates/muklog/` — `mk-auth.jsx`·`mk-home.jsx`·`mk-log.jsx`·`mk-ui.jsx`·`mk-data.js`·`index.html`).
> 토큰 출처: `src/theme/tokens.ts`. 가이드: `ui-publishing` 스킬.
> 방법: 킷 함수 ↔ RN 파일을 3축 동시 대조 — (a) 레이아웃·safe-area, (b) 비주얼(토큰·radius·spacing·color·폰트·그림자→헤어라인), (c) 텍스트/카피.
> 작성: ui-publisher. 날짜: 2026-06-14.

---

## 0. 요약

- 토큰 매핑은 전반적으로 정확(raw hex 0건, `--mk-*` 실값 일치). **카테고리 그라데이션 8종 hex 쌍이 `categories.ts` ↔ `mk-data.js` 정확 일치**, FoodCover는 카테고리별 `expo-linear-gradient` 렌더(단색 폴백 아님) — 킷 준수.
- 핵심 결함은 **(1) 공용 Sheet의 safe-area·maxHeight 부재**(보고 이슈 ①), **(2) 일부 폰트 역할 토큰 오용으로 인한 크기 과대**(상세 섹션 제목·메모·로그인 워드마크 lineHeight clip), **(3) MuklogEntrySheet·검색 UI의 구조/카피 차이**(보고 이슈 ②)다.
- 다수 카피/구조 차이는 **데이터 부재 또는 구조 분기로 문서화된 의도적 사항**(파트너 닉네임 부재, 멀티로그 설계, Kakao SDK 후속 스프린트). 이들은 developer/리더 결정 영역으로 분리 표기.

### 작업 분류
- **A. ui-publisher 즉시 수정**(비주얼/토큰/레이아웃, 로직 불변) — §2~§7의 `[FIX]` 표기 항목.
- **B. 구조/네비 결정 필요**(리더·developer) — §8의 `[FLAG]` 항목(시트↔풀스크린, MapTab 구현, CreatedScreen, 네이티브 헤더 vs SubBar).
- **C. 데이터 의존 의도적 차이**(developer) — `[BY-DESIGN]` 표기, 수정 대상 아님.

---

## 1. 보고 우선 이슈

### ① 공용 Sheet 엣지투엣지 침범 — `[FIX]`
- **원인 확정**: `src/components/Sheet.tsx`는 `useSafeAreaInsets` 미적용 + `maxHeight` 캡 없음. 패널 `paddingBottom: spacing[32]` 고정 → 홈 인디케이터 안전영역 침범. 내용(장소검색 결과)이 길어지면 패널이 화면 꼭대기까지 차오름(상단 캡 없음).
- 킷 `mk-ui.jsx:155-172` Sheet: 디바이스 프레임 `inset:0` 안에서 하단 정렬, 패널 `padding:10px 20px 34px`. 웹 프레임은 자체 safe-area를 가지므로 RN에선 **하단 inset 합산 + 상단 maxHeight 캡**으로 번역해야 함(`Screen.tsx`가 화면 safe-area를 처리하는 것과 동급).
- **수정**: 패널에 `paddingBottom = insets.bottom + spacing[20]`, `maxHeight = '88%'`, 내부 `children`을 ScrollView 친화(이미 MuklogEntrySheet는 내부 ScrollView 사용) 되도록 패널 `flexShrink`. §2 참조.

### ② MuklogEntrySheet·검색 UI가 킷과 다름 — 일부 `[FIX]`, 구조는 `[FLAG]`
- **구조(FLAG)**: 킷 `MuklogEditor`(mk-log:281-368)는 **풀스크린**(SubBar: 뒤로 + 타이틀 + 우측 "저장" 버튼). 킷 `PlaceSearch`(mk-log:383-414)도 **풀스크린 검색 뷰**(헤더 back + 라운드 검색 pill + 결과 리스트). RN은 **하단 Sheet + 인라인 PlaceSearchField**. 시트↔풀스크린은 네비게이션 구조 변경(developer 영역) → §8 FLAG.
- **카피/비주얼(FIX)**:
  - 메모 placeholder: 킷 `"무엇을 먹었고 어땠는지, 둘의 추억을 남겨보세요 💕"`(mk-log:352) ↔ RN `"무엇을 먹었고 어땠는지 남겨보세요 💕"`(엔트리시트:468) — "둘의 추억을" 누락.
  - 시트 타이틀: 킷 SUBBAR `"새 먹로그"`/`"먹로그 편집"`(mk-log:295, 이모지 없음) ↔ RN `"새 먹로그 🍽️"`(엔트리시트:358) — 🍽️는 킷 토스트(`"맛집을 기록했어요! 🍽️"`)에만 있음. 타이틀에서 제거.
  - 필드 라벨: 킷 `Field` 라벨 `"800 15px/1"`(Bold, mk-log:373) ↔ RN `variant="bodySm"`(14 Medium) — 라벨이 더 작고 가늚. `sectionLabel`(15 Bold) 적용.
  - 방문일: 킷은 calendar 아이콘 + 포맷 텍스트 + chevron-down **탭 행**(mk-log:357-363) ↔ RN 평문 `TextInput "YYYY-MM-DD"`. 날짜피커는 로직(developer)이나 **비주얼 행 셸**은 킷대로(아이콘+chevron) 번역 권장 → §7 FIX(셸만).
  - 별점: 킷 별점 옆 `"평가"/rating.toFixed(1)` 라벨(mk-log:345) ↔ RN 라벨 없음. (LOW)
  - 카테고리 칩 행: 킷 MuklogEditor엔 **카테고리 필드 없음**(장소 선택에서 파생). RN은 수동 8칩 추가 — 수동입력 경로 보강이므로 `[BY-DESIGN]` 유지(킷 위반 아님, 칩 자체는 MkChip 정합).

---

## 2. 공용 컴포넌트 — Sheet / Screen

| 대상 | 축 | 킷 ref | RN ref | 수정안 | 등급 |
|---|---|---|---|---|---|
| Sheet safe-area | a | mk-ui:155-172 프레임 inset:0 하단정렬 | Sheet.tsx:45-58 inset/ maxHeight 없음 | `useSafeAreaInsets` → paddingBottom=insets.bottom+spacing[20]; panel `maxHeight:'88%'` | **High [FIX]** |
| Sheet 타이틀 폰트 | b | mk-ui:167 `700 18px/1.3` | Sheet.tsx:66 `variant="h3"`(20 SemiBold) | `sheetTitle` 토큰(18 Bold) 신설·적용 | Med [FIX] |
| Sheet 패널 하단 패딩 | b | mk-ui:163 `34` | Sheet.tsx:54 `spacing[32]` | inset 합산으로 흡수(위) | Low [FIX] |

---

## 3. Auth / Splash (vs mk-auth.jsx)

| Screen | 축 | 킷 ref | RN ref | 수정안 | 등급 |
|---|---|---|---|---|---|
| Login 워드마크 | b | mk-auth:96 `800 34px/1`(lh 34) | LoginScreen `emptyTitle`(lh 27)+fontSize34 | `lineHeight:34` 추가(클리핑 방지) | **High [FIX]** |
| Splash 워드마크 | b | mk-auth:63 `800 38px/1`(lh 38) | SplashView `display`(lh 48)+fontSize38 | `lineHeight:38` 추가 | Med [FIX] |
| Splash 태그라인 | b | mk-auth:66 `600 15px/1.5`(SemiBold) | SplashView `bodySm`(Medium 500) | SemiBold family 지정(`Pretendard-SemiBold`) | Med [FIX] |
| Login 카피 | b | mk-auth:99 `600 15.5px/1.6`(SemiBold) | LoginScreen `bodySm`(Medium) | SemiBold family 지정 | Med [FIX] |
| Login 약관 | b | mk-auth:109 `500 11.5px` | caption(12px) | fontSize 11.5 근사 또는 유지 | Low |
| 그라데이션 각도 | b | 160deg 대각 | start{0.2,0}→{0,1} 거의 수직 | 대각 근사 start{0.15,0}→end{0.85,1} | Low [FIX] |
| AppMark / SocialButton | all | mk-auth:8-158 | AppMark.tsx·SocialButton.tsx | **정합(OK)** — SVG·height54·radius14·apple/google 색·보더·카피 일치 | OK |

카피 일치(OK): Splash `"둘이 함께 쌓는 맛집 지도"`, Login `"데이트하며 다닌 맛집을\n사진·메모·위치로 둘이 함께 기록해요."`, 버튼/약관 전부 일치.

---

## 4. Home / List (vs mk-home.jsx · mk-ui MkTabBar)

| Screen | 축 | 킷 ref | RN ref | 수정안 | 등급 |
|---|---|---|---|---|---|
| HomeHeader 타이틀(지도탭) | c | mk-home:261 `title="지도"` | HomeHeader 하드코딩 `"먹로그"`(탭 무관) | `title` prop 추가, 지도탭 "지도" 전달 | Med [FIX] |
| TabBar 패딩 | a | mk-ui:182 `paddingBottom22 paddingTop9` | HomeTabs 미지정(RN 기본) | tabBarStyle paddingTop spacing[8], 하단 inset+기본 | Med [FIX] |
| TabBar 비활성 지도 아이콘색 | b | mk-ui:192 `text-assistive`(fgAssistive) 양탭 동일 | HomeTabs 지도탭 `fgWeak`(과대 진함) | `fgAssistive`로 통일 | Med [FIX] |
| TabBar 상단 구분선 | b | mk-ui:183 `line-alt`(hairlineAlt) | HomeTabs `hairline`(0.22) | `hairlineAlt` | Low [FIX] |
| TabBar 아이콘 크기 | b | mk-ui:192 `25` | nav 기본 | `size={25}` 고정 | Low [FIX] |
| TabBar 배경 | b | mk-ui:183 `mk-card`(surface) | HomeTabs `bg` | `surface`(다크 정합) | Low [FIX] |
| AddSheet 이모지 배지 | b | mk-home:134 `fontSize24` | AddSheet `variant="h3"`(20) | 24px 적용 | Med [FIX] |
| AddSheet SheetAction 보더 | b | mk-home:131 `1px solid line` | AddSheet `hairlineWidth`(~0.5) | `borderWidth:1` | Low [FIX] |
| AddSheet 행 chevron 색 | b | mk-home:139 fgAssistive | AddSheet fgMuted | `fgAssistive` | Low [FIX] |
| LogCard 미리보기 gap | b | mk-home:61 `gap7` | LogListScreen `spacing[6]` | `spacing[7]` | Low [FIX] |
| LogCard chevron | b | mk-home:57 `size18 fgAssistive` | LogListScreen `size20 fgMuted` | `18`/`fgAssistive` | Low [FIX] |
| LogList 리스트 패딩 | b | mk-home:87 `4 / 20 / 24` | uniform 20 | top4/h20/b24 | Low [FIX] |
| LogCard 커플 날짜 | c | mk-home:53 `함께한 지 N일`(since) | 항상 `YYYY.MM.DD 시작` | 커플=since | Med [BY-DESIGN?]→ developer(파트너 createdAt 有) |
| LogCard 미리보기/“맛집 N곳”/“짝꿍” | b/c | mk-home:63,72,47 | 빈 점선/“기록해보세요”/“짝꿍” | 데이터 부재 — | [BY-DESIGN] |

OK: HomeHeader 패딩·워드마크 800/26 ls-0.5·🍽️19·아바타36·+버튼(accent-weak bubble+accentStrong), MemberBadge, Card 섀도우, EmptyLogs 카피/이모지64, AddSheet 카피 전부.

---

## 5. Log / Detail (vs mk-log.jsx)

| Screen | 축 | 킷 ref | RN ref | 수정안 | 등급 |
|---|---|---|---|---|---|
| Detail 섹션제목 "메모"/"위치" | b | mk-log:175,186 `800 16px/1.2` | DetailScreen `emptyTitle`(21px) | `sectionLabel`(16 Bold) 신설·적용 | **High [FIX]** |
| Detail 메모 본문 | b | mk-log:177 `500 15px/1.7` | DetailScreen `bodyLg`(18) | `body`(16) 또는 15 변형 | Med [FIX] |
| Detail 별점 숫자 | b | mk-log:165 `700 15px/1` | DetailScreen `cardTitle`(17) | 15 변형/`navTitle` 근사 | Med [FIX] |
| scrim 투명도 | b | mk-log:94 `rgba(0,0,0,.32)` | tokens scrimStrong `.42` | `.32`로(킷) | Med [FIX] |
| FAB 글로우 | b | mk-log:495 `0 8px22 accent-shadow` | MuklogList `shadow.md`(검정) | accent 틴트 그림자 | Med [FIX] |
| FAB 하단 inset | a | mk-log:494 frame bottom26 | MuklogList `bottom26`(inset 무시) | `insets.bottom+spacing[26]` | Med [FIX] |
| LogScreen 솔로배너 InviteCard | b | mk-log:44 `compact` | InviteCodeCard compact 미지원 | compact 변형 추가(패딩 축소) | Med [FIX] |
| Detail glass 버튼 | b | mk-log:248 `38×38` | IconButton 40×40 | 38 근사(또는 유지) | Low |
| MuklogCard author 카피 | c | mk-log:114 `{nick}님이 기록` | `내가/짝꿍이 기록` | 파트너 닉 부재 — | [BY-DESIGN] |
| Detail share 버튼 | a | mk-log:143 share GlassBtn | 미렌더 | plan §2 OUT | [FLAG] 후속 |
| Detail 미니맵 | a | mk-log:256-277 장식 미니맵 | empty stub | 좌표 부재 — | [BY-DESIGN] |

OK: 카드 16/10·radius22·Stars14, 캐러셀 1/1, glass-bar safe-area, body -18 overlap+22, InfoRow radius18, 삭제버튼(negative #E5484D), 메뉴/삭제확인 **모든 카피 일치**.

---

## 6. Join / Profile / Map (vs mk-home·mk-log)

| Screen | 축 | 킷 ref | RN ref | 수정안 | 등급 |
|---|---|---|---|---|---|
| MapTabScreen | all | mk-home:247-327 헤더+범례+선택카드+맵 | placeholder 텍스트 | Kakao SDK 후속 — 헤더("지도"+🍽️)·범례 골격만이라도? | **High [FLAG]** §8 |
| CreatedScreen 등가 | a/c | mk-home:196-214 🎉 축하화면 | 없음(LogScreen 인라인 대체) | 멀티로그 구조 분기 | Med [FLAG] §8 |
| Join/Profile 헤더 | a | SubBar(좌측8·17px 좌측정렬) | 네이티브 스택 헤더 | SubBar RN 번역(LogScreen 패턴 재사용) | Med [FLAG] §8 |
| InviteCodeCard 코드 | b | mk-home:225 `800 26px` | `h2`(24) | `inviteCode`(26) 변형 | Low [FIX] |
| Profile 닉네임 | b | mk-log:440 `800 22px` | `h3`(20 SemiBold) | 22 Bold 변형 | Low [FIX] |
| Join 이모지/제목 | b | mk-home:152-153 `52px`/`800 22px` | `display`(40)/`h2`(24) | 근사 — 정밀시 전용 | Low |

OK: CodeInput 셀 46×56/radius14/800-24/accent보더, InviteCodeCard bg/radius/라벨, Join 본문 카피·padding, Profile 통계/설정 카피·radius·구분선.

---

## 7. Primitives / Search (vs mk-ui · mk-log · mk-data)

| 대상 | 축 | 킷 ref | RN ref | 수정안 | 등급 |
|---|---|---|---|---|---|
| Stars 빈 별색 | b | mk-ui:42 `--line-strong`(rgba 112,115,124,.52) | Stars `borderStrong`(#C4C4C4 불투명) | `lineStrong` 토큰으로 | Med [FIX] |
| MemberBadge 솔로 텍스트색 | b | mk-ui:146 `text-alternative`(fgMuted) | `fgWeak`(문서화된 가독성 변경) | 의도적 — 확인 | Med [확인] |
| PhotoPickerGrid 영상힌트 | a | mk-log:337 "🎬 2초 영상도…" | 없음 | 영상 범위 외면 OK | Low |
| FoodCover 그라데 각도 | b | mk-ui:54 `140deg` | start{0,0}→{1,1}(135°) | 140° 근사 | Low [FIX] |
| categories 그라데 8종 | b | mk-data:5-14 | categories.ts | **정확 일치(OK)** | OK |
| Chip/IconButton/Button/Avatar | all | mk-ui | 각 컴포넌트 | **정합(OK)** | OK |
| PlaceSearchField/ResultRow/SelectedSummary | a | mk-log:383-414 풀스크린 | 인라인 시트 | 구조 분기(문서화) | [FLAG] §8 |

---

## 8. 구조/결정 필요 (리더·developer) — `[FLAG]`

> **2026-06-14 리더 결정: FLAG 4건 전부 "킷대로 정합". §11에 처리 결과 기록.**


1. **MuklogEditor 시트 ↔ 풀스크린**: 킷은 풀스크린(SubBar+저장). RN은 하단 Sheet. 검색도 킷=풀스크린/RN=인라인. 네비 구조 변경은 developer 영역 — 유지 여부 결정 필요. (현재 ui-publisher는 시트 내부 카피·폰트·safe-area만 정합)
2. **MapTabScreen**: 킷 MapScreen 전체(맵·핀·범례·선택카드) 미구현(placeholder). 실제 Kakao Map은 후속 스프린트. 최소 헤더/범례 셸 선반영 여부 결정.
3. **CreatedScreen(생성완료 축하)**: 멀티로그 설계로 생성→LogScreen 직행, 🎉 화면·"새 로그가 만들어졌어요"·"로그 열기/나중에" CTA 미사용. 기획 의도 재현 여부 결정.
4. **Join/Profile 헤더**: 네이티브 스택 헤더 vs 킷 SubBar(좌측정렬 17px). 비주얼 정합 위해 커스텀 SubBar 헤더 적용 여부 결정.
5. **Detail share 버튼**: 킷 존재, plan §2 OUT. 공유 스프린트에서 복원.

---

## 9. 수정 실행 계획(ui-publisher, 본 스프린트)

A1. `tokens.ts`: `sheetTitle`(18 Bold)·`sectionLabel`(16 Bold)·`inviteCode`(26 Bold)·`profileName`(22 Bold)·`ratingNum`(15 Bold)·`memoBody`(15/1.7) 역할 토큰 신설. scrimStrong → `.32`(킷). + tokens.spec 검증.
A2. `Sheet.tsx`: safe-area inset + maxHeight 캡 + sheetTitle.
A3. `SplashView`/`LoginScreen`: 워드마크 lineHeight, SemiBold 카피, 그라데 각도.
A4. `MuklogDetailScreen`: 섹션제목 sectionLabel, 메모 memoBody, 별점 ratingNum, scrim(토큰 경유).
A5. `MuklogList`(FAB): accent 글로우 + 하단 inset.
A6. `HomeTabs`: 패딩·아이콘색·구분선·크기·배경. `HomeHeader`: title prop(지도탭).
A7. `AddSheet`: 이모지24·보더1·chevron색. `LogListScreen`: gap7·chevron·패딩.
A8. `InviteCodeCard`: inviteCode 토큰 + compact 변형. `ProfileScreen`: profileName.
A9. `MuklogEntrySheet`: 메모 카피·타이틀 이모지 제거·필드라벨 sectionLabel·방문일 행 셸.
A10. `Stars`: 빈 별 lineStrong. `FoodCover`: 그라데 각도 근사.

각 모듈 수정 후 관련 `npm test` + `tsc --noEmit`, qa-inspector에 incremental 킷 대조 검증 요청.

---

## 10. 수정 완료 로그 (2026-06-14, ui-publisher)

**검증 상태: `npm test` 618/618 통과 · `tsc --noEmit` 무오류.** 로직/데이터 불변, 토큰 경유만(raw hex 0).

### 토큰 (`src/theme/tokens.ts` + `tokens.spec.ts`)
- 역할 토큰 신설: `sheetTitle`(18 Bold)·`sectionLabel`(16 Bold)·`fieldLabel`(15 Bold)·`memoBody`(15/1.7 Med)·`ratingNum`(15 Bold)·`inviteCode`(26 Bold)·`profileName`(22 Bold).
- `scrimStrong` 불투명도 `.42 → .32`(킷 mk-log:94 실값). 검증 테스트 추가.

### 보고 이슈 ① — `src/components/Sheet.tsx`
- `useSafeAreaInsets` 도입: 패널 `paddingBottom = insets.bottom + spacing[20]`(홈 인디케이터 침범 해소).
- 패널 `maxHeight: '88%'` 캡 + children을 `flexShrink:1` body로 래핑 → 긴 내용(장소검색)이 상태바 침범 없이 내부 스크롤.
- 타이틀 `variant h3(20 SemiBold) → sheetTitle(18 Bold)`.
- `MuklogEntrySheet`: 내부 ScrollView `flexShrink:1`로 캡 안에서 스크롤 보장.

### 보고 이슈 ② — `MuklogEntrySheet.tsx`
- 메모 placeholder `"무엇을 먹었고 어땠는지 남겨보세요 💕" → "…, 둘의 추억을 남겨보세요 💕"`(킷 mk-log:352).
- 시트 타이틀 `"새 먹로그 🍽️" → "새 먹로그"`(킷 SUBBAR는 이모지 없음).
- 필드 라벨 5종 `bodySm(14 Med) → fieldLabel(15 Bold)`(킷 Field 800/15).
- **[FLAG]** 시트↔풀스크린 구조, 방문일 calendar+chevron 탭 행(날짜피커=developer), 검색 풀스크린화는 §8 — 미반영(구조/로직).

### Auth — `SplashView.tsx`·`LoginScreen.tsx`
- Login 워드마크 `lineHeight 34` 추가(emptyTitle 27 < 34 글리프 클리핑 **High** 해소).
- Splash 워드마크 `lineHeight 38`. 두 화면 태그라인/카피 `Pretendard-SemiBold`(킷 600). 그라데이션 160° 대각 근사(start{0.15,0}→end{0.85,1}).

### Detail — `MuklogDetailScreen.tsx`
- 섹션 제목 "메모"/"위치" `emptyTitle(21) → sectionLabel(16)` (**High** 5px 과대 해소).
- 메모 본문 `bodyLg(18) → memoBody(15)`. 별점 숫자 `cardTitle(17) → ratingNum(15)`. scrim은 토큰 .32로 자동 반영.

### Home — `MuklogList.tsx`·`HomeTabs.tsx`·`HomeHeader.tsx`·`AddSheet.tsx`·`LogListScreen.tsx`
- FAB 그림자 `shadow.md(검정) → accent 틴트 글로우`(킷 0 8px22 accent-shadow). FAB 하단 inset은 **Screen `edges=['…','bottom']`가 이미 처리**(이중 inset 회피 — 변경 불요).
- TabBar: 배경 surface, 구분선 hairlineAlt, paddingTop spacing[8], 아이콘 25 고정, 지도탭 비활성 아이콘 `fgWeak → fgAssistive`(먹로그탭 통일), 라벨 11px SemiBold.
- HomeHeader `title` prop 추가 → 지도탭 "지도"/그 외 "먹로그"(킷 mk-home:261/82).
- AddSheet: 이모지 배지 24px, SheetAction 보더 `hairlineWidth → 1`, 행 chevron `fgMuted → fgAssistive`.
- LogCard: 미리보기 gap `6→7`, chevron `20/fgMuted → 18/fgAssistive`. 리스트 패딩 uniform20 → 4/20/24.

### Primitives — `Stars.tsx`·`FoodCover.tsx`·`InviteCodeCard.tsx`·`ProfileScreen.tsx`
- Stars 빈 별 `borderStrong(#C4C4C4 불투명) → lineStrong(rgba 112,115,124,.52)` — 킷 `--line-strong` 실값 확인(tokens/figma-variables.css:261).
- FoodCover 그라데 140° 근사(start{0.08,0}→end{0.92,1}).
- InviteCodeCard 코드 `h2(24) → inviteCode(26)`. ProfileScreen 닉네임 `h3(20 SemiBold) → profileName(22 Bold)`.

### 미반영(§8 FLAG — 리더/developer 결정)
MapTabScreen 전체 구현, CreatedScreen 축하화면, Join/Profile SubBar(네이티브 헤더), MuklogEditor 시트↔풀스크린, Detail share 버튼, 방문일 날짜피커 행. + `[BY-DESIGN]` 데이터 의존 차이(파트너 닉네임/미리보기 사진/맛집 카운트)는 developer 영역.
</content>
</invoke>

---

## 11. FLAG 정합 처리 로그 (2026-06-14, ui-publisher — 리더 "킷대로" 결정 후속)

**검증 상태: `npm test` 625/625 통과 · `tsc --noEmit` 무오류.** TDD·토큰 경유·무회귀 유지.

### FLAG-0 — 공용 SubBar 신설 (기반)
- `src/components/SubBar.tsx`(+spec) — 킷 mk-home:233-244: insets.top 헤더 + chevron-left IconButton(24) + 좌측정렬 타이틀(cardTitle 700/17) + 우측 슬롯. `components/index.ts` export.

### FLAG-1 — 에디터 풀스크린 전환 (검색 풀스크린은 dev 협업 대기)
- `MuklogEntrySheet.tsx`: 컨테이너 `Sheet`(하단 시트) → **전체화면 Modal + Screen + SubBar**. 저장 버튼을 SubBar 우측 텍스트 버튼(킷 mk-log:296 800/16, 활성 accentStrong/비활성 fgAssistive)으로 이동. 본문 padding 8/20/28(mk-log:299). 25개 시트 테스트 그린(저장/사진/검색/편집 플로우 보존).
  - **번역 선택**: 네비 라우트 대신 full-screen `Modal`로 present → 기존 `visible`-prop 배선(MuklogList FAB)·저장/사진/검색 플로우를 **무회귀**로 보존. 풀스크린 비주얼은 동일. (원하면 dev가 네비 push 라우트로 후속 전환 가능 — 비주얼 영향 0.)
  - **장소검색 풀스크린화 = developer 협업 대기**: 킷 PlaceSearch(383-414)는 별도 풀스크린(검색 pill + 결과). 현재 RN은 인라인 PlaceSearchField(풀스크린 에디터 내 동작). 풀스크린 검색은 `usePlaceSearch` controlled 계약(query/results/onSelectResult)·수동입력 폴백(§4.2)·관련 테스트를 함께 바꿔야 해 developer와 공동 진행 필요. 인라인 검색은 정상 동작 유지.

### FLAG-2 — MapTabScreen 헤더/범례 셸
- `MapTabScreen.tsx`(+spec): placeholder → 범례("우리 맛집"=primary dot / "주변 음식점"=fgMuted dot, 킷 mk-home:281-284) + 지도 영역 플레이스홀더. 헤더("지도")는 HomeTabs HomeHeader가 제공. 실지도·핀·선택카드는 map-tab 스프린트.

### FLAG-3 — CreatedScreen 축하화면 복원 (비주얼 셸, dev 배선 대기)
- `RoomCreatedScreen.tsx`(+spec): 킷 mk-home:196-214 — SubBar "로그 만들기" + 🎉 + "새 로그가 만들어졌어요" + "아래 초대코드를 연인에게 보내면\n둘이 함께 기록할 수 있어요." + InviteCodeCard + "로그 열기"/"나중에"(ghost). **props 계약**: `{ inviteCode, onEnter, onLater }`. developer가 멀티로그 생성 플로우에 라우트 등록·연결(기존 생성→LogScreen 회귀 보호).

### FLAG-4 — Join/Profile SubBar 정합
- `JoinLogScreen.tsx`·`ProfileScreen.tsx`: 화면 자체 SubBar("초대코드 입장"/"프로필", onBack=navigation.goBack) 적용. `AppNavigator.tsx`: Profile·JoinLog 옵션 `headerShown:false`로 전환(이중 헤더 방지) + 미사용 detailHeaderOptions/useTheme 제거. ProfileScreen.spec에 navigation goBack 모킹 추가, JoinLogScreen.spec mock에 goBack 추가.
  - ⚠️ AppNavigator 네이티브 헤더 옵션 flip은 본래 developer 영역이나, SubBar만 추가하고 헤더를 안 끄면 **이중 헤더(런타임 버그)**가 되어 무회귀 보장을 위해 동반 flip함. developer는 이 옵션을 검토·소유.

### developer 인계 항목
1. **FLAG-3 RoomCreatedScreen 라우트 등록·생성 플로우 연결**(props: inviteCode/onEnter/onLater).
2. **FLAG-1 장소검색 풀스크린화**(usePlaceSearch 계약·테스트 공동 변경) — 원하면 진행.
3. **FLAG-1 에디터 Modal→네비 push 전환**(선택, 비주얼 영향 0).
4. **FLAG-4 AppNavigator headerShown:false** 검토·소유(이미 무회귀 적용).

---

## 12. QA 후속 잔여 수정 (2026-06-14, ui-publisher — qa-inspector 회신 대응)

QA incremental 검증 결과 13/15+6/6 PASS, 회귀 0. 잔여 LOW 3건 마무리:

- **A [FIX] InviteCodeCard compact** — `InviteCodeCard.tsx`에 `compact?: boolean` 추가 → padding `compact ? 14/16 : 20`(킷 mk-home:220). `LogScreen.tsx:109` 솔로배너 → `<InviteCodeCard code={code} compact />`(킷 mk-log:44). +compact 스모크 테스트.
- **B [FIX] 솔로배너 헤딩** — `LogScreen.tsx:102` navTitle(16) → `fieldLabel`(15, 킷 mk-log:39 700/15).
- **C [cosmetic] 주석 정리** — `MuklogDetailScreen.tsx` memoText 스타일 주석을 memoBody 기준으로 수정(bodyLg 언급 제거).

검증: InviteCodeCard(5)·LogScreen·MuklogDetailScreen 스펙 그린. (전체 tsc/test는 developer FLAG 배선 in-flight 중이라 스코프 스펙으로 확인.)

---

## 13. FLAG-1 에디터 비주얼 폴리시 (2026-06-14, ui-publisher — developer 1a green 후)

developer가 MuklogEntrySheet→MuklogEditor(풀스크린, Screen+SubBar) 배선 완료 후 비주얼 폴리시:

- **저장 버튼 정확화**(킷 mk-log:296 `800 16px/1`, 활성 accent-strong / 비활성 text-disable): `MuklogEditor.tsx` SubBar.right 텍스트 `variant sectionLabel→button`(16 Bold), 비활성색 `fgAssistive→fgDisabled`. accessibilityLabel/State·onPress 배선 유지(테스트 의존).
- **신규 토큰 `fgDisabled`** = 킷 `--text-disable`=`--label-disable` `rgba(55,56,60,0.16)`(figma-variables.css:207). 라이트=실값, 다크=`rgba(255,255,255,0.20)` 미러. tokens.spec 검증.
- **에디터 필드 그룹 gap 22**(킷 mk-log:299 `gap:22`): 필드 간 `marginTop spacing[16]→spacing[22]`. `spacing[22]` 토큰 추가(킷 정확값, 4px 그리드 예외 — 기존 7/18/26과 동일 정책). tokens.spec 검증.
- **장소 라벨 필수 `*` accent**(킷 mk-log:374 `color:--mk-accent`): 중첩 Text `color="primary"`.
- 본문 padding 8/20/28(mk-log:299)·필드 라벨 fieldLabel·메모 카피는 developer가 이관 유지 — 정합 확인.

검증: tokens·MuklogEditor·MuklogEditorRoute 스펙 + 전체 `npm test` **636/636 통과**, `tsc` 무오류.

### 잔여(FLAG-1b, developer 협업 대기)
- **장소검색 풀스크린 스왑**(킷 mk-log:293 에디터 내부 `searching` state → PlaceSearch 풀스크린): developer가 searching-state 스캐폴드(구조) → ui-publisher가 searchBtn/placeChosen 토글 + 풀스크린 검색뷰 비주얼. 현재 1a는 인라인 PlaceSearchField(회귀 안전) 유지.

---

## 14. FLAG-1b 장소검색 풀스크린 — 검색뷰 비주얼 (2026-06-14, ui-publisher)

> 리더 결정: 1b 지금 완성. developer=searching 상태머신(스왑 진입/복귀), ui-publisher=검색뷰 비주얼.

- **`PlaceSearchView.tsx`(+spec, 7 케이스)** — 킷 mk-log.jsx:383-414 풀스크린 PlaceSearch 재현:
  - 헤더: 뒤로(IconButton chevron-left 24) + 검색 pill(surface+hairline, radius full, pad 10/16, search 18 + TextInput autofocus "장소, 음식점 검색"). insets.top 안전영역.
  - 스크롤: 섹션 라벨(`'{q}' 검색 결과` / 안내), 결과 리스트(PlaceResultRow 재사용, padding 0/12/24), 상태 loading/empty/error(plan §4.2).
  - **controlled props**(developer usePlaceSearch 주입): `{ query, onChangeQuery, status, results, onSelectResult, resolveCategory?, errorMessage?, onBack, placeholder? }`. 표시 전용, 무회귀.
- **통합 contract**: MuklogEditor의 `searching` state(developer 소유)에서 `if (searching) return <PlaceSearchView … onBack={()=>setSearching(false)} />`(킷 mk-log:291). 검색 진입 트리거(searchBtn)·placeChosen "변경" 토글은 에디터 place 필드 — developer 스캐폴드 후 ui-publisher가 비주얼 폴리시(킷 searchBtn mk-log:312 / placeChosen 302-310).

검증: PlaceSearchView 7/7 그린, tsc 무오류.

---

## 15. FLAG-1b 검색 풀스크린 비주얼 폴리시 완료 (2026-06-14, ui-publisher)

developer가 searching 상태머신 green(647) + PlaceSearchView 채택 → ui-publisher 비주얼 폴리시 마무리:

- **검색뷰 = `PlaceSearchView`**(킷 mk-log:383-414 정확): 헤더 **뒤로 + 검색 pill 한 줄**(developer 초기 SubBar-title+pill-below 대비 킷 충실), 결과(PlaceResultRow), 상태(loading/empty/error), **"직접 입력" 폴백**(ready+0 또는 error 시, §4.2). `backLabel="검색 취소"`로 컨트랙트 가드 충족.
- **searchBtn**(킷 lk.searchBtn mk-log:497): radius `control(14)→xl(16)`, border `hairline→1.5`. 돋보기 20 + "장소 검색 (카카오)".
- **"변경"**(킷 mk-log:309 700/13 accent 우측): `bodySm(14 Med)→badge(12 Bold)`, `alignSelf flex-start→flex-end`(우측).
- 저장버튼/필드 gap22/asterisk(§13) 유지.

**컨트랙트 가드 전부 유지**(테스트 의존): accessibilityLabel `장소 검색하기`/`장소 변경`/`검색 취소`/`직접 입력`/`장소 검색`(입력), testID `place-result-*`/`place-search-empty`/`place-search-error`/`place-selected-summary`. usePlaceSearch·searching 상태머신 불변(비주얼만).

검증: 전체 `npm test` **648/648 통과**, `tsc` 무오류. (PlaceSearchView 9 + MuklogEditor 28 그린.)

### cleanup 노트(developer 판단)
- `PlaceSearchField.tsx`는 검색뷰가 PlaceSearchView로 대체되며 **UI 미사용**(현재 `PlaceSearchStatus` 타입만 PlaceSearchView/MuklogEditor가 참조). 타입을 types.ts로 이전하면 PlaceSearchField+spec 제거 가능 — developer 영역이라 미삭제, 정리 여부 위임.
