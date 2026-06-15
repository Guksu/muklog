# UI Spec — map-tab-nearby 슬라이스 2 (주변 음식점 viewport 핀 + 카드)

> 디자인 단일 출처: 킷 `templates/muklog/mk-home.jsx` `MapScreen`(선택 스팟 카드 mk-home:287-301, 범례 mk-home:281-283·306-312, Pin mk-home:314).
> 작성: ui-publisher. 소비: developer(MapTabScreen 조립·HTML 핀 색 분기·데이터 배선), qa-visual(킷 대조 검증).
> 범위: **NearbySpotCard 컴포넌트 + 핀 색 스펙(HTML 적용 지시) + 범례 불변 확인 + 조립 가이드**. 데이터/훅/HTML생성/메시지파싱은 developer 몫(plan §3·§5).
> slice1 산출물(`SelectedSpotCard`·`MapLegend`·`MapWebView` 등)과 `color.mapNearbyPin = #B6ABA0`는 **불변·계승**.

---

## 0. 산출물 요약

| 산출물 | 경로 | 역할 | 킷 대응 |
|---|---|---|---|
| **`NearbySpotCard`(신규)** | `src/features/map/components/NearbySpotCard.tsx` | 주변 핀(saved:false) 탭 시 하단 요약 카드(가게명·카테고리명·거리) | mk-home:287-301 셸 재사용(필드 축소) |
| 배럴 export | `src/features/map/components/index.ts` | `NearbySpotCard`/`NearbySpotCardProps` export 추가 | — |
| 테스트 | `src/features/map/components/NearbySpotCard.spec.tsx` | 가게명·메타(거리 유/무)·FoodCover·별점/heart 부재 단언(5 케이스 green) | — |

- **토큰 변경 없음.** `color.mapNearbyPin = #B6ABA0`은 slice1에서 이미 추가됨(재사용만).
- **핀 색 스펙(§2)**: developer가 `mapHtml.ts`에 적용(HTML 격리 영역 — RN 컴포넌트 아님).
- **범례(`MapLegend`)**: slice1 그대로. 변경 없음(§3).

`npm test`(NearbySpotCard.spec) 5/5 green. `tsc --noEmit`: NearbySpotCard 관련 에러 0.

---

## 1. `NearbySpotCard` — 킷↔RN 매핑 + props 계약

**킷 대응**: mk-home.jsx:287-301(선택 스팟 카드). 킷 `MapScreen`엔 **nearby 전용 카드 함수가 없다**(킷 지도는 saved 카드만 띄움). plan §4·§9.4 확정대로 **동일 카드 셸을 재사용하되 표시 필드만 축소**한다 → SelectedSpotCard와 비주얼 일관(같은 슬롯·셸·간격), 데이터만 다름.

### 1.1 셸 정합(SelectedSpotCard와 동일)

| 킷(웹) | 라인 | RN 매핑 | SelectedSpotCard와 동일? |
|---|---|---|---|
| 컨테이너 `padding:"14px 20px 16px"`, `background:var(--mk-card)`, `boxShadow:"0 -8px 24px rgba(0,0,0,.06)"` | 288 | `surface` 배경, paddingTop 14/bottom 16/horizontal 20, `shadow.md` + 상단 `radius.card`(지도 위 floating 정합) | ✅ 동일 |
| `display:flex; gap:13` | 289 | `flexDirection:row`, `gap: spacing[12]`(킷 13≈12) | ✅ 동일 |
| `FC cat radius=14 emojiSize=26 54×54` | 290 | `<FoodCover category radius={14} emojiSize={26} size={54} />` | ✅ 동일 |
| `place`(700/16) | 292 | `<Text variant="cardTitle">`(700/17 근사), numberOfLines 1 | ✅ 동일 |

### 1.2 필드 축소(SelectedSpotCard와 다른 부분 — 주변 음식점엔 그 데이터가 없음)

| 킷 요소(saved 카드) | 라인 | NearbySpotCard | 사유 |
|---|---|---|---|
| `<ST value={rating} size=13 />`(별점) | 294 | **없음** | 주변 음식점은 내 평점이 없음(plan §4). |
| 메타 `"· {CATLABEL(cat)} · {area}"` | 295 | **메타 `"{categoryName} · {거리}"`** (변형) | area 없음 → Kakao **categoryName**(FD6 브레드크럼) + **거리**로 대체. `· ` 구분, 거리 결측 시 카테고리명만. |
| `<I heart-fill size=20 var(--mk-accent) />` | 298 | **없음** | "우리 맛집" 표식 — 내 맛집이 아니므로 제거. |

- **FoodCover category**: nearby는 Kakao **categoryName(자유 text)**를 그대로 넘긴다 → `categories.ts`가 미지 key를 **cafe 그라데이션·이모지로 폴백**(킷 `CAT[cat]||CAT.cafe` 정합). 즉 주변 핀 카드 커버는 cafe 톤 그라데이션 + ☕ 이모지로 일관 표시. (카테고리별 이모지 매핑은 핀 마커 emoji가 담당 — 카드 커버는 셸 일관성 유지가 우선.)
- **메타 색**: SelectedSpotCard와 동일 `meta`/`fgMuted`.

### 1.3 props 계약

```ts
type NearbySpotCardProps = {
  placeName: string;        // NearbyPlaceItem.placeName (Kakao place_name)
  categoryName: string;     // NearbyPlaceItem.categoryName (FD6 브레드크럼, 예 "음식점 > 한식 > 칼국수")
  distanceText?: string;    // developer가 formatDistance({ meters: distance })로 생성·주입.
                            //   distance가 null이면 미전달(undefined) → 카드에서 거리 조각 생략.
};
```

- **developer 주입**: nearby 결과에서 `kakaoPlaceId === tappedId` lookup한 `NearbyPlaceItem`의 `placeName`/`categoryName`을 그대로, **거리는 `distance`(number|null)를 `formatDistance`로 문자열화**해 `distanceText`로 전달.
  - `distance === null` → **`distanceText` prop 자체를 넘기지 않는다**(undefined). 컴포넌트가 거리 조각을 생략한다.
  - `distance` 있음 → `formatDistance({ meters: distance })`("320m"/"1.5km")를 `distanceText`로 전달.
- **컴포넌트는 거리 계산/포맷을 하지 않는다** — `distanceText`는 완성된 문자열로 받는다(데이터/로직 경계 준수, plan §4 거리 표기 규칙은 `formatDistance` 유틸 = developer 몫).

---

## 2. nearby 핀 색 스펙 (developer가 `mapHtml.ts`에 적용 — HTML 격리 영역)

> **이건 RN 컴포넌트가 아니라 WebView HTML(`mapHtml.ts`) 영역이라 ui-publisher가 직접 수정하지 않는다**(plan 절대 경계: `mapHtml.ts`는 developer 몫). 아래는 **킷 정합값과 적용 지시**다. developer가 `renderMarkers`의 `m.saved` 분기에 그대로 박는다.

### 2.1 킷 정합값(mk-home:314 `Pin`)

킷 `Pin` 함수(mk-home:314):
```js
const c = saved ? "var(--mk-accent)" : "#B6ABA0";
```
- `var(--mk-accent)` = **`#3366FF`**(primary). → **saved 핀**(내 맛집).
- `#B6ABA0`(웜그레이) = **`mapNearbyPin`** 토큰값. → **nearby 핀**(주변 음식점).

### 2.2 적용 지시(developer)

`mapHtml.ts`의 `.mk-pin`(또는 `renderMarkers` 마커 생성)에서 **`m.saved` 분기**로 핀 색(border/fill)을 결정한다:

| 마커 | saved | 핀 색(hex 직박힘) | 근거 |
|---|---|---|---|
| 내 먹로그(saved) | `true` | **`#3366FF`** | 킷 `var(--mk-accent)`. slice1 HTML에 이미 직박힘(보존). |
| 주변 음식점(nearby) | `false` | **`#B6ABA0`** | 킷 `#B6ABA0` = `mapNearbyPin` 토큰값. 신규 분기. |

- 적용 방식: CSS 클래스 `.mk-pin--nearby { ... border-color/fill: #B6ABA0 }` 추가, 또는 마커 인라인 스타일에 `m.saved ? '#3366FF' : '#B6ABA0'`. (plan §3.7 — 방식은 developer 재량.)

### 2.3 ⚠️ 근사 사유(HTML hex 직박힘 — slice1 선례)

- **WebView HTML은 RN 토큰 시스템(`useTheme()`) 밖**이라 `theme.color.mapNearbyPin`을 주입할 수 없다. 따라서 hex(`#B6ABA0`)를 HTML 문자열에 직접 박는다.
- 이는 **slice1 선례 그대로**다: slice1에서도 saved 핀 색 `#3366FF`(primary)·현재위치 점 `#3B82F6`가 HTML에 직박혀 있다(slice1 ui-spec §5 기록).
- **단일 출처 정합**: `#B6ABA0` = `tokens.ts`의 `color.mapNearbyPin` 실값과 **반드시 일치**해야 한다(범례 dot은 토큰 경유, 지도 핀은 hex 직박힘 → 같은 값). developer는 hex를 `mapNearbyPin` 토큰값에서 베껴오고, dev-notes에 "HTML 핀 색 `#B6ABA0`은 `color.mapNearbyPin` 미러(HTML 격리로 직박힘)"를 기록한다.
- 향후 토큰 시스템을 HTML에 직렬화 주입(INIT 페이로드에 색 토큰 동봉)하면 직박힘을 제거할 수 있으나, slice1 정책 유지로 이번엔 직박힘(범위 밖).

---

## 3. 범례(`MapLegend`) — slice1 그대로(변경 없음)

- `MapLegend`는 slice1에서 이미 **"우리 맛집"(primary) / "주변 음식점"(mapNearbyPin)** 2칩을 렌더한다(킷 mk-home:282-283).
- slice1엔 주변 핀 **자체**가 없어 "주변 음식점" 칩만 표시됐고, slice2에서 **핀이 실제로 채워진다**(범례 dot 색과 지도 nearby 핀 색이 동일 `mapNearbyPin #B6ABA0`로 시각 정합).
- **컴포넌트·스타일·색 변경 0.** 범례 dot은 토큰(`mapNearbyPin`) 경유, 지도 핀은 hex(`#B6ABA0`) 직박힘 — 두 값이 같아 사용자에게 일관된 웜그레이로 보인다.

---

## 4. MapTabScreen 조립 가이드 (developer용)

> **ui-publisher는 `MapTabScreen.tsx`를 건드리지 않았다**(plan 절대 경계). 아래는 자식 배치 권고. 상태→컴포넌트 매핑·훅 배선·메시지 분기는 developer.

### 4.1 카드 슬롯(SelectedSpotCard ↔ NearbySpotCard 택1)

`NearbySpotCard`는 **slice1 `SelectedSpotCard`와 동일한 하단 도킹 슬롯**에 들어간다. 둘 중 **하나만** 표시한다(선택 상태가 saved/nearby 중 하나).

```
<View flex:1>                              // 지도 탭 루트(slice1 구조 보존)
  <MapWebView html onMessage flex:1>       // 지도 영역
    {/* 오버레이(children) — slice1 그대로 */}
    <View absolute top=spacing[14] left=spacing[16]>
      <MapLegend />                         // slice1 불변(핀이 채워짐)
    </View>
    {status !== ready && (<MapStatusOverlay ... />)}   // slice1 불변
  </MapWebView>

  {/* 하단 카드 슬롯 — saved/nearby 택1(plan §4 카드 분기 규칙) */}
  {selected?.saved === true && savedPin && (
    <SelectedSpotCard                       // slice1 — saved 핀 탭
      placeName={savedPin.placeName}
      rating={savedPin.rating}
      category={savedPin.category}
      area={savedPin.area}
    />
  )}
  {selected?.saved === false && nearbyItem && (
    <NearbySpotCard                         // slice2 신규 — nearby 핀 탭
      placeName={nearbyItem.placeName}
      categoryName={nearbyItem.categoryName}
      distanceText={
        nearbyItem.distance !== null
          ? formatDistance({ meters: nearbyItem.distance })
          : undefined
      }
    />
  )}
</View>
```

### 4.2 카드 분기 배선(plan §4·§9.3 — developer 로직)

| 메시지 | 선택 상태 `{ id, saved }` | lookup | 카드 |
|---|---|---|---|
| `MARKER_TAP{ saved:true, id }` | `{ id, saved:true }` | `pins.find(p => p.muklogId === id)` | `SelectedSpotCard`(slice1) |
| `MARKER_TAP{ saved:false, id }` | `{ id, saved:false }` | nearby 결과 `find(it => it.kakaoPlaceId === id)` | `NearbySpotCard`(slice2) |

- **선택 상태는 `{ id, saved }` 쌍으로 보관**(같은 좌표 saved/nearby 충돌 방지 — plan §4·엣지 "MARKER_TAP id 충돌").
- 두 카드는 **상호 배타**(한 슬롯). saved 카드가 떠 있으면 nearby 카드는 미표시, 반대도 동일.
- **거리 포맷**: `nearbyItem.distance`(number|null)를 `formatDistance`로 변환. **null이면 `distanceText` prop을 넘기지 않는다**(undefined) → 카드가 거리 조각 생략(plan §4 "거리(distance) 결측" 엣지).

### 4.3 상태 우선순위(slice1 보존)

- nearby **로딩/빈/에러**는 **하단 카드와 무관**(plan §4): saved 핀·카드·지도·slice1 오버레이 전부 유지. nearby는 핀만 조용히 채우거나 비운다.
- 카드는 **마커 탭 시에만** 뜬다(로딩 중 차단 오버레이 아님). slice1 카드 동작과 동일.

---

## 5. qa-visual 대조 포인트

| 킷 라인 | RN 파일 | 대조 |
|---|---|---|
| mk-home:288-290 | NearbySpotCard.tsx | 카드 셸 padding(14/20/16)·surface·상단 radius.card·shadow.md·FoodCover 54/14/26 — SelectedSpotCard와 동일 셸 |
| mk-home:292 | NearbySpotCard.tsx | 가게명 cardTitle(700/17), numberOfLines 1 |
| mk-home:295(변형) | NearbySpotCard.tsx | 메타 "{categoryName} · {거리}", 거리 결측 시 카테고리명만(거리 조각 생략) |
| mk-home:294,298(제거) | NearbySpotCard.tsx | 별점(Stars)·heart **부재**(주변 음식점 데이터 없음 — 의도) |
| mk-home:314 (`#B6ABA0`) | mapHtml.ts(developer) | nearby 핀 색 `#B6ABA0`(= `mapNearbyPin`), saved 핀 `#3366FF` — HTML hex 직박힘(slice1 선례) |
| mk-home:282-283 | MapLegend.tsx(slice1) | 범례 2칩 불변, dot 색(`mapNearbyPin`)과 지도 nearby 핀 색 정합 |

---

## 6. RN 미재현 / 근사 항목 (사유 기록)

| 항목 | 킷 | RN 근사 | 사유 |
|---|---|---|---|
| nearby 카드 셸 | 킷에 nearby 전용 카드 없음(saved 카드만) | SelectedSpotCard 셸 재사용 + 필드 축소 | 킷 단일 카드 디자인을 nearby에 일관 적용(plan §4·§9.4 확정). |
| nearby 카드 커버 이모지 | (킷 미정의) | FoodCover에 Kakao categoryName 전달 → cafe 그라데이션 폴백 | nearby는 8종 enum key가 아닌 Kakao 자유 text라 미매핑 → `CAT[cat]||CAT.cafe` 정합(킷 폴백 규칙). 핀 마커 emoji는 별도(nearbyToMapMarkers가 categoryEmoji 매핑 — developer). |
| nearby 핀 색 토큰 | `#B6ABA0`(킷 Pin) | HTML hex 직박힘(`mapNearbyPin` 미러) | WebView HTML이 RN 토큰 밖(slice1 선례 — `#3366FF`도 직박힘). 값 일치 강제. |
| 선택 카드 상향 그림자 | `box-shadow:0 -8px 24px` | `shadow.md` + 상단 `radius.card` | RN iOS shadow 음수 offset 약함(slice1 SelectedSpotCard와 동일 근사). |

---

## 7. 비주얼 충실도 self-check (→ qa-visual 인계)

- [x] NearbySpotCard 셸이 SelectedSpotCard와 동일(surface·radius.card·shadow.md·padding·FoodCover 54/14/26·row gap 12) — 같은 슬롯·일관.
- [x] 표시 필드 = 가게명 + "카테고리명 · 거리"(거리 결측 시 카테고리명만). 별점/area/heart 부재.
- [x] 색 전부 토큰 경유(RN 컴포넌트 raw hex 0). 핀 색만 HTML 영역이라 hex 직박힘(§2.3 사유·developer 적용 지시).
- [x] FoodCover cafe 폴백(킷 `CAT[cat]||CAT.cafe`) 정합.
- [x] 범례 slice1 불변(핀이 채워져 dot↔핀 색 정합).
- [x] props 계약 = plan §3.2 `NearbyPlaceItem` 필드(placeName/categoryName/distance→distanceText). 데이터/거리 포맷은 developer.
- [x] `npm test`(NearbySpotCard.spec) 5/5 green. tsc NearbySpotCard 에러 0.
