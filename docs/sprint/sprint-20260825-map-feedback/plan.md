# Sprint: 지도 탭 피드백 3건 (map-feedback)

> UX 개선 스프린트 · 백로그 항목 **U55 · U4 · U5**(`docs/ux/ux-backlog.md`)
> 기준: `ux-principles` 스킬(위반 원칙 — U55: 4 / U4: 10·3 / U5: 3) · 킷 `templates/muklog`가 비주얼 단일 출처(원칙은 킷이 침묵하는 영역에만 적용)
> 선행 스프린트: `sprint-20260813-map-clustering`(클러스터러) · `sprint-20260820-map-pin-loading`(선로딩·영속 캐시·명시 재검색) — **두 모델의 계약을 깨지 않는다.**

---

## 1. 기능 한줄 정의

지도 탭에서 **클러스터를 탭하면 깜박임 없이 중심 기준으로 부드럽게 한 단계 확대**되고, **첫 주변 조회가 실패해도 "이 지역에서 검색"으로 복구할 수 있으며**, **지도 부팅 동안 흰 여백 대신 지도 톤 배경 + "지도를 불러오는 중이에요" 배너**를 본다.

---

## 2. 범위

### In-scope (이 3건만)

| 항목 | 한 줄 | 변경 파일(프로덕션) |
|------|------|--------------------|
| **U55** | 클러스터 탭 = `disableClickZoom:true` + `clusterclick` → 중심 anchor 애니메이션 줌인 | `mapHtml.ts` |
| **U4** | `researchAvailable`에 에러 복구 경로 추가(`status==='error'`면 노출) | `useNearbyPlaces.ts` |
| **U5** | ① `mapHtml` 배경을 킷 지도 톤 `#EFEAE3` ② 로딩 배너 조건에 `!mapReady` ③ RN 측 지도 컨테이너 배경 동일 톤(토큰 `mapSurface`) | `mapHtml.ts`, `MapTabScreen.tsx`, `tokens.ts`, `MapWebView.tsx` |

부수적으로 **테스트 인프라 확장**이 필요하다: `createMapSandbox`에 `getLevel`/`setLevel` 기록과 클러스터 이벤트 발화기를 추가한다(§3.4). 클러스터 탭은 분기·상태가 있는 동작이라 문자열 단언으로 잠글 수 없다(메모리 "문자열 단언은 쉽게 죽는다").

### Out-of-scope (일부러 안 하는 것)

- **U10 — 주변 조회 로딩·실패·0건 전면 피드백**(재검색 pill 로딩 상태·실패 배너·0건 토스트). 별도 백로그 항목이며 U4는 그중 "복구 경로가 아예 없다"만 고친다. **U4 이후에도 실패는 여전히 무음이고, 사용자가 보는 어포던스는 재검색 pill 하나다.**
  - 따라서 백로그 U4 개선안의 후반부("에러 배너 '다시 시도'도 같은 `research` 핸들러")는 **이번 스프린트에 넣지 않는다** — 에러 배너 자체가 U10 산출물이기 때문이다.
- 클러스터 탭 → 멤버 목록 시트(킷 시안 0건, `map-clustering` §OUT 유지).
- 클러스터 버블 스타일·개수 경계·`gridSize` 등 `map-clustering` 실값 계약 변경(줌 동작만 바꾼다).
- 팬·줌 자동 조회 부활(= `map-pin-loading`의 핵심 결정 되돌리기). **금지.**
- 로딩 배너 플래시 가드(`useDeferredFlag`) — §6 E5의 조건이 실기기에서 관측될 때만 후속.
- 위치 권한 배너 개선(U7), 핀 카드 진입(U11·U12), 현재위치 FAB 피드백(U13).

---

## 3. 계약

DB 마이그레이션 · RLS · RPC · Edge Function · 신규 npm 의존성 **전부 0**. 브리지 메시지(inbound/outbound) 신규 **0**. 순수 클라이언트 변경이다.

### 3.1 U55 — WebView 내부 클러스터 줌인 (`mapHtml.ts`)

**SDK API 실존 확인(문서 대조 완료 — 지어낸 API 0):**

| API | 확인 근거 |
|-----|----------|
| `MarkerClustererOptions.disableClickZoom: boolean` | Kakao 공식 샘플 `web/sample/addClustererClickEvent` — `disableClickZoom: true // 클러스터 마커를 클릭했을 때 지도가 확대되지 않도록 설정한다` |
| `clusterclick` 이벤트 | 공식 문서 MarkerClusterer 이벤트 목록(`clusterclick`·`clusterover`·`clusterout`·`clusterdblclick`·`clusterrightclick`·`clustered`) + 위 샘플의 `kakao.maps.event.addListener(clusterer, 'clusterclick', function(cluster) {...})` |
| `cluster.getCenter()` | 공식 문서 `Cluster` 클래스 메서드(`getCenter`·`getBounds`·`getSize`·`getMarkers`·`getClusterMarker`) + 샘플이 `map.setLevel(level, {anchor: cluster.getCenter()})`로 사용 |
| `map.setLevel(level, { anchor, animate })` | 공식 문서 `Map.setLevel(level, options)` — `animate Boolean\|Object`(**현재 레벨과의 차이가 2 이하인 경우에만 애니메이션 가능**), `animate.duration Number`(기본 300ms), `anchor LatLng` |

> ⚠️ `disableClickZoom`을 끄는 setter는 문서에 없다(`setGridSize`·`setMinLevel` 등만 존재). 즉 **생성자에서 한 번 정해지면 되돌릴 수 없다** → 리스너 등록 실패가 "클러스터는 보이는데 탭이 죽은" 상태를 만들 수 있다. §3.1-C가 이를 구조적으로 막는다.

**A. 상수(§`MK_CLUSTER_OPTIONS` 블록 한 곳에서만 튜닝 — `map-clustering` §3.7 규율 계승)**

```js
disableClickZoom: true,   // MK_CLUSTER_OPTIONS에 추가. 기본 클릭줌(무애니메이션 즉시 전환) 차단.
var MK_CLUSTER_ZOOM_STEP = 1;         // 탭당 확대 단계. animate 가능 상한이 2이므로 1~2만 허용.
var MK_CLUSTER_ZOOM_DURATION_MS = 300; // 원칙 4(150~300ms) 상단 + Kakao 기본값과 일치.
var MK_MAP_MIN_LEVEL = 1;             // ROADMAP 최소 레벨(문서: ROADMAP 1~14). 하한 클램프.
```

`MK_CLUSTER_ZOOM_STEP = 1`은 Kakao 공식 샘플(`map.getLevel() - 1`)과 동일한 보수적 선택이다. 사용자 리포트는 "너무 조금 확대된다"가 아니라 **"깜박인다"**이므로 이번 수정의 본체는 애니메이션이다. 한 번 탭으로 클러스터가 안 풀리는 체감이 실기기에서 문제면(§7 S3) 이 상수만 2로 올린다(diff 2까지는 여전히 애니메이션 가능).

**B. 핸들러 계약**

```js
// 클러스터 탭 → 클러스터 중심을 기준점으로 한 단계 부드럽게 확대(U55).
//   기본 클릭줌은 무애니메이션 즉시 전환이라 클러스터 해체 재렌더와 겹쳐 "깜박임"으로 보인다.
//   ⚠️ mkMap을 인자로 받거나 클로저에 가두지 않는다 — 재-INIT이 mkMap을 새 인스턴스로 교체하므로
//      반드시 모듈 변수를 매번 읽어야 옛 지도에 대고 setLevel 하는 조용한 실패를 피한다.
function mkClusterZoomIn(cluster) {
  if (!mkMap || !cluster || typeof cluster.getCenter !== 'function') return;
  var level = mkMap.getLevel();
  if (typeof level !== 'number') return;
  var next = level - MK_CLUSTER_ZOOM_STEP;
  if (next < MK_MAP_MIN_LEVEL) next = MK_MAP_MIN_LEVEL;
  if (next === level) return; // 더 확대할 수 없음 — 호출 자체를 하지 않는다.
  mkMap.setLevel(next, {
    anchor: cluster.getCenter(),
    animate: { duration: MK_CLUSTER_ZOOM_DURATION_MS },
  });
}
```

**C. 등록 위치·순서 계약 (가장 중요)**

`ensureClusterer()`의 **신규 생성 분기에서만** 등록한다. 재사용 분기(재-INIT)에서는 등록하지 않는다 — 등록하면 INIT 회수만큼 리스너가 쌓여 한 번의 탭이 여러 단계를 건너뛴다.

등록은 **`mkClusterer`에 대입하기 전에** 한다:

```js
var created = new kakao.maps.MarkerClusterer({ ...옵션, disableClickZoom: true });
kakao.maps.event.addListener(created, 'clusterclick', mkClusterZoomIn); // 대입 전에 등록
mkClusterer = created;
```

이유: `addListener`가 던지면 `mkClusterer`는 `null`로 남아 기존 강등 경로(개별 핀 `setMap`)를 그대로 탄다. `created`는 마커를 한 번도 못 받으므로 버블을 그리지 않는다 → **"클러스터는 보이는데 탭이 아무 일도 안 하는" 상태가 구조적으로 불가능**하다. 대입을 먼저 하면 그 상태가 실제로 만들어진다.

**D. 신규 브리지 메시지 0** — 확대는 WebView 내부에서 완결한다. `setLevel`이 유발하는 `idle`은 기존 `emitBounds` 리스너를 타 `BOUNDS_CHANGED`를 보내는데, `map-pin-loading` 모델에서 이 신호는 "조회하라"가 아니라 "현재 뷰포트는 여기다"이므로 **네트워크 0**이다(§8).

### 3.2 U4 — 재검색 버튼 노출 조건 (`useNearbyPlaces.ts`)

**현재(L413-417)**

```ts
const researchAvailable =
  status !== 'loading' &&
  lastQueried !== null &&
  currentBounds !== null &&
  exceedsResearchThreshold({ prev: lastQueried.bounds, next: currentBounds });
```

첫 조회가 실패하면 `commitQueried`가 호출되지 않아 `lastQueried`가 영원히 `null`이고, 팬·줌 자동 조회도 없으므로 **그 세션에서 주변 핀을 볼 방법이 사라진다**(원칙 10 위반: 빈/실패 상태가 다음 행동을 안내하지 못한다. 원칙 3 위반: 실패가 무음).

**변경 후 계약**

```ts
// 버튼 노출(§4.4 갱신): 조회 중 아님 · 뷰포트 수신함 · (에러 복구 경로 OR 드리프트 초과).
//   status==='error'는 "이 마운트에서 적용된 area가 아직 없을 수도 있다"는 뜻이므로 lastQueried를 요구하지 않는다.
//   단 currentBounds는 AND 밖으로 뽑아 **양쪽 경로 공통 전제**로 남긴다 —
//   research()가 currentBoundsRef null이면 no-op이라, 없으면 "눌러도 아무 일도 안 하는 버튼"이 된다.
const researchAvailable =
  status !== 'loading' &&
  currentBounds !== null &&
  (status === 'error' ||
    (lastQueried !== null &&
      exceedsResearchThreshold({ prev: lastQueried.bounds, next: currentBounds })));
```

- 반환 타입·시그니처 변경 **0**(`UseNearbyPlacesResult` 그대로). 소비자(`MapTabScreen`)는 무변경.
- 자기치유 유지: `research()` 성공 → `status='ready'` + `lastQueried=현재 bbox` → drift 0 → 버튼이 스스로 숨는다.
- 실패 후 미세 이동에도 버튼이 남는다(에러 경로는 임계를 보지 않는다) — 의도된 동작. 그게 "복구 어포던스"다.
- 연타 가드(`inFlightRef`)·레이스 가드(`requestSeqRef`)·비용 상한 **불변**.

> ⚠️ **기존 테스트 1건이 이 변경과 정면으로 충돌한다** — `useNearbyPlaces.spec.ts:722` "조회 전에는 뷰포트를 받아도 researchAvailable=false(lastQueried 조건 하중)". 이 테스트가 만드는 상황(첫 조회 실패 + 뷰포트 수신)이 곧 U4가 고치려는 버그다. **테스트를 지우지 말고 §5-1 A2로 재작성**한다(같은 conjunct에 다른 방식으로 하중을 싣는다). qa-logic L2가 이 conjunct를 일부러 잠갔다는 사실을 dev-notes에 남긴다.

### 3.3 U5 — 부팅 여백 (`mapHtml.ts` · `MapTabScreen.tsx` · `tokens.ts` · `MapWebView.tsx`)

**① WebView 내부 CSS** — 킷 `mk-home.jsx:336`의 지도 영역 배경 `#EFEAE3` verbatim.

```css
html, body { margin:0; padding:0; width:100%; height:100%; background: #EFEAE3; }
#map { position:absolute; top:0; left:0; right:0; bottom:0; background: #EFEAE3; }
```

`#map`에도 넣는 이유: `#map`은 뷰포트를 절대배치로 덮으므로(기존 주석 L25-26) body 배경만 칠하면 타일 도착 전 `#map`이 그 위를 투명/기본색으로 덮을 수 있다. 두 곳 모두 명시한다.

**② 로딩 배너 조건** — `MapTabScreen.tsx` `overlay` IIFE의 로딩 분기:

```ts
// 지도 부팅(WebView + Kakao SDK, 실측 ≈1.2s) 동안에도 로딩을 알린다 — 핀은 캐시로 즉시 ready라
//   핀 상태만 보면 부팅 구간이 무통지 흰 화면이 된다(원칙 3).
if (state.status === 'loading' || !mapReady) {
  return { tone: MapStatusTone.Loading, message: MAP_COPY.loading };
}
```

- 카피는 **기존 `MAP_COPY.loading` 재사용**("지도를 불러오는 중이에요"). 신규 카피 0.
- 우선순위는 현행 유지: `mapErrored` → 핀 `error` → **로딩(+`!mapReady`)** → 권한 거부. 지도가 아직 없는데 권한 안내를 먼저 띄우는 건 순서가 뒤집힌 것이므로 로딩이 위다.
- `mapReady`는 `READY` 수신 시 `true`(`MapTabScreen.tsx:229-231`). SDK 실패는 `ERROR` → `mapErrored`가 위에서 가로챈다.

**③ RN 측 지도 톤 배경(신규 토큰)** — WebView가 HTML을 페인트하기 전 첫 프레임은 여전히 RN 뷰 배경(현재 미지정 = 흰색)이다. ①만으로는 그 프레임이 남는다.

```ts
// palette
// 지도 캔버스 배경 — 킷 mk-home.jsx:336 지도 영역 background #EFEAE3(SSOT, --mk-* 변수 아닌 인라인 실값).
//   WebView(mapHtml)는 격리 HTML이라 이 hex를 body/#map에 직박음 — RN 컨테이너 값과 일치시켜
//   부팅 첫 프레임(RN 뷰)→HTML 페인트 사이 흰 점멸을 없앤다(mapNearbyPin·mapWishPin과 동일 패턴).
mapSurface: '#EFEAE3',
// lightColor
mapSurface: palette.mapSurface,   // 라이트/다크 공통(지도 캔버스라 톤 고정) — darkColor가 lightColor를 스프레드하므로 자동 미러
```

적용: `MapWebView` `styles.container`에 `backgroundColor: theme.color.mapSurface`(현재 컴포넌트는 `useTheme` 미사용이므로 훅 도입 필요) **또는** `MapTabScreen` `styles.root`에 인라인 토큰. **결정: `MapWebView` 컨테이너** — 지도 캔버스 소유자가 자기 배경을 갖는 게 맞고, `MapPrewarm`의 숨은 WebView에도 자동 적용된다. 카드·시트가 붙는 `MapTabScreen` root는 무변경.

> 킷 충돌 없음 — 킷이 이미 정의한 값을 RN으로 번역하는 것이므로 킷 변경도, 사용자 승인도 필요 없다.

### 3.4 테스트 인프라 — `createMapSandbox` 확장

U55는 실행 검증이 필수다. 다음을 추가한다(앱 번들 도달 경로 0, `*.spec.*` 미매칭 유지).

```ts
// FakeMap 확장
level: number;                                    // options.level에서 초기화
setLevelCalls: Array<{ level: number; options: unknown }>;
getLevel: () => number;
setLevel: (level: number, options?: unknown) => void;  // level을 갱신하고 호출을 기록

// kakao.maps.event.addListener 확장
//   handler 타입을 (arg?: unknown) => void 로 넓힌다(현재 () => void라 cluster 인자를 못 넘긴다).
//   config.throwOnClusterListener 가 true면 type === 'clusterclick' 등록에서만 throw.

// MapSandbox 신규 표면
/** clusterer 대상으로 등록된 이벤트를 가짜 Cluster와 함께 발화한다. */
fireClusterEvent: (payload: { type: string; center: Coords }) => void;
/** 특정 target·type으로 등록된 리스너 수(중복 등록 회귀 검출용). */
listenerCount: (payload: { type: string }) => number;
```

`fireClusterEvent`는 `{ getCenter: () => LatLng }` 형태의 가짜 `Cluster`를 만들어 넘긴다(문서화된 표면만 모사 — 기존 규율 동일). `ClustererConfig`에 `throwOnClusterListener?: boolean` 추가.

---

## 4. 화면 · UX

| 상태 | 지금 | 이번 스프린트 후 |
|------|------|-----------------|
| 지도 탭 진입 직후(부팅 중) | 흰 여백, 통지 0 | `#EFEAE3` 지도 톤 + 스피너 + "지도를 불러오는 중이에요" |
| 클러스터 버블 탭 | 무애니메이션 즉시 전환 + 해체 재렌더 → 깜박임 | 클러스터 중심 기준 300ms 확대 — 전이가 "여기를 파고든다"를 설명(원칙 4) |
| 첫 주변 조회 실패 | 무음, 재검색 버튼 영영 없음(복구 불가) | 재검색 pill("이 지역에서 검색") 노출 → 탭 시 1회 재조회 |
| 재검색 성공 | — | 핀 갱신 + pill 자동 소멸(drift 0) |
| 재검색 재실패 | — | pill 유지(계속 재시도 가능) |

토큰: 신규 `color.mapSurface`(#EFEAE3) 1종. 그 외 기존 토큰만 사용. 킷 시안 변경 0.

---

## 5. 작업 목록

### T0 — 테스트 인프라 (U55 선행)

- [ ] **T0.** `createMapSandbox`에 `getLevel`/`setLevel`(+`setLevelCalls`)·`fireClusterEvent`·`listenerCount`·`throwOnClusterListener` 추가
      — 인수조건: 기존 mapHtml.spec 전량이 무수정으로 통과하고(순수 추가), 새 표면으로 `clusterclick`을 가짜 `Cluster`와 함께 발화할 수 있다
      — 테스트: T0 자체는 U55 테스트가 사용해 간접 검증(인프라 전용 spec 별도 작성 안 함)

### T1 — U55 클러스터 부드러운 줌인 (원칙 4)

- [ ] **T1-a.** `MK_CLUSTER_OPTIONS`에 `disableClickZoom: true` 추가 + 생성자에 전달, L153의 낡은 주석("disableClickZoom 미설정…") 교체
      — 인수조건: 샌드박스가 만든 클러스터러의 `options.disableClickZoom === true`
      — 테스트: `boot().clusterer?.options.disableClickZoom` (문자열 아닌 **실행** 단언 — 주석이 대신 충족할 수 없다)
- [ ] **T1-b.** `mkClusterZoomIn` 정의 + 생성 분기에서만 `clusterclick` 등록(대입 전 등록)
      — 인수조건: `clusterclick` 1회 발화 → `map.setLevelCalls`가 1건이고 `{ level: 초기레벨-1, options: { anchor: 클러스터중심, animate: { duration: 300 } } }`
      — 테스트: §5-1 U55-1
- [ ] **T1-c.** 재-INIT 시 리스너 중복 등록 0 + 새 Map 대상 동작
      — 인수조건: INIT 2회 후 `clusterclick` 1회 → `setLevel` 총 1회이고 그 호출이 **두 번째** Map 인스턴스에 있다
      — 테스트: §5-1 U55-3·U55-4
- [ ] **T1-d.** 리스너 등록 실패 시 강등(클러스터 0 + 개별 핀)
      — 인수조건: `throwOnClusterListener` → `clusterMode === 'none'`, 핀 전량 `setMap(mkMap)` 부착, `ERROR` post 0
      — 테스트: §5-1 U55-6

### T2 — U4 실패 복구 경로 (원칙 10·3)

- [ ] **T2-a.** `researchAvailable`을 §3.2 식으로 교체 + 주석 갱신(4조건 AND → "공통 전제 2 + 택1")
      — 인수조건: 첫 조회 실패(`status==='error'`) + 뷰포트 수신 상태에서 `researchAvailable === true`
      — 테스트: §5-1 U4-1
- [ ] **T2-b.** 기존 spec:722 재작성(§5-1 A2) — `lastQueried` conjunct 하중 유지
      — 인수조건: 에러가 아닌 경로에서 `lastQueried === null`이면 여전히 `false`
      — 테스트: §5-1 A2
- [ ] **T2-c.** `useNearbyPlaces.ts` 파일 헤더 주석의 에러 정책 문장 갱신
      ("lastQueried를 갱신하지 않으므로 버튼이 남는다" → 첫 조회 실패는 lastQueried 자체가 없으므로 `status==='error'`가 노출을 책임진다)
      — 인수조건: 주석과 구현이 일치(문서 부채 0)
      — 테스트: 없음(주석)

### T3 — U5 부팅 여백 (원칙 3)

- [ ] **T3-a.** `mapHtml` `html, body`·`#map`에 `background: #EFEAE3`
      — 인수조건: `cssBlock({selector:'#map'})`와 `html, body` 블록 둘 다 `#EFEAE3`을 포함하고, HTML 전체의 `#EFEAE3` 등장 수가 계약대로다
      — 테스트: §5-1 U5-1
- [ ] **T3-b.** `MapTabScreen` 로딩 분기 조건에 `|| !mapReady`
      — 인수조건: READY 전에는 핀이 `ready`여도 `map-status-spinner` + "지도를 불러오는 중이에요"가 뜨고, READY 후 사라진다
      — 테스트: §5-1 U5-2·U5-3
- [ ] **T3-c.** 기존 MapTabScreen spec 3건 보정(§5-1 B1~B3) — READY 발화 추가
      — 인수조건: 권한 거부 안내·nearby 에러 회귀 테스트가 **READY 이후** 상태를 검증하도록 바뀌고, 핀 로딩 테스트는 READY를 발화해 자기 conjunct에 하중을 유지한다
      — 테스트: §5-1 B1~B3
- [ ] **T3-d.** `tokens.ts`에 `mapSurface: '#EFEAE3'`(palette + lightColor) 추가
      — 인수조건: `themes.light.color.mapSurface === '#EFEAE3'`이고 `themes.dark.color.mapSurface`도 동일
      — 테스트: §5-1 U5-4
- [ ] **T3-e.** `MapWebView` 컨테이너 배경을 `theme.color.mapSurface`로
      — 인수조건: 컨테이너 스타일에 `backgroundColor: '#EFEAE3'`이 적용되고, WebView·오버레이 배치는 불변
      — 테스트: §5-1 U5-5

### T4 — 마무리

- [ ] **T4.** `npm test` 전량 green + 타입체크 통과, dev-notes에 §3.1 SDK 근거·§3.2 테스트 충돌 경위·§7 스모크 이월 기록

---

## 5-1. 테스트 케이스 (TDD)

**경계 원칙(`docs/testing-strategy.md`)**: Kakao SDK 실동작은 단위 대상이 아니다 → `createMapSandbox`는 **문서화된 표면의 모사**이며, 실제 줌 애니메이션 체감·클러스터 해체 렌더는 **디바이스 스모크(§7)가 단독 권위**다. `mapHtml` 문자열 단언은 CSS 실값처럼 실행으로 관측 불가능한 것에만 쓰고, 그때도 블록 추출 + 개수로 잠근다(주석·다른 분기가 대신 충족하지 못하게).

### U55 — `mapHtml.spec.ts` describe('mapHtml 실행') (신규 6)

| # | 유형 | 케이스 | 단언 |
|---|------|--------|------|
| U55-1 | 정상 | 클러스터 탭 1회 | `map.setLevelCalls`가 1건, `level === 초기레벨 - 1`, `options.anchor`가 발화 시 넘긴 중심 좌표, `options.animate.duration === 300` |
| U55-2 | 정상 | 생성자 옵션 | `clusterer.options.disableClickZoom === true` + 기존 5개 옵션 실값 회귀 0 |
| U55-3 | 경계 | INIT 2회(재-INIT) 후 탭 1회 | `listenerCount({type:'clusterclick'}) === 1`, `setLevelCalls` 합계 1건 |
| U55-4 | 경계 | 재-INIT 후 탭 | `setLevel`이 **두 번째** Map(`maps[1]`)에 기록된다(옛 Map `maps[0]`엔 0건) |
| U55-5 | 경계 | 최소 레벨(레벨 1)에서 탭 | `setLevel` 호출 0(하한 클램프로 "같은 레벨 재설정" 자체를 안 한다) |
| U55-6 | 실패 | `throwOnClusterListener` | `clusterMode === 'none'`, 모든 핀 오버레이가 `setMap(mkMap)`으로 부착, `posted`에 `ERROR` 0 |

추가 실패 케이스(기존 강등 경로 회귀): `available:false` / `constructThrows` 상태에서 `fireClusterEvent`를 발화해도 throw 없이 `setLevel` 0 — 클러스터가 없으면 이벤트도 없다는 전제를 방어적으로 잠근다.

### U4 — `useNearbyPlaces.spec.ts` (신규 3 + 재작성 1)

| # | 유형 | 케이스 | 단언 |
|---|------|--------|------|
| U4-1 | 정상 | `searchMock` reject → `setBounds` → settle | `status === 'error'` **이고** `researchAvailable === true` (기존 버그: false) |
| U4-2 | 정상 | 위 상태에서 `research()` → resolve | `searchMock` 2회 호출, `items` 반영, `status === 'ready'`, `researchAvailable === false`(자동 소멸) |
| U4-3 | 경계 | reject 후 `preload`만 하고 `setBounds` 없음 | `status === 'error'`인데 `researchAvailable === false` — `currentBounds` 전제가 AND 밖에 살아있음을 잠근다(뮤턴트: `currentBounds !== null`을 에러 절 안으로 옮기면 red) |
| A2 | 경계(재작성) | 캐시 하이드레이션으로 `status==='ready'` + `setBounds` 직후, **0틱 타이머 flush 전** | `researchAvailable === false` — `lastQueried !== null` conjunct에 하중 유지(뮤턴트: `lastQueried` 절을 통째로 지우면 red) |

> A2는 spec:722를 대체한다. 기존 시나리오(에러+뷰포트)는 U4-1이 정반대 결과를 요구하므로 그대로 둘 수 없다. **주의**: A2는 `status==='loading'` 전 구간을 봐야 하므로 타이머를 수동 제어한다(기존 `settle()`을 그대로 쓰면 조회가 발사돼 `loading`이 되어 다른 conjunct가 대신 false를 만든다 — 그러면 하중이 사라져 테스트가 죽은 단언이 된다).

**회귀 확인 필수(무수정 통과해야 함)**: `T1-c`·`T1-d`(자동 조회 0)·`A3-5`(임계)·`A3-6`(성공 후 소멸)·`A3-7`(연타)·`A3-8`(research 실패 후 재탭)·"뷰포트 미수신이면 선로딩 성공해도 false"·"뷰포트 없으면 research() no-op".

### U5 — `mapHtml.spec.ts` · `MapTabScreen.spec.tsx` · `tokens.spec.ts` · `MapWebView.spec.tsx`

| # | 유형 | 케이스 | 단언 |
|---|------|--------|------|
| U5-1 | 정상 | mapHtml CSS | `cssBlock({selector:'#map'})`에 `background: #EFEAE3`, `html, body` 블록에도 동일. `html.match(/#EFEAE3/g)`의 길이를 실측값으로 고정(주석이 늘어나면 red → 위치가 아니라 개수로 잠근다) |
| U5-2 | 정상 | 핀 `ready` + READY 미발화 | `map-status-spinner` 존재 + "지도를 불러오는 중이에요" 표시 |
| U5-3 | 경계 | 위 상태에서 READY 발화 | 배너 사라짐(`queryByTestId('map-status-overlay')`가 null — 권한 granted 전제) |
| U5-3b | 경계 | READY 후 권한 거부 | 권한 안내 배너가 뜬다(로딩이 영구히 가로채지 않음을 잠근다) |
| U5-4 | 정상 | 토큰 | `themes.light.color.mapSurface === '#EFEAE3'` · `themes.dark.color.mapSurface === '#EFEAE3'` · `!== themes.light.color.bg`(흰색 근사로 되돌아가면 red) |
| U5-5 | 정상 | MapWebView | 컨테이너 스타일에 `backgroundColor: '#EFEAE3'`이 flatten되어 존재 |

### 기존 테스트 보정 (회귀 방지 — 반드시 함께)

| # | 파일:라인 | 지금 | 왜 손대나 | 어떻게 |
|---|-----------|------|----------|--------|
| B1 | `MapTabScreen.spec.tsx:257-261` "권한 거부면 현재위치 안내를 노출하되…" | READY 미발화 | `!mapReady`가 로딩으로 가로채 **깨진다** | `renderWithTheme` 직후 `emitMessage({raw: '{"type":"READY"}'})` 추가 |
| B2 | `MapTabScreen.spec.tsx:384-394` "nearby 에러여도 slice1 오버레이…" | READY 미발화 | 동일하게 **깨진다** | 동일하게 READY 발화 추가 |
| B3 | `MapTabScreen.spec.tsx:245-250` "핀 loading이면 로딩 오버레이를 띄운다" | READY 미발화 | 깨지진 않지만 **`!mapReady`가 대신 충족**시켜 `state.status==='loading'` 단언이 죽는다(메모리: 문자열/조건 단언은 다른 항이 대신 충족시키면 죽는다) | READY 발화 후에도 로딩 배너가 뜨는지로 바꿔 핀 로딩 conjunct에 하중 유지 |

> B1~B3 외에 READY를 발화하지 않는 테스트들은 오버레이를 단언하지 않으므로(범례·마커탭·비JSON 무시 등) 영향 없다. 실행 후 실제 실패 목록으로 교차 확인할 것.

---

## 6. 엣지케이스

| # | 상황 | 기대 동작 | 어디서 잠그나 |
|---|------|----------|--------------|
| E1 | 클러스터러 강등 상태(라이브러리 미로드·생성 실패)에서 클러스터 탭 | 클러스터 자체가 없으므로 이벤트 없음. 강제로 발화해도 throw 0·`setLevel` 0 | U55 추가 실패 케이스 |
| E2 | `addListener` 실패 | `mkClusterer=null` → 개별 핀 강등. **탭 죽은 클러스터가 존재할 수 없다** | U55-6 |
| E3 | 재-INIT(지도 에러 배너 "다시 시도") 후 클러스터 탭 | 새 Map에 `setLevel`. 리스너 중복 0 | U55-3·U55-4 |
| E4 | 최대 확대(레벨 1)에서 탭 | no-op(`minLevel:2`라 클러스터가 생기지 않지만 방어) | U55-5 |
| E5 | 프리워밍이 잘 들어 READY가 매우 빠름 | 로딩 배너가 짧게 스쳐 또 다른 깜박임이 된다 | **단위로 못 본다** → §7 S6. 관측되면 `useDeferredFlag({delayMs:250}) && !mapReady`로 후속(이번 스프린트 out-of-scope) |
| E6 | READY도 ERROR도 영영 안 옴(조용한 실패) | 로딩 배너가 영구 잔류 | 알려진 한계. U10(실패 배너) 대상. dev-notes에 명시 |
| E7 | 커플 두 명이 동시에 같은 지역에서 재검색 | 각자 로컬 캐시·조회라 상호작용 0(공유 상태 없음) | 해당 없음(검증 불필요) |
| E8 | 오프라인에서 탭 진입 | 선로딩 실패 → `status='error'` → 첫 뷰포트 수신 후 pill 노출 → 탭마다 재시도 | U4-1·U4-2 |
| E9 | 실패 직후 사용자가 지도를 크게 팬 | pill 유지(에러 경로는 임계 무시), `research()`는 **현재** bbox로 조회 | `research()`가 `currentBoundsRef`를 읽으므로 자동 충족. U4-2에서 확인 |
| E10 | 실패 후 재검색 성공 → 다시 실패 | pill 유지(status='error') | 기존 A3-8 + U4-1 조합 |
| E11 | 다크 모드 | 지도 캔버스 톤은 라이트/다크 공통(`mapNearbyPin` 선례) | U5-4 |
| E12 | 클러스터 탭이 지도 배경 click으로 새어 `MAP_TAP` → 선택 해제 | 미확정(클러스터 버블은 마커 관리 오버레이라 map click을 안 탈 가능성이 높다) | **단위로 못 본다** → §7 S4에서 관측만 하고, 해제되더라도 이번 스프린트에선 수정하지 않는다 |

---

## 7. QA 교차검증 경계면

**qa-logic (병렬)** — 생산자↔소비자 양쪽을 같이 읽을 쌍:

1. `mapHtml.ts` `ensureClusterer`(생성·리스너 등록) ↔ `mkClusterZoomIn`(모듈 변수 `mkMap` 참조) ↔ `__muklogInit`(mkMap 교체) — 재-INIT 후 옛 지도를 잡고 있지 않은가
2. `mapHtml.ts` 강등 경로(`demoteClusterer`·`applyOverlayDelta` catch) ↔ 신규 리스너 — 강등 후 리스너가 살아 있어도 부작용이 없는가
3. `useNearbyPlaces.researchAvailable`(생산, `useNearbyPlaces.ts:413-417`) ↔ 재검색 pill 렌더(소비, `MapTabScreen.tsx:424-434`) ↔ `research()`의 `currentBoundsRef` 가드 — **노출 조건과 실행 가능 조건이 어긋나지 않는가**(눌러도 no-op인 버튼 0)
4. `useNearbyPlaces` 에러 경로 ↔ 비용 상한(자동 invoke ≤2) — U4가 자동 조회를 늘리지 않았는가
5. `MapTabScreen` `overlay` 우선순위 사슬(mapErrored → 핀 error → 로딩+!mapReady → 권한) ↔ `mapReady` 배선(`MapInboundType.Ready`)
6. `createMapSandbox` 확장 ↔ `mapHtml` 실제 코드 — 샌드박스가 실제로 없는 API를 모사해 테스트만 통과시키고 있지 않은가(§3.1 표의 문서 근거와 대조)
7. `mapHtml.spec` 문자열 단언 ↔ 주석/다른 분기 — **뮤테이션으로 확인**: `disableClickZoom` 주석만 남기고 옵션을 지웠을 때 red인가, `background:#EFEAE3`를 한 곳만 지웠을 때 red인가

**qa-visual (병렬)** — 킷 대조:

1. 킷 `templates/muklog/mk-home.jsx:336`(지도 영역 `background:#EFEAE3`) ↔ `tokens.mapSurface` ↔ `mapHtml` CSS ↔ `MapWebView` 컨테이너 — **네 곳의 값이 전부 같은가**
2. 로딩 배너(`MapStatusOverlay` Loading tone) 시안 정합 — 부팅 구간에도 기존 배너 컴포넌트·카피를 그대로 쓰는가(신규 비주얼 0)
3. 클러스터 버블 실값 회귀 0(`map-clustering` §3.4 계약 — 색·크기·그림자·경계)

**디바이스 스모크(실기기 — QA는 렌더 픽셀을 볼 수 없다. 이 항목들이 단독 권위)**

| # | 항목 | 합격 기준 |
|---|------|----------|
| S1 | 클러스터 버블 탭 | **깜박임 없이** 클러스터 중심 방향으로 부드럽게 확대된다(사용자 리포트 재현 시나리오 그대로) |
| S2 | 300ms 체감 | 느리게 끌리지도, 툭 끊기지도 않는다. 애니메이션이 실제로 걸리는가(레벨 차 1이라 문서상 가능) |
| S3 | 탭 반복 | 2~3회 탭으로 클러스터가 풀린다. 답답하면 `MK_CLUSTER_ZOOM_STEP`을 2로(그때도 애니메이션 유지) |
| S4 | 클러스터 탭 시 선택 카드 | 열려 있던 스팟 카드가 사라지는지 관측(E12 — 수정 대상 아님, 기록만) |
| S5 | 지도 탭 진입 | 흰 여백이 보이지 않고 지도 톤 + 로딩 배너 → 지도로 전환된다 |
| S6 | 배너 지속시간 | 배너가 300ms 미만으로 깜박이면 E5 후속 트리거 |
| S7 | 오프라인 진입 → 온라인 복귀 | pill이 뜨고, 탭하면 주변 핀이 채워진다(U4 실사용 경로) |
| S8 | 재-INIT(지도 에러 → 다시 시도) 후 클러스터 탭 | 정상 확대(E3 실환경 확인) |

---

## 8. 비용 가드레일 체크

| 항목 | 영향 |
|------|------|
| Kakao Local(`nearby-search` Edge Function) 호출 | **증가 0.** U55 확대는 WebView 로컬 계산이고, 그로 인한 `idle`→`BOUNDS_CHANGED`는 `map-pin-loading` 모델에서 네트워크를 태우지 않는다(`setBounds`는 통지일 뿐) |
| 자동(사용자 액션 없는) invoke 상한 | **불변 2회**(선로딩 1 + 보정 1). U4는 **사용자 탭 경로만** 연다 — 실패해도 자동 재시도는 하지 않는다 |
| Kakao Map SDK 다운로드 | 불변(`libraries=clusterer` 그대로, URL 무변경) |
| Supabase(DB·RPC·Storage·Realtime·Edge Function) | **0건.** 마이그레이션·RLS 변경 없음 |
| 폴링·타이머·리스너 | 신규 타이머 0. 신규 리스너는 WebView 내부 `clusterclick` 1개(클러스터러당 1회, 재-INIT에서 증가하지 않음) |
| 이미지 압축·번들 | 해당 없음(신규 에셋 0, 신규 의존성 0) |
| AWS | 미사용 |

---

## 9. 완료 기준

- [ ] `npm test` 전량 green(기존 회귀 0 — 특히 `map-clustering`·`map-pin-loading` 계약 테스트)
- [ ] §5-1 신규 케이스 전부 작성·통과, §5-1 "기존 테스트 보정" B1~B3 반영
- [ ] qa-logic 리포트(`qa-report-logic.md`) · qa-visual 리포트(`qa-report-visual.md`) 통과
- [ ] `dev-notes.md`에 SDK API 근거(§3.1)·spec:722 충돌 경위(§3.2)·디바이스 스모크 이월(S1~S8) 기록
- [ ] `docs/ux/ux-backlog.md`의 U55·U4·U5 상태를 `완료(sprint-20260825-map-feedback)`로 갱신
- [ ] `docs/design/architecture.md` 스프린트 표에 항목 추가(§4 지도 탭 상태·§비용 가드레일 불변 명시)
