# QA Report — Visual (sprint-20260624-prod-bugfix)

비주얼·레이아웃 중심 버그(#1·#5·#3·#6·#7) 킷↔RN 충실도 검증. **검증·리포트 전용(수정 미수행).** git 미수행.

## 종합 판정: 비주얼 통과 (PASS) — 디바이스 스모크 2건 분리

| 항목 | 판정 | 근거 |
|------|------|------|
| #1 GNB safe-area | 통과 | `buildTabBarStyle`이 insets.bottom 반영, 킷 토큰 유지, inset 0 회귀 0 |
| #5 텍스트 클리핑 | 통과(픽셀은 스모크) | 지도 카드 메타 lineHeight 18>13, 지도 한정 인라인 |
| #3 기본 닉네임 | 통과 | 5개 소비처 동일 폴백 패턴, 아바타 이모지 폴백과 무충돌 |
| #6 고기 카테고리 | 통과 | 🍖 칩·필터·커버 자동 전파, 따뜻한 구이 톤·자연스러운 순서 |
| #7 검색 커버 | 통과 | resolveCategory 기본 항상 호출 → 카테고리별 커버 렌더 체인 정합 |

모든 비주얼 항목이 킷 정합 또는 의도된 킷 확장으로 통과. 단 한글 글리프 실픽셀 클리핑(#5)과 Android GNB 실가림(#1)은 단위검증 경계 밖이라 **디바이스 스모크로 분리**(아래).

---

## #1 — Android GNB safe-area (통과)

킷: `mk-ui.jsx:222-225` MkTabBar — `paddingBottom: 22, paddingTop: 9, background: var(--mk-card), boxShadow: inset 0 1px 0 var(--line-alt)`(상단 헤어라인, 드롭섀도 아님), 아이콘 25, 라벨 `700/600 11px/1`.

RN: `src/navigation/tabBarStyle.ts:28-37` `buildTabBarStyle` + `HomeTabs.tsx:37`.

**① 레이아웃·safe-area**
- 킷의 정적 `paddingBottom: 22`(웹 프로토타입의 홈인디케이터 여백)를 RN에서 동적 `paddingBottom: insets.bottom`으로 번역 — RN의 올바른 safe-area 번역. 코드베이스 공통 패턴(다른 화면이 `insets.bottom` 수동 적용)과 일관.
- `height: TAB_BAR_CONTENT_HEIGHT(56) + insets.bottom` — 바 전체가 inset만큼 자라 시스템 내비바 위로 클리어. 콘텐츠 위치는 paddingBottom으로 보존.
- inset 0(iOS 홈인디케이터 없는 기기 등)이면 콘텐츠 높이(56)만 → 회귀 0. `tabBarStyle.spec.ts:22-27`로 박제.

**② 비주얼·토큰**
- `backgroundColor: surface`, `borderTopColor: hairlineAlt`(킷 `--mk-card`/`--line-alt` 정합), `paddingTop: spacing[8]`(킷 9 → 그리드 8 근사, 코드 주석에 명시). 모두 토큰 경유, raw hex 0.
- 그림자 아님 — 상단 헤어라인 보더(borderTopColor)로 킷 `inset 0 1px 0` 정합.
- 아이콘 25px(`HomeTabs.tsx:55,68`), 라벨 11px SUIT-SemiBold(`:39-42`). 라벨 weight는 킷이 active 700/inactive 600인데 RN은 SemiBold 고정 — react-navigation이 focus별 weight 변경이 어려운 한계로 600 근사(`HomeTabs.tsx:41` 주석). **근사 허용**(라이브러리 제약, 사유 코드 기록).

**근사 허용**
- paddingTop spacing[8](=8) vs 킷 9: 4px 그리드 토큰 사용을 위한 1px 근사. 토큰 경유 우선이 맞음.
- 비활성 라벨 weight 700/600 미분리 → SemiBold 고정(react-navigation 제약).

**디바이스 스모크(분리)**: Android 제스처/3버튼 내비에서 탭바 라벨·아이콘이 실제로 시스템 바 위로 올라오는지, iOS 홈인디케이터 회귀 없는지, 56 높이 적정성 — 실픽셀은 단위검증 경계 밖(dev-notes-D §디바이스 검증).

---

## #5 — 지도 카드 텍스트 상단 클리핑 (통과 / 픽셀은 스모크)

킷: `mk-home.jsx:287-301` 선택 스팟 카드 메타줄. 토큰 `meta`(`tokens.ts:209`) = size 13, ratio 1 → lineHeight 13 == fontSize → 한글 글리프 상단 어센더 클리핑(메모리 qa-layout-blind-spot 패턴).

RN: `NearbySpotCard.tsx:48,106`·`SelectedSpotCard.tsx:38,84` — `META_LINE_HEIGHT = 18` 상수, 메타 `Text` style에 `lineHeight: 18` 인라인 머지.

**① 레이아웃·구조**
- 두 카드 모두 메타 `Text`에 인라인 lineHeight 18(>fontSize 13, ratio≈1.38) 적용 — 상단 클리핑 해소.
- 글로벌 `meta` 토큰 **미변경** — 지도 카드 인스턴스에서만 오버라이드. `Text`가 style을 마지막 머지하므로 인스턴스가 토큰을 덮음. 타 화면(LogCard 날짜 메타 등) 영향 0이라 **합리적**(글로벌 변경 시 회귀 면적이 큼).
- 다른 텍스트는 `cardTitle`(ratio 1.3)/`caption`(1.4)이라 클리핑 없음 → 미변경 적절.

**② 비주얼·토큰**
- 카드 셸 토큰 정합: surface 배경, `radius.card` 상단 모서리, padding 14/16/20(spacing 토큰), FoodCover 54×54/radius14/emojiSize26(킷 mk-home:290), shadow.md 근사(위로 뜨는 floating 카드라 헤어라인 아닌 그림자 — ui-spec 기록된 근사). raw hex 0.

**미세 관찰(비차단)**: lineHeight 18을 토큰 경유 아닌 매직넘버 상수로 둠. 단 두 카드가 동일 `META_LINE_HEIGHT` 상수를 각자 선언(중복). 지도 한정·의도적 인라인이라 회귀 아님. 글로벌 `meta` 토큰의 lineHeight==fontSize 잠재 문제는 타 화면에도 있어(dev-notes-B §미완) **ui-publisher가 토큰 레벨 근본 수정 검토 권장** — 본 스프린트 범위 밖이므로 통과 처리.

**디바이스 스모크(분리)**: 한글 SUIT-Medium 글리프의 실제 렌더 클리핑 해소는 픽셀 검증 영역(메모리 qa-layout-blind-spot). 디바이스에서 주변/선택 스팟 카드 카테고리 텍스트 상단 육안 확인.

---

## #3 — 기본 닉네임 표시 일관성 (통과)

신설 `defaultNickname.ts` — 동물명 20종(한국어) + userId 결정적 해시(31진 다항) → `동물명+4자리`(예 수달2847). 결정적 → 화면 간 동일 신원.

**③ 텍스트·카피 + 일관성**
- 5개 소비처 모두 동일 가드 패턴(`nickname && length>0 ? nickname : defaultNickname({ userId })`):
  - HomeHeader `HomeHeader.tsx:36-39` · LogList useSelfDisplay `LogListScreen.tsx:55-58` · LogScreen `:227` · ProfileScreen `:249-252` · NotifSettings `:46`.
- 잔존 `'나'`/`'닉네임 미설정'` 리터럴 폴백 0건(grep 전수 확인). 화면 간 동일 userId → 항상 같은 표시명 보장(드리프트 0).

**아바타 이모지/이니셜 폴백 충돌 검증(핵심)**
- `Avatar.tsx:38-111` 표시 우선순위: url → **userId 이모지+컬러** → nickname 이니셜 → 익명 🙂.
- HomeHeaderAvatar는 항상 `userId`를 넘기므로 **보이는 글리프는 userId 파생 이모지**(우선순위 2). `nickname` prop은 접근성 라벨에만 쓰임(`Avatar.tsx:40`). 따라서 nickname을 defaultNickname으로 채워도 **이모지 아바타와 충돌 없음** — 이모지(시각)와 동물명+숫자(텍스트)는 독립 폴백으로 공존. a11y 라벨도 "수달2847 아바타"로 일관(텍스트 표시명과 정합). dev-notes-A의 "이니셜/이모지 폴백과 충돌 없음" 주장 정확.

> 참고: MuklogDetail 작성자 라벨("내가 기록"/"짝꿍이 기록")은 닉 미표시라 #3 무관 — 카피 그대로 유지(올바름).

---

## #6 — 고기 카테고리 추가 (통과 — 의도된 킷 확장)

킷: `mk-data.js:5-14` CAT = **8종**(pasta·cafe·noodle·sushi·bakery·chinese·burger·izakaya), meat 없음.

RN: `categories.ts:10-21` — 킷 8종 label·emoji·grad **모두 정확 미러**(검수: 8종 hex·라벨·이모지 1:1 일치) + `meat` 추가(plan #6이 명시 허가한 킷 확장이므로 킷 일탈 아님).

**② 비주얼·토큰(톤 일관성)**
- meat 그라데이션 `['#FFC58A', '#E2622F']`(주황→짙은 구이 갈색). 형제 비교: noodle `#FFE1A8→#FF8A6B`, chinese `#FFD2A6→#E78B5A`, burger `#FFDFA0→#E69356` — 전부 웜 앰버/주황→테라코타 계열. meat의 `to` `#E2622F`는 더 깊고 채도 높은 구이 갈색-주황으로 형제와 구분되면서 따뜻한 패밀리 유지. **톤 일관**.
- 🍖 이모지(킷 음식 이모지 플레이풀 예외 허용).
- 칩/필터칩/FoodCover 커버는 `MUKLOG_CATEGORY_KEYS`/`MUKLOG_CATEGORIES` 순회라 **자동 전파**(추가 배선 0) — 비주얼 일관 보장.

**① 칩 순서**
- meat를 noodle(한식) 바로 뒤에 삽입: `pasta, cafe, noodle, meat, sushi, ...`. 킷 8종 순서 그대로 보존 + 한식 인접에 고기 → 자연스러운 그룹핑(plan §6 의도 일치).

---

## #7 — 검색 결과 커버 카테고리별 매핑 (통과 — 코드 경로 정합)

근본: 이전 `resolveCategory ? ... : null` + 매핑 어휘 부족 → 결과가 늘 category=null → FoodCover cafe(커피) 폴백.

**비주얼 렌더 체인 검증(킷↔RN)**
- `PlaceSearchView.tsx:59` `resolveCategory = resolveByKakaoCategory`(기본 mapKakaoCategory) + `:195` `category={resolveCategory({ item })}` — 분기 제거, **항상 호출**. 위시리스트 미주입 소비처도 자동 정확 매핑.
- `PlaceResultRow.tsx:63` `category`를 그대로 `FoodCover`에 전달.
- `FoodCover.tsx:56-57` — non-null 매핑 category면 `categoryColors`/`categoryEmoji`로 **카테고리별 그라데이션+이모지** 렌더. null일 때만 cafe 폴백.
- `kakaoCategory.ts:20-45` 매핑 어휘 9종으로 대폭 확장(한식·일식·고기·치킨·호프·국밥 등 실 브레드크럼 커버, 우선순위 정렬·부분일치 함정 차단). → 다양한 검색 결과가 noodle 🍜/sushi 🍣/meat 🍖/izakaya 🍶 등 **서로 다른 커버**로 렌더(전부 cafe 아님).

결론: #7의 "카테고리별 커버" 비주얼 의도가 코드 경로상 정확히 반영됨. 라벨(subline `categoryLabel`)도 같은 매핑으로 일관.

**미완/리스크(비차단)**: 매핑은 키워드 부분일치라 실데이터에서 함정 잔존 가능(메모리 nearby-category-mapping). 어긋나는 케이스는 디바이스에서 실 categoryName 로깅 후 규칙 보정 권장(dev-notes-C §QA 참고).

---

## 라우팅
- **즉시 ui-publisher 라우팅 비주얼 불일치: 없음.** 모든 항목 킷 정합 또는 의도된 킷 확장/근사 허용.
- **권고(비차단, ui-publisher 차후 검토)**: 글로벌 `meta` 토큰 lineHeight==fontSize(13) 한글 클리핑은 지도 외 화면에도 잠재 → 토큰 레벨 근본 수정 검토(본 스프린트 지도 한정 처리는 적절).

## 디바이스 스모크(픽셀 — 분리 검증)
1. #1 Android 제스처/3버튼 내비 GNB 비가림 + iOS 홈인디케이터 회귀 0 + 탭바 높이 적정성.
2. #5 주변/선택 스팟 카드 카테고리 텍스트 상단 클리핑 해소(한글 실글리프).
