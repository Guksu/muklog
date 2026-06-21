# UI Spec — 홈 화면 구조 정합 (sprint-20260620-home-fidelity)

퍼블리셔 산출물. 디자인 단일 출처(SSOT) = `.claude/skills/ui-design/templates/muklog/mk-home.jsx`.
이 문서는 **킷 라인 ↔ RN 파일:라인 매핑**, LogCard prop 계약, 신규 토큰/유틸/컴포넌트, 근사 허용 항목, 비주얼 체크리스트를 담는다.

> 범위: 홈(먹로그 탭) 한 화면 — `LogListScreen.tsx` + `heroGradient` 토큰 + `relativeTimeLabel` 유틸.
> 컬러·radius·간격 토큰은 변경 없음(`heroGradient`만 신규). 데이터(`spotCount`/`lastMuklogAt`/`previewPaths`)는 developer 소유 `MyLog`에서 직접 읽음.

---

## 1. 변경 파일

| 파일 | 종류 | 내용 |
|---|---|---|
| `src/navigation/screens/LogListScreen.tsx` | 재작성 | LogCard(스트립/+N/통계행/빈카드) · 인사 헤드라인 · EmptyLogs(히어로+두 갈래) |
| `src/navigation/screens/LogListScreen.spec.tsx` | 재작성 | AC2~AC5 검증(킷 충실화) |
| `src/navigation/screens/relativeTimeLabel.ts` | 신규 | 킷 `agoLabel` 동등 상대시간 유틸 |
| `src/navigation/screens/relativeTimeLabel.spec.ts` | 신규 | 임계 경계 단위테스트 |
| `src/theme/tokens.ts` | 추가만 | `heroGradient` stops(`#EAF0FF→#FFE7DD`) + palette `heroGradTop/Bottom` |
| `src/theme/index.ts` | 추가만 | `heroGradient` re-export |
| `src/theme/tokens.spec.ts` | 추가만 | `heroGradient` 값 검증 |

**손대지 않음(developer 소유):** `useMyLogs.ts`, 마이그레이션 SQL, `useMyLogs.spec.ts`, `dev-notes.md`.

---

## 2. 킷 라인 ↔ RN 매핑

### 2.1 LogCard — 킷 `mk-home.jsx:28-104`

| 킷 라인 | 킷 요소 | RN(LogListScreen.tsx) | 토큰/근거 |
|---|---|---|---|
| 35-39 | 카드 컨테이너(card radius·padding16·shadow-card) | `Card`(공용, `LogCard`) | `radius.card`(22)·`shadow.card`(웜) |
| 41-45 | 아바타 겹침(본인 + 커플이면 ring 짝꿍, marginLeft -12) | `styles.avatarStack` + `Avatar` 2개(`marginLeft:-spacing[12]`) | 짝꿍 실데이터 없음 → 익명 `🙂`(plan §3.3) |
| 48-50 | 타이틀 700/17(폴백 `me ♥ partner`) | `Text variant="cardTitle"` + `displayLogName` | `typography.cardTitle`(700/17) |
| 53 | MemberBadge | `MemberBadge`(공용) | 킷 `mk-ui:139` |
| 54-56 | since/start 라벨 500/12.5 | `Text variant="meta"` `"YYYY.MM.DD 시작"` | 킷은 커플 `함께한 지 N일`이나 RN은 `Date.now` 비결정 회피로 "시작" 통일(기존 정책 유지) |
| 59 | chevron-right 18 / text-assistive | `Icon ChevronRight 18 color="fgAssistive"` | |
| **63-71** | **빈카드**(spotCount 0): 점선 박스 + 🍽️ 배지 + 문구 + plus | `LogEmptyBody` | `radius.xl`(16)·`fillAlt`·`accentLine` dashed·🍽️ 배지 `primaryWeak`/`radius.lg`(12) |
| **74-91** | **사진 4칸 스트립** | `LogPhotoStrip` | 아래 2.2 |
| **92-99** | **통계행** | `LogStatsRow` | 아래 2.3 |

### 2.2 사진 스트립 — 킷 `mk-home.jsx:74-91` → `LogPhotoStrip`

| 킷 | RN | 비고 |
|---|---|---|
| 75 `display:flex; gap:7; marginTop:14` | `styles.strip`(flexDirection row, gap 7) + `marginTop spacing[14]` | gap 7 킷 실값 |
| 76-87 `preview.map` FoodCover 카테고리 커버 | `previewUrls`로 **실사진** `Image`(`testID="log-strip-thumb"`) | **근사 1**(아래 §5): 킷=카테고리 그라데이션 커버 / RN=실사진(더 충실, plan §3.3) |
| 79 `radius:14 aspectRatio:1/1` | `slot`(flex 1, aspectRatio 1) + `radius.control`(14) | |
| 81-83 `+{more}` 딤 오버레이 rgba(20,12,8,.46) 흰 800/17 | `MoreOverlay`(`scrimStrong` 배경 + `Text cardTitle primaryFg`) | `more=max(0,spotCount-4)`, 4번째 슬롯에만 |
| 88-90 빈 슬롯(부족분) `fill-alt` + `1px dashed line` | `slot` + `testID="log-strip-empty"`(`fillAlt`/`hairline` dashed) | 항상 4칸 보장 |

- **미발급 path 강등:** signed URL이 아직 없는 path는 점선 빈 슬롯으로 떨어뜨림(깨진 이미지 방지). 채움 후보 = `previewUrls`에 값이 있는 path만.

### 2.3 통계행 — 킷 `mk-home.jsx:92-99` → `LogStatsRow`

| 킷 | RN | 토큰 |
|---|---|---|
| 93 상단 헤어라인 `borderTop 1px line-alt` | `borderTopWidth: hairlineWidth` + `hairlineAlt` | |
| 95 location 아이콘 15 / accent | `Icon Location 15 color="primary"` | `--mk-accent`=primary |
| 96 "맛집 {spots}곳" 700/13.5 | `Text variant="spotCount"` `맛집 {spotCount}곳` | `typography.spotCount`(600/14 근사) |
| 98 "마지막 기록 {AGO(latest)}" 600/12.5 | `Text variant="meta"` `마지막 기록 {상대시간}` | `lastMuklogAt` null → **"기록 없음"** 폴백(거짓 시각 금지) |

### 2.4 인사 헤드라인 — 킷 `mk-home.jsx:116-122` → `GreetingHeader`(`ListHeaderComponent`)

| 킷 | RN | 토큰 |
|---|---|---|
| 117-119 `h2 800/22` "{닉}님, 오늘은\n어디 다녀왔어요?" | `Text variant="emptyTitle"`(800/21≈22) | 현 한 줄 캡션(`둘만의 맛집 지도…`) **제거** |
| 120-121 "지금까지 함께 **{Σspots}곳**을 기록했어요"(합계 accentStrong/800) | `Text sectionCaption` + 중첩 `Text accentStrong` `{Σ}곳` | 합계 = `state.logs.reduce(+spotCount)` |

### 2.5 EmptyLogs — 킷 `mk-home.jsx:136-181` → `EmptyLogs`(ScrollView)

| 킷 라인 | 킷 요소 | RN |
|---|---|---|
| 138 `padding 10/20/28` | `styles.emptyScroll`(ScrollView contentContainer) | 빈 상태는 길어서 스크롤 가능 |
| 141-146 인사 + 본문 | `Text emptyTitle` "{닉}님,\n먹로그를 시작해볼까요?" + `sectionCaption` 본문 | |
| 150-172 **히어로 비주얼**(그라데이션 172h) | `LinearGradient`(`heroGradient`, `testID="empty-hero"`)·`radius.card` | 아래 §5 근사 2·3 |
| 156-159 음식 핀 4개(🍝☕🍣🍰) | `HeroPill` ×4(`pillTopLeft`…) | `shadow.seg` 근사(아래) |
| 160-170 아바타 + 💕 + 🙂 | `Avatar 62` + `heroHeart`(💕) + `heroPartner`(🙂) | |
| 176-177 **두 갈래 SheetAction**(🥢 새 로그 / 💌 초대코드로 입장) | `StartActionCard` ×2 | 킷 `SheetAction` 203-218 골격 |

- **onJoin 배선:** 킷 EmptyLogs `onJoin` → RN `navigation.navigate(Routes.JoinLog)`(기존 라우트 존재). 현 화면은 onCreate만 있었음 → onJoin 추가.

---

## 3. LogCard prop 계약 (publisher↔developer 경계)

`LogCard`는 **별도 binding 없이 `MyLog`를 직접 읽음**(plan §컴포넌트 계약). developer는 `MyLog`에 아래를 채워주면 자동 반영.

```ts
LogCard 입력:
  log: MyLog            // useMyLogs.ts(developer 소유)
  self: { userId; nickname; avatarUrl }  // useSelfDisplay(useProfile)
  previewUrls: Record<path, signedUrl>   // useLogPreviewUrls
  onPress: () => void                    // → LogScreen({roomId})

LogCard가 직접 읽는 MyLog 필드:
  log.spotCount: number          // 0 → 빈카드 / >0 → 스트립+통계행 / >4 → +(spotCount-4)
  log.lastMuklogAt: string|null  // 통계행 우측. null → "기록 없음"
  log.previewPaths: string[]     // 스트립 채움(signed URL 발급된 것만, 최대 4)
  log.memberCount, log.name, log.createdAt  // 헤더(기존)
```

**병렬 무충돌 확인:** publisher = `LogListScreen.tsx`만 수정. `MyLog` 타입(`spotCount`/`lastMuklogAt`)은 이미 developer가 정의함(읽기만). 거짓 카운트 안전 폴백 = `spotCount` 누락/0 → 빈카드.

---

## 4. 신규 토큰 / 유틸 / 컴포넌트

### 4.1 신규 토큰 — `heroGradient`
- `src/theme/tokens.ts`: `palette.heroGradTop='#EAF0FF'`, `heroGradBottom='#FFE7DD'`, `export const heroGradient = [top, bottom]`.
- 출처: 킷 `mk-home:152` `linear-gradient(150deg,#EAF0FF 0%,#FFE7DD 100%)` verbatim.
- `tokens.spec.ts`에 값 검증 추가. `theme/index.ts` re-export.

### 4.2 신규 유틸 — `relativeTimeLabel({ iso, now? })`
- 킷 `mk-ui.jsx:256-265` `agoLabel` 동등: 오늘/어제/N일 전/N주 전/N개월 전/N년 전.
- 임계값·나눗셈 킷 보존(7/28/365일, 7/30/365). `now` 주입 가능(테스트 결정성).
- **킷 대비 보정:** 킷은 28일에서 `floor(28/30)=0` → "0개월 전" 약점 → 개월/년 최소 1 클램프(거짓스러운 "0개월" 회피). 사유 기록.
- `iso`가 전체 ISO timestamp(`lastMuklogAt`)를 받음 — 킷 `agoLabel`은 date-only(00:00 고정)였으나 일수 계산 로직은 동일.
- 기존 `formatLogDate`는 날짜 표기 전용이라 재사용 불가(상대시간은 별도 유틸).

### 4.3 신규 화면-내 컴포넌트(LogListScreen.tsx 로컬, 화면 전용)
- `LogPhotoStrip` — 사진 4칸 스트립 + 빈 슬롯 + `+N`.
- `MoreOverlay` — `+N` 딤 오버레이.
- `LogEmptyBody` — spotCount 0 빈카드.
- `LogStatsRow` — 통계행.
- `GreetingHeader` — 인사 헤드라인 + 합계.
- `EmptyLogs` / `HeroPill` / `StartActionCard` — 빈 상태 히어로 + 두 갈래.

> 이들은 LogList 화면 전용이라 `src/components/`(공용)로 추출하지 않음. 킷에서도 `mk-home` 화면 스코프 함수(공용 `mk-ui` 프리미티브 아님). 공용 프리미티브(Avatar/MemberBadge/Card/Icon/FoodCover)는 기존 것 재사용.

---

## 5. RN 근사 허용 항목 (킷 100% 미재현 + 사유)

| # | 킷 | RN 근사 | 사유 |
|---|---|---|---|
| 1 | 사진 스트립 = `FoodCover` 카테고리 그라데이션 커버(74-91) | 실사진 `Image`(signed URL) | plan §3.3 결정 — 실사진이 더 충실. 사진 없는 slot은 점선 빈 슬롯(킷 빈슬롯과 동일 비주얼) |
| 2 | 히어로 `linear-gradient(150deg)` 정확 각도(152) | `expo-linear-gradient start{0,0}→end{1,1}`(대각 근사) | RN LinearGradient는 deg 직접 지정 불가 → 좌상→우하 대각으로 150° 근사(살구가 우하단). stops 색은 정확 |
| 3 | 히어로 💕 칩/음식 핀 컬러 그림자 `rgba(120,90,70,.x)`(165·187) | 💕=인라인 검정 그림자(.16), 핀=`shadow.seg`(검정 근사) | RN은 컬러 그림자 미지원 → 검정 근사. 떠 있는 칩이라 그림자 유지(헤어라인 대상 아님) |
| 4 | 히어로 🙂 반투명 흰 원 + inset ring `rgba(120,90,70,.12)`(167-170) | `rgba(255,255,255,.7)` + borderWidth 2 `rgba(120,90,70,.12)` | inset box-shadow → borderWidth 근사(킷 웜 톤 그대로) |
| 5 | `+N` 딤 `rgba(20,12,8,.46)`(82) | `scrimStrong` 토큰(`rgba(0,0,0,.32)`) 재사용 | 기존 사진 위 글래스 배지 토큰 재사용(톤 근접). raw rgba 신규 하드코딩 회피 |

> 근사 3·4의 인라인 `rgba(255,255,255,..)`/`rgba(120,90,70,..)`는 히어로 비주얼 한정 장식값(시맨틱 컬러 아님) — 킷 verbatim 웜 톤. 토큰화 대상이 아니라 인라인 유지(킷 인라인 실값 정합).

---

## 6. 비주얼 충실도 체크리스트 (self-check → qa-visual 인계)

- [x] 킷 구조 요소 누락 0: 헤더 아바타겹침·MemberBadge·chevron / 본문 분기(빈카드 ∥ 스트립+통계행) / 인사 헤드라인+합계 / 빈상태(히어로+음식핀4+두 갈래).
- [x] 색 전부 토큰 경유(raw hex 0). 히어로 장식 rgba만 킷 verbatim 인라인(근사 3·4, 사유 기록).
- [x] radius: 카드 22(`radius.card`)·빈카드 16(`radius.xl`)·슬롯 14(`radius.control`)·시작카드 18(`radius.action`)·🍽️ 배지 12(`radius.lg`).
- [x] 폰트: cardTitle 700/17·emptyTitle 800/22·spotCount·meta — 기존 역할 토큰.
- [x] 그림자 vs 헤어라인: 카드=`shadow.card` / 시작카드=헤어라인 보더(그림자 off) / CTA=점선(그림자 off) / 히어로 칩=떠있어 그림자 유지.
- [x] 스트립 항상 4칸(부족분 점선 빈 슬롯). `+N`은 spotCount>4일 때만 4번째 슬롯.
- [x] 통계행 `lastMuklogAt` null → "기록 없음"(거짓 시각 0).
- [x] 인사 합계 = 전 로그 spotCount 합(거짓 카운트 0 — RPC 실집계만).
- [x] onJoin → `Routes.JoinLog` 배선.
- [x] 화면 전용 컴포넌트는 LogList 스코프(킷 mk-home 동일), 공용 프리미티브 재사용(인라인 중복 0).
- [x] 근사 항목 §5 기록.
- [x] `npm test` 전체 green(139 suites / 1259 tests) + `tsc --noEmit` 0.

### qa-visual 대조 포인트(킷 라인)
- LogCard 빈카드 ↔ `mk-home:63-71` / 스트립+`+N` ↔ `74-91` / 통계행 ↔ `92-99`.
- 인사 헤드라인 ↔ `116-122`(리스트) / `141-146`(빈상태).
- 히어로 ↔ `150-172`(핀 위치 22/24·30/28·24/34·30/30) / 두 갈래 ↔ `176-177`+`203-218`.
- 디바이스 스모크 권장: 스트립 4칸 wrap·헤어라인 렌더·히어로 핀 위치(메모 qa-layout-blind-spot).
