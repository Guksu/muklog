# UI Spec: 위시리스트 장소 지도 핀 표시 (map-wish-pins)

> 디자인 단일 출처: 킷 `.claude/skills/ui-design/templates/muklog/`. 킷 `MapScreen`(mk-home.jsx:319-395)의 범례·핀은 **우리 맛집(blue)·주변 음식점(gray) 2종뿐** — 위시 핀 전용 색·카드가 킷에 없다. 따라서 위시 핀 스타일과 `WishSpotCard`는 **킷 기존 패턴(스팟 카드 셸·범례 칩·warm 포인트색)을 조합**해 확정하고, 각 근거를 킷 라인으로 명시한다.

---

## 0. 요약 — 무엇을 만들었나

| 산출물 | 유형 | 파일 | 킷 근거 |
|---|---|---|---|
| 위시 핀 색 토큰 `mapWishPin` | 신규 토큰 | `src/theme/tokens/tokens.ts` | 킷 warm 앰버 `#FFB23E`(mk-ui Stars `starFill`) |
| `.mk-pin--wish` CSS 클래스 | mapHtml 스타일 추가 | `src/features/map/mapHtml/mapHtml.ts` | 3-way 시각 구분(saved blue / nearby gray / **wish amber**) |
| `WishSpotCard` 최소 카드 | 신규 컴포넌트 | `src/features/map/components/WishSpotCard/` | mk-home.jsx:386-393 스팟 카드 셸 미러(별점·heart·거리·액션 제외) |
| MapLegend 위시 항목 추가 | 기존 컴포넌트 확장 | `src/features/map/components/MapLegend/MapLegend.tsx` | 킷 mk-home:282-283 범례 칩 패턴 + 위시 보이스(mk-extra:195) |

---

## 1. 위시 핀 색 — 킷 직접 시안 없음(패턴 조합)

### 1.1 문제

핀이 이제 3종(saved=먹로그 / nearby=주변 / **wish=위시**). 킷 범례·핀은 2종뿐(mk-home:282 `우리 맛집`=`--mk-accent` blue, :283 `주변 음식점`=`#B6ABA0` warm gray)이라 **위시 전용 색이 킷에 없다.** → 제3의 색을 킷 근거로 확보해야 한다.

### 1.2 결정 — warm 앰버 `#FFB23E`

킷 팔레트에서 saved(blue #3366FF)·nearby(warm gray #B6ABA0)와 **명확히 구분되는 제3의 웜 포인트색**은 앰버 `#FFB23E`(킷 `mk-ui.jsx` Stars 채운 별색 = 기존 `starFill` 토큰). 채택 근거:

1. **3-way 판별성**: 앰버(웜 골드)는 blue·gray 어느 쪽과도 색상환에서 멀어 지도 위에서 즉시 구분.
2. **킷 근거**: 임의 hex가 아니라 킷이 이미 쓰는 warm 포인트색(Stars). muklog 웜 변형 톤과 정합.
3. **의미**: 앰버/골드 = "가보고 싶은 곳"의 따뜻한 지향. 킷 위시 화면(mk-extra 📍·warm)과 톤 일치.
4. **분리 회피**: 코럴(`brandMarkGlyph #FF5566`)은 브랜드 「먹 핀」 마크 전용이고 negative red 계열과 혼동 위험 → 배제. `mapLocate #3B82F6`는 primary와 근접 → 배제.

**근사/제약**: 값은 `starFill`과 동일하나 **의미가 달라 전용 토큰 `mapWishPin`으로 분리**(별점≠위시핀). `calendarSun`(값=`statusNegative`이나 의미 분리) 선례와 동일 패턴. 라이트/다크 공통(지도 위 마커라 톤 고정, `mapNearbyPin` 동일).

### 1.3 토큰 매핑

| 항목 | 값 | 소비처 |
|---|---|---|
| `color.mapWishPin` | `#FFB23E`(라이트=다크) | MapLegend 위시 dot(RN) |
| `.mk-pin--wish { border-color: #FFB23E }` | 동일 hex 직박음 | 지도 위시 핀(WebView 격리 HTML — RN 토큰 참조 불가, `mapNearbyPin` 선례) |

> ⚠️ RN 토큰과 WebView hex는 **같은 값 `#FFB23E`를 양쪽에 유지**(단일 출처 규율). 색 변경 시 두 곳 동시 갱신.

### 1.4 zIndex(stacking) — 머지 우선순위 정합

머지 우선순위 saved > wish > nearby(plan §3.5)와 stacking을 일치시킨다:

| kind | zIndex(비활성) | 근거 |
|---|---|---|
| active(선택) | 5 | 킷 mk-home:350 active |
| saved | 3 | 킷 saved |
| **wish** | **2** | saved와 nearby 사이(내 위시가 일반 주변 핀 위, 먹로그 아래) |
| nearby | 1 | 킷 nearby |

→ developer `pinZIndex(kind, active)` = `active ? 5 : kind==='saved' ? 3 : kind==='wish' ? 2 : 1`.

---

## 2. mapHtml `.mk-pin--wish` — 내가 정의한 것 / developer가 배선할 것

- **ui-publisher(완료)**: `<style>`에 `.mk-pin--wish { border-color: #FFB23E; }` 추가. `.mk-pin`(base, primary border)를 상속하되 border만 앰버로. 크기·라운드·배경은 base 공유(saved/nearby와 동일 셸).
- **developer(T6)**: `el.className`을 `kind` 기반 3분기(`saved→'mk-pin'` / `nearby→'mk-pin mk-pin--nearby'` / `wish→'mk-pin mk-pin--wish'`), `pinZIndex(kind, active)`(§1.4), MARKER_TAP `{ id, kind }` 동봉, `mkPins[id].kind` 추적. **색/zIndex 값은 위 표가 단일 출처 — hex 임의 지정 금지.**

> mapHtml.spec에 `.mk-pin--wish { border-color: #FFB23E; }` 존재 단언을 추가했다(내 CSS 검증, developer의 kind JS 리팩터와 독립). developer T6의 kind 분기 단언은 developer가 추가.

---

## 3. WishSpotCard — 최소 표시 카드

### 3.1 킷 대조

킷 `MapScreen` 스팟 카드(mk-home:386-393)는 saved 전용(FoodCover + 이름 + 별점 + heart). 위시 카드는 이 **셸을 미러**하되 표시를 축소:

| 요소 | SelectedSpotCard(킷 saved) | WishSpotCard(위시) |
|---|---|---|
| 카드 셸(surface·radius.card 상단·shadow.md·padding 14/20/16) | ✅ | ✅ 동일 |
| FoodCover 54×54 / radius 14 / emoji 26 | ✅ | ✅ 동일 |
| 가게명(cardTitle 700/17) | ✅ | ✅ |
| 별점(Stars) | ✅ | ❌ 미방문이라 평점 없음 |
| heart | ✅ | ❌ 아직 먹로그 아님 |
| 메타 "· 라벨 · area" | ✅ | ✅ (별점 없이 단독) |
| 거리·액션 | — | ❌ plan §4.1 "액션 없음" |

→ 셸·FoodCover·메타 합성(`· {label} · {area}` null-safe)은 SelectedSpotCard와 동일. 별점·heart만 제거. NearbySpotCard와도 셸 100% 공유(세 카드 동일 슬롯).

### 3.2 커버 이모지 — 핀과 단일 출처(drift 방지)

**함정(plan 경계면 §7-6)**: FoodCover의 category→이모지 폴백은 `cafe ☕`(FoodCover:56)인데, 위시 핀(`wishToMapMarkers`)의 폴백은 `🍽️`(plan §3.3). **null category일 때 카드 ☕ vs 핀 🍽️ 드리프트.**

→ **해결**: WishSpotCard는 `coverEmoji`를 **주입받는다**(NearbySpotCard 선례). developer가 핀과 **동일한 `categoryEmoji`(+🍽️ 폴백)** 로 한 번 산출해 마커와 카드에 같은 값을 넘긴다 → 카드 글리프 == 핀 글리프(null 포함). `category`는 FoodCover **그라데이션 tint + 메타 라벨** 출처로만 쓴다(글리프는 `coverEmoji` 오버라이드가 우선).

### 3.3 props 계약 (developer가 채움)

```ts
type WishSpotCardProps = {
  placeName: string;                                  // 위시 placeName
  category: MuklogCategoryKey | string | null;        // FoodCover tint + categoryLabel(메타)
  coverEmoji: string;                                 // ★ 핀과 동일 categoryEmoji 산출값(단일 출처, §3.2)
  area: string | null;                                // 메타 "· 라벨 · area"(null이면 area 조각 생략)
};
```

- **별점/heart/거리/액션 prop 없음** — 최소 표시 카드(회귀 방지: 세 카드가 같은 셸이라 시각 일관).
- `coverEmoji`는 반드시 `wishToMapMarkers`가 쓰는 것과 **같은 `categoryEmoji` 호출 결과**(폴백 🍽️ 포함)를 주입 — 카드↔핀 단일 출처.

---

## 4. MapLegend — 위시 항목 추가

### 4.1 결정 — 추가함(3종 범례)

3종 핀이 색으로 구분되므로 범례에 위시 항목을 **추가**한다(안 하면 앰버 핀의 의미 미설명). 킷 범례 칩 패턴(dot + label, mk-home:306-312)을 그대로 따르는 얇은 확장.

| 항목 | dot 색 | 라벨 | 근거 |
|---|---|---|---|
| 우리 맛집 | `primary` | 우리 맛집 | 킷 mk-home:282 |
| **가고 싶은 곳** | **`mapWishPin`** | **가고 싶은 곳** | 신설. 라벨은 킷 위시 보이스("가보고 싶은 곳" mk-extra:195)를 주변/맛집과 평행한 짧은 명사구로 축약 |
| 주변 음식점 | `mapNearbyPin` | 주변 음식점 | 킷 mk-home:283 |

**근사/제약**: 칩 3개가 좌상단 가로 배치(no-wrap) — 375px 폭 기준 ~226px로 여유. 초협폭 기기에서 좁아질 수 있으나 오버레이라 지도 가림 최소(qa-visual 디바이스 확인 권고). 순서는 stacking 우선순위(맛집>위시>주변)와 동일하게 배열.

---

## 5. TDD 현황

| 스위트 | 내용 | 결과 |
|---|---|---|
| `tokens.spec.ts` | `mapWishPin` = #FFB23E, starFill과 값 동일·의미 분리, saved/nearby와 3-way 구분, 라이트=다크 | green |
| `mapHtml.spec.ts` | `.mk-pin--wish { border-color: #FFB23E; }` 존재 | green |
| `WishSpotCard.spec.tsx` | 이름·메타(라벨·area)·area 생략·coverEmoji 렌더·별점/heart/액션 없음·메타 클리핑 | green(6) |
| `MapLegend.spec.tsx` | 3 라벨·3 dot | green |

내가 만든 4개 산출물(tokens·mapHtml CSS·WishSpotCard·MapLegend)은 **테스트 green + tsc 클린**.

> ⚠️ 전체 `tsc`에는 현재 developer의 `saved`→`kind` 리팩터 진행분(MapTabScreen·mergeMapMarkers·MARKER_TAP·관련 spec)의 미완 에러가 있다 — **내 파일이 아니라 developer T1/T5/T7 영역**이며 T9 게이트에서 green으로 수렴한다.

---

## 6. developer 배선 가이드(요약)

- **mapHtml(T6)**: `.mk-pin--wish` 색은 정의 완료 → `kind→className`·`pinZIndex(kind,active)`(§1.4)·MARKER_TAP `kind`만 배선.
- **MapTabScreen(T7)**: 선택 `{ id, kind }` 3분기 — `saved→SelectedSpotCard` / `nearby→NearbySpotCard` / `wish→WishSpotCard`. WishSpotCard엔 `{ placeName, category, coverEmoji, area }` 주입, `coverEmoji`는 핀과 동일 `categoryEmoji`(§3.2).
- **범례**: MapLegend 자동으로 3종 렌더(배선 불필요).
- **토큰**: `mapWishPin` 사용처는 MapLegend뿐(추가 배선 없음). WebView hex는 mapHtml에 이미 반영.

---

## 7. QA(qa-visual) 대조 포인트

1. **위시 핀 색** — 실기기에서 앰버 핀이 blue(맛집)·gray(주변)와 명확히 구분되는지(디바이스 스모크, [[qa-layout-blind-spot]]).
2. **3-way stacking** — 좌표 근접 시 saved > wish > nearby 순으로 겹침(zIndex).
3. **WishSpotCard 셸** — Selected/NearbySpotCard와 동일 셸(cover 54/14/26·padding·radius.card)이고 별점/heart/액션 부재.
4. **카드↔핀 이모지 일치** — 같은 위시의 핀 글리프와 카드 글리프가 동일(§3.2, null category 포함).
5. **범례 3칩** — 라벨·dot 색·좌상단 배치, 협폭 기기 오버플로 여부.
