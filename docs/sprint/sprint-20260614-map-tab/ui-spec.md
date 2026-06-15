# UI Spec — map-tab 슬라이스 1 (지도 셸 + 현재위치 + 내 먹로그 핀)

> 디자인 단일 출처: 킷 `templates/muklog/mk-home.jsx` `MapScreen`(라인 247-352).
> 작성: ui-publisher. 소비: developer(MapTabScreen 조립·데이터 배선), qa-inspector(킷 대조 검증).
> 범위: **프리젠테이션 컴포넌트 비주얼만**. 데이터/훅/HTML생성/메시지파싱은 developer 몫(plan §3·§5).

---

## 0. 산출물 요약

| 컴포넌트 | 경로 | 역할 | 킷 대응 |
|---------|------|------|---------|
| `SelectedSpotCard` | `src/features/map/components/SelectedSpotCard.tsx` | 핀 탭 시 하단 선택 스팟 카드 | mk-home:287-301 |
| `MapLegend` | `src/features/map/components/MapLegend.tsx` | 범례 칩 묶음("우리 맛집"/"주변 음식점") | mk-home:281-284,306-312 |
| `MapStatusOverlay` | `src/features/map/components/MapStatusOverlay.tsx` | 로딩/권한거부/빈/에러 안내 오버레이(비주얼만) | plan §4 상태(킷 톤 정합) |
| `MapWebView` | `src/features/map/components/MapWebView.tsx` | WebView 프리젠테이션 컨테이너(props forward + 오버레이 z순서) | mk-home:262-285 지도 영역 |
| 배럴 | `src/features/map/components/index.ts` | export | — |

**토큰 보강 1건**: `color.mapNearbyPin = #B6ABA0`(킷 주변 음식점 웜그레이). `tokens.ts`/`tokens.spec.ts`.

테스트(모두 통과): `SelectedSpotCard.spec.tsx`·`MapLegend.spec.tsx`·`MapStatusOverlay.spec.tsx`·`MapWebView.spec.tsx`.
tsc: `MapWebView.tsx`의 `react-native-webview` import 1건만 미해소(developer가 패키지 설치 시 해소 — 의도적).

---

## 1. 토큰 변경

### 1.1 신규: `color.mapNearbyPin` = `#B6ABA0`
- **근거(킷 라인)**: mk-home.jsx:282(`<Legend color="#B6ABA0" label="주변 음식점" />`), mk-home.jsx:314(`Pin`의 `saved ? var(--mk-accent) : "#B6ABA0"`).
- **왜 전용 토큰**: 기존 셸은 `fgMuted`(#9B9B9B, 쿨뉴트럴)로 근사했으나 킷은 **웜그레이**라 톤이 다름. raw hex 하드코딩 금지 규칙상 토큰화. 라이트/다크 공통(지도 위 마커라 톤 고정).
- **슬라이스 1 사용처**: `MapLegend`의 "주변 음식점" dot. (슬라이스 1엔 주변 음식점 핀 자체는 없음 — plan §2 OUT. dot만 표시. 슬라이스 2 `map-tab-nearby`의 주변 핀 색을 선반영.)
- **검증**: `tokens.spec.ts` — `mapNearbyPin === '#B6ABA0'` && `!== fgMuted`, dark 미러링.

### 1.2 변경 없음(계승)
- `primary`(#3366FF)=우리 맛집 dot·핀. `starFill`(#FFB23E)=별점. `surface`/`radius.card`(22)/`radius.full`/`shadow.md`/`spacing` 전부 기존 토큰 사용.

---

## 2. 컴포넌트별 킷↔RN 매핑 + props 계약

### 2.1 `SelectedSpotCard` — 선택 스팟 카드

**킷 대응**: mk-home.jsx:287-301.

| 킷(웹) | 라인 | RN 매핑 |
|---|---|---|
| 컨테이너 `padding:"14px 20px 16px"`, `background:var(--mk-card)`, `boxShadow:"0 -8px 24px rgba(0,0,0,.06)"` | 288 | `surface` 배경, paddingTop 14/bottom 16/horizontal 20, `shadow.md`(위로 뜨는 카드). **킷은 box-shadow 상향(0 -8px)**, RN shadow는 offset 음수 height 지원 약함 → `shadow.md` 근사 + 상단 모서리 `radius.card`만 둥글게(지도 위 floating 카드 정합). |
| `display:flex; gap:13` | 289 | `flexDirection:row`, `gap: spacing[12]`(킷 13≈12). |
| `FC cat radius=14 emojiSize=26 54×54` | 290 | `<FoodCover category radius={14} emojiSize={26} size={54} />`. |
| `place`(700/16) | 292 | `<Text variant="cardTitle">`(700/17 근사 — 기존 카드타이틀 토큰, 킷 16↔17 1px차 허용). numberOfLines 1. |
| `<ST value={rating} size=13 />` | 294 | `<Stars value={rating} size={13} />`. |
| `"· {CATLABEL(cat)} · {area}"`(500/12.5) | 295 | `<Text variant="meta">` `· {라벨} · {area}`. **null 안전 합성**(buildMeta): 라벨·area 중 존재하는 것만 `· `로 join. |
| `<I heart-fill size=20 var(--mk-accent) />` | 298 | `<Icon name={IconName.Heart} size={20} color="primary" />`. **근사**: `heart-fill` 글리프 없음 → outline `heart`(primary). 장식 표식(슬라이스 1 토글 없음). |

**props 계약** (전부 plan §3.3 `MuklogPin` 필드 — 추가 조회 없음):
```ts
type SelectedSpotCardProps = {
  placeName: string;                 // pin.placeName
  rating: number | null;             // pin.rating (1~5 | null)
  category: MuklogCategoryKey | string | null;  // pin.category → 커버 이모지/라벨
  area: string | null;               // pin.area
};
```
**developer 주입**: selectedPin(= `pins.find(p => p.muklogId === tappedId)`)에서 4필드 그대로 전달.

---

### 2.2 `MapLegend` — 범례 칩

**킷 대응**: mk-home.jsx:281-284(배치), 306-312(Legend 칩).

| 킷(웹) | 라인 | RN 매핑 |
|---|---|---|
| `position:absolute; top:14; left:16; gap:8` | 281 | **이 컴포넌트는 칩 묶음(row, gap 8)만**. absolute 오프셋(top/left)은 **부모(MapTabScreen/MapWebView 오버레이)가 배치** — 레이아웃 책임 분리. |
| 칩 `padding:"5px 10px"`, `borderRadius:999`, `background:rgba(255,255,255,.85)`, `backdropFilter:blur(6px)` | 308 | paddingV 5/H 10, `radius.full`, `surface` 배경. **근사**: backdrop-blur RN 미지원 → 불투명 surface(blur 없음). |
| 칩 텍스트 `700/11`, `var(--mk-ink2)` | 308 | `<Text variant="caption" color="fgWeak">`(12/Medium 근사, 킷 11↔12). |
| dot `9×9 radius:999`, `background:color` | 309 | 9×9 `borderRadius:4.5`. "우리 맛집"=`primary`, "주변 음식점"=`mapNearbyPin`. testID `map-legend-dot`. |

**props 계약**: 없음(고정 2종 칩). 라벨·색은 컴포넌트 내 `LEGEND_ITEMS` 상수.
**developer 배치**: 지도 영역 좌상단 absolute(`top: spacing[14], left: spacing[16]`)로 오버레이.

---

### 2.3 `MapStatusOverlay` — 상태 안내 오버레이

**킷 대응**: 킷엔 전용 상태 오버레이 함수가 없음(킷은 FauxMap 정적). plan §4 상태 정의 + 킷 톤(surface 카드/헤어라인/radius.card) 정합으로 신규 구성.

| plan §4 상태 | tone | 스피너 | 액션 |
|---|---|---|---|
| 로딩(지도 로드+핀 조회 중) | `loading` | O | — |
| 권한 거부 안내 / 빈 상태 | `info` | X | (선택) |
| 핀 조회 실패 / 지도 SDK ERROR | `error` | X | actionLabel + onAction(재시도) |

**비주얼**: `surface` 카드 + `hairline` 보더 + `shadow.md`(떠 있는 안내), `radius.card`, maxWidth 320, 중앙정렬. 스피너 색 `primary`, 메시지 `bodySm/fgWeak`, 액션은 `Button variant="soft" size="sm"`.

**props 계약**:
```ts
type MapStatusOverlayProps = {
  tone: 'loading' | 'info' | 'error';   // MapStatusTone 상수
  message: string;                       // 카피는 developer/킷 정합(아래 §4 카피 가이드)
  actionLabel?: string;                  // 예 "다시 시도" — 없으면 액션 미표시
  onAction?: () => void;                 // 예 refresh
};
```
**중요**: 상태→tone/message 매핑(판단)은 **developer**가 `MapTabScreen`에서 한다. 이 컴포넌트는 비주얼만.

---

### 2.4 `MapWebView` — 지도 WebView 컨테이너 (프리젠테이션만)

**킷 대응**: mk-home.jsx:262-285(지도 영역 = `<div flex:1 position:relative><FauxMap/>...핀...범례</div>`). 킷의 `FauxMap`/정규화 핀 좌표(`px()`)·현재위치 점은 **실제 Kakao Map JS SDK(WebView HTML)가 대체** — 그 HTML/마커 렌더는 developer가 SDK로 구현. 여기선 **WebView가 지도 영역을 꽉 채우는 레이아웃 + 오버레이 z순서**만.

| 책임 | 내용 |
|---|---|
| ✅ 레이아웃 | `flex:1` 컨테이너에 WebView `flex:1`(지도 영역 풀필), `overflow:hidden`. |
| ✅ props forward | `source={{ html }}`, `onMessage`, `style` 그대로 전달. `originWhitelist={['*']}`(로컬 HTML). |
| ✅ 오버레이 | `children`을 `absoluteFill`+`pointerEvents="box-none"`로 WebView 위에 → 범례/선택카드/상태오버레이 z순서. |
| ❌ 비즈니스 로직(developer) | HTML 생성·INIT 직렬화·SET_MARKERS injectJavaScript·메시지 파싱(`MARKER_TAP`/`READY`/`ERROR`) **전부 금지**. html 문자열·onMessage 콜백을 가공 없이 받기만. |

**props 계약**:
```ts
type MapWebViewProps = {
  html: string;                                       // developer가 생성한 지도 HTML
  onMessage: (e: { nativeEvent: { data: string } }) => void;  // 파싱은 developer
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;                         // 범례·선택카드·상태 오버레이
};
export type MapWebViewMessageEvent = { nativeEvent: { data: string } };  // forward 시그니처(webview 타입 의존 회피)
```

**⚠️ 의존성**: `react-native-webview`는 **developer가 설치**(plan §5 "의존성 추가"). 미설치 동안 `MapWebView.tsx`의 import에 tsc 에러 1건 발생(의도적). 설치 후 자동 해소. (테스트는 `jest.mock(..., { virtual:true })`로 모킹 — 미설치에도 통과.)

---

## 3. MapTabScreen 조립 가이드 (developer용)

> **ui-publisher는 `MapTabScreen.tsx`를 건드리지 않았다.** 아래는 자식 컴포넌트 배치 권고. 상태→컴포넌트 매핑·훅 배선은 developer.

레이아웃(킷 mk-home `MapScreen` 구조, 헤더는 HomeTabs의 HomeHeader가 제공):

```
<View flex:1>                          // 지도 탭 루트
  <MapWebView html onMessage flex:1>   // 지도 영역(킷 mk-home:262 flex:1 position:relative 대응)
    {/* 오버레이(children) — z순서 위→아래 */}
    <View absolute top=spacing[14] left=spacing[16]>
      <MapLegend />                     // 범례(킷 mk-home:281)
    </View>
    {status !== ready && (
      <View absolute center(또는 상단)>   // 차단 아님 — 지도 위 배너
        <MapStatusOverlay tone message [actionLabel onAction] />
      </View>
    )}
  </MapWebView>
  {selectedPin && (
    <SelectedSpotCard                   // 하단 도킹(킷 mk-home:287 flex:none 하단)
      placeName rating category area /> // = selectedPin 4필드
  )}
</View>
```

**상태→컴포넌트 매핑**(plan §4):

| 상태 | MapStatusOverlay | 비고 |
|---|---|---|
| `pins.status==='loading'` | `tone="loading"` "지도를 불러오는 중이에요"류 | 지도는 그 아래 계속 렌더 |
| 권한 `denied` | `tone="info"` "위치 권한을 허용하면 현재 위치를 볼 수 있어요" | 지도 표시, 현재위치 마커만 생략(bbox 중심) |
| `ready && pins:[]`(빈) | `tone="info"` "좌표가 있는 먹로그가 아직 없어요" | 지도 표시, 핀 0 |
| `pins.status==='error'` 또는 SDK `ERROR` | `tone="error"` + actionLabel="다시 시도" onAction=refresh | 지도는 별개로 떠 있을 수 있음 |
| `ready && pins.length>0` | (오버레이 없음) | 핀 N개 + (옵션)첫 핀 자동선택 |

**선택 카드 배선**: WebView `MARKER_TAP id` → `setSelectedId(id)` → `selectedPin = pins.find(p => p.muklogId === id)` → `<SelectedSpotCard {...selectedPin} />`. (킷은 진입 시 `spots[0]` 자동선택 — 자동선택 여부는 developer 재량, 데이터 계약 무영향.)

**현재위치 마커**: 킷 mk-home:265-267 파란 점(`#3B82F6` + 링)은 **WebView HTML 내부 마커**로 developer가 SDK 구현(INIT의 `me:Coords`로 주입). RN 오버레이 아님. (색은 `primary` 톤 권고 — HTML 안이라 토큰 직접 적용 불가, dev-notes에 #3366FF 명시.)

---

## 4. 카피 가이드 (킷·plan §4 정합, developer 확정)

킷 `MapScreen`엔 상태 카피가 없음(정적). plan §4·architecture §6 톤 기준 권고(해요체, 차단 아님):
- 로딩: "지도를 불러오는 중이에요"
- 권한 미결정 요청 직전(필요 시): "근처 맛집을 지도에 보여주려면 위치 권한이 필요해요"
- 권한 거부: "위치 권한을 허용하면 현재 위치를 볼 수 있어요"
- 빈 상태: "좌표가 있는 먹로그가 아직 없어요"(수동입력은 미표시 뉘앙스 — plan §6)
- 핀 조회 에러: "먹로그를 불러오지 못했어요" + "다시 시도"
- 지도 SDK 에러: "지도를 불러오지 못했어요" + "다시 시도"

> 최종 카피 문자열은 developer가 props로 주입(컴포넌트는 받기만). 위는 권고값.

---

## 5. RN 미재현 / 근사 항목 (사유 기록)

| 항목 | 킷 | RN 근사 | 사유 |
|---|---|---|---|
| 선택 카드 상향 그림자 | `box-shadow:0 -8px 24px` | `shadow.md` + 상단 `radius.card` | RN iOS shadow는 음수 offset 표현 약함. 떠 있는 카드 톤만 유지. |
| 범례 칩 글래스 | `backdrop-filter:blur(6px)` + `rgba(255,255,255,.85)` | 불투명 `surface`(blur 없음) | RN backdrop-blur 미지원(`expo-blur` 도입은 과함). MuklogCard 칩과 동일 정책. |
| heart-fill 아이콘 | `heart-fill`(solid, primary) | outline `heart`(primary) | `heart-fill` 글리프 부재. 장식 표식(슬라이스 1 토글 없음)이라 outline 허용. 필요 시 추후 asset 추가. |
| 범례 폰트 | `700/11` | `caption`(12/Medium) | 1px·weight 차 허용(기존 토큰 재사용, 신규 토큰 회피). |
| 현재위치 점 색 | `#3B82F6` | WebView HTML 내부(토큰 미적용) | HTML 안이라 RN 토큰 직접 적용 불가. dev-notes에 `primary #3366FF` 권고. |

---

## 6. 비주얼 충실도 self-check (→ qa 인계)

- [x] 킷 선택 카드 구조 요소: FoodCover·가게명·별점·메타("· 카테고리 · area")·heart 모두 존재.
- [x] 범례 2칩(우리 맛집 primary / 주변 음식점 mapNearbyPin) 존재.
- [x] 색 전부 토큰 경유(raw hex 0). 신규 `mapNearbyPin` 킷 #B6ABA0 정합 + spec 검증.
- [x] radius(card 22)·별점 starFill·spacing 킷 실값.
- [x] 그림자 vs 헤어라인: 카드=떠 있어 shadow.md, 범례 칩=불투명 surface.
- [x] FoodCover 카테고리 그라데이션 재사용(기존 컴포넌트).
- [x] 프리미티브 추출: 범례 칩을 MapTabScreen 인라인 → MapLegend로 추출(인라인 중복 제거).
- [x] RN 미재현 근사+사유 기록(§5).
- [x] `npm test`(map+theme) 통과. tsc: webview import 1건만 미해소(developer 설치 대기, 의도적).

## 7. qa-inspector 대조 포인트

| 킷 라인 | RN 파일 | 대조 |
|---|---|---|
| mk-home:290 | SelectedSpotCard.tsx FoodCover | size 54·radius 14·emojiSize 26 |
| mk-home:292-295 | SelectedSpotCard.tsx | 가게명·별점 size13·메타 "· 라벨 · area" |
| mk-home:298 | SelectedSpotCard.tsx | heart primary(근사: outline, §5) |
| mk-home:282,314 | tokens.ts mapNearbyPin | #B6ABA0 정합 |
| mk-home:308-309 | MapLegend.tsx | 칩 pad 5×10·radius full·dot 9×9 |
| mk-home:281 | (MapTabScreen 조립) | top14/left16 오프셋은 developer 배치 |
| mk-home:262 | MapWebView.tsx | 지도 영역 flex:1 풀필 + 오버레이 z순서 |
