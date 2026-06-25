# dev-notes — 그룹 C (카테고리·검색 #6·#7)

실기기 버그 #6(고기 카테고리 추가)·#7(검색 결과가 늘 커피 이미지) 수정. TDD(Red→Green). 그룹 C 파일셋만 수정, map 화면 미변경.

## #6 — '고기' 카테고리 추가

### 근본
8종 enum에 고기 종목이 없어 고기집/구이/삼겹/갈비를 기록하면 매핑 실패 또는 noodle(한식)로 새고, 칩에도 선택지가 없었다.

### 수정
- `src/features/muklog/categories.ts:15` — `MUKLOG_CATEGORIES`에 `meat` 추가(`noodle` 바로 뒤 = 한식 인접 위치). label '고기', emoji 🍖, 따뜻한 구이 그라데이션 `['#FFC58A', '#E2622F']`(주황→짙은 구이 갈색).
  - 칩(MuklogEditor)·필터칩(filterByCategory)·FoodCover 커버는 모두 `MUKLOG_CATEGORY_KEYS`/`MUKLOG_CATEGORIES`를 순회하므로 **자동 전파**(추가 배선 0).
- `src/features/muklog/kakaoCategory.ts:14` — `CATEGORY_RULES`에 meat 규칙 추가(`고기·육류·삼겹·갈비·곱창·막창·정육·스테이크·바베큐·구이`). **noodle('한식')·pasta('양식')보다 위**에 배치 — "한식 > 갈비"가 noodle로, "양식 > 스테이크"가 pasta로 새던 것을 meat로 정정.
- 주변 핀/카드(map, 그룹 B)는 `nearbyCategoryEmoji.ts`가 이미 고기→🍖를 처리하므로 변경 불필요(그룹 C 미소유 파일 미수정).

## #7 — 검색 결과 커버가 항상 cafe(커피)

### 근본(왜 늘 cafe였나) — 원인 2개
1. **매핑 어휘 부족** — `mapKakaoCategory`의 `CATEGORY_RULES`가 실제 카카오 브레드크럼 어휘를 거의 못 잡았다. 실데이터는 `음식점 > 한식 > 육류,고기`, `음식점 > 치킨`, `음식점 > 술집 > 호프`, `음식점 > 한식 > 국밥`, `음식점 > 한식 > 찌개,전골`, `음식점 > 일식 > 돈까스,우동` 같은 형태인데 기존 규칙엔 `치킨`·`호프`·`국밥`·`찌개`·`돈까스`·`육류,고기` 등이 없어 대부분 **null** 반환. PlaceResultRow→FoodCover는 `category=null`이면 `categoryEmoji({key:null})=''` → `MUKLOG_CATEGORIES.cafe`로 폴백(FoodCover.tsx:56·categories.ts categoryColors cafe 폴백). 결과적으로 매핑 실패 = 커피 커버.
2. **위시리스트 검색이 resolveCategory 미주입** — `LogScreen`의 위시 추가 풀스크린 검색이 `PlaceSearchView`에 `resolveCategory`를 안 넘겼다. 기존 PlaceSearchView는 `resolveCategory ? ... : null`이라 **모든** 위시 결과 행이 `category=null` → cafe 커버. (에디터 검색은 `defaultResolveCategory`를 넘겨 그나마 일부 매핑됐으나 #7의 어휘부족으로 역시 cafe가 잦았음.)

### 수정
- `src/features/muklog/kakaoCategory.ts:14` — `CATEGORY_RULES` 어휘 대폭 확장(실데이터로 보정된 `nearbyCategoryEmoji` 어휘를 9종 enum으로 이식). 배열 순서=우선순위:
  cafe → bakery → **meat** → sushi(일식·돈까스·우동·라멘 포함) → izakaya(술집·호프·주점·포차·펍·바 흡수) → chinese → burger(치킨·패스트푸드 포함) → pasta(피자 포함) → **noodle(한식 광범위 폴백, 맨 끝)**.
  - 부분일치 함정 차단(메모리 [[nearby-category-mapping]] 준수): `닭`은 burger에 미포함(→"육류,고기>닭요리"가 meat로). `펍`/`바`는 burger→izakaya로 이동. `면`·`식당`·`한식`처럼 넓은 키워드는 noodle 맨 끝이라 구체 규칙이 먼저 매칭.
- `src/features/muklog/PlaceSearchView.tsx:14·54·188` — `resolveCategory` 기본값을 `mapKakaoCategory` 기반 `resolveByKakaoCategory`로 지정. 미주입 소비처(위시리스트)도 자동으로 정확 매핑. 렌더 분기 `resolveCategory ? ... : null` → 항상 호출로 단순화.

## 생산자 ↔ 소비자 매핑 (QA 교차검증용)
- 생산자: `place-search` Edge Function `{ results: PlaceSearchItem[] }`(categoryName='음식점 > … > leaf', categoryGroupCode FD6/CE7) → `searchPlaces`(필터 FD6/CE7) → `usePlaceSearch`.
- 소비자: `PlaceSearchView`(results map) → `resolveCategory`(기본 `mapKakaoCategory`) → `PlaceResultRow.category` → `FoodCover`(그라데이션·이모지) + `categoryLabel`(subline). 저장 시 `placeFieldsFromItem`→`mapKakaoCategory`로 동일 매핑(자동채움 category).
- 소비처 2: `LogScreen` 위시 추가 검색 → 동일 PlaceSearchView 기본 resolveCategory 적용(별도 배선 불필요).

## 테스트 (Red→Green)
실행: `npx jest src/features/muklog/categories src/features/muklog/kakaoCategory src/features/muklog/PlaceSearchView src/features/muklog/PlaceResultRow src/components/FoodCover src/features/muklog/MuklogEditor src/features/muklog/usePlaceSearch src/features/muklog/searchPlaces src/features/muklog/filterByCategory src/features/muklog/MuklogCard` → **10 suites / 156 tests green**.
- `categories.spec.ts` — 9종 key(meat 포함) 순서 고정, meat label/emoji/그라데이션.
- `kakaoCategory.spec.ts` — #6 고기 매핑(육류,고기/갈비/삼겹/스테이크/정육/바베큐 + "한식>갈비"는 meat 우선·"양식>스테이크"는 meat 우선), #7 실 브레드크럼 13종이 cafe 아닌 정확 enum으로 매핑(국밥→noodle, 치킨→burger, 호프→izakaya, 돈까스→sushi 등), CE7→cafe 회귀 없음.
- `PlaceSearchView.spec.tsx` — resolveCategory 미주입 시 mapKakaoCategory 기본 해석(양식→파스타 라벨, 육류,고기→고기 라벨).

## 배포/마이그레이션
- DB category는 자유 text(CHECK 제약 없음, migrations 확인) → `meat` 저장에 마이그레이션·배포 불필요. Edge Function 무변경. **추가 배포 0**.

## 범위 준수
- 수정 파일: `categories.ts`·`kakaoCategory.ts`·`PlaceSearchView.tsx`(+ 각 spec). `PlaceResultRow.tsx`·`FoodCover.tsx`는 무변경(이미 category props 소비 정상).
- map 화면(MapTabScreen 등 그룹 B) 미변경. `nearbyCategoryEmoji.ts`(B 인접) 미변경.
- 전체 suite·tsc 미실행(리더 통합 시 1회). git 미수행.

## QA 참고(미완/리스크)
- 매핑은 키워드 부분일치라 함정이 잔존할 수 있다(메모리 [[nearby-category-mapping]]). 실기기에서 카테고리가 어긋나는 케이스가 보이면 추측 말고 실 categoryName을 찍어 규칙 보정 후 spec 박제 권장. 현재 규칙은 알려진 브레드크럼 + nearbyCategoryEmoji 보정 이력 기준.
- `PlaceSearchView`에 mapKakaoCategory 의존이 생김(이전엔 순수 표시 컴포넌트). 기본값일 뿐이라 소비처가 resolveCategory를 넘기면 종전대로 오버라이드 가능 — 비주얼/계약 회귀 아님.
