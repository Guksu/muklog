# Sprint: 지도 핀 클러스터링 (map-clustering)

> 작성: planner-map-cluster · 2026-08-13
> 설계 단일 출처: `docs/design/architecture.md` (§지도 슬라이스 3종 · §비용 가드레일)
> 선행 완료: `map-tab`(슬라이스1) · `map-tab-nearby`(슬라이스2) · `map-wish-pins` · `map-pin-select` · `map-category-filter` · `map-nearby-accumulate` · `map-prewarm` · `map-initial-location`
> architecture.md L238이 `map-tab-nearby`에서 **"클러스터링 OUT(후속)"** 으로 명시 이월한 항목 — 이번 스프린트가 그 후속이다(설계 문서와 충돌 없음).

---

## 1. 기능 한줄 정의

지도에서 서로 가까운 핀들이 겹쳐 아이콘이 뭉개지는 대신 **개수가 적힌 하나의 클러스터 버블**로 묶여 보이고, 그 버블을 탭하면 **지도가 확대되며 안에 있던 핀들이 펼쳐진다**.

---

## 2. 범위

### In-scope
- 지도 탭(`MapTabScreen`) WebView 안에서 **Kakao Maps `MarkerClusterer` 라이브러리**로 핀 클러스터링(§3.1 D1).
- 클러스터 대상 = **saved(내 맛집) · wish(위시) · nearby(주변 음식점) 3종 전부, 단일 클러스터러**(§3.2 D2).
- 클러스터 탭 동작 = **카카오 기본 줌인**(§3.3 D3).
- 클러스터 버블 비주얼 = 브랜드 토큰 실값 계약(§3.4 D4).
- 클러스터러 라이브러리 미로드/미정의 시 **기존 렌더 경로로 자동 강등**(지도가 죽지 않음, §3.6 E4).
- `mapHtml.spec.ts` 증분 단위 테스트 + 디바이스 스모크 체크리스트(§5-1).

### Out-of-scope (일부러 안 함 — 후속)
- **클러스터 탭 → 목록/바텀시트 UI.** 킷 `templates/muklog`에 클러스터 시안이 **없다**(전체 grep 0건, §3.3 근거). 킷이 단일 출처이므로 없는 패턴은 만들지 않는다.
- **kind별 클러스터러 분리(파랑/앰버/회색 버블 3개).** §3.2에서 근거로 기각.
- **RN 측 사전 클러스터링.** §3.9에 폴백 계약만 확정해 두고, T0 스파이크가 실패할 때만 전환한다.
- 미니맵(`muklogMiniMapHtml`, 상세 화면) 클러스터링 — 핀 1개짜리 지도라 대상 아님.
- 클러스터 hover/호버 프리뷰, 클러스터 애니메이션, 스파이더파이(spiderfy).
- `nearby` 조회 로직·누적 cap(`NEARBY_ACCUM_CAP=100`)·카테고리 필터 로직 변경 — **전부 불변**.
- DB 마이그레이션 · RLS · Edge Function · RPC 변경 **0건**.

---

## 3. 데이터 · API 계약

### 3.0 변경 요약 (한눈에)
| 대상 | 변경 |
|---|---|
| 테이블 / 컬럼 / RLS / 마이그레이션 | **0** |
| Edge Function / RPC | **0** |
| `src/features/map/types/types.ts` (`MapMarker`·`MapInboundType`·`MapOutboundType`·`MapInboundMessage`) | **0 (불변)** |
| `parseMapMessage` · `mapMessages` · `pinsToMapMarkers` · `wishToMapMarkers` · `nearbyToMapMarkers` · `mergeMapMarkers` | **0 (불변)** |
| `MapTabScreen.tsx` | **0 (불변)** |
| `MapWebView` · `MapPrewarm` | **0 (불변 — 단 mapHtml을 공유하므로 SDK URL 변경이 자동 반영, §3.5)** |
| `src/features/map/mapHtml/mapHtml.ts` | **변경 (이 스프린트의 유일한 프로덕션 변경 파일)** |
| `src/features/map/mapHtml/mapHtml.spec.ts` | 증분 |
| `docs/design/architecture.md` | 백로그 행 1건 추가 |

> **Path A(채택)의 핵심 성질: RN 측 프로덕션 코드 변경이 0이다.** 브리지 계약이 그대로이기 때문이며, 이것이 §3.1에서 WebView 내 처리를 고른 첫째 이유다.

---

### 3.1 D1 — 클러스터링 수단: **WebView 내 Kakao `MarkerClusterer`** (채택, T0 스파이크가 게이트)

**정찰로 확인한 코드 사실**
- 현재 핀은 전부 `kakao.maps.CustomOverlay`다 — `mapHtml.ts:118-124`. `kakao.maps.Marker`가 **아니다**.
- 그 CustomOverlay의 `content`는 우리가 만든 DOM(`div.mk-pin`)이고, 여기에 다음이 전부 매달려 있다:
  - 이모지 본문 `el.textContent = m.emoji` (`mapHtml.ts:108`)
  - kind별 색 클래스 `mk-pin--nearby` / `mk-pin--wish` / base (`mapHtml.ts:105-106`)
  - 선택 활성 클래스 `.mk-pin--active` 토글 = **`SET_SELECTED` 계약의 구현 자체** (`mapHtml.ts:186-196`)
  - 핀 탭 DOM 리스너 → `MARKER_TAP` + `stopPropagation`(MAP_TAP 경합 차단) (`mapHtml.ts:112-117`)
  - `el.dataset.pinId`, `mkPins[id] = { el, overlay, kind }` 추적 (`mapHtml.ts:107·126`)
  - 오버레이 stacking `overlay.setZIndex(pinZIndex(...))` (`mapHtml.ts:122·194`)
- 즉 **마커를 `kakao.maps.Marker`로 갈아끼우면 위 6가지가 전부 깨진다**(이모지·3-way 색·선택 강조·탭 계약). 마커 구현을 바꾸지 않는 것이 이 스프린트의 제1 제약이다.

**문서 사실 / 미확정 지점**
- Kakao `MarkerClusterer`의 `markers` 옵션과 `addMarkers()` 파라미터는 **`kakao.maps.Marker` 배열로 문서화**되어 있다. `CustomOverlay` 지원은 **문서상 보장되지 않는다.**
- 다만 클러스터러가 멤버에게 쓰는 것은 실질적으로 `getPosition()` / `setMap()` 뿐이고, `CustomOverlay`는 둘 다 갖는다 → duck-typing으로 동작할 **가능성은 높으나 미보장**이다.
- ⚠️ **이 계획은 "호환된다"고 단정하지 않는다.** 호환성 판정은 **T0 스파이크(실기기)** 로 넘기고, 실패 시 §3.9 Path B 계약으로 같은 스프린트 안에서 전환한다. (SDK 실물 검증은 불가 — 클러스터러 소스는 유효 `appkey` 없이는 받을 수 없고, `.env`는 읽기 금지 대상이다. 추측으로 메우지 않고 스파이크로 판정한다.)

**대안(RN 측 사전 클러스터링)과의 비교 — 왜 WebView 우선인가**

| 항목 | Path A: WebView `MarkerClusterer` | Path B: RN 사전 클러스터링 |
|---|---|---|
| 브리지 계약 변경 | **0** | `BOUNDS_CHANGED`에 `level` 추가 + `SET_MARKERS`에 `clusters` 추가 |
| RN 코드 변경 | **0** | 파서·타입·유틸 신설 + `MapTabScreen` 배선 |
| 줌 변경 시 재계산 | Kakao가 내부에서 처리 | 줌마다 `SET_MARKERS` 재주입 → **전 오버레이 재생성(깜빡임·churn)** |
| 클러스터 탭 줌인 | 기본 제공 | 직접 구현 |
| 단위 테스트 가능성 | 낮음(문자열 단언 + 스모크) | **높음**(순수 유틸) |
| 리스크 | CustomOverlay 호환 미보장 | 없음(전량 우리 코드) |

→ **Path A 채택.** 회귀 표면적(0 RN 변경)과 사용자 체감(깜빡임 없음)이 결정적이다. Path B의 유일한 우위인 테스트 용이성은, 이 기능이 어차피 **WebView 런타임 동작**이라 단위 테스트로 검증되지 않는다는 점에서 실익이 작다(§5-1 TDD 경계).

---

### 3.2 D2 — 클러스터 대상 마커: **saved · wish · nearby 3종 전부, 단일 클러스터러**

현재 마커는 3종이다(`MapPinKind`, `types.ts:44-49`): `saved`(내 맛집, #3366FF) / `wish`(위시, #FFB23E) / `nearby`(주변 음식점, #B6ABA0). `mergeMapMarkers`가 우선순위 dedup 후 하나의 배열로 합쳐 `SET_MARKERS`로 보낸다.

**결정: 3종 전부를 하나의 클러스터러에 넣는다.**

- **nearby 제외안 → 기각.** 겹침이 가장 심한 게 바로 nearby다: 세션 누적 cap이 100개(`useNearbyPlaces.ts:40 NEARBY_ACCUM_CAP = 100`)이고, 밀집 상권에서는 `nearby-search`가 반경 수십 m 안에 15건을 한 번에 돌려준다. nearby를 빼면 사용자가 제기한 "인접한 가게 아이콘이 겹친다"의 **주 원인이 그대로 남는다.**
- **kind별 클러스터러 3개(색 보존) → 기각.** 같은 지점에 파랑·앰버·회색 버블 **3개가 겹쳐 뜬다** = 겹침 문제를 다른 모양으로 재생산한다. 클러스터링의 목적을 스스로 무너뜨리는 안이다.
- **단일 클러스터러의 3-way 색 손실은 수용 가능하다.** 색 구분은 **개별 핀 레벨의 계약**이고(범례도 개별 핀을 설명한다), 클러스터 버블은 탭 한 번이면 사라지는 과도 상태다. 줌인 후에는 파랑/앰버/회색 핀과 범례가 그대로 살아난다.
- 부수 효과로 `mergeMapMarkers`의 좌표근접 dedup(≈11m)과 클러스터링은 **다른 레이어**로 공존한다: dedup은 "같은 가게의 중복 핀 제거", 클러스터링은 "다른 가게들의 시각적 묶음". 서로 간섭하지 않는다.

---

### 3.3 D3 — 클러스터 탭 동작: **카카오 기본 줌인** (신규 UI 창작 없음)

- 킷 `templates/muklog` 전체(`ds-base.js`·`mk-*.jsx`·`SPEC.md`·`README.md`·`HANDOFF-*.md`)에 `cluster` 문자열 **0건**. 지도 화면 `mk-home.jsx:326-395`에도 클러스터 개념이 없다(개별 `Pin`만 존재).
- 킷이 디자인 단일 출처이고 **없는 패턴은 만들지 않는 것이 기본**이므로, 클러스터 탭 → 목록 시트 같은 신규 UI는 도입하지 않는다.
- **`disableClickZoom`을 설정하지 않는다(기본 false)** → 클러스터 탭 시 Kakao가 내부에서 확대·이동을 수행한다.
- **결과: 클러스터 탭용 신규 inbound 메시지 0.** `MARKER_TAP` 계약은 완전히 불변이고, `MapInboundType`에 추가되는 값도 없다(§3.6 C1).

---

### 3.4 D4 — 클러스터 버블 비주얼 계약 (실값 고정 — 개발자 창작 여지 0)

Kakao `MarkerClusterer`의 `styles`는 **클러스터 DOM에 인라인 CSS로 적용되는 JS 객체 배열**이다(`<style>` 클래스가 아님). 따라서 아래 실값을 `styles` 객체에 직접 넣는다. `mapHtml`은 WebView 격리 HTML이라 킷 hex를 직박는 기존 선례(`mapHtml.ts:9-10`, `.mk-pin` 색)를 그대로 따른다.

`calculator: [10, 100]` + `styles: [S0, S1, S2]` (경계 = 미만/이상)

| 스타일 | 적용 개수 | width·height | lineHeight | fontSize |
|---|---|---|---|---|
| `S0` | 2 ~ 9 | `40px` | `40px` | `13px` |
| `S1` | 10 ~ 99 | `48px` | `48px` | `14px` |
| `S2` | 100 이상 | `56px` | `56px` | `15px` |

세 스타일 **공통 실값**:
```
background: '#3366FF'          // 킷 --mk-accent (브랜드 파랑)
color: '#FFFFFF'
border: '2px solid #FFFFFF'    // 지도 배경(#EFEAE3 계열) 대비 분리
borderRadius: '999px'          // 원형
textAlign: 'center'            // Kakao 공식 샘플 방식(내용이 텍스트 노드라 flex 대신 line-height 센터링)
fontWeight: '700'
boxShadow: '0 3px 5px rgba(0,0,0,0.18)'   // 킷 Pin 비활성 drop-shadow 동값(mk-home.jsx:404)
```
- 버블 텍스트 = **클러스터에 묶인 마커 개수 숫자**(Kakao 기본, `texts` 미지정).
- ⚠️ `zIndex`는 스타일 객체에 넣지 않는다 — `mapHtml.ts:69-71`에 기록된 대로 오버레이마다 컨테이너가 달라 element z-index는 오버레이 간 stacking에 효과가 없다. 클러스터↔비클러스터 핀 stacking은 **스모크 관찰 항목(S8)** 으로 두고, 문제가 보이면 후속으로 다룬다(없는 API를 지어내지 않는다).

**클러스터러 옵션 실값 계약**
```
averageCenter: true      // 멤버 중심(centroid)에 버블 배치 — 첫 마커 위치보다 정확
minClusterSize: 2        // 2개부터 묶음
gridSize: 60             // px, Kakao 기본
minLevel: 2              // 레벨 2 이상(=축소 방향)에서만 클러스터
```
- `minLevel: 2` 근거: Kakao 레벨은 **1이 최대 확대**(약 20m 스케일)다. 핀 지름이 34px(`mapHtml.ts:31`)이므로 레벨 1에서는 인접 가게 핀이 실제로 겹치지 않는다 → 레벨 1에서는 클러스터하지 않고 개별 핀을 보여준다(사용자가 "끝까지 확대하면 다 보인다"는 예측 가능한 모델을 갖게 된다).
- 위 5개 상수는 **`mapHtml.ts` 안 한 곳의 상수 블록**에 모아 둔다(스모크 튜닝 루프가 한 파일 한 지점에서 끝나도록).

**ui-publisher 필요 여부 판정: 불필요.**
근거 — ① 킷에 대응 시안이 없어 번역할 원본이 없다, ② 신규 RN 화면·프리미티브·`src/theme` 토큰 변경이 0이다(변경 파일은 `mapHtml.ts` 하나), ③ 사용하는 값이 전부 **이미 확정된 브랜드 토큰의 재사용**(#3366FF·#FFFFFF·radius 999·킷 Pin 그림자 동값)이고 이 문서가 실값을 계약으로 못 박았다, ④ WebView 격리 HTML의 hex 직박음은 `.mk-pin`에서 이미 확립된 선례다. → **qa-visual은 "클러스터 버블 실값이 위 표와 일치하는가" 1건만 확인**하면 되고, 별도 ui-spec 산출물은 만들지 않는다.

---

### 3.5 SDK 로드 계약 변경 (유일한 외부 계약 변경)

```
- sdk.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KEY}&autoload=false'
+ sdk.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KEY}&autoload=false&libraries=clusterer'
```
- `kakao.maps.load(cb)` 콜백 시점에 `kakao.maps.MarkerClusterer`가 준비된다 → 클러스터러 생성은 `__muklogInit`(READY 이후) 안에서 하므로 타이밍 안전.
- **`MapPrewarm`이 같은 `mapHtml()`을 사용한다**(`MapPrewarm.tsx` — `mapHtml({ jsKey: env.KAKAO_JS_KEY })`). 따라서 프리워밍이 클러스터러 스크립트의 HTTP 캐시까지 자동으로 데운다. 별도 프리워밍 작업 불필요 = 콜드 로드 회귀 방어가 공짜로 따라온다(§8).
- ⚠️ `services` 라이브러리는 여전히 불필요(Local 호출은 Edge Function 경유) — `clusterer`만 추가한다.

---

### 3.6 WebView 내부 동작 계약 (`mapHtml.ts`)

**C1. 브리지 메시지 계약 — 전부 불변**

| 방향 | 메시지 | 변경 |
|---|---|---|
| WebView→RN | `READY` · `MARKER_TAP{id,kind}` · `ERROR{reason}` · `BOUNDS_CHANGED{sw,ne}` · `MAP_TAP` | **불변** |
| RN→WebView | `INIT{center,markers,me}` · `SET_MARKERS{markers}` · `SET_SELECTED{selectedId}` · `RECENTER{me}` | **불변** |

**C2. 클러스터러 수명주기 (가장 중요한 구현 계약)**

현재 `renderMarkers`는 `clearMarkers()`(각 오버레이 `setMap(null)` + `mkOverlays=[]` + `mkPins={}`) → 재생성 순서다. 클러스터러가 오버레이의 표시 소유권을 가져가므로 **`clearMarkers`에 `clusterer.clear()`가 반드시 동반**되어야 한다. 빠지면 고스트 핀이 지도에 영구히 남는다.

```
clearMarkers():
  1) mkClusterer가 있으면 mkClusterer.clear()   // 클러스터러가 붙잡은 오버레이 해제
  2) 기존대로 각 overlay.setMap(null)            // 클러스터러 밖에 있던 것까지 확실히 제거
  3) mkOverlays = [] ; mkPins = {}               // 기존 동작 불변(mkSelectedId는 유지)

renderMarkers(markers):
  1) clearMarkers()
  2) 기존대로 오버레이 생성 → mkOverlays / mkPins 채움
     ⚠️ 이때 overlay.setMap(mkMap)은 클러스터러 사용 시 호출하지 않는다(클러스터러가 표시를 관리)
  3) mkClusterer가 유효하면 mkClusterer.addMarkers(mkOverlays)
     아니면 기존대로 각 overlay.setMap(mkMap)   // 폴백 경로(E4)
```

**C3. 클러스터러 생성 시점** — `__muklogInit` 안, `mkMap` 생성 직후 · `renderMarkers(payload.markers)` **호출 전**. 재-INIT(`handleRetry`)에도 안전하도록 **이미 있으면 재생성하지 않고 재사용**한다(중복 클러스터러 = 유령 버블).

**C4. `me` 마커는 클러스터 대상이 아니다.** `mkMeOverlay`는 `mkOverlays`에 들어가지 않고(현재도 그렇다 — `mapHtml.ts:143-147`은 `mkOverlays.push`를 하지 않는다) `addMarkers` 인자에도 포함되지 않는다. 현재 위치 파란 점이 "1"짜리 클러스터로 바뀌면 안 된다.

**C5. `SET_SELECTED`는 그대로 동작한다.** `mkPins[id].el`은 클러스터에 흡수돼 DOM에서 분리돼도 참조가 살아 있어 `classList` 토글이 예외 없이 수행된다. 줌인해 다시 펼쳐지면 활성 강조가 그대로 보인다(`mkSelectedId`가 유지되고 `renderMarkers`가 재적용 — `mapHtml.ts:109-111`).

---

### 3.7 상수 위치
`mapHtml.ts` HTML 템플릿 안 스크립트 상단에 클러스터 설정 블록 1곳(`MK_CLUSTER_OPTIONS` · `MK_CLUSTER_STYLES`). 스모크 튜닝 시 이 블록만 만진다.

### 3.8 프론트 훅 시그니처
**신설·변경 없음.** `useMuklogPins` · `useWishPins` · `useNearbyPlaces` · `useLocationPermission` 전부 불변.

### 3.9 폴백 계약 — Path B (T0 스파이크 실패 시에만 발동)

T0에서 `CustomOverlay`가 `MarkerClusterer`에 들어가지 않는 것으로 판정되면, **마커 구현(CustomOverlay)은 지키고 클러스터링만 RN으로 옮긴다.** 아래는 그때 곧바로 착수할 수 있도록 미리 확정한 계약이다(재기획 불필요).

- **B1. `BOUNDS_CHANGED`에 `level: number` 추가**(선택 필드). `parseMapMessage`는 `level`이 없거나 숫자가 아니면 `null`로 흡수(기존 메시지와 하위 호환) → **순수 파서 단위 테스트 대상**.
- **B2. 순수 유틸 `clusterMarkers`** 신설:
  `clusterMarkers({ markers: MapMarker[], level: number }) => { markers: MapMarker[]; clusters: ClusterMarker[] }`
  - `ClusterMarker = { id: string; lat: number; lng: number; count: number }` — `id`는 그리드 셀 키(`${row}:${col}`)로 결정적 생성.
  - 도(degree) 그리드: 레벨→epsilon 상수 테이블(`MK_CLUSTER_EPSILON_BY_LEVEL`). 레벨 1은 epsilon 0(클러스터 없음, D4 `minLevel:2`와 동일 정책).
  - 클러스터 위치는 멤버 좌표 평균(`averageCenter: true` 동등).
  - **순수 함수 → 정상·경계·실패 단위 테스트 전수 작성**(이 폴백은 Path A보다 테스트 커버리지가 높다).
- **B3. `SET_MARKERS` 페이로드에 `clusters` 필드 추가**(`{ type, markers, clusters }`). `MapMarker.kind`에 `'cluster'`를 **넣지 않는다** — 3-way 판별자를 오염시키면 `mergeMapMarkers`·카드 3분기·파서가 전부 영향을 받는다.
- **B4. HTML은 `clusters`를 별도 CustomOverlay(`.mk-cluster`, §3.4 실값 동일)로 렌더**하고, 탭 시 **로컬에서** `mkMap.setLevel(현재레벨 - 2, { anchor: 클러스터 위치 })` → **신규 inbound 메시지 여전히 0.**
- **B5. 비용:** 줌 변경마다 `SET_MARKERS` 재주입 1회(브리지 로컬 통신, 외부 호출 0). 깜빡임 리스크는 수용하고 스모크에서 확인한다.

---

## 4. 화면 · UX

- **변경 화면: 지도 탭(`MapTabScreen`) 1개.** 신규 화면·라우트·컴포넌트 **0개**.
- **비주얼 변경 지점: 지도 위 핀 레이어 1곳** — 인접 핀 → 클러스터 버블(§3.4).
- **불변 요소:** 헤더·`CategoryFilterBar`·`MapLegend`(범례 문구 그대로 — 여전히 개별 핀을 설명한다)·`MapStatusOverlay`·`MapLocateButton` FAB·`SelectedSpotCard`/`NearbySpotCard`/`WishSpotCard`·`LogPickerSheet`.

**상태별 동작**
| 상태 | 동작 |
|---|---|
| 로딩 | 기존과 동일(`MapStatusOverlay` loading). 클러스터 관련 추가 UI 없음 |
| 빈 상태(마커 0) | 클러스터 0개, 지도만 표시. 기존과 동일(빈 상태 안내는 제거된 상태 — `MapTabScreen.tsx:319`) |
| 마커 1개 | `minClusterSize: 2`라 클러스터 미생성, 개별 핀 표시 |
| 에러(핀 조회 실패) | 기존 배너 그대로. 클러스터러는 마커 0개로 무해 |
| 클러스터러 미로드 | **개별 핀으로 정상 렌더**(강등) — 사용자에게는 클러스터링 이전과 동일한 화면. 에러 배너 띄우지 않음(§6 E4) |

**원티드 토큰 사용 지점**: 클러스터 버블 배경 `#3366FF`(`--mk-accent`), 텍스트 `#FFFFFF`, radius 999, 그림자 `0 3px 5px rgba(0,0,0,.18)`(킷 Pin 동값). 전부 §3.4 계약 실값.

---

## 5. 작업 목록

> 순서 강제: **T0가 게이트다.** T0 판정 전에는 T1~T5를 확정 커밋하지 않는다.

- [ ] **T0. 클러스터러↔CustomOverlay 호환성 스파이크(실기기)** — `libraries=clusterer` 추가 + `MarkerClusterer`에 기존 CustomOverlay 배열을 `addMarkers`로 넣고 실기기(dev build)에서 관찰.
  - **인수조건:** 다음 3개가 모두 관찰되면 **Path A 확정** — ① 밀집 지역에서 클러스터 버블이 그려진다, ② 클러스터에 묶인 개별 핀이 지도에서 사라진다, ③ 클러스터 탭 시 확대되며 하위 핀이 펼쳐진다. 하나라도 실패하거나 콘솔 예외가 나면 **Path B(§3.9)로 전환하고 그 사실·로그를 `dev-notes.md`에 근거로 남긴다.**
  - **테스트:** 디바이스 스모크(단위 테스트 불가 영역). Metro/`adb logcat` 콘솔 확인 필수 — 네이티브/WebView 문제는 preview 빌드에서 조용히 숨는다.
- [ ] **T1. SDK URL에 `libraries=clusterer` 추가** — 인수조건: `mapHtml({jsKey})` 결과 문자열이 `libraries=clusterer`를 포함하고, 기존 `appkey=`·`autoload=false`도 그대로 유지한다. — 테스트: `mapHtml.spec.ts` 문자열 단언 3건.
- [ ] **T2. 클러스터러 생성 + 수명주기 배선(§3.6 C2·C3)** — 인수조건: `__muklogInit`에서 `mkMap` 생성 후 `renderMarkers` 호출 전에 클러스터러가 1회 생성되고(재-INIT 시 재사용, 재생성 안 함), `clearMarkers()`가 `clusterer.clear()`를 먼저 호출하며, `renderMarkers`가 `addMarkers(mkOverlays)`로 마커를 넘긴다. — 테스트: spec 문자열 단언(`MarkerClusterer` 생성·`.clear()`·`.addMarkers(`) + 스모크 S4(카테고리 전환 후 고스트 핀 0).
- [ ] **T3. 클러스터 옵션·스타일 실값 적용(§3.4)** — 인수조건: 옵션 5개(`averageCenter:true`·`minClusterSize:2`·`gridSize:60`·`minLevel:2`·`calculator:[10,100]`)와 스타일 3단계 실값이 §3.4 표와 **정확히** 일치하고, 한 상수 블록에 모여 있다. — 테스트: spec 단언(`#3366FF`·`#FFFFFF`·`minLevel`·`averageCenter`·`gridSize`) + 스모크 S1/S3.
- [ ] **T4. 클러스터러 부재 시 강등 경로(§3.6 C2 폴백)** — 인수조건: `kakao.maps.MarkerClusterer`가 `undefined`이거나 생성이 throw하면, 예외를 삼키고 **기존 경로(각 `overlay.setMap(mkMap)`)로 핀을 렌더**한다. 지도는 정상 동작하고 `ERROR` 메시지는 **발신하지 않는다**(지도 자체는 멀쩡하므로 에러 배너는 오해를 준다). — 테스트: spec 단언(`MarkerClusterer` 존재 검사 분기·`setMap(mkMap)` 폴백 잔존) + 스모크 S7.
- [ ] **T5. `me` 마커 클러스터 제외 확인(§3.6 C4)** — 인수조건: `mkMeOverlay`가 `mkOverlays`에 push되지 않고 `addMarkers` 인자에도 포함되지 않는다(현재 코드 성질 유지). — 테스트: spec 단언(`addMarkers` 인자가 `mkOverlays`임) + 스모크 S8.
- [ ] **T6. `mapHtml.spec.ts` 증분 작성(§5-1)** — 인수조건: 신규 단언이 T1~T5를 커버하고, **기존 단언(`MARKER_TAP`·`kind: m.kind`·`__muklogSetSelected`·`#B6ABA0`·`#FFB23E`·`BOUNDS_CHANGED`)이 하나도 삭제·완화되지 않는다.** — 테스트: `npm test -- mapHtml`.
- [ ] **T7. 전체 회귀** — 인수조건: `npm test` **전량 green**, `npm run typecheck` 통과. Path A에서는 RN 변경이 0이므로 실패가 나오면 그 자체가 계약 위반 신호다. — 테스트: `npm test` · `npm run typecheck`.
- [ ] **T8. 디바이스 스모크 체크리스트 실행(§5-2)** — 인수조건: S1~S9 전 항목의 관찰 결과를 `dev-notes.md`에 기록(통과/실패/이월 명시). — 테스트: 실기기(dev build).
- [ ] **T9. `architecture.md` 백로그 행 추가** — 인수조건: `map-clustering` 행이 추가되고, `map-tab-nearby` 행의 "클러스터링 OUT(후속)"이 이 스프린트로 해소됐음이 드러난다(§3.1 D1 결정·대상 3종·탭 줌인·비용 0 요약 포함). — 테스트: 문서 리뷰(qa-logic).

---

## 5-1. 테스트 케이스 (TDD)

### TDD 경계 선언 (`docs/testing-strategy.md` 준수)

| 영역 | 경계 | 이유 |
|---|---|---|
| `mapHtml()` 반환 **문자열** | **단위 테스트 ✅** (jest-expo) | 순수 함수. 단, 검증할 수 있는 건 "템플릿에 그 코드가 들어 있다"까지다 |
| WebView 안에서 **실행되는 클러스터러 동작** | **단위 테스트 밖 ❌ → 디바이스 스모크** | Kakao JS SDK는 외부 SDK이고 WebView 런타임은 jest 환경에 존재하지 않는다 |
| RN 유틸·파서·훅·화면 | **기존 테스트로 회귀 검증만** | Path A는 RN 변경 0 |
| Path B 채택 시 `clusterMarkers`·`parseMapMessage(level)` | **단위 테스트 ✅ 전수** | 순수 함수/파서 |

> ⚠️ **문자열 단언의 한계를 인정한다.** `expect(html).toContain('MarkerClusterer')`는 클러스터링이 *작동함*을 증명하지 않는다. 이 기능의 진짜 검증자는 **§5-2 디바이스 스모크**이고, 단위 테스트는 "계약 문자열이 실수로 사라지는 회귀"를 막는 안전망일 뿐이다. 메모리 [qa-layout-blind-spot]·[native-module-debug-needs-devbuild]의 교훈대로, 렌더 픽셀을 보지 않으면 이 스프린트는 검증되지 않은 것으로 간주한다.

### 단위 테스트 — `src/features/map/mapHtml/mapHtml.spec.ts` 증분

**정상 경로**
1. `libraries=clusterer`를 SDK URL에 포함한다.
2. `appkey=` 주입과 `autoload=false`가 그대로 유지된다(T1 회귀).
3. `new kakao.maps.MarkerClusterer(` 생성부를 포함한다.
4. 클러스터러 옵션 실값을 포함한다: `averageCenter`, `minClusterSize`, `gridSize`, `minLevel`, `calculator`.
5. 클러스터 스타일 실값을 포함한다: `#3366FF`, `#FFFFFF`, `borderRadius`, `0 3px 5px rgba(0,0,0,0.18)`.
6. `addMarkers(mkOverlays)` 호출부를 포함한다(인자가 `mkOverlays`임 — `me` 오버레이 제외 근거, T5).
7. `clearMarkers` 안에 `.clear()` 호출부를 포함한다(고스트 방지, T2).

**경계**
8. 클러스터 스타일이 **3단계**(`calculator: [10, 100]` + styles 3개)로 정의된다.
9. `minLevel`이 `2`다(레벨 1 = 최대 확대에서는 클러스터하지 않음, §3.4 근거).
10. `minClusterSize`가 `2`다(1개는 클러스터 안 됨).

**실패 경로**
11. `MarkerClusterer` 존재 여부 검사 분기를 포함한다(미정의 시 강등, T4).
12. 폴백 경로의 `setMap(mkMap)`가 템플릿에 남아 있다(클러스터러 없이도 핀이 그려진다).
13. 클러스터러 생성 실패가 `ERROR` 발신으로 이어지지 않는다 — `MarkerClusterer` 관련 코드가 기존 `post({ type: 'ERROR'` 경로에 새 호출을 추가하지 않는다.

**회귀(삭제 금지 단언 — 기존 spec 전량 유지)**
14. `MARKER_TAP` + `kind: m.kind` 동봉 불변.
15. `__muklogInit` / `__muklogSetMarkers` / `__muklogSetSelected` / `__muklogRecenter` 4개 핸들러 정의 불변.
16. 3-way 핀 색 `#3366FF` · `#B6ABA0` · `#FFB23E` 불변.
17. `BOUNDS_CHANGED` · `MAP_TAP` · `CustomOverlay` · `emoji` 불변.

### 뮤테이션 검증 규범 (qa-logic·developer 공통)
단언이 **죽은 문자열**을 검사하는 게 아닌지 확인할 때는 반드시 **격리 사본**으로 한다:
- 사본을 **`src/` 밖**(세션 스크래치패드)에 만든다.
- 파일명이 jest testMatch(`*.spec.*` / `*.test.*` / `__tests__/`)에 **매치되지 않게** 한다.
- 확인 즉시 **삭제**한다. 원본 `src/` 파일을 뮤테이트하지 않는다.

---

## 5-2. 디바이스 스모크 체크리스트 (이 기능의 실질 검증자)

dev build + Metro 콘솔로 실행한다(preview/production 빌드는 WebView 예외를 조용히 삼킨다).

| # | 시나리오 | 기대 |
|---|---|---|
| S1 | 밀집 상권(예: 강남역)으로 이동해 nearby 핀이 15+ 쌓인 상태에서 관찰 | 겹쳐 있던 아이콘이 카운트 버블로 묶여 **개별 핀 겹침이 눈에 띄게 해소** |
| S2 | 클러스터 버블 탭 | 지도가 확대되며 하위 핀이 펼쳐진다(신규 시트/목록 UI 없음) |
| S3 | 최대 확대(레벨 1)까지 줌인 | 클러스터 미생성, 개별 핀(이모지·3-way 색) 표시 |
| S4 | 카테고리 필터 변경 → 원복 | 재클러스터되고 **고스트 핀·유령 버블 0** |
| S5 | 개별 핀 탭(saved / nearby / wish 각 1회) | 기존 카드 3종이 그대로 뜬다(`MARKER_TAP` 회귀 0) |
| S6 | 핀 선택 → 줌아웃해 클러스터에 흡수 → 다시 줌인 | 크래시 없음. 줌인 복귀 시 **활성 강조(`.mk-pin--active`) 유지**. (카드가 도킹된 채 유지되는 것은 §6 E5의 **의도된 동작**) |
| S7 | 기내모드 등으로 clusterer 스크립트만 실패시킨 상태로 지도 진입 | 지도·핀 정상 렌더(클러스터 없음), **에러 배너 미표시** |
| S8 | 현재위치 FAB 탭 후 파란 점 관찰 | 파란 점이 클러스터에 흡수되지 않고 그대로. 클러스터↔개별 핀 stacking 이상 여부도 함께 관찰(§3.4 주석) |
| S9 | 앱 콜드스타트 → 지도 탭 진입 시간 체감 | 클러스터러 추가 전과 **체감 회귀 없음**(MapPrewarm이 스크립트까지 워밍 — §3.5) |

---

## 6. 엣지케이스

| # | 케이스 | 처리 |
|---|---|---|
| **E1** | **마커 0개**(핀 없음 / 카테고리 필터로 전부 아웃) | `addMarkers([])` — 클러스터 0, 예외 없음. 지도만 표시 |
| **E2** | **마커 1개** | `minClusterSize: 2` → 클러스터 미생성, 개별 핀 |
| **E3** | **같은 좌표에 여러 핀**(`mergeMapMarkers` epsilon ≈11m를 아슬하게 벗어난 saved+wish) | 클러스터로 묶임. dedup(같은 가게 제거)과 클러스터링(다른 가게 묶음)은 별개 레이어라 충돌 없음 |
| **E4** | **clusterer 라이브러리 로드 실패 / `MarkerClusterer` 미정의** | 기존 렌더 경로로 **강등**. 지도·핀 정상, `ERROR` **미발신**(지도가 멀쩡한데 에러 배너를 띄우면 오해를 준다). T4·S7 |
| **E5** | **선택된 핀이 줌아웃으로 클러스터에 흡수됨** | **의도된 동작: 카드는 열린 채 유지한다.** 선택은 데이터상 여전히 유효하고(마커 집합에서 빠진 게 아니라 시각적으로 묶였을 뿐), 줌인하면 활성 핀이 그대로 다시 나타난다. `clearSelectionWhenPinGone`(`MapTabScreen.tsx:235-243`)은 **마커 집합** 기준이라 발화하지 않는다 — 이는 버그가 아니라 계약이다. S6에서 관찰만 한다 |
| **E6** | **`SET_MARKERS` 폭풍**(카테고리 연타·nearby 누적 갱신) | 매번 `clear()` → 재생성. 마커 규모 ≤ 수백이라 부담 없음. 단 `clear()` 누락 시 고스트가 누적되므로 T2가 핵심 |
| **E7** | **`SET_MARKERS`가 INIT보다 먼저 도착** | 기존 가드 유지(`if (!mkMap ...) return`, `mapHtml.ts:100`). 클러스터러도 `mkMap` 이후 생성되므로 null 접근 없음 |
| **E8** | **재-INIT**(`handleRetry` → `sendInit`) | 클러스터러 **재사용**(재생성 금지, C3). 재생성하면 이전 클러스터러가 붙잡은 버블이 유령으로 남는다 |
| **E9** | **커플 동시성** — 파트너가 먹로그/위시 추가 | 포커스 refresh(`useRefreshOnFocus`) → 마커 증가 → `SET_MARKERS` → 재클러스터. 표시 레이어라 동시성 충돌 개념 없음 |
| **E10** | **네트워크 실패**(nearby 조회 실패) | 기존 best-effort 유지. 마커가 줄어들 뿐 클러스터링은 정상 |
| **E11** | **권한 거부**(현재위치 없음) | 폴백 센터로 지도 표시 + 클러스터링 정상. `me` 마커 없음(C4와 무관) |
| **E12** | **클러스터 탭이 `MAP_TAP`으로 새는 경우** | 새더라도 결과는 "선택 해제 + 줌인"으로 사용자 기대와 어긋나지 않는다. 별도 방어 코드를 넣지 않는다(S2에서 관찰) |
| **E13** | **`nearby` 누적 cap 100 도달** | 클러스터가 `S2`(100+) 스타일로 커질 수 있음. 계약된 정상 동작 |
| **E14** | **미니맵(`muklogMiniMapHtml`)** | 별도 HTML이며 핀 1개 — 이 스프린트가 **건드리지 않는다**(회귀 확인 대상) |

---

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

qa-logic이 **양쪽을 같이 열어** 읽어야 하는 쌍:

1. `mapHtml.renderMarkers`(생산) ↔ `mapHtml.clearMarkers` + 클러스터러 수명주기(소비) — **`clear()` 누락 시 고스트 핀**. §3.6 C2 대조.
2. `mapHtml.mkPins` 추적(생산) ↔ `__muklogSetSelected`(소비) — 클러스터에 흡수돼 DOM detach된 `el`의 `classList` 토글이 안전한지. §3.6 C5.
3. `mapHtml` SDK URL(생산) ↔ `MapPrewarm`(소비, 같은 `mapHtml()` 공유) — 프리워머가 클러스터러까지 워밍하는지, 프리워머에서 `MarkerClusterer` 생성 부작용이 없는지(프리워머는 INIT을 보내지 않으므로 클러스터러도 생성되지 않아야 정상).
4. `MapTabScreen.markersKey` effect(생산, `MapTabScreen.tsx:212-219`) ↔ `SET_MARKERS` ↔ `clusterer.clear()+addMarkers`(소비) — 필터/누적 변화가 재클러스터로 정확히 이어지는지.
5. `types.ts MapMarker`·`MapInboundType`·`MapOutboundType`(생산) ↔ `mapHtml` 소비 — **전부 불변인지**(하나라도 바뀌면 Path A 전제가 깨진 것).
6. `mapHtml.spec.ts` 단언(생산) ↔ 실제 템플릿(소비) — 단언이 **죽은 문자열**을 검사하고 있지 않은지(§5-1 뮤테이션 규범, 격리 사본으로).
7. `pinZIndex`(생산, `mapHtml.ts:72-77`) ↔ 클러스터 버블 stacking(소비) — 클러스터가 개별 핀 밑으로 깔리지 않는지(S8 관찰).
8. `mergeMapMarkers` dedup(생산) ↔ 클러스터 카운트(소비) — dedup으로 제외된 핀이 카운트에 포함되지 않는지(카운트는 `SET_MARKERS`로 넘어간 최종 집합 기준이어야 함).
9. `muklogMiniMapHtml`(무관 모듈) — 이번 변경이 새지 않았는지 회귀 확인.

**qa-visual 담당(1건):** 클러스터 버블 실값이 §3.4 표(#3366FF · #FFFFFF · border 2px white · radius 999 · 40/48/56px · shadow `0 3px 5px rgba(0,0,0,.18)`)와 일치하는가. 킷 시안이 없으므로 **킷 대조가 아니라 이 계약표 대조**다.

---

## 8. 비용 가드레일 체크

| 항목 | 판정 |
|---|---|
| **Kakao Local API 호출 증가** | **0** — `useNearbyPlaces`·`nearby-search` Edge Function·디바운스/양자화 캐시/최소이동 임계 **전부 불변**. 클러스터링은 이미 받은 마커의 **표시 레이어**일 뿐 조회를 유발하지 않는다 |
| **Kakao Map SDK 추가 네트워크** | 클러스터러 라이브러리 스크립트 **1회 다운로드**(HTTP 캐시 대상). `MapPrewarm`이 같은 `mapHtml()`을 쓰므로 프리워밍에 자동 포함(§3.5) → 콜드 로드 회귀 방어. S9에서 확인 |
| **클러스터 계산 위치** | **100% WebView 로컬**. 외부 호출 0, 서버 왕복 0 |
| **연산 규모** | saved + wish + nearby(cap 100) = 현실적으로 수십~수백 개. 클러스터러 그리드는 마커 수에 선형 → 성능 문제 없음. 지도 성능 병목은 측정상 **WebView 부팅(88%)** 이지 마커 처리가 아니다(메모리 [map-perf-bottleneck]) |
| **Supabase 호출 증가** | **0** — RPC·쿼리·Realtime·Storage 변경 없음 |
| **DB 마이그레이션 / Edge Function / RLS** | **0건** |
| **이미지·업로드** | 무관 |
| **AWS 리소스** | **미사용** |
| **폴링·타이머·리스너 추가** | **0** — 클러스터 재계산은 Kakao가 기존 zoom/idle 이벤트에 얹어 처리한다(우리가 새 리스너를 달지 않는다) |

---

## 9. 완료 기준 (Definition of Done)

1. T0 스파이크 판정이 `dev-notes.md`에 근거(콘솔 로그·관찰)와 함께 기록됐다 — Path A 또는 Path B 중 어느 쪽으로 갔는지 명시.
2. T1~T6 전 작업의 인수조건 충족.
3. `npm test` 전량 green + `npm run typecheck` 통과(T7).
4. 디바이스 스모크 S1~S9 결과 기록(T8) — **S1·S2·S3·S5·S7이 통과해야 기능 완료**로 본다(S6·S8·S9는 관찰·이월 허용).
5. `architecture.md` 백로그 갱신(T9).
6. **비주얼 임의 변경 0** — developer는 §3.4 실값만 쓰고 색·크기를 창작하지 않는다.
7. git 작업(커밋·푸시·브랜치)은 **사용자 전담** — 이 계획에 포함하지 않는다.
